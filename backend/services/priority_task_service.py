# services/priority_task_service.py

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple
from uuid import uuid4

from postgrest.exceptions import APIError

from .supabase_client import supabase
from .priority_llm_service import analyze_task_with_llm, prioritize_tasks_with_llm

DEFAULT_TZ = os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata")


# ---------- Helpers ----------

def sb_select_one(table: str, **equals) -> Dict[str, Any] | None:
    q = supabase.table(table).select("*")
    for k, v in equals.items():
        q = q.eq(k, v)
    res = q.limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def sb_upsert_one(table: str, payload: Dict[str, Any], on_conflict: str | None = None) -> Dict[str, Any] | None:
    if on_conflict:
        res = supabase.table(table).upsert(payload, on_conflict=on_conflict).execute()
    else:
        res = supabase.table(table).upsert(payload).execute()
    rows = res.data or []
    return rows[0] if rows else None


def get_or_create_user_by_email(email: str) -> Dict[str, Any]:
    user = sb_select_one("users", email=email)
    if user:
        return user
    name = email.split("@")[0]
    payload = {"email": email, "name": name}
    return sb_upsert_one("users", payload, on_conflict="email")


def ensure_priority_profile(user_id: str) -> Dict[str, Any]:
    prof = sb_select_one("priority_profiles", user_id=user_id)
    if prof:
        return prof
    # Sensible defaults; later you can expose an API to customize
    payload = {
        "user_id": user_id,
        "morning_energy": 4,
        "afternoon_energy": 3,
        "evening_energy": 2,
        "default_today_minutes": 120,
    }
    return sb_upsert_one("priority_profiles", payload, on_conflict="user_id")


# ---------- Public functions used by app.py ----------

