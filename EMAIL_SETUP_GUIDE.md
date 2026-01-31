# 📧 Free Email Setup Guide for CodeWars 2.0

## 🆓 Option 1: EmailJS (Recommended - 100% Free)

### Step 1: Create EmailJS Account
1. Go to https://www.emailjs.com/
2. Click "Sign Up" and create free account
3. Verify your email address

### Step 2: Add Email Service
1. Go to "Email Services" in dashboard
2. Click "Add New Service"
3. Choose your email provider:
   - **Gmail** (recommended)
   - **Outlook/Hotmail**
   - **Yahoo**
   - **Custom SMTP**
4. Connect your email account
5. **Copy the Service ID** (like `service_abc123`)

### Step 3: Create Email Template
1. Go to "Email Templates"
2. Click "Create New Template"
3. **Copy the template from `EMAILJS_TEMPLATE.md`**
4. **Save and copy Template ID** (like `template_xyz789`)

### Step 4: Get Public Key
1. Go to "Account" → "General"
2. **Copy your Public Key** (like `user_abcdefghijk`)

### Step 5: Update Your .env File
```env
VITE_EMAILJS_SERVICE_ID="service_abc123"
VITE_EMAILJS_TEMPLATE_ID="template_xyz789"
VITE_EMAILJS_PUBLIC_KEY="user_abcdefghijk"
```

### Step 6: Test
1. Restart your dev server: `npm run dev`
2. Register a test team
3. Check if real emails are sent!

---

## 🆓 Option 2: Resend (Alternative)

### Step 1: Create Resend Account
1. Go to https://resend.com/
2. Sign up with GitHub/Google
3. **No credit card required** for free tier

### Step 2: Get API Key
1. Go to "API Keys"
2. Create new API key
3. Copy the key

### Step 3: Update Code
You'd need to modify the email service to use Resend API instead of EmailJS.

---

## 🆓 Option 3: Brevo (Sendinblue)

### Step 1: Create Account
1. Go to https://www.brevo.com/
2. Sign up for free account
3. Verify email

### Step 2: Get API Key
1. Go to "SMTP & API"
2. Create API key
3. Copy the key

---

## 🎯 Current Status

**Right now your system works with EMAIL PREVIEWS in console.**

When you register teams, you'll see the email content in your browser console (F12). This lets you test the entire system without setting up real email sending.

**To send real emails**: Follow the EmailJS setup above (takes 5 minutes).

## 🚀 Quick Test

1. **Make yourself admin** (add your user ID to admin role in Supabase)
2. **Go to** http://localhost:8081/dashboard
3. **Register a test team**
4. **Check browser console** (F12) to see email preview
5. **Team can login** with the generated credentials!

The auto-account creation and password generation is already working perfectly!