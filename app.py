from flask import Flask, render_template, request, redirect, url_for, session, flash
import sqlite3
import os
import smtplib
from email.message import EmailMessage
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-this-secret")

DATABASE_PATH = os.path.join(os.path.dirname(__file__), "tickets.db")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin@it.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
IT_TEAM_EMAILS = [email.strip() for email in os.environ.get("IT_TEAM_EMAILS", "it1@example.com,it2@example.com").split(",") if email.strip()]
SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", SMTP_USERNAME or "noreply@local.local")


def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_number TEXT UNIQUE NOT NULL,
                user_name TEXT NOT NULL,
                user_email TEXT NOT NULL,
                subject TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Open',
                assigned_to TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ticket_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id INTEGER NOT NULL,
                sender_role TEXT NOT NULL,
                sender_name TEXT NOT NULL,
                sender_email TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(ticket_id) REFERENCES tickets(id)
            )
            """
        )


def normalize_ticket_number(value):
    if not value:
        return ""
    candidate = value.strip().upper().replace(" ", "")
    if candidate.startswith("IT-"):
        return candidate
    return f"IT-{candidate}"


def next_ticket_number():
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT MAX(CAST(SUBSTR(ticket_number, 4) AS INTEGER)) AS last_number FROM tickets WHERE ticket_number LIKE 'IT-%'"
        ).fetchone()
    last_number = row["last_number"] if row and row["last_number"] is not None else 1000
    return f"IT-{int(last_number) + 1}"


def add_message(ticket_id, sender_role, sender_name, sender_email, message):
    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO ticket_messages (ticket_id, sender_role, sender_name, sender_email, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (ticket_id, sender_role, sender_name, sender_email, message, datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")),
        )
        conn.commit()


def send_email(subject, body, recipients, reply_to=None):
    if not recipients:
        return False
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = ", ".join(recipients)
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(body)

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(message)
        return True
    except Exception:
        return False


def notify_it_team(ticket):
    recipients = IT_TEAM_EMAILS or [SMTP_FROM_EMAIL]
    body = (
        f"New IT support ticket received.\n\n"
        f"Ticket Number: {ticket['ticket_number']}\n"
        f"Customer Name: {ticket['user_name']}\n"
        f"Email: {ticket['user_email']}\n"
        f"Category: {ticket['category']}\n"
        f"Priority: {ticket['priority']}\n"
        f"Subject: {ticket['subject']}\n\n"
        f"Description:\n{ticket['description']}\n"
    )
    return send_email(f"New Support Ticket #{ticket['ticket_number']}", body, recipients)


def notify_user_on_admin_reply(ticket, reply_text, admin_name):
    body = (
        f"Hello {ticket['user_name']},\n\n"
        f"Your IT ticket #{ticket['ticket_number']} has an update.\n\n"
        f"Support: {admin_name}\n"
        f"Update:\n{reply_text}\n\n"
        f"You can continue by replying to this email or by checking your ticket status online.\n"
        f"Ticket Subject: {ticket['subject']}\n"
    )
    return send_email(f"Update on Ticket #{ticket['ticket_number']} - {ticket['subject']}", body, [ticket['user_email']], reply_to=SMTP_FROM_EMAIL)


def notify_it_team_on_user_reply(ticket, message):
    recipients = IT_TEAM_EMAILS or [SMTP_FROM_EMAIL]
    body = (
        f"A customer has added a new message to ticket #{ticket['ticket_number']}.\n\n"
        f"Customer Name: {ticket['user_name']}\n"
        f"Email: {ticket['user_email']}\n"
        f"Subject: {ticket['subject']}\n\n"
        f"Message:\n{message}\n"
    )
    return send_email(f"Ticket Update #{ticket['ticket_number']}", body, recipients)


def get_ticket_by_number(ticket_number):
    with get_db_connection() as conn:
        ticket = conn.execute(
            "SELECT * FROM tickets WHERE ticket_number = ?",
            (ticket_number,),
        ).fetchone()
        if not ticket:
            return None
        messages = conn.execute(
            "SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC",
            (ticket["id"],),
        ).fetchall()
    return {**dict(ticket), "messages": [dict(row) for row in messages]}


@app.context_processor
def inject_defaults():
    return {
        "admin_username": ADMIN_USERNAME,
        "site_title": "IT Support Desk"
    }


@app.route("/")
def home():
    return render_template("home.html")


@app.route("/submit-ticket", methods=["POST"])
def submit_ticket():
    name = request.form.get("name", "").strip()
    email = request.form.get("email", "").strip()
    subject = request.form.get("subject", "").strip()
    description = request.form.get("description", "").strip()
    category = request.form.get("category", "General Support").strip() or "General Support"
    priority = request.form.get("priority", "Medium").strip() or "Medium"

    if not name or not email or not subject or not description:
        flash("Please fill in all required fields.", "error")
        return redirect(url_for("home"))

    ticket_number = next_ticket_number()
    created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO tickets (ticket_number, user_name, user_email, subject, description, category, priority, status, assigned_to, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', 'IT Team', ?, ?)
            """,
            (ticket_number, name, email, subject, description, category, priority, created_at, created_at),
        )
        ticket_id = cur.lastrowid
        conn.commit()

    add_message(ticket_id, "user", name, email, description)
    ticket = get_ticket_by_number(ticket_number)
    notify_it_team(ticket)
    flash(f"Your ticket has been created successfully. Your ticket number is {ticket_number}.", "success")
    return redirect(url_for("ticket_detail", ticket_number=ticket_number))


