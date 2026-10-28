# Ticket System

This project is a complete IT support ticket system built with Flask and SQLite.

Features:
- Public guest ticket submission without login
- Required email input for every new ticket
- Auto-generated ticket numbers like IT-1001
- Search by ticket number
- Admin dashboard for viewing/updating tickets
- Customer email notifications to the IT team
- Admin response emails sent to the customer email
- SQLite database for local storage

Quick start:

1. Create a virtual environment
   python -m venv .venv
   . .venv/bin/activate  # Linux/macOS
   # or .venv\Scripts\activate  # Windows

2. Install dependencies
   pip install -r requirements.txt

3. Configure email settings
   Copy .env.example to .env and update the values.
   At minimum, set:
   - ADMIN_USERNAME
   - ADMIN_PASSWORD
   - IT_TEAM_EMAILS
   - SMTP_SERVER
   - SMTP_PORT
   - SMTP_USERNAME
   - SMTP_PASSWORD
   - SMTP_FROM_EMAIL

4. Start the app
   python app.py

5. Open the browser
   http://localhost:5000

Admin login:
- Default username: admin@it.local
- Default password: admin123

You can override these with environment variables.

For email notifications, set your SMTP details to a working mail provider, such as Gmail, SendGrid, or a local SMTP relay.

Example:

export ADMIN_USERNAME="admin@it.local"
export ADMIN_PASSWORD="admin123"
export IT_TEAM_EMAILS="it1@example.com,it2@example.com"
export SMTP_SERVER="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USERNAME="your-email@gmail.com"
export SMTP_PASSWORD="your-app-password"
export SMTP_FROM_EMAIL="your-email@gmail.com"

Then run:

python app.py
