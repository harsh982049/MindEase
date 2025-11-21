# app.py (updated)
from flask import Flask, request, Response, stream_with_context, jsonify, make_response, redirect
from config import Config
from extensions import db
from flask_migrate import Migrate
from sqlalchemy import func

from services.auth_service import register_user, login_user
from services.stress_face_service import face_health, face_predict
from services.chatbot_service import chat_with_bot, reset_session, sse_stream

# NEW: Breathing coach service
from services.breath_service import (
    init_service as breath_init_service,
    get_status as breath_get_status,
    plan as breath_plan,
    start_session as breath_start_session,
    stop_session as breath_stop_session,
    ingest_telemetry as breath_ingest_telemetry,
    update_from_face_response as breath_update_from_face_response,
)

# NEW: Task Prioritization Agent services (independent of Focus Companion)
from services.priority_task_service import (
    create_priority_task_for_user,
    prioritize_for_user,
    get_today_tasks_for_user,
    update_manual_order_for_user,
    generate_steps_for_task,
)


# NEW: Focus Companion (planner + scheduler + notifier) services
from services.supabase_client import supabase  # Supabase server client
from services.focus_planner_service import plan_subtasks
from services.scheduler_service import schedule_subtasks
from services.notifier_service import send_email

from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from flask_cors import CORS

from models import Chat, ChatMessage, ChatSummary, UserMemory  # existing models

import os, json, pathlib
import signal
import atexit
from datetime import datetime, timezone, timedelta
import pytz
from postgrest.exceptions import APIError

# Scheduler (for email reminders)
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# Initialize extensions
db.init_app(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)

# Initialize services on startup
breath_init_service()


# =========================================
# APScheduler for Focus Companion reminders
# =========================================
DEFAULT_TZ = os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata")

scheduler = BackgroundScheduler(timezone=DEFAULT_TZ)
scheduler.start()

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

GOOGLE_SCOPES = [os.getenv("GOOGLE_OAUTH_SCOPES", "https://www.googleapis.com/auth/gmail.send")]
CLIENT_SECRET_FILE = os.path.join(os.path.dirname(__file__), "client_secret.json")
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token.json")

@app.get("/auth/google/init")
def google_auth_init():
    if not os.path.exists(CLIENT_SECRET_FILE):
        return "client_secret.json missing in backend/", 500

    redirect_uri = os.getenv("GOOGLE_OAUTH_REDIRECT_URI")
    if not redirect_uri:
        return "GOOGLE_OAUTH_REDIRECT_URI not set", 500

    flow = Flow.from_client_secrets_file(
        client_secrets_file=CLIENT_SECRET_FILE,
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri
    )

    # allow passing preferred account: /auth/google/init?user=harshnshah264@gmail.com
    login_hint = (request.args.get("user") or "").strip() or None

    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        **({"login_hint": login_hint} if login_hint else {})
    )
    return redirect(auth_url)

@app.get("/auth/google/callback")
def google_auth_callback():
    if not os.path.exists(CLIENT_SECRET_FILE):
        return "client_secret.json missing", 500

    redirect_uri = os.getenv("GOOGLE_OAUTH_REDIRECT_URI")
    flow = Flow.from_client_secrets_file(client_secrets_file=CLIENT_SECRET_FILE, scopes=GOOGLE_SCOPES, redirect_uri=redirect_uri)
    flow.fetch_token(authorization_response=request.url)

    creds = flow.credentials
    data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": creds.scopes,
    }
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f)

    # quick probe (optional)
    try:
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        service.users().getProfile(userId="me").execute()
    except Exception as e:
        return f"Authorized but probe failed: {e}", 200

    return "Gmail API authorization complete. token.json saved. You can close this tab.", 200

