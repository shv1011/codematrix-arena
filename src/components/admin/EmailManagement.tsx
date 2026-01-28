import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { config, validateConfig } from "@/lib/config";
import { toast } from "sonner";
import { 
  Mail, 
  Send, 
  Users, 
  Key, 
  Settings,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Copy
} from "lucide-react";

interface Team {
  id: string;
  team_name: string;
  team_code: string;
  leader_email: string;
  password_hash: string;
  is_active: boolean;
  is_disqualified: boolean;
}

interface EmailTemplate {
  subject: string;
  body: string;
}

export const EmailManagement = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>({
    subject: "CodeWars 2.0 - Team Credentials",
    body: `Dear Team Leader,

Welcome to CodeWars 2.0! Your team has been successfully registered for the competition.

Team Details:
- Team Name: {{TEAM_NAME}}
- Team Code: {{TEAM_CODE}}
- Password: {{PASSWORD}}

Competition Information:
- Date: [Competition Date]
- Time: [Competition Time]
- Platform: [Platform URL]

Please keep these credentials safe and share them only with your team members.

Best of luck!
CodeWars 2.0 Team`
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  // Fetch teams
  const fetchTeams = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast.error("Failed to fetch teams");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  // Toggle team selection
  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  // Select all teams
  const selectAllTeams = () => {
    setSelectedTeams(teams.map(team => team.id));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTeams([]);
  };

  // Generate new password for team (for email purposes)
  const generatePassword = (): string => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Process email template with team data
  const processEmailTemplate = (template: string, team: Team, password: string): string => {
    return template
      .replace(/{{TEAM_NAME}}/g, team.team_name)
      .replace(/{{TEAM_CODE}}/g, team.team_code)
      .replace(/{{PASSWORD}}/g, password)
      .replace(/{{LEADER_EMAIL}}/g, team.leader_email);
  };

  // Send emails to selected teams
  const sendEmails = async () => {
    if (selectedTeams.length === 0) {
      toast.error("Please select at least one team");
      return;
    }

    if (!validateConfig.hasEmailConfig()) {
      toast.error("Email service is not configured. Please check your environment variables.");
      return;
    }

    setIsSending(true);
    const results = [];

    try {
      for (const teamId of selectedTeams) {
        const team = teams.find(t => t.id === teamId);
        if (!team) continue;

        // Generate new password for this email
        const newPassword = generatePassword();
        
        // Hash the new password
        const encoder = new TextEncoder();
        const data = encoder.encode(newPassword);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const passwordHash = Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Update team password in database
        const { error: updateError } = await supabase
          .from("teams")
          .update({ password_hash: passwordHash })
          .eq("id", teamId);

        if (updateError) {
          results.push({ team: team.team_name, success: false, error: updateError.message });
          continue;
        }

        // Process email template
        const emailBody = processEmailTemplate(emailTemplate.body, team, newPassword);
        const emailSubject = processEmailTemplate(emailTemplate.subject, team, newPassword);

        // TODO: Implement actual email sending
        // For now, we'll simulate email sending
        console.log(`Sending email to ${team.leader_email}:`, {
          subject: emailSubject,
          body: emailBody
        });

        // Simulate email sending delay
        await new Promise(resolve => setTimeout(resolve, 500));

        results.push({ 
          team: team.team_name, 
          success: true, 
          email: team.leader_email,
          password: newPassword
        });
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      toast.success(`Sent ${successful} emails successfully. ${failed} failed.`);
      
      // Log results for admin reference
      console.log("Email sending results:", results);

      // Clear selection after sending
      setSelectedTeams([]);
      
      // Refresh teams data
      fetchTeams();

    } catch (error) {
      console.error("Error sending emails:", error);
      toast.error("Failed to send emails");
    } finally {
      setIsSending(false);
    }
  };

  // Copy team credentials to clipboard
  const copyCredentials = (team: Team) => {
    const credentials = `Team: ${team.team_name}\nCode: ${team.team_code}\nEmail: ${team.leader_email}`;
    navigator.clipboard.writeText(credentials);
    toast.success("Credentials copied to clipboard");
  };

  // Preview email for selected team
  const previewEmail = (team: Team) => {
    const samplePassword = "SAMPLE123";
    const processedSubject = processEmailTemplate(emailTemplate.subject, team, samplePassword);
    const processedBody = processEmailTemplate(emailTemplate.body, team, samplePassword);
    
    alert(`Subject: ${processedSubject}\n\n${processedBody}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Configuration Status */}
      <Card variant={validateConfig.hasEmailConfig() ? "glass" : "destructive"}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {validateConfig.hasEmailConfig() ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-semibold">Email Service Configured</p>
                  <p className="text-sm text-muted-foreground">
                    From: {config.email.fromAddress} ({config.email.fromName})
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="font-semibold">Email Service Not Configured</p>
                  <p className="text-sm text-muted-foreground">
                    Please configure VITE_EMAIL_SERVICE_KEY and VITE_EMAIL_FROM_ADDRESS in your environment
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Email Template */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Template
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={emailTemplate.subject}
                onChange={(e) => setEmailTemplate(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Email subject"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="body">Email Body</Label>
              <Textarea
                id="body"
                value={emailTemplate.body}
                onChange={(e) => setEmailTemplate(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Email body with placeholders"
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Available placeholders:</strong></p>
              <p>• {{TEAM_NAME}} - Team name</p>
              <p>• {{TEAM_CODE}} - Team code</p>
              <p>• {{PASSWORD}} - Generated password</p>
              <p>• {{LEADER_EMAIL}} - Leader email</p>
            </div>
          </CardContent>
        </Card>

        {/* Team Selection */}
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Select Teams ({selectedTeams.length}/{teams.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswords(!showPasswords)}
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={selectAllTeams}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {teams.map((team) => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTeams.includes(team.id) 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => toggleTeamSelection(team.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{team.team_name}</p>
                      <Badge variant="outline" className="font-mono text-xs">
                        {team.team_code}
                      </Badge>
                      {!team.is_active && <Badge variant="secondary">Inactive</Badge>}
                      {team.is_disqualified && <Badge variant="destructive">Disqualified</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{team.leader_email}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        previewEmail(team);
                      }}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyCredentials(team);
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}

              {teams.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No teams registered</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send Emails */}
      <Card variant="neon">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Send Credentials</h3>
              <p className="text-sm text-muted-foreground">
                {selectedTeams.length > 0 
                  ? `Ready to send emails to ${selectedTeams.length} selected team${selectedTeams.length > 1 ? 's' : ''}`
                  : "Select teams to send credentials via email"
                }
              </p>
            </div>
            <Button
              onClick={sendEmails}
              disabled={isSending || selectedTeams.length === 0 || !validateConfig.hasEmailConfig()}
              size="lg"
              variant="neon"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Emails
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};