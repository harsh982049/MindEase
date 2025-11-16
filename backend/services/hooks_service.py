# services/hooks_service.py
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Tuple

from services.supabase_client import supabase
from services.focus_planner_service import micro_split  # used when action == "blocked"

# If your token is a signed blob you verify elsewhere, keep that code.
# Here we assume it’s a JSON stringified payload (sid, a, exp) that you already validated upstream.

# --- helpers: datetime -> ISO strings -----------------------------------------------------

def _to_iso(v: Any) -> Any:
    if isinstance(v, datetime):
        # Always store aware UTC as ISO 8601
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        else:
            v = v.astimezone(timezone.utc)
        return v.isoformat()
    return v

def _coerce_dt(d: Dict[str, Any]) -> Dict[str, Any]:
    return {k: _to_iso(v) for k, v in d.items()}

# --- narrow DB helpers (never send raw datetimes to supabase) -----------------------------

def _update_subtask_state(subtask_id: str, new_state: str, extra_fields: Dict[str, Any] | None = None):
    fields = {"state": new_state}
    if extra_fields:
        fields.update(_coerce_dt(extra_fields))
    return supabase.table("subtasks").update(fields).eq("id", subtask_id).execute()

def _get_subtask(subtask_id: str) -> Dict[str, Any] | None:
    res = supabase.table("subtasks").select("*").eq("id", subtask_id).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None

def _insert_microsteps(task_id: str, after_idx: int, micro_steps: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    """
    Insert 2–3 micro-steps *immediately after* 'after_idx'; we keep state 'scheduled'
    and let the caller re-run scheduling.
    """
    payload = []
    idx = after_idx + 1
    for m in micro_steps:
        payload.append({
            "task_id": task_id,
            "idx": idx,
            "title": m["title"],
            "dod_text": m["definition_of_done"],
            "estimate_min": int(m["estimate_min"]),
            "state": "scheduled",
        })
        idx += 1
    ins = supabase.table("subtasks").insert(payload).execute()
    return ins.data or []

# --- public entry: invoked by /api/focus/hook route ---------------------------------------

def handle_magic_hook(token: str, action: str, raw_params: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Returns: (ok, message, effect)
      effect may include:
        - {"reschedule": True, "seed_subtasks": [ ... ]}  # caller should reschedule & (re-)enqueue emails
        - or {} if nothing else to do
    """
    # 1) Parse token (your existing format). Example here expects JSON in token or query.
    try:
        # Your token likely has 'sid' (subtask_id), 'a' (action), 'exp' (ISO). Adapt if you use JWT.
        # If you’re using itsquery string, adapt parser accordingly.
        payload = _decode_token(token)
    except Exception as e:
        return False, f"Invalid token: {e}", {}

    subtask_id = payload.get("sid")
    tok_action = payload.get("a")
    exp_str = payload.get("exp")

    if not subtask_id:
        return False, "Missing subtask id in token.", {}

    # 2) Expiry check
    try:
        if exp_str:
            exp = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp:
                return False, "This link has expired.", {}
    except Exception:
        # Soft-fail: ignore if can’t parse
        pass

    # 3) Normalize action (prefer explicit query action over token)
    action = (raw_params.get("action") or tok_action or "").lower().strip()
    if action not in {"start", "done", "snooze", "blocked"}:
        return False, f"Unknown action '{action}'.", {}

    # 4) Load the subtask (we’ll need task_id, idx, etc.)
    st = _get_subtask(subtask_id)
    if not st:
        return False, "Subtask not found.", {}

    now = datetime.now(timezone.utc)

    # 5) Action handlers
    if action == "start":
        _update_subtask_state(subtask_id, "in_progress", {"actual_start_ts": now})
        return True, "Marked as started.", {}

    if action == "done":
        _update_subtask_state(subtask_id, "done", {"actual_end_ts": now})
        return True, "Marked as done.", {"reschedule": True}

    if action == "snooze":
        # Default snooze = +10 minutes (can override via ?mins=)
        mins = int(raw_params.get("mins", 10))
        new_start = now + timedelta(minutes=mins)
        new_end = new_start + timedelta(minutes=int(st.get("estimate_min", 5)))
        _update_subtask_state(subtask_id, "scheduled", {
            "planned_start_ts": new_start,
            "planned_end_ts": new_end
        })
        return True, f"Snoozed by {mins} minutes.", {"reschedule": False}

    if action == "blocked":
        # Split into micro steps (≤ 10 min) using LLM, insert right after this idx
        notes = raw_params.get("notes", "")
        try:
            mp = micro_split(st["title"], st.get("dod_text") or "", notes=notes, remaining_time_min=int(st.get("estimate_min", 10)))
            created = _insert_microsteps(task_id=st["task_id"], after_idx=int(st["idx"]), micro_steps=[m.model_dump() for m in mp.micro_steps])
            # mark current one as "blocked"
            _update_subtask_state(subtask_id, "blocked", {"actual_end_ts": now})
            # Ask caller to reschedule the whole task (so new micro-steps get times + emails)
            return True, "Blocked: added micro-steps and marked this one blocked.", {"reschedule": True, "seed_subtasks": created}
        except Exception as e:
            return False, f"Failed to create micro-steps: {e}", {}

    # Shouldn’t reach here
    return False, "Unhandled state.", {}

# --- token decode (stub) ------------------------------------------------------------------

def _decode_token(token: str) -> Dict[str, Any]:
    """
    Adapt this to your existing token format.
    In your earlier logs token looked like a signed payload:
      ?token=eyJzaWQiOiI...&action=done
    If you are using itsdangerous/Fernet/JWT, put that here.
    For now, try to base64/url-decode JSON; otherwise return minimal dict.
    """
    try:
        # First try plain JSON (dev mode)
        return json.loads(token)
    except Exception:
        # Fallback: treat as already validated upstream, return only query pieces
        # (The /api/focus/hook route usually looks up the subtask_id by token)
        return {"sid": None, "a": None, "exp": None}