def render_email_for_subtask(subtask: dict, to_email: str) -> tuple[str, str]:
    """
    Returns (subject, html) for a simple reminder email for a subtask.
    Times are shown in DEFAULT_TZ (e.g. Asia/Kolkata), not raw UTC.
    No Start/Done/Snooze/Blocked buttons.
    """
    title = subtask.get("title", "Your planned focus block")
    dod = subtask.get("dod_text", "")
    start = subtask.get("planned_start_ts")
    end = subtask.get("planned_end_ts")

    # Convert planned times to local timezone for display
    def _to_local(val):
        if val is None:
            return None
        # handle both ISO strings and datetime objects
        if isinstance(val, str):
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        else:
            dt = val
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        local_tz = pytz.timezone(DEFAULT_TZ)
        return dt.astimezone(local_tz)

    start_local = _to_local(start)
    end_local = _to_local(end)

    if start_local and end_local:
        planned_str = f"{start_local.strftime('%Y-%m-%d %H:%M')} → {end_local.strftime('%Y-%m-%d %H:%M')} ({DEFAULT_TZ})"
    else:
        planned_str = "not scheduled"

    subject = f"[MindEase] Focus block: {title}"
    html = f"""
    <div style="font-family:Arial, Helvetica, sans-serif;max-width:560px">
      <h2 style="margin:0 0 8px">{title}</h2>
      <p style="margin:0 0 12px">{dod}</p>
      <p style="margin:0 0 12px"><b>Planned:</b> {planned_str}</p>
      <p style="font-size:12px;color:#666">
        This is a gentle reminder from MindEase based on the focus plan you created.
      </p>
    </div>
    """
    return subject, html

def _iso(val):
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return str(val)


def _enqueue_email_job(subtask: dict, to_email: str):
    # planned_start_ts may be str or datetime; normalize to aware UTC
    when = subtask.get("planned_start_ts")
    if isinstance(when, str):
        # tolerate 'Z'
        when = datetime.fromisoformat(when.replace("Z", "+00:00"))
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    job_id = f"email_{subtask['id']}"

    def _send_now():
        subject, html = render_email_for_subtask(subtask, to_email)
        # send via provider-selected path (gmail api / sendgrid / smtp)
        send_email(to_email, subject, html)

        # write a notification row (ISO strings only)
        try:
            supabase.table("notifications").insert({
                "subtask_id": subtask["id"],
                "channel": "email",
                "scheduled_ts": _iso(subtask.get("planned_start_ts")),
                "sent_ts": datetime.now(timezone.utc).isoformat(),
                "status": "sent"
            }).execute()
        except Exception as e:
            print("[notify] insert failed:", repr(e))

    # (If you use APScheduler, keep your scheduler object and removal here)
    try:
        scheduler.remove_job(job_id)
    except Exception:
        pass

    run_at = when if when > now else now + timedelta(seconds=5)
    scheduler.add_job(_send_now, "date", run_date=run_at, id=job_id)


# =========================================
# Task Prioritization Agent (independent feature)
# =========================================


@app.post("/api/priority/task/create")
@jwt_required(optional=True)
def priority_create_task():
    """
    Create a new task for the Task Prioritization Agent.

    Body JSON:
    {
      "user_email": "user@example.com",
      "title": "Finish MindEase paper section",
      "description": "...",
      "deadline_ts": "2025-11-20T18:30:00+05:30",  # optional ISO string
      "status": "backlog" | "planned"              # optional, default "backlog"
    }
    """
    data = request.get_json(force=True) or {}
    user_email = (data.get("user_email") or "").strip()
    if not user_email:
        return jsonify({"error": "user_email is required"}), 400

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    description = data.get("description")
    deadline_ts = data.get("deadline_ts")  # ISO or None
    status = (data.get("status") or "backlog").strip() or "backlog"

    try:
        task = create_priority_task_for_user(
            user_email=user_email,
            title=title,
            description=description,
            deadline_ts=deadline_ts,
            status=status,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"task": task}), 200

@app.post("/api/priority/task/steps")
@jwt_required(optional=True)
def priority_generate_task_steps():
    """
    Generate AI step-by-step instructions for a single task.

    Body JSON:
    {
      "user_email": "user@example.com",   # optional but recommended
      "task_id": "<priority_tasks.id>"
    }

    Response:
    {
      "task": { ...updated task row... },
      "steps": [ { step_number, instruction, estimated_minutes, notes, links }, ... ]
    }
    """
    data = request.get_json(force=True) or {}
    task_id = (data.get("task_id") or "").strip()
    user_email = (data.get("user_email") or "").strip() or None

    if not task_id:
        return jsonify({"error": "task_id is required"}), 400

    try:
        out = generate_steps_for_task(task_id, user_email=user_email)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(out), 200


