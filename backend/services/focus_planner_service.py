import os
import json
import re
from typing import List, Dict, Any, Annotated, Optional
from pydantic import BaseModel, Field, ValidationError

import google.generativeai as genai

# ---------- Config ----------
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")  # safe default


# ---------- Schemas ----------


class Step(BaseModel):
    """
    Single step in a focus block. This is what we store in the `subtasks` row
    as `steps_json`. We keep this schema EXACTLY compatible with the existing DB:
    no new columns, no breaking changes.

    A *break* step is represented simply as another Step whose `title` starts
    with "Break:" and whose `definition_of_done` explains the relaxing activity.
    """
    idx: Annotated[int, Field(ge=1)]
    title: Annotated[str, Field(min_length=3)]
    definition_of_done: Annotated[str, Field(min_length=3)]
    estimate_min: Annotated[int, Field(gt=0, le=180)]


class Plan(BaseModel):
    steps: List[Step]


class MicroStep(BaseModel):
    """
    Finer-grained "micro" steps used if we ever need to slice a big step into
    very small time slices. These are stored as JSON inside the same DB column
    (no schema change required).

    We now allow an optional `links` list so the LLM can attach helpful URLs
    for that micro-step (e.g., YouTube playlist, small game, breathing guide).
    """
    title: Annotated[str, Field(min_length=3)]
    definition_of_done: Annotated[str, Field(min_length=3)]
    estimate_min: Annotated[int, Field(gt=0, le=30)]
    links: Optional[List[str]] = Field(default=None)


class MicroPlan(BaseModel):
    micro_steps: List[MicroStep]


# ---------- System prompts ----------

PLANNER_SYSTEM = """
You are a precise planning assistant for ONE deep-work focus session.

You will receive:
- a GOAL (what the user wants to accomplish in this session),
- a timebox in minutes (timebox_min),
- a "constraints" object which may include:
  - calendar / timing information, and
  - an optional "relax_prefs" object describing what helps the user de-stress.

Your job:
- Break the goal into a small sequence of concrete steps that can be executed
  in this single session.
- If the timebox is fairly long AND relaxation preferences are provided,
  weave in SHORT BREAK steps so the session supports stress relief.

Return ONLY valid JSON using this exact schema:

{
  "steps": [
    {
      "idx": 1,
      "title": "Write the outline for the section",
      "definition_of_done": "Outline has the 4 key subsections, each with 2–3 bullet points.",
      "estimate_min": 25
    },
    ...
  ]
}

Rules:
1. Aim for 3–7 steps in total. For very long sessions (>= 120 minutes), lean
   towards more steps; for short sessions (<= 45 minutes), 3–4 is enough.
2. The sum of all estimate_min values MUST be:
   - <= timebox_min + 10%
   - and > timebox_min * 0.6 (do not under-plan).
3. Steps must be ACTIONABLE, not vague. Each should be something the user can
   complete in 10–60 minutes.
4. If constraints.relax_prefs exists and timebox_min >= 60:
   - Insert at least one SHORT BREAK step in the middle of the sequence.
   - For breaks:
     - The step title MUST start with "Break:" (e.g. "Break: 10 minutes of lo-fi music").
     - estimate_min should be between 5 and 20 minutes.
     - Use relax_prefs to choose the activity:
       - likes_games: light web game or puzzle.
       - likes_music: calming music or playlist.
       - likes_breathing: short breathing exercise.
       - likes_walking: short walk / stretch.
       - likes_chatting: mindful check-in with a friend.
       - custom_text: can further personalize the suggestion.
     - You MAY embed concrete URLs directly inside definition_of_done, but
       there is no separate field for links at this level.
   - Do NOT let breaks dominate the plan; the majority of steps must be work.
5. If constraints.relax_prefs is missing OR timebox_min < 60:
   - You may still include a single short break if it feels natural, but it is
     optional.
6. Use simple, student-friendly language.
7. Never include comments or explanations outside the JSON structure.
""".strip()


MICRO_SYSTEM = """
You are a micro-planning assistant. The user already has a single Step from a
larger focus session (for example: "Write the rough draft for subsection 2").
We now want to break that step into very small "micro-steps".

Return ONLY valid JSON of the form:

{
  "micro_steps": [
    {
      "title": "Clarify the key argument",
      "definition_of_done": "Write 3 bullet points that summarize the argument.",
      "estimate_min": 10,
      "links": ["https://example.com/resource1"]
    },
    ...
  ]
}

Rules:
1. 3–6 micro-steps is usually enough.
2. Each micro-step should take between 5 and 20 minutes.
3. If the original step or context suggests the user is stressed or short on
   time, you may include 1 short "Break:" micro-step (similar convention as in
   the main planner).
4. The optional "links" field can be used to attach helpful URLs (learning
   resources, playlists, etc.). It can also be omitted.
5. The total of the estimate_min values should roughly match the available
   remaining time for this step (within ±20%).
6. Use plain, friendly language.
""".strip()


# ---------- Helpers ----------


