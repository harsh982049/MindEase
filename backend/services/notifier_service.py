import os
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "smtp").lower()
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "MindEase")
EMAIL_FROM_ADDR = os.getenv("EMAIL_FROM_ADDR", "no-reply@example.com")

# ------------- Common: build HTML email -------------
def build_email(to_email: str, subject: str, html: str) -> tuple[str, str, str]:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{EMAIL_FROM_NAME} <{EMAIL_FROM_ADDR}>"
    msg["To"] = to_email
    part_html = MIMEText(html, "html", "utf-8")
    msg.attach(part_html)
    return (to_email, subject, msg.as_string())

# ------------- Gmail API backend -------------
def _gmail_send_raw(raw_str: str):
    # lazy import to avoid heavy deps at import time
    from googleapiclient.discovery import build
    from google.oauth2.credentials import Credentials

    token_path = os.path.join(os.path.dirname(__file__), "..", "token.json")
    token_path = os.path.abspath(token_path)
    if not os.path.exists(token_path):
        raise RuntimeError("Gmail API token.json not found. Visit /auth/google/init to authorize once.")

    creds = Credentials.from_authorized_user_file(token_path, scopes=[os.getenv("GOOGLE_OAUTH_SCOPES", "https://www.googleapis.com/auth/gmail.send")])
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    # Gmail API expects base64url-encoded raw
    raw_b64 = base64.urlsafe_b64encode(raw_str.encode("utf-8")).decode("utf-8")
    body = {"raw": raw_b64}
    return service.users().messages().send(userId="me", body=body).execute()

def send_via_gmail_api(to_email: str, subject: str, html: str):
    _, _, raw = build_email(to_email, subject, html)
    return _gmail_send_raw(raw)

# ------------- SendGrid backend -------------
def send_via_sendgrid(to_email: str, subject: str, html: str):
    import sendgrid
    from sendgrid.helpers.mail import Mail, From, To, Content

    api_key = os.getenv("SENDGRID_API_KEY")
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY not set")

    sg = sendgrid.SendGridAPIClient(api_key)
    mail = Mail(
        from_email=From(EMAIL_FROM_ADDR, EMAIL_FROM_NAME),
        to_emails=To(to_email),
        subject=subject,
        html_content=Content("text/html", html),
    )
    return sg.send(mail)

# ------------- SMTP (your existing) as fallback -------------
def send_via_smtp(to_email: str, subject: str, html: str):
    import smtplib
    from email.utils import formataddr

    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER")
    SMTP_PASS = os.getenv("SMTP_PASS")
    FROM = formataddr((EMAIL_FROM_NAME, EMAIL_FROM_ADDR))

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls()
            if SMTP_USER and SMTP_PASS:
                s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(EMAIL_FROM_ADDR, [to_email], msg.as_string())
    except Exception as e:
        # Dev fallback: log instead of exploding jobs
        print("=== EMAIL (SMTP DEV FALLBACK) ===")
        print("TO:", to_email)
        print("SUBJECT:", subject)
        print("ERROR:", repr(e))

# ------------- Public entry point -------------
def send_email(to_email: str, subject: str, html: str):
    provider = EMAIL_PROVIDER
    if provider == "gmail_api":
        return send_via_gmail_api(to_email, subject, html)
    elif provider == "sendgrid":
        return send_via_sendgrid(to_email, subject, html)
    else:
        return send_via_smtp(to_email, subject, html)