def create_priority_task_for_user(
    user_email: str,
    title: str,
    description: str | None,
    deadline_ts: str | None,
    status: str = "backlog",
) -> Dict[str, Any]:
    """
    Creates a priority_tasks row + runs Stage 1 LLM analysis to fill AI columns.
    """
    user = get_or_create_user_by_email(user_email)
    if not user:
        raise RuntimeError("Failed to create/find user")

    # Insert bare task row first
    insert_payload = {
        "user_id": user["id"],
        "title": title,
        "description": description,
        "deadline_ts": deadline_ts,
        "status": status,
    }
    try:
        ins = supabase.table("priority_tasks").insert(insert_payload).execute()
        rows = ins.data or []
        if not rows:
            raise RuntimeError("priority_tasks insert returned no rows")
        task = rows[0]
    except APIError as e:
        raise RuntimeError(f"priority_tasks insert failed: {e.message}")

    # Run LLM analysis (Stage 1)
    try:
        llm_info = analyze_task_with_llm(task)
    except Exception as e:
        print("[priority_task_service] analyze_task_with_llm failed:", repr(e))
        llm_info = {
            "importance": 3,
            "stress_cost": 3,
            "energy_requirement": "medium",
            "estimated_minutes": 30,
            "category": "other",
        }

    update_payload = {
        "ai_importance": llm_info["importance"],
        "ai_stress_cost": llm_info["stress_cost"],
        "ai_energy_requirement": llm_info["energy_requirement"],
        "ai_estimated_minutes": llm_info["estimated_minutes"],
        "ai_category": llm_info["category"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        upd = supabase.table("priority_tasks").update(update_payload).eq("id", task["id"]).execute()
        rows = upd.data or []
        if rows:
            task = rows[0]
    except APIError as e:
        print("[priority_task_service] priority_tasks update failed:", e.message)

    return task


def _compute_deadline_label_and_days(deadline_ts: str | None) -> Tuple[str, int | None]:
    if not deadline_ts:
        return "no_deadline", None
    try:
        # Accept both Z and offset-style
        dt = datetime.fromisoformat(deadline_ts.replace("Z", "+00:00"))
    except Exception:
        return "no_deadline", None

    today = datetime.now(timezone.utc).date()
    ddate = dt.astimezone(timezone.utc).date()
    diff = (ddate - today).days
    if diff < 0:
        return "overdue", diff
    elif diff == 0:
        return "today", diff
    elif diff == 1:
        return "tomorrow", diff
    elif diff <= 7:
        return "this_week", diff
    else:
        return "future", diff


def prioritize_for_user(user_email: str, today_minutes_override: int | None = None) -> Dict[str, Any]:
    """
    Stage 2: Fetch all relevant priority_tasks for a user and call LLM
    to compute ai_priority_rank, ai_bucket, ai_reason, ai_run_id.

    Returns: {"run_id": str, "plan_summary": str, "tasks": [ ...ordered tasks... ]}
    """
    user = get_or_create_user_by_email(user_email)
    if not user:
        raise RuntimeError("Failed to create/find user")

    profile = ensure_priority_profile(user["id"])
    today_minutes = today_minutes_override or profile.get("default_today_minutes", 120)

    # Fetch candidate tasks
    try:
        res = (
            supabase.table("priority_tasks")
            .select("*")
            .eq("user_id", user["id"])
            .in_("status", ["backlog", "planned"])
            .order("created_at", desc=False)
            .execute()
        )
        tasks = res.data or []
    except APIError as e:
        raise RuntimeError(f"priority_tasks select failed: {e.message}")

    if not tasks:
        return {"run_id": None, "plan_summary": "No tasks to prioritize.", "tasks": []}

    # Build LLM input list
    llm_tasks_input: List[Dict[str, Any]] = []
    for t in tasks:
        deadline_ts = t.get("deadline_ts")
        deadline_label, days_to_deadline = _compute_deadline_label_and_days(deadline_ts)
        ai_importance = t.get("ai_importance") or 3
        ai_stress_cost = t.get("ai_stress_cost") or 3
        ai_energy_req = t.get("ai_energy_requirement") or "medium"
        ai_est_minutes = t.get("ai_estimated_minutes") or 30
        ai_category = t.get("ai_category") or "other"

        llm_tasks_input.append({
            "id": t["id"],
            "title": t.get("title"),
            "description": t.get("description"),
            "status": t.get("status"),
            "deadline_label": deadline_label,
            "days_to_deadline": days_to_deadline,
            "ai_importance": ai_importance,
            "ai_stress_cost": ai_stress_cost,
            "ai_energy_requirement": ai_energy_req,
            "ai_estimated_minutes": ai_est_minutes,
            "ai_category": ai_category,
            "previously_deprioritized": bool(t.get("last_deprioritized_at")) if "last_deprioritized_at" in t else False,
        })

    now_utc = datetime.now(timezone.utc)
    user_ctx = {
        "current_datetime": now_utc.isoformat(),
        "timezone": DEFAULT_TZ,
        "morning_energy": profile.get("morning_energy", 4),
        "afternoon_energy": profile.get("afternoon_energy", 3),
        "evening_energy": profile.get("evening_energy", 2),
        "today_available_minutes": today_minutes,
    }

    # Call LLM
    try:
        llm_out = prioritize_tasks_with_llm(user_ctx, llm_tasks_input)
    except Exception as e:
        print("[priority_task_service] prioritize_tasks_with_llm failed:", repr(e))
        # Fallback: heuristic ordering (by deadline then importance)
        tasks_sorted = sorted(
            tasks,
            key=lambda t: (
                _compute_deadline_label_and_days(t.get("deadline_ts"))[1] or 9999,
                -(t.get("ai_importance") or 3),
            ),
        )
        out_tasks = []
        for idx, t in enumerate(tasks_sorted, start=1):
            out_tasks.append({
                "id": t["id"],
                "priority_rank": idx,
                "bucket": "now" if idx <= 3 else "later",
                "reason": "Heuristic: sorted by deadline and importance (LLM unavailable).",
                "final_estimated_minutes": t.get("ai_estimated_minutes") or 30,
            })
        plan_summary = "Fallback heuristic: sorted by deadline and importance."
        run_row = _log_priority_run(user["id"], model_name="heuristic", count=len(tasks), notes=str(e))
        _apply_priority_to_db(run_row["id"], out_tasks)
        # Merge with latest DB after update
        merged = _fetch_tasks_with_ai_fields(user["id"])
        return {
            "run_id": run_row["id"],
            "plan_summary": plan_summary,
            "tasks": merged,
        }

    # Normal path: LLM output
    plan_summary = llm_out.get("plan_summary", "")
    out_tasks = llm_out.get("tasks", [])

    # Log run
    run_row = _log_priority_run(
        user_id=user["id"],
        model_name=os.getenv("PRIORITY_LLM_MODEL", "gemini-1.5-flash"),
        count=len(tasks),
        notes=None,
    )

    # Apply updates to DB
    _apply_priority_to_db(run_row["id"], out_tasks)

    # Fetch with latest fields to return in a clean, ordered format
    merged = _fetch_tasks_with_ai_fields(user["id"])

    return {
        "run_id": run_row["id"],
        "plan_summary": plan_summary,
        "tasks": merged,
    }


def _log_priority_run(user_id: str, model_name: str, count: int, notes: str | None) -> Dict[str, Any]:
    payload = {
        "user_id": user_id,
        "model_name": model_name,
        "input_task_count": count,
        "notes": notes,
    }
    res = supabase.table("priority_runs").insert(payload).execute()
    rows = res.data or []
    return rows[0] if rows else payload


def _apply_priority_to_db(run_id: str, llm_tasks: List[Dict[str, Any]]) -> None:
    """
    llm_tasks is list of {id, priority_rank, bucket, reason, final_estimated_minutes}
    """
    for t in llm_tasks:
        tid = t.get("id")
        if not tid:
            continue
        payload = {
            "ai_run_id": run_id,
            "ai_priority_rank": int(t.get("priority_rank", 999)),
            "ai_bucket": t.get("bucket", "later"),
            "ai_reason": t.get("reason", None),
            "ai_estimated_minutes": int(t.get("final_estimated_minutes", 30)),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            supabase.table("priority_tasks").update(payload).eq("id", tid).execute()
        except APIError as e:
            print("[priority_task_service] apply_priority update failed:", e.message)


def _fetch_tasks_with_ai_fields(user_id: str) -> List[Dict[str, Any]]:
    """
    Helper to get tasks ordered by bucket + priority.
    """
    try:
        res = (
            supabase.table("priority_tasks")
            .select("*")
            .eq("user_id", user_id)
            .order("ai_bucket", desc=False)
            .order("ai_priority_rank", desc=False)
            .execute()
        )
        tasks = res.data or []
    except APIError as e:
        print("[priority_task_service] fetch tasks failed:", e.message)
        tasks = []

    # Basic sort on Python side as safety
    bucket_order = {"now": 0, "next": 1, "later": 2, "backlog": 3, None: 4}
    tasks.sort(
        key=lambda t: (
            bucket_order.get(t.get("ai_bucket"), 4),
            t.get("ai_priority_rank") or 9999,
        )
    )
    return tasks


def get_today_tasks_for_user(user_email: str) -> Dict[str, Any]:
    user = get_or_create_user_by_email(user_email)
    if not user:
        raise RuntimeError("Failed to create/find user")
    tasks = _fetch_tasks_with_ai_fields(user["id"])
    return {"tasks": tasks}


def update_manual_order_for_user(user_email: str, ordered_ids: List[str]) -> Dict[str, Any]:
    """
    When frontend drag-and-drops tasks, it can send a list of task IDs
    in desired order (within 'now' or across buckets). For simplicity, we
    just overwrite ai_priority_rank according to this list and mark
    tasks moved down as "deprioritized" via a timestamp.
    """
    user = get_or_create_user_by_email(user_email)
    if not user:
        raise RuntimeError("Failed to create/find user")

    now_iso = datetime.now(timezone.utc).isoformat()
    for rank, tid in enumerate(ordered_ids, start=1):
        try:
            # We fetch the task to detect if it moved down (optional)
            res = supabase.table("priority_tasks").select("ai_priority_rank").eq("id", tid).limit(1).execute()
            prev_rows = res.data or []
            prev_rank = prev_rows[0].get("ai_priority_rank") if prev_rows else None

            payload = {
                "ai_priority_rank": rank,
                "updated_at": now_iso,
            }
            if prev_rank is not None and prev_rank < rank:
                # User pushed this task down → record deprioritized_at
                payload["last_deprioritized_at"] = now_iso

            supabase.table("priority_tasks").update(payload).eq("id", tid).execute()
        except APIError as e:
            print("[priority_task_service] update_manual_order failed:", e.message)

    # Return refreshed list
    tasks = _fetch_tasks_with_ai_fields(user["id"])
    return {"tasks": tasks}