def _extract_json(text: str) -> Dict[str, Any]:
    """
    Extract the first top-level JSON object/array from a model's text response.
    We defensively:
      - strip Markdown fences (```json ... ```),
      - use a regex to capture the outermost JSON structure,
      - then json.loads it.
    """
    if not text:
        raise ValueError("Empty response from model")

    # Strip markdown code fences if present
    text = text.strip()
    if text.startswith("```"):
        # Remove leading and trailing backticks block
        text = text.strip("`").strip()
        # Remove optional "json" language hint
        if text.lower().startswith("json"):
            text = text[4:].strip()

    # Try direct JSON parse first
    try:
        return json.loads(text)
    except Exception:
        pass

    # Fallback: find first {...} or [...] block via regex
    match = re.search(r"(\{.*\}|\[.*\])", text, flags=re.DOTALL)
    if not match:
        raise ValueError(f"Could not find JSON in: {text[:200]}...")

    candidate = match.group(1)
    return json.loads(candidate)


def _make_model(system_instruction: str) -> genai.GenerativeModel:
    """
    Create a Gemini model instance with a given system instruction and
    conservative generation settings (we want reliability over creativity).
    """
    return genai.GenerativeModel(
        model_name=MODEL_NAME,
        system_instruction=system_instruction,
        generation_config={
            "temperature": 0.25,
            "top_p": 0.9,
            "top_k": 32,
        },
    )


# ---------- Public API ----------


def plan_subtasks(goal: str, timebox_min: int, constraints: Dict[str, Any]) -> Plan:
    """
    Main entry point: used by /api/focus/task/create in app.py.

    Args:
        goal:         Human-readable goal for this focus session (task title).
        timebox_min:  Total minutes user wants to spend in this block.
        constraints:  Arbitrary dict coming from the frontend. May include:
                      - workday start/end, etc.
                      - "relax_prefs" with fields like likes_music, likes_games, etc.

    Returns:
        Plan pydantic model with a `steps` list.

    The presence of constraints["relax_prefs"] + a reasonably large timebox
    (>= 60 minutes) will cause the model to insert at least one BREAK step
    whose title starts with "Break:".
    """
    if timebox_min <= 0:
        raise ValueError("timebox_min must be > 0")

    model = _make_model(PLANNER_SYSTEM)

    # Keep constraints compact in the prompt; relax_prefs may be nested
    relax_prefs = constraints.get("relax_prefs")
    # We pass the entire constraints object for completeness; the system prompt
    # knows how to interpret relax_prefs if present.
    payload = {
        "goal": goal,
        "timebox_min": timebox_min,
        "constraints": constraints,
    }
    if relax_prefs is not None:
        payload["relax_prefs_present"] = True

    user_prompt = json.dumps(payload, ensure_ascii=False, indent=2)

    resp = model.generate_content(user_prompt)
    text = (getattr(resp, "text", None) or "").strip()
    raw = _extract_json(text)

    try:
        plan = Plan.model_validate(raw)
    except ValidationError as ve:
        # Log + raise so caller can decide fallback behaviour
        print("[focus_planner_service] Plan validation failed:", ve)
        raise

    # Extra safety: clamp total time if model overshot
    total_est = sum(s.estimate_min for s in plan.steps)
    if total_est > int(timebox_min * 1.3):
        factor = (timebox_min * 1.1) / max(total_est, 1)
        new_steps: List[Step] = []
        for s in plan.steps:
            new_est = max(5, int(round(s.estimate_min * factor)))
            if new_est > 180:
                new_est = 180
            new_steps.append(
                Step(
                    idx=s.idx,
                    title=s.title,
                    definition_of_done=s.definition_of_done,
                    estimate_min=new_est,
                )
            )
        plan = Plan(steps=new_steps)

    return plan


def split_blocked_task_to_microsteps(
    goal: str,
    notes: str,
    remaining_time_min: int,
    extra_context: Optional[Dict[str, Any]] = None,
) -> MicroPlan:
    """
    Optional helper for further slicing a single Step into smaller micro-steps.
    Currently not wired into the main focus companion flow, but kept here for
    completeness and future extensions.

    Args:
        goal:               The original step/goal we are micro-planning.
        notes:              Any notes, context, or constraints from the system.
        remaining_time_min: Available minutes to distribute across micro-steps.
        extra_context:      Optional dict, e.g. could include relax_prefs later.

    Returns:
        MicroPlan with micro_steps including optional `links`.
    """
    if remaining_time_min <= 0:
        raise ValueError("remaining_time_min must be > 0")

    model = _make_model(MICRO_SYSTEM)
    payload = {
        "goal": goal,
        "notes": notes,
        "remaining_time_min": remaining_time_min,
        "extra_context": extra_context or {},
    }
    user_prompt = json.dumps(payload, ensure_ascii=False, indent=2)

    resp = model.generate_content(user_prompt)
    text = (getattr(resp, "text", None) or "").strip()
    raw = _extract_json(text)

    try:
        plan = MicroPlan.model_validate(raw)
    except ValidationError as ve:
        print("[focus_planner_service] MicroPlan validation failed:", ve)
        raise

    # Clamp overshoot if needed
    total_est = sum(s.estimate_min for s in plan.micro_steps)
    if total_est > int(remaining_time_min * 1.4):
        factor = (remaining_time_min * 1.1) / max(total_est, 1)
        new_steps: List[MicroStep] = []
        for s in plan.micro_steps:
            new_est = max(5, int(round(s.estimate_min * factor)))
            if new_est > 30:
                new_est = 30
            new_steps.append(
                MicroStep(
                    title=s.title,
                    definition_of_done=s.definition_of_done,
                    estimate_min=new_est,
                    links=s.links,
                )
            )
        plan = MicroPlan(micro_steps=new_steps)

    return plan