@app.post("/api/priority/run")
@jwt_required(optional=True)
def priority_run():
    """
    Run AI prioritization for all relevant tasks of a user.

    Body JSON:
    {
      "user_email": "user@example.com",
      "today_available_minutes": 120   # optional
    }

    Response:
    {
      "run_id": "...",
      "plan_summary": "...",
      "tasks": [ ... ]
    }
    """
    data = request.get_json(force=True) or {}
    user_email = (data.get("user_email") or "").strip()
    if not user_email:
        return jsonify({"error": "user_email is required"}), 400

    today_minutes = data.get("today_available_minutes")
    if today_minutes is not None:
        try:
            today_minutes = int(today_minutes)
        except ValueError:
            today_minutes = None

    try:
        out = prioritize_for_user(user_email, today_minutes_override=today_minutes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(out), 200


@app.get("/api/priority/tasks/today")
@jwt_required(optional=True)
def priority_tasks_today():
    """
    Get tasks ordered by the latest AI priority run.

    Query params:
      ?user_email=...

    Response:
    {
      "tasks": [ ... ]
    }
    """
    user_email = (request.args.get("user_email") or "").strip()
    if not user_email:
        return jsonify({"error": "user_email is required"}), 400

    try:
        out = get_today_tasks_for_user(user_email)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(out), 200


@app.post("/api/priority/order/manual")
@jwt_required(optional=True)
def priority_manual_order():
    """
    Update manual order after drag-and-drop.

    Body JSON:
    {
      "user_email": "user@example.com",
      "ordered_ids": ["task-id-1", "task-id-2", ...]
    }
    """
    data = request.get_json(force=True) or {}
    user_email = (data.get("user_email") or "").strip()
    if not user_email:
        return jsonify({"error": "user_email is required"}), 400

    ordered_ids = data.get("ordered_ids") or []
    if not isinstance(ordered_ids, list) or not ordered_ids:
        return jsonify({"error": "ordered_ids must be a non-empty list"}), 400

    try:
        out = update_manual_order_for_user(user_email, ordered_ids)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(out), 200



# -------- Auth --------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    return register_user(data)

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    return login_user(data)


# -------- Stress Face Detection --------
@app.route("/api/stress/face/health", methods=["GET"])
@jwt_required(optional=True)
def stress_face_health():
    return face_health()

@app.route("/api/stress/face/predict", methods=["POST"])
@jwt_required(optional=True)
def stress_face_predict():
    """
    Pass-through to face predictor, with an added hook:
    - After getting the JSON, we update the breathing service's stress cache so
      the breathing plan can adapt in (near) real-time without any frontend changes.
    """
    uid = get_jwt_identity()
    resp, status = face_predict(request)  # returns (Response, status_code)
    try:
        # Update breathing cache using the same user id
        payload = resp.get_json(silent=True) or {}
        breath_update_from_face_response(user_id=uid, face_json=payload)
    except Exception:
        # If anything goes wrong here, we still return the face response unchanged.
        pass
    return resp, status


# -------- Breathing Coach (Existing) --------
@app.route("/api/breath/status", methods=["GET"])
@jwt_required(optional=True)
def breath_status_route():
    uid = get_jwt_identity()
    return jsonify(breath_get_status(uid)), 200

@app.route("/api/breath/plan", methods=["GET"])
@jwt_required(optional=True)
def breath_plan_route():
    uid = get_jwt_identity()
    window = int(request.args.get("window", 60))
    return jsonify(breath_plan(uid, window_sec=window)), 200

@app.route("/api/breath/session", methods=["POST"])
@jwt_required(optional=True)
def breath_session_route():
    uid = get_jwt_identity()
    body = request.get_json(silent=True) or {}
    action = (body.get("action") or "start").lower()
    duration = int(body.get("duration_target_sec", 180))
    with_audio = bool(body.get("with_audio", False))
    if action == "stop":
        return jsonify(breath_stop_session(uid)), 200
    else:
        return jsonify(breath_start_session(uid, duration_target_sec=duration, with_audio=with_audio)), 200

@app.route("/api/breath/telemetry", methods=["POST"])
@jwt_required(optional=True)
def breath_telemetry_route():
    uid = get_jwt_identity()
    payload = request.get_json(silent=True) or {}
    return jsonify(breath_ingest_telemetry(uid, payload)), 200


# =========================================
# Focus Companion (Planner + Scheduler + Notifier)
# =========================================

def sb_select_one(table: str, **equals):
    """Return first row or None."""
    q = supabase.table(table).select("*")
    for k, v in equals.items():
        q = q.eq(k, v)
    res = q.limit(1).execute()
    rows = (res.data or []) if res else []
    return rows[0] if rows else None

def sb_upsert_one(table: str, payload: dict, on_conflict: str | None = None):
    """Upsert a single row and return the resulting row (first). Works with supabase-py v2."""
    if on_conflict:
        res = supabase.table(table).upsert(payload, on_conflict=on_conflict).execute()
    else:
        res = supabase.table(table).upsert(payload).execute()
    rows = (res.data or []) if res else []
    return rows[0] if rows else None

def get_or_create_user_by_email(email: str):
    user = sb_select_one("users", email=email)
    if user:
        return user
    # insert (or upsert by unique email)
    name = email.split("@")[0]
    return sb_upsert_one("users", {"email": email, "name": name}, on_conflict="email")

def ensure_prefs_for_user(user_id: str, defaults: dict):
    prefs = sb_select_one("user_prefs", user_id=user_id)
    if prefs:
        return prefs
    payload = {
        "user_id": user_id,
        "timezone": os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata"),
        "work_start_hhmm": defaults.get("work_start_hhmm", "06:00"),
        "work_end_hhmm": defaults.get("work_end_hhmm", "23:59"),
        "default_buffer_min": defaults.get("default_buffer_min", 1),
        "notify_email": defaults.get("notify_email", True),
        "notify_telegram": defaults.get("notify_telegram", False),
        "telegram_chat_id": defaults.get("telegram_chat_id"),
    }
    return sb_upsert_one("user_prefs", payload, on_conflict="user_id")


@app.post("/api/focus/task/create")
@jwt_required(optional=True)
def focus_create_task():
    data = request.get_json(force=True)

    user_email = (data.get("user_email") or "").strip()
    if not user_email:
        return jsonify({"error": "user_email is required"}), 400

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    description = (data.get("description") or None)
    timebox_min = int(data.get("timebox_min", 60))
    deadline_ts = data.get("deadline_ts")  # ISO or None
    constraints = data.get("constraints", {})

    # 1) Get-or-create user
    try:
        user = get_or_create_user_by_email(user_email)
        if not user:
            return jsonify({"error": "Failed to create/find user"}), 500
    except APIError as e:
        return jsonify({"error": f"users upsert/select failed: {e.message}"}), 500

    # 2) Ensure prefs exist (and are demo-friendly for quick tests)
    try:
        prefs = ensure_prefs_for_user(user["id"], {
            "work_start_hhmm": "06:00",
            "work_end_hhmm": "23:59",
            "default_buffer_min": 1,
            "notify_email": True
        })
        if not prefs:
            return jsonify({"error": "Failed to create/find user_prefs"}), 500
    except APIError as e:
        return jsonify({"error": f"user_prefs upsert/select failed: {e.message}"}), 500

    # 3) Insert task
    try:
        task_res = supabase.table("tasks").insert({
            "user_id": user["id"],
            "title": title,
            "description": description,
            "deadline_ts": deadline_ts,
            "timebox_min": timebox_min
        }).execute()
        task_rows = task_res.data or []
        if not task_rows:
            return jsonify({"error": "tasks insert returned no rows"}), 500
        task = task_rows[0]
    except APIError as e:
        return jsonify({"error": f"tasks insert failed: {e.message}"}), 500

    # 4) Plan with Gemini
    try:
        plan = plan_subtasks(title, timebox_min, constraints)
    except Exception as e:
        return jsonify({"error": f"planner failed: {str(e)}"}), 500

    steps_payload = [{
        "task_id": task["id"],
        "idx": s.idx,
        "title": s.title,
        "dod_text": s.definition_of_done,
        "estimate_min": s.estimate_min,
        "state": "scheduled"
    } for s in plan.steps]

    try:
        ins_res = supabase.table("subtasks").insert(steps_payload).execute()
        inserted = ins_res.data or []
        if not inserted:
            return jsonify({"error": "subtasks insert returned no rows"}), 500
    except APIError as e:
        return jsonify({"error": f"subtasks insert failed: {e.message}"}), 500

    # 5) Schedule
    now_utc = datetime.now(timezone.utc)
    scheduled = schedule_subtasks(
        now_utc=now_utc,
        tz_name=prefs["timezone"],
        work_start_hhmm=prefs["work_start_hhmm"],
        work_end_hhmm=prefs["work_end_hhmm"],
        buffer_min=prefs["default_buffer_min"],
        subtasks=inserted
    )
    try:
        for st in scheduled:
            supabase.table("subtasks").update({
                "planned_start_ts": st["planned_start_ts"].isoformat(),
                "planned_end_ts": st["planned_end_ts"].isoformat()
            }).eq("id", st["id"]).execute()
    except APIError as e:
        return jsonify({"error": f"subtasks update failed: {e.message}"}), 500

    # 6) Enqueue email reminders (non-fatal if it fails)
    try:
        if prefs.get("notify_email", True) and user.get("email"):
            for st in scheduled:
                _enqueue_email_job(st, user["email"])
    except Exception:
        pass

    return jsonify({
        "task_id": task["id"],
        "subtasks": [{
            "id": st["id"],
            "idx": st["idx"],
            "title": st["title"],
            "dod_text": st.get("dod_text"),
            "estimate_min": st.get("estimate_min"),
            "planned_start_ts": st["planned_start_ts"].isoformat(),
            "planned_end_ts": st["planned_end_ts"].isoformat(),
        } for st in scheduled]
    }), 200

    
@app.get("/api/focus/subtasks/upcoming")
@jwt_required(optional=True)
def focus_upcoming_subtasks():
    """
    Return upcoming scheduled focus subtasks for the given user_email
    over the next N days (default 7).
    """
    user_email = (request.args.get("user_email") or "").strip()
    if not user_email:
        return jsonify({"error": "user_email query param is required"}), 400

    days = request.args.get("days", default=7, type=int)

    # 1) Find user (no auto-create here; empty if no user yet)
    try:
        user = sb_select_one("users", email=user_email)
    except APIError as e:
        return jsonify({"error": f"users select failed: {e.message}"}), 500

    if not user:
        return jsonify({"subtasks": []}), 200

    # 2) All tasks for this user
    try:
        tasks_res = supabase.table("tasks").select("id").eq("user_id", user["id"]).execute()
        task_rows = tasks_res.data or []
    except APIError as e:
        return jsonify({"error": f"tasks select failed: {e.message}"}), 500

    task_ids = [row["id"] for row in task_rows]
    if not task_ids:
        return jsonify({"subtasks": []}), 200

    # 3) Subtasks for these tasks in the next N days
    now_utc = datetime.now(timezone.utc)
    horizon = now_utc + timedelta(days=days)

    try:
        q = (
            supabase.table("subtasks")
                .select(
                    "id, task_id, idx, title, dod_text, estimate_min, planned_start_ts, planned_end_ts"
                )
                .in_("task_id", task_ids)
                .gte("planned_start_ts", now_utc.isoformat())
                .lte("planned_start_ts", horizon.isoformat())
                .order("planned_start_ts", desc=False)  # ascending = True
        )
        res = q.execute()
        rows = res.data or []
    except APIError as e:
        return jsonify({"error": f"subtasks select failed: {e.message}"}), 500

    return jsonify({
        "subtasks": [
            {
                "id": r["id"],
                "task_id": r.get("task_id"),
                "idx": r.get("idx"),
                "title": r.get("title"),
                "dod_text": r.get("dod_text"),
                "estimate_min": r.get("estimate_min"),
                "planned_start_ts": r.get("planned_start_ts"),
                "planned_end_ts": r.get("planned_end_ts"),
            }
            for r in rows
        ]
    }), 200

    
@app.get("/api/focus/prefs")
@jwt_required(optional=True)
def focus_get_prefs():
    """
    Fetch stored focus/workday preferences for a given email.
    Creates a user + default prefs lazily if they don't exist.
    """
    user_email = (request.args.get("user_email") or "").strip()
    if not user_email:
        return jsonify({"error": "user_email query param is required"}), 400

    try:
        user = get_or_create_user_by_email(user_email)
        if not user:
            return jsonify({"error": "Failed to create/find user"}), 500
    except APIError as e:
        return jsonify({"error": f"users upsert/select failed: {e.message}"}), 500

    prefs = sb_select_one("user_prefs", user_id=user["id"])
    if not prefs:
        # lazily create demo-friendly defaults
        try:
            prefs = ensure_prefs_for_user(user["id"], {
                "work_start_hhmm": "06:00",
                "work_end_hhmm": "23:59",
                "default_buffer_min": 1,
                "notify_email": True,
            })
        except APIError as e:
            return jsonify({"error": f"user_prefs upsert/select failed: {e.message}"}), 500

    return jsonify({
        "prefs": {
            "timezone": prefs.get("timezone"),
            "work_start_hhmm": prefs.get("work_start_hhmm"),
            "work_end_hhmm": prefs.get("work_end_hhmm"),
            "default_buffer_min": prefs.get("default_buffer_min"),
            "notify_email": prefs.get("notify_email"),
        }
    }), 200


@app.post("/api/focus/prefs")
@jwt_required(optional=True)
def focus_set_prefs():
    """
    Upsert focus/workday preferences for a given email.
    Body JSON:
    {
      "user_email": "...",
      "work_start_hhmm": "09:00",
      "work_end_hhmm": "18:00",
      "default_buffer_min": 5,
      "notify_email": true
    }
    """
    data = request.get_json(force=True)

    user_email = (data.get("user_email") or "").strip()
    if not user_email:
        return jsonify({"error": "user_email is required"}), 400

    try:
        user = get_or_create_user_by_email(user_email)
        if not user:
            return jsonify({"error": "Failed to create/find user"}), 500
    except APIError as e:
        return jsonify({"error": f"users upsert/select failed: {e.message}"}), 500

    existing = sb_select_one("user_prefs", user_id=user["id"])

    tz = data.get("timezone") or (existing.get("timezone") if existing else os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata"))
    ws = data.get("work_start_hhmm") or (existing.get("work_start_hhmm") if existing else "06:00")
    we = data.get("work_end_hhmm") or (existing.get("work_end_hhmm") if existing else "23:59")

    buf = data.get("default_buffer_min")
    if buf is None:
        buf = existing.get("default_buffer_min") if existing else 1
    try:
        buf = int(buf)
    except (TypeError, ValueError):
        buf = 1

    notify_email = data.get("notify_email")
    if notify_email is None:
        notify_email = existing.get("notify_email") if existing else True

    payload = {
        "user_id": user["id"],
        "timezone": tz,
        "work_start_hhmm": ws,
        "work_end_hhmm": we,
        "default_buffer_min": buf,
        "notify_email": bool(notify_email),
        "notify_telegram": existing.get("notify_telegram") if existing else False,
        "telegram_chat_id": existing.get("telegram_chat_id") if existing else None,
    }

    try:
        prefs = sb_upsert_one("user_prefs", payload, on_conflict="user_id")
    except APIError as e:
        return jsonify({"error": f"user_prefs upsert failed: {e.message}"}), 500

    return jsonify({
        "prefs": {
            "timezone": prefs.get("timezone"),
            "work_start_hhmm": prefs.get("work_start_hhmm"),
            "work_end_hhmm": prefs.get("work_end_hhmm"),
            "default_buffer_min": prefs.get("default_buffer_min"),
            "notify_email": prefs.get("notify_email"),
        }
    }), 200


# -------- Chat management --------
@app.route("/api/chats", methods=["POST"])
@jwt_required()  # must be logged in to create a persistent chat
def create_chat():
    uid = get_jwt_identity()
    try:
        user_id = int(uid) if uid is not None else None
    except ValueError:
        user_id = None

    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip() or None
    is_journal = bool(body.get("is_journal", False))

    if is_journal:
        existing = Chat.query.filter_by(user_id=user_id, is_journal=True).first()
        if existing:
            return jsonify({"chat_id": existing.id, "title": existing.title, "is_journal": True}), 200

    if not is_journal and title is None:
        candidates = (
            Chat.query
            .filter_by(user_id=user_id, is_journal=False)
            .order_by(
                func.coalesce(Chat.updated_at, Chat.created_at).desc(),
                Chat.id.desc()
            )
            .all()
        )
        for c in candidates:
            msg_count = ChatMessage.query.filter_by(chat_id=c.id).count()
            if msg_count == 0:
                return jsonify({"chat_id": c.id, "title": c.title, "is_journal": c.is_journal}), 200

    chat = Chat(user_id=user_id, title=title, is_journal=is_journal)
    db.session.add(chat)
    db.session.commit()
    return jsonify({"chat_id": chat.id, "title": chat.title, "is_journal": chat.is_journal}), 201

@app.route("/api/chats", methods=["GET"])
@jwt_required()
def list_chats():
    uid = get_jwt_identity()
    try:
        user_id = int(uid) if uid is not None else None
    except ValueError:
        return jsonify({"error": "Invalid token"}), 401
    rows = (
        Chat.query
        .filter_by(user_id=user_id)
        .order_by(
            func.coalesce(Chat.updated_at, Chat.created_at).desc(),
            Chat.id.desc()
        )
        .all()
    )
    out = []
    for c in rows:
        out.append({
            "chat_id": c.id,
            "title": c.title or "New conversation",
            "is_journal": c.is_journal,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        })
    return jsonify({"chats": out}), 200

@app.route("/api/chats/<int:chat_id>/messages", methods=["GET"])
@jwt_required()
def get_chat_messages(chat_id: int):
    uid = get_jwt_identity()
    try:
        user_id = int(uid) if uid is not None else None
    except ValueError:
        user_id = None
    chat = Chat.query.filter_by(id=chat_id, user_id=user_id).first()
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    limit = int(request.args.get("limit", 100))
    rows = (ChatMessage.query
            .filter_by(chat_id=chat_id)
            .order_by(ChatMessage.id.desc())
            .limit(limit)
            .all())
    rows = list(reversed(rows))
    return jsonify({"messages": [{"id": r.id, "role": r.role, "content": r.content, "created_at": r.created_at.isoformat()} for r in rows]})

@app.route("/api/chats/<int:chat_id>", methods=["DELETE"])
@jwt_required()
def delete_chat(chat_id: int):
    uid = get_jwt_identity()
    try:
        user_id = int(uid) if uid is not None else None
    except ValueError:
        user_id = None
    chat = Chat.query.filter_by(id=chat_id, user_id=user_id).first()
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    ChatMessage.query.filter_by(chat_id=chat_id).delete()
    ChatSummary.query.filter_by(chat_id=chat_id).delete()
    db.session.delete(chat)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200

# -------- User profile memory --------
@app.route("/api/profile/memory", methods=["GET"])
@jwt_required()
def get_profile_memory():
    uid = get_jwt_identity()
    try:
        user_id = int(uid) if uid is not None else None
    except ValueError:
        user_id = None
    rows = (UserMemory.query
            .filter_by(user_id=user_id)
            .order_by(UserMemory.score.desc(), UserMemory.updated_at.desc())
            .all())
    return jsonify({"items": [{"id": r.id, "key": r.key, "value": r.value, "score": r.score} for r in rows]})

@app.route("/api/profile/memory", methods=["POST"])
@jwt_required()
def upsert_profile_memory():
    uid = get_jwt_identity()
    try:
        user_id = int(uid) if uid is not None else None
    except ValueError:
        user_id = None
    body = request.get_json(silent=True) or {}
    items = body.get("items", [])
    for it in items:
        key = (it.get("key") or "").strip()
        val = (it.get("value") or "").strip()
        score = float(it.get("score", 0.5))
        if not key or not val:
            continue
        existing = UserMemory.query.filter_by(user_id=user_id, key=key).first()
        if existing:
            existing.value = val
            existing.score = score
        else:
            db.session.add(UserMemory(user_id=user_id, key=key, value=val, score=score))
    db.session.commit()
    return jsonify({"message": "Saved"}), 200

# -------- Chatbot (JSON & SSE) --------
@app.route("/api/chatbot", methods=["POST"])
@jwt_required(optional=True)
def chatbot_route():
    data = request.get_json()
    return chat_with_bot(data)  # returns (json, status)

@app.route("/api/chatbot/stream", methods=["GET"])
@jwt_required(optional=True)
def chatbot_stream_route():
    uid = get_jwt_identity()
    try:
        user_id = int(uid) if uid is not None else None
    except ValueError:
        user_id = None
    session_id = request.args.get("session_id", "")
    chat_id = request.args.get("chat_id", "")
    chat_id = int(chat_id) if (chat_id and chat_id.isdigit()) else None
    user_message = request.args.get("message", "")
    return Response(stream_with_context(
        sse_stream(user_id, chat_id, session_id, user_message)
    ), headers={
        "Cache-Control": "no-cache",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    })

@app.route("/api/chatbot/reset", methods=["POST"])
def chatbot_reset_route():
    data = request.get_json()
    return reset_session(data)

@app.get("/health")
def health():
    return {"ok": True, "time": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    app.run(debug=True)