@app.route("/ticket/<ticket_number>")
def ticket_detail(ticket_number):
    ticket = get_ticket_by_number(normalize_ticket_number(ticket_number))
    if not ticket:
        flash("Ticket not found.", "error")
        return redirect(url_for("home"))
    return render_template("ticket_detail.html", ticket=ticket)


@app.route("/search-ticket", methods=["POST"])
def search_ticket():
    ticket_number = normalize_ticket_number(request.form.get("ticket_number", ""))
    if not ticket_number:
        flash("Please enter a ticket number.", "error")
        return redirect(url_for("home"))
    return redirect(url_for("ticket_detail", ticket_number=ticket_number))


@app.route("/ticket/<ticket_number>/reply", methods=["POST"])
def public_ticket_reply(ticket_number):
    ticket = get_ticket_by_number(normalize_ticket_number(ticket_number))
    if not ticket:
        flash("Ticket not found.", "error")
        return redirect(url_for("home"))

    sender_name = request.form.get("sender_name", "").strip()
    sender_email = request.form.get("sender_email", "").strip()
    message = request.form.get("message", "").strip()

    if not sender_name or not sender_email or not message:
        flash("Please enter your name, email, and message.", "error")
        return redirect(url_for("ticket_detail", ticket_number=ticket_number))

    if sender_email.lower() != ticket["user_email"].lower():
        flash("Please use the email address that was used when you created the ticket.", "error")
        return redirect(url_for("ticket_detail", ticket_number=ticket_number))

    with get_db_connection() as conn:
        conn.execute(
            "UPDATE tickets SET status = 'Awaiting IT Response', updated_at = ? WHERE id = ?",
            (datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"), ticket["id"]),
        )
        conn.commit()

    add_message(ticket["id"], "user", sender_name, sender_email, message)
    notify_it_team_on_user_reply(ticket, message)
    flash("Your response has been sent to the IT team.", "success")
    return redirect(url_for("ticket_detail", ticket_number=ticket_number))


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            return redirect(url_for("admin_dashboard"))
        flash("Invalid admin credentials.", "error")
    return render_template("admin_login.html")


@app.route("/admin/logout")
def admin_logout():
    session.pop("admin_logged_in", None)
    return redirect(url_for("admin_login"))


@app.route("/admin")
def admin_dashboard():
    if not session.get("admin_logged_in"):
        return redirect(url_for("admin_login"))

    status_filter = request.args.get("status", "all")
    with get_db_connection() as conn:
        if status_filter == "all":
            tickets = conn.execute("SELECT * FROM tickets ORDER BY created_at DESC").fetchall()
        else:
            tickets = conn.execute(
                "SELECT * FROM tickets WHERE status = ? ORDER BY created_at DESC",
                (status_filter,),
            ).fetchall()
    return render_template("admin_dashboard.html", tickets=tickets, status_filter=status_filter)


@app.route("/admin/tickets/<ticket_number>", methods=["GET", "POST"])
def admin_ticket_detail(ticket_number):
    if not session.get("admin_logged_in"):
        return redirect(url_for("admin_login"))

    ticket = get_ticket_by_number(normalize_ticket_number(ticket_number))
    if not ticket:
        flash("Ticket not found.", "error")
        return redirect(url_for("admin_dashboard"))

    if request.method == "POST":
        status = request.form.get("status", ticket["status"])
        priority = request.form.get("priority", ticket["priority"])
        assigned_to = request.form.get("assigned_to", ticket["assigned_to"]) or "IT Team"
        reply_text = request.form.get("reply_text", "").strip()

        with get_db_connection() as conn:
            conn.execute(
                "UPDATE tickets SET status = ?, priority = ?, assigned_to = ?, updated_at = ? WHERE id = ?",
                (status, priority, assigned_to, datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"), ticket["id"]),
            )
            conn.commit()

        if reply_text:
            add_message(ticket["id"], "admin", ADMIN_USERNAME, SMTP_FROM_EMAIL, reply_text)
            notify_user_on_admin_reply(ticket, reply_text, ADMIN_USERNAME)
            flash("Reply sent to customer email.", "success")
        else:
            flash("Ticket updated.", "success")
        return redirect(url_for("admin_ticket_detail", ticket_number=ticket_number))

    return render_template("admin_ticket_detail.html", ticket=ticket)


init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
