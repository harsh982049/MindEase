# services/priority_llm_service.py

import os
import json
from typing import Any, Dict, List, Optional

import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PRIORITY_LLM_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    # You can also choose to raise here if you want hard failure
    print("[priority_llm_service] WARNING: GEMINI_API_KEY not set, LLM calls will fail.")


def _call_gemini_json(prompt: str) -> Dict[str, Any]:
    """
    Helper to call Gemini and parse JSON response safely.
    We ask the model to RESPOND ONLY WITH JSON.
    """
    model = genai.GenerativeModel(PRIORITY_LLM_MODEL)
    resp = model.generate_content(prompt)
    text = (getattr(resp, "text", None) or "").strip()

    # Sometimes model wraps JSON in ```json ... ```
    if text.startswith("```"):
        # Strip leading and trailing backticks
        text = text.strip("`").strip()
        # Remove optional "json" header
        if text.lower().startswith("json"):
            text = text[4:].strip()

    try:
        return json.loads(text)
    except Exception as e:
        print("[priority_llm_service] JSON parse failed:", e, "Raw:", text[:500])
        raise


# ---------- Stage 1: Per-task understanding ----------


def analyze_task_with_llm(task: Dict[str, Any]) -> Dict[str, Any]:
    """
    Input: task dict with keys like: title, description, deadline_ts (ISO or None)
    Output: {
        "importance": int 1-5,
        "stress_cost": int 1-5,
        "energy_requirement": "low"|"medium"|"high",
        "estimated_minutes": int,
        "category": str
    }
    """
    title = task.get("title", "")
    description = task.get("description") or ""
    deadline_ts = task.get("deadline_ts")

    deadline_str = str(deadline_ts) if deadline_ts else "no explicit deadline"

    prompt = f"""
You are helping a student/working professional prioritize tasks.

Task details:
- Title: {title!r}
- Description: {description!r}
- Deadline: {deadline_str}

Return a JSON object with these exact keys:
- "importance": integer from 1 to 5 (1 = trivial, 5 = extremely important for goals/career/grades)
- "stress_cost": integer from 1 to 5 (1 = very light, 5 = very mentally/emotionally heavy)
- "energy_requirement": one of "low", "medium", "high" (how much focus/brainpower is needed)
- "estimated_minutes": integer, rough time to complete in minutes (15, 30, 45, 60, 90, 120, etc.)
- "category": one of "deep_work", "admin", "communication", "personal", "study", or "other"

Respond ONLY with valid JSON, no explanation.
    """.strip()

    raw = _call_gemini_json(prompt)

    # Basic validation + defaults
    importance = int(raw.get("importance", 3))
    importance = max(1, min(5, importance))

    stress_cost = int(raw.get("stress_cost", 3))
    stress_cost = max(1, min(5, stress_cost))

    energy_req = str(raw.get("energy_requirement", "medium")).lower()
    if energy_req not in {"low", "medium", "high"}:
        energy_req = "medium"

    est_min = int(raw.get("estimated_minutes", 30))
    if est_min <= 0:
        est_min = 30

    category = str(raw.get("category", "other")).lower()

    return {
        "importance": importance,
        "stress_cost": stress_cost,
        "energy_requirement": energy_req,
        "estimated_minutes": est_min,
        "category": category,
    }


