# EmailJS Template for CodeWars 2.0

## Template Subject:
```
🚀 Welcome to CodeWars 2.0 - Your Team Credentials
```

## Template Content (HTML):
```html
Dear {{participant_name}} Team Leader,

Welcome to CodeWars 2.0! 🚀 We're excited to have you onboard and look forward to an intense, fun, and competitive coding experience.

📌 Event Details
Event Name: CodeWars 2.0 - The Ultimate Coding Competition
Date: 5th Feb 2026
Time: 10 pm onwards
Mode: Online

🔐 Login Credentials
You can access the competition portal using the credentials below:

Team Name: {{team_name}}
Team Code: {{team_code}}
Password: {{temporary_password}}
Email: {{email}}

For security reasons, we recommend keeping these credentials safe and not sharing them with other teams.

🎯 Competition Rounds
Round 1: Aptitude Arena (30 minutes) - Multiple choice questions
Round 2: Constraint Paradox (60 minutes) - Coding with constraints  
Round 3: Code Jeopardy (90 minutes) - Final showdown

🔗 Competition Access
Please use the link to the competition which will be shared on the day of the event.

⚠️ IMPORTANT NOTES:
- Keep your credentials secure
- Login 15 minutes before each round starts
- Make sure your internet connection is stable
- Have your preferred coding environment ready

If you have any questions or face any issues, feel free to reach out to us at 24bt04175@gsfcuniversity.ac.in.

Best regards,
CodeWars 2.0 Organizing Committee

This email was sent to {{email}} because your team is registered for CodeWars 2.0.

🏆 May the best code win! 🏆
```

## Variables Used:
- {{participant_name}} - Team name
- {{team_name}} - Team name
- {{team_code}} - Auto-generated team code
- {{temporary_password}} - Auto-generated password
- {{email}} - Team leader email

## Setup Instructions:

1. **Go to EmailJS Dashboard**: https://dashboard.emailjs.com/
2. **Create Email Template**:
   - Click "Email Templates"
   - Click "Create New Template"
   - Copy the subject and content above
   - Save the template
   - Copy the Template ID

3. **Update Your .env File**:
   ```env
   VITE_EMAILJS_SERVICE_ID="your_service_id"
   VITE_EMAILJS_TEMPLATE_ID="your_template_id"
   VITE_EMAILJS_PUBLIC_KEY="your_public_key"
   ```

4. **Test**: Register a team and check if emails are sent!

## Quick Setup (5 minutes):
1. Go to https://www.emailjs.com/ → Sign up
2. Add Gmail service → Get Service ID
3. Create template with content above → Get Template ID  
4. Get Public Key from Account settings
5. Update .env file with all 3 IDs
6. Restart server and test!