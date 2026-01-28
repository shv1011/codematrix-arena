// Email automation service for CodeWars 2.0
import { config } from './config';

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export interface TeamCredentials {
  team_name: string;
  team_code: string;
  leader_email: string;
  password: string;
  member_names?: string;
  member_emails?: string;
}

export interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  error?: string;
  sent_at: string;
}

class EmailService {
  private logs: EmailLog[] = [];

  // Generate welcome email template
  generateWelcomeEmail(credentials: TeamCredentials): EmailTemplate {
    const subject = `🎯 CodeWars 2.0 - Team Registration Successful!`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CodeWars 2.0 - Welcome</title>
        <style>
          body { font-family: 'Courier New', monospace; background: #0a0a0a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: 1px solid #00ff88; border-radius: 10px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #00ff88; text-shadow: 0 0 10px #00ff88; }
          .credentials { background: rgba(0, 255, 136, 0.1); border: 1px solid #00ff88; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .cred-item { margin: 10px 0; }
          .cred-label { color: #00ff88; font-weight: bold; }
          .cred-value { color: #ffffff; font-size: 18px; letter-spacing: 1px; }
          .warning { background: rgba(255, 165, 0, 0.1); border: 1px solid #ffa500; border-radius: 8px; padding: 15px; margin: 20px 0; color: #ffa500; }
          .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
          .button { display: inline-block; background: linear-gradient(45deg, #00ff88, #00cc6a); color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">CODE<span style="color: #ff0080;">WARS</span> 2.0</div>
            <p>Welcome to the Ultimate Coding Competition!</p>
          </div>
          
          <h2 style="color: #00ff88;">🎉 Registration Successful!</h2>
          <p>Congratulations! Your team <strong>"${credentials.team_name}"</strong> has been successfully registered for CodeWars 2.0.</p>
          
          <div class="credentials">
            <h3 style="color: #00ff88; margin-top: 0;">🔐 Your Team Credentials</h3>
            <div class="cred-item">
              <span class="cred-label">Team Name:</span><br>
              <span class="cred-value">${credentials.team_name}</span>
            </div>
            <div class="cred-item">
              <span class="cred-label">Team Code:</span><br>
              <span class="cred-value">${credentials.team_code}</span>
            </div>
            <div class="cred-item">
              <span class="cred-label">Password:</span><br>
              <span class="cred-value">${credentials.password}</span>
            </div>
            <div class="cred-item">
              <span class="cred-label">Leader Email:</span><br>
              <span class="cred-value">${credentials.leader_email}</span>
            </div>
            ${credentials.member_names ? `
            <div class="cred-item">
              <span class="cred-label">Team Members:</span><br>
              <span class="cred-value">${credentials.member_names}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="warning">
            <strong>⚠️ IMPORTANT:</strong> Keep these credentials safe! You'll need them to access the competition platform. Do not share them with other teams.
          </div>
          
          <h3 style="color: #00ff88;">🏆 Competition Details</h3>
          <ul>
            <li><strong>Round 1:</strong> Aptitude Arena (30 minutes) - Multiple choice questions</li>
            <li><strong>Round 2:</strong> Constraint Paradox (60 minutes) - Coding with constraints</li>
            <li><strong>Round 3:</strong> Code Jeopardy (90 minutes) - Final showdown</li>
          </ul>
          
          <h3 style="color: #00ff88;">📋 Next Steps</h3>
          <ol>
            <li>Save these credentials in a secure location</li>
            <li>Wait for the competition start announcement</li>
            <li>Login to the platform when the competition begins</li>
            <li>Dominate the leaderboard! 🚀</li>
          </ol>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${window.location.origin}/login" class="button">Access Competition Platform</a>
          </div>
          
          <div class="footer">
            <p>Good luck and may the best code win!</p>
            <p>CodeWars 2.0 Team | ${new Date().getFullYear()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
CodeWars 2.0 - Team Registration Successful!

Congratulations! Your team "${credentials.team_name}" has been successfully registered for CodeWars 2.0.

YOUR TEAM CREDENTIALS:
Team Name: ${credentials.team_name}
Team Code: ${credentials.team_code}
Password: ${credentials.password}
Leader Email: ${credentials.leader_email}
${credentials.member_names ? `Team Members: ${credentials.member_names}` : ''}

IMPORTANT: Keep these credentials safe! You'll need them to access the competition platform.

COMPETITION DETAILS:
- Round 1: Aptitude Arena (30 minutes) - Multiple choice questions
- Round 2: Constraint Paradox (60 minutes) - Coding with constraints  
- Round 3: Code Jeopardy (90 minutes) - Final showdown

NEXT STEPS:
1. Save these credentials in a secure location
2. Wait for the competition start announcement
3. Login to the platform when the competition begins
4. Dominate the leaderboard!

Access the platform: ${window.location.origin}/login

Good luck and may the best code win!
CodeWars 2.0 Team
    `;

    return { subject, htmlContent, textContent };
  }

  // Generate round notification email
  generateRoundNotification(roundNumber: number, roundName: string, timeLimit: number): EmailTemplate {
    const subject = `🚀 CodeWars 2.0 - Round ${roundNumber} Starting Soon!`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CodeWars 2.0 - Round ${roundNumber}</title>
        <style>
          body { font-family: 'Courier New', monospace; background: #0a0a0a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: 1px solid #ff0080; border-radius: 10px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #00ff88; text-shadow: 0 0 10px #00ff88; }
          .round-info { background: rgba(255, 0, 128, 0.1); border: 1px solid #ff0080; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .timer { font-size: 24px; color: #ff0080; font-weight: bold; }
          .button { display: inline-block; background: linear-gradient(45deg, #ff0080, #cc0066); color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">CODE<span style="color: #ff0080;">WARS</span> 2.0</div>
            <p>The Competition Continues!</p>
          </div>
          
          <div class="round-info">
            <h2 style="color: #ff0080; margin-top: 0;">Round ${roundNumber}: ${roundName}</h2>
            <div class="timer">Time Limit: ${Math.floor(timeLimit / 60)} minutes</div>
          </div>
          
          <p>Get ready! The next round is about to begin. Make sure you're logged in and ready to compete.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${window.location.origin}/dashboard" class="button">Join Round ${roundNumber}</a>
          </div>
          
          <p style="text-align: center; color: #888;">Good luck, and may the best code win!</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
CodeWars 2.0 - Round ${roundNumber} Starting Soon!

Round ${roundNumber}: ${roundName}
Time Limit: ${Math.floor(timeLimit / 60)} minutes

Get ready! The next round is about to begin. Make sure you're logged in and ready to compete.

Join the competition: ${window.location.origin}/dashboard

Good luck, and may the best code win!
    `;

    return { subject, htmlContent, textContent };
  }

  // Send email using configured service
  async sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
    const emailLog: EmailLog = {
      id: crypto.randomUUID(),
      recipient: to,
      subject: template.subject,
      status: 'pending',
      sent_at: new Date().toISOString(),
    };

    this.logs.push(emailLog);

    try {
      // Check if email service is configured
      if (!config.email.serviceKey) {
        throw new Error('Email service not configured');
      }

      // For now, we'll simulate email sending
      // In production, integrate with SendGrid, AWS SES, or similar service
      console.log('📧 Sending email to:', to);
      console.log('📧 Subject:', template.subject);
      console.log('📧 Content preview:', template.textContent.substring(0, 200) + '...');

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For demo purposes, we'll always succeed
      // In production, make actual API call here
      const success = true;

      if (success) {
        emailLog.status = 'sent';
        console.log('✅ Email sent successfully to:', to);
        return true;
      } else {
        throw new Error('Email service returned error');
      }
    } catch (error: any) {
      emailLog.status = 'failed';
      emailLog.error = error.message;
      console.error('❌ Failed to send email to:', to, error.message);
      return false;
    }
  }

  // Send welcome emails to multiple teams
  async sendWelcomeEmails(teams: TeamCredentials[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const team of teams) {
      const template = this.generateWelcomeEmail(team);
      const success = await this.sendEmail(team.leader_email, template);
      
      if (success) {
        sent++;
      } else {
        failed++;
      }

      // Add delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { sent, failed };
  }

  // Send round notification to all active teams
  async sendRoundNotifications(
    teamEmails: string[], 
    roundNumber: number, 
    roundName: string, 
    timeLimit: number
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    const template = this.generateRoundNotification(roundNumber, roundName, timeLimit);

    for (const email of teamEmails) {
      const success = await this.sendEmail(email, template);
      
      if (success) {
        sent++;
      } else {
        failed++;
      }

      // Add delay between emails
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return { sent, failed };
  }

  // Get email logs
  getEmailLogs(): EmailLog[] {
    return [...this.logs].sort((a, b) => 
      new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
  }

  // Clear email logs
  clearLogs(): void {
    this.logs = [];
  }

  // Get email statistics
  getStats(): { total: number; sent: number; failed: number; pending: number } {
    const total = this.logs.length;
    const sent = this.logs.filter(log => log.status === 'sent').length;
    const failed = this.logs.filter(log => log.status === 'failed').length;
    const pending = this.logs.filter(log => log.status === 'pending').length;

    return { total, sent, failed, pending };
  }
}

// Export singleton instance
export const emailService = new EmailService();