def generate_task_steps_with_llm(
    task: Dict[str, Any],
    relax_prefs: Optional[Dict[str, Any]] = None,
    include_break_suggestions: bool = False,
) -> List[Dict[str, Any]]:
    """
    Given a task (title, description, optional category), generate
    a small, actionable step-by-step plan.

    Optionally, this can also weave in MICRO-BREAK suggestions between steps,
    tailored to the user's relaxation preferences (games, music, breathing, etc.).

    Returns a list like:
    [
      {
        "step_number": 1,
        "instruction": "...",          # Work step OR short break, see note below
        "estimated_minutes": 10,
        "notes": "...",
        "links": ["https://..."]
      },
      ...
    ]

    If include_break_suggestions=True, the model is allowed to insert short
    break steps. By convention we ask it to start those instructions with
    "Break:" (e.g. "Break: listen to a calming playlist on Spotify").
    """
    title = task.get("title", "") or ""
    description = task.get("description") or ""
    category = (task.get("ai_category") or task.get("category") or "other").lower()

    relax_str = (
        "None provided"
        if not relax_prefs
        else json.dumps(relax_prefs, ensure_ascii=False)
    )

    break_instructions = ""
    if include_break_suggestions:
        break_instructions = """
You are ALSO allowed to insert SHORT BREAK steps between work steps
to help the user de-stress. Follow these rules:

- Use the user's relaxation preferences when proposing breaks.
- A break step should:
  - Have an "instruction" starting with "Break:" (e.g. "Break: listen to a 5-minute lo-fi playlist on YouTube").
  - Have "estimated_minutes" between 5 and 20.
  - Optionally include helpful "links" (e.g. YouTube playlist, breathing exercise site, light web game).
- Do NOT make more break time than work time overall.
- Only insert breaks when they make sense (e.g. after 1–2 intense work steps).
        """.strip()

    prompt = f"""
You are an assistant helping a student/working professional execute tasks.

TASK:
- Title: {title!r}
- Description: {description!r}
- Category (rough): {category!r}

User relaxation preferences (for optional micro-breaks):
{relax_str}

Break the main task into 3 to 8 CONCRETE, ACTIONABLE steps.
Each WORK step should be something the user can actually do in 5–45 minutes.

{break_instructions}

Return ONLY a JSON array. Each element MUST be an object with:

- "step_number": integer >= 1, in execution order
- "instruction": short, imperative sentence describing the action
  - For WORK steps: a clear action on the task.
  - For BREAK steps (if any): start the instruction with "Break:" and describe the relaxing activity.
- "estimated_minutes": integer estimate for this step (5, 10, 15, 20, 30, 45, etc.)
- "notes": optional short extra hint or context (string, can be empty)
- "links": optional array of helpful URLs (can be empty)

Example JSON format (structure only):

[
  {{
    "step_number": 1,
    "instruction": "Do something important",
    "estimated_minutes": 15,
    "notes": "",
    "links": []
  }}
]

Respond ONLY with valid JSON. No explanation, no markdown.
    """.strip()

    raw = _call_gemini_json(prompt)

    if not isinstance(raw, list):
        raise ValueError("Expected a JSON array for steps, got: %r" % type(raw))

    steps: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            num = int(item.get("step_number", len(steps) + 1))
        except Exception:
            num = len(steps) + 1

        instr = str(item.get("instruction") or "").strip()
        if not instr:
            continue

        try:
            est = int(item.get("estimated_minutes", 10))
        except Exception:
            est = 10
        # Clamp 5–180 minutes to avoid crazy values
        est = max(5, min(est, 180))

        notes = (item.get("notes") or "").strip()
        links = item.get("links") or []
        if not isinstance(links, list):
            links = []

        steps.append(
            {
                "step_number": num,
                "instruction": instr,
                "estimated_minutes": est,
                "notes": notes,
                "links": links,
            }
        )

    # Sort by step_number to be safe
    steps.sort(key=lambda s: s["step_number"])
    return steps


# ---------- Stage 2: Global prioritization & scheduling ----------


def prioritize_tasks_with_llm(
    user_ctx: Dict[str, Any],
    tasks: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Input:
      user_ctx: {
        "current_datetime": "2025-11-15T08:35:00+05:30",
        "morning_energy": int,
        "afternoon_energy": int,
        "evening_energy": int,
        "today_available_minutes": int,

        # Optional, for multi-day, stress-aware planning:
        "planning_horizon_days": int,       # e.g. 1 (today only), 3, 7
        "multi_day": bool,                  # if True, allow distribution across days
        "relax_prefs": { ... },             # same shape you store in priority_relax_prefs
        "feedback_type": str | null         # e.g. "too_packed", "needs_more_breaks", "very_stressed"
      }

      tasks: list of dicts, each with at least:
        id, title, description,
        status, deadline_label, days_to_deadline,
        ai_importance, ai_stress_cost, ai_energy_requirement,
        ai_estimated_minutes, ai_category, previously_deprioritized (bool)

    Output JSON from model (multi-day aware but backward compatible):

    {
      "plan_summary": str,
      "tasks": [
        {
          "id": "...",
          "priority_rank": 1,
          "bucket": "now" | "next" | "later" | "backlog",
          "reason": str,
          "final_estimated_minutes": int,

          # Optional (for multi-day scheduling):
          "planned_for_date": "YYYY-MM-DD" | null,
          "planned_for_minutes": int | null
        },
        ...
      ]
    }

    Notes on behavior:

    - If multi_day is False or missing, the assistant plans for TODAY only,
      similar to the original behavior.

    - If multi_day is True and planning_horizon_days is provided, the assistant
      is allowed to DISTRIBUTE work over the next N days, starting from
      current_datetime's date, and should:
        * Respect deadlines.
        * Avoid overloading any single day.
        * Prefer to keep today's total minutes within today's available
          minutes (today_available_minutes), or at most ~20% above.
        * When today's focus time is too small for all urgent tasks,
          select the most critical subset for today and push others to
          upcoming days within the horizon.

    - "planned_for_date" and "planned_for_minutes" are intended to be written
      into Supabase columns:
        - priority_tasks.planned_for_date
        - priority_tasks.planned_for_minutes
    """
    if not tasks:
        return {"plan_summary": "No tasks to prioritize.", "tasks": []}

    # Keep prompt compact by including only needed fields
    tasks_str = json.dumps(tasks, ensure_ascii=False)
    ctx_str = json.dumps(user_ctx, ensure_ascii=False)

    multi_day = bool(user_ctx.get("multi_day"))
    planning_horizon_days = user_ctx.get("planning_horizon_days")

    # High-level explanation for the model about mode selection
    mode_explanation = ""
    if multi_day and isinstance(planning_horizon_days, int) and planning_horizon_days > 1:
        mode_explanation = f"""
You are in MULTI-DAY MODE.

- You may schedule tasks across the next {planning_horizon_days} days,
  starting from the date in user_ctx["current_datetime"].
- For each task, you may choose which single day within this horizon it is
  primarily worked on.
- You must output "planned_for_date" (YYYY-MM-DD) and "planned_for_minutes"
  for each task, indicating how many minutes of focused work are realistically
  planned on that day.
- Try to keep the total planned_for_minutes for EACH day within that day's
  realistic capacity:
    - For TODAY, the capacity is approximately user_ctx["today_available_minutes"].
    - For FUTURE days, assume a similar capacity unless clearly impossible.
- If the total time of all high-importance, near-deadline tasks exceeds
  today's capacity, pick the most critical subset for today and push the rest
  to later days within the horizon. Mention this in the "reason" field.
        """.strip()
    else:
        mode_explanation = """
You are in SINGLE-DAY MODE (TODAY ONLY).

- Focus only on planning for TODAY.
- You do NOT need to output "planned_for_date" or "planned_for_minutes",
  but if you choose to, use today's date and realistic minutes.
        """.strip()

    prompt = f"""
You are an AI task prioritization and light scheduling assistant.

Your user is overwhelmed with tasks. You will receive:
1) "user_ctx": energy pattern, time budget and planning horizon.
2) "tasks": a JSON list of tasks with AI-understood attributes.

{mode_explanation}

General constraints:
- Focus on tasks with deadlines today/soon and high importance.
- Consider stress_cost and energy_requirement vs user's energy across the day.
- Avoid planning more total minutes for any given day than that day's available
  minutes by more than ~20%.
- Avoid stacking many very-high-stress tasks back-to-back if possible.
- When the user has indicated they are very stressed (e.g. feedback_type is
  "very_stressed" or "too_packed"), prefer to:
    - Reduce today's load slightly.
    - Move non-urgent work to later days (if in multi-day mode).
    - Mention this explicitly in the "reason".

Use four main buckets:
  - "now": do these first today.
  - "next": later today, if time/energy remains.
  - "later": not today, but still scheduled within the horizon.
  - "backlog": far future / someday or not currently scheduled.

Input JSON:

"user_ctx":
{ctx_str}

"tasks":
{tasks_str}

Return a single JSON object with:
- "plan_summary": short natural language summary of the plan (1–3 sentences).
- "tasks": array of objects, one per task you considered, with keys:
   - "id": same id as input
   - "priority_rank": integer (1 = highest priority)
   - "bucket": "now" | "next" | "later" | "backlog"
   - "reason": one-sentence explanation of why this task is in this bucket and position
   - "final_estimated_minutes": integer, your best estimate for how long
     the user should realistically work on this task on its planned day
   - "planned_for_date": optional, string "YYYY-MM-DD" indicating the main day
     of work for this task (especially in multi-day mode)
   - "planned_for_minutes": optional, integer minutes planned on that date

Every input task must appear exactly once in the "tasks" array.

Respond ONLY with valid JSON, no extra commentary.
    """.strip()

    raw = _call_gemini_json(prompt)

    # Basic sanity checks
    if "tasks" not in raw or not isinstance(raw["tasks"], list):
        raise ValueError("LLM did not return 'tasks' list")

    return raw
