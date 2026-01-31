// EmailJS Integration for Free Email Sending
// Install: npm install @emailjs/browser

import emailjs from '@emailjs/browser';
import { config } from './config';

interface EmailJSConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
}

interface TeamCredentialsEmail {
  team_name: string;
  team_code: string;
  password: string;
  leader_email: string;
  login_url: string;
}

class EmailJSService {
  private config: EmailJSConfig;
  private isInitialized = false;

  constructor() {
    this.config = {
      serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || '',
      templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '',
      publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || ''
    };

    this.initialize();
  }

  private initialize() {
    if (this.config.publicKey) {
      emailjs.init(this.config.publicKey);
      this.isInitialized = true;
      console.log('📧 EmailJS initialized successfully');
    } else {
      console.warn('📧 EmailJS not configured - emails will be logged to console');
    }
  }

  async sendTeamCredentials(credentials: TeamCredentialsEmail): Promise<boolean> {
    if (!this.isInitialized) {
      // Fallback to console logging
      console.log('📧 EMAIL PREVIEW (EmailJS not configured):');
      console.log('To:', credentials.leader_email);
      console.log('Subject: 🚀 Welcome to CodeWars 2.0 - Your Team Credentials');
      console.log('Content:');
      console.log(`
Dear ${credentials.team_name} Team Leader,

Welcome to CodeWars 2.0! 🚀 We're excited to have you onboard and look forward to an intense, fun, and competitive coding experience.

📌 Event Details
Event Name: CodeWars 2.0 - The Ultimate Coding Competition
Date: 5th Feb 2026
Time: 10 pm onwards
Mode: Online

🔐 Login Credentials
You can access the competition portal using the credentials below:

Team Name: ${credentials.team_name}
Team Code: ${credentials.team_code}
Password: ${credentials.password}
Email: ${credentials.leader_email}

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

This email was sent to ${credentials.leader_email} because your team is registered for CodeWars 2.0.

🏆 May the best code win! 🏆
      `);
      return true; // Return true for demo purposes
    }

    try {
      const templateParams = {
        to_email: credentials.leader_email,
        participant_name: credentials.team_name,
        team_name: credentials.team_name,
        team_code: credentials.team_code,
        temporary_password: credentials.password,
        email: credentials.leader_email,
        from_name: 'CodeWars 2.0 Organizing Committee'
      };

      const response = await emailjs.send(
        this.config.serviceId,
        this.config.templateId,
        templateParams
      );

      if (response.status === 200) {
        console.log('✅ Email sent successfully via EmailJS to:', credentials.leader_email);
        return true;
      } else {
        throw new Error(`EmailJS returned status: ${response.status}`);
      }
    } catch (error: any) {
      console.error('❌ Failed to send email via EmailJS:', error);
      return false;
    }
  }

  async sendRoundNotification(
    emails: string[], 
    roundNumber: number, 
    roundName: string, 
    timeLimit: number
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        if (!this.isInitialized) {
          // Console preview for round notifications
          console.log(`📧 ROUND NOTIFICATION PREVIEW:
To: ${email}
Subject: 🚀 CodeWars 2.0 - Round ${roundNumber} Starting Soon!

Round ${roundNumber}: ${roundName}
Time Limit: ${Math.floor(timeLimit / 60)} minutes

Get ready! The next round is about to begin.
Login: ${window.location.origin}/dashboard
          `);
          sent++;
          continue;
        }

        const templateParams = {
          to_email: email,
          round_number: roundNumber,
          round_name: roundName,
          time_limit: Math.floor(timeLimit / 60),
          login_url: window.location.origin + '/dashboard'
        };

        const response = await emailjs.send(
          this.config.serviceId,
          'round_notification_template', // You'd need to create this template
          templateParams
        );

        if (response.status === 200) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error('Failed to send round notification to:', email, error);
        failed++;
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { sent, failed };
  }

  isConfigured(): boolean {
    return this.isInitialized;
  }

  getConfig(): EmailJSConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const emailJSService = new EmailJSService();

// Convenience function for team credentials (matches existing interface)
export async function sendTeamCredentials(credentials: {
  teamName: string;
  teamCode: string;
  password: string;
  leaderEmail: string;
  loginUrl: string;
}): Promise<boolean> {
  return await emailJSService.sendTeamCredentials({
    team_name: credentials.teamName,
    team_code: credentials.teamCode,
    password: credentials.password,
    leader_email: credentials.leaderEmail,
    login_url: credentials.loginUrl
  });
}