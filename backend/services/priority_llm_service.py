# services/priority_llm_service.py

import os
import json
from typing import Any, Dict, List, Tuple

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
    text = (resp.text or "").strip()
    # Sometimes model wraps JSON in ```json ... ```
    if text.startswith("```"):
        text = text.strip("`")
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

def generate_task_steps_with_llm(task: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Given a task (title, description, optional category), generate
    a small, actionable step-by-step plan.

    Returns a list like:
    [
      {
        "step_number": 1,
        "instruction": "...",
        "estimated_minutes": 10,
        "notes": "...",
        "links": ["https://..."]
      },
      ...
    ]
    """
    title = task.get("title", "") or ""
    description = task.get("description") or ""
    category = (task.get("ai_category") or task.get("category") or "other").lower()

    prompt = f"""
You are an assistant helping a student/working professional execute tasks.

TASK:
- Title: {title!r}
- Description: {description!r}
- Category (rough): {category!r}

Break this task into 3 to 8 CONCRETE, ACTIONABLE steps.
Each step should be something the user can actually do in 5–45 minutes.

Return ONLY a JSON array. Each element MUST be an object with:

- "step_number": integer >= 1, in execution order
- "instruction": short, imperative sentence describing the action (e.g. "Open IRCTC website and log in")
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
        est = max(5, min(est, 180))  # clamp 5–180 minutes

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

# ---------- Stage 2: Global prioritization ----------

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
        "today_available_minutes": int
      }
      tasks: list of dicts, each with:
        id, title, description, status, deadline_label, days_to_deadline,
        ai_importance, ai_stress_cost, ai_energy_requirement,
        ai_estimated_minutes, ai_category, previously_deprioritized (bool)

    Output JSON from model:
    {
      "plan_summary": str,
      "tasks": [
        {
          "id": "...",
          "priority_rank": 1,
          "bucket": "now"|"next"|"later"|"backlog",
          "reason": str,
          "final_estimated_minutes": int
        }, ...
      ]
    }
    """
    if not tasks:
        return {"plan_summary": "No tasks to prioritize.", "tasks": []}

    # Keep prompt compact by including only needed fields
    tasks_str = json.dumps(tasks, ensure_ascii=False)

    ctx_str = json.dumps(user_ctx, ensure_ascii=False)

    prompt = f"""
You are an AI task prioritization assistant.

Your user is overwhelmed with tasks. You will receive:
1) "user_ctx": energy pattern and time budget for TODAY.
2) "tasks": a JSON list of tasks with AI-understood attributes.

Your goal: select and order a realistic plan for TODAY.
Constraints:
- Focus on tasks with deadlines today/soon and high importance.
- Consider stress_cost and energy_requirement vs user's energy.
- Avoid planning more total minutes than today's available minutes by more than ~20%.
- Avoid stacking many very-high-stress tasks back-to-back if possible.
- Use three main buckets:
  - "now": do these first today.
  - "next": later today, if time/energy remains.
  - "later": not today, but keep visible.
  - "backlog": far future / someday.

Input JSON:

"user_ctx":
{ctx_str}

"tasks":
{tasks_str}

Return a single JSON object with:
- "plan_summary": short natural language summary of today's focus (1–2 sentences).
- "tasks": array of objects, one per task you considered, with keys:
   - "id": same id as input
   - "priority_rank": integer (1 = highest priority)
   - "bucket": "now" | "next" | "later" | "backlog"
   - "reason": one-sentence explanation of why this task is in this bucket and position
   - "final_estimated_minutes": integer, your best estimate for how long it will take today

Every input task must appear exactly once in the "tasks" array.
Respond ONLY with valid JSON, no extra commentary.
    """.strip()

    raw = _call_gemini_json(prompt)

    # Basic sanity checks
    if "tasks" not in raw or not isinstance(raw["tasks"], list):
        raise ValueError("LLM did not return 'tasks' list")

    return raw
