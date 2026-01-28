import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, 
  Plus, 
  Trash2, 
  Mail, 
  Key, 
  Upload,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface TeamMember {
  name: string;
  email: string;
  role: string;
}

interface TeamRegistrationData {
  teamName: string;
  leaderEmail: string;
  members: TeamMember[];
  institution?: string;
  phone?: string;
}

interface BulkTeamData {
  teams: TeamRegistrationData[];
}

export const TeamRegistration = () => {
  const [singleTeam, setSingleTeam] = useState<TeamRegistrationData>({
    teamName: "",
    leaderEmail: "",
    members: [{ name: "", email: "", role: "Member" }],
    institution: "",
    phone: ""
  });

  const [bulkTeams, setBulkTeams] = useState<TeamRegistrationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<"single" | "bulk">("single");

  // Generate team code
  const generateTeamCode = (teamName: string): string => {
    const prefix = teamName.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${random}`;
  };

  // Generate secure password
  const generatePassword = (): string => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Hash password (simple hash for demo - use bcrypt in production)
  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // Add member to single team
  const addMember = () => {
    setSingleTeam(prev => ({
      ...prev,
      members: [...prev.members, { name: "", email: "", role: "Member" }]
    }));
  };

  // Remove member from single team
  const removeMember = (index: number) => {
    setSingleTeam(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index)
    }));
  };

  // Update member data
  const updateMember = (index: number, field: keyof TeamMember, value: string) => {
    setSingleTeam(prev => ({
      ...prev,
      members: prev.members.map((member, i) => 
        i === index ? { ...member, [field]: value } : member
      )
    }));
  };

  // Register single team
  const registerSingleTeam = async () => {
    if (!singleTeam.teamName || !singleTeam.leaderEmail) {
      toast.error("Team name and leader email are required");
      return;
    }

    setIsLoading(true);
    try {
      const teamCode = generateTeamCode(singleTeam.teamName);
      const password = generatePassword();
      const passwordHash = await hashPassword(password);

      const { data, error } = await supabase
        .from("teams")
        .insert({
          team_name: singleTeam.teamName,
          team_code: teamCode,
          leader_email: singleTeam.leaderEmail,
          password_hash: passwordHash,
          is_active: true,
          is_disqualified: false,
          current_round: 0,
          total_score: 0,
          round1_score: 0,
          round2_score: 0,
          round3_score: 0
        })
        .select()
        .single();

      if (error) throw error;

      // TODO: Send email with credentials
      toast.success(`Team registered successfully! Code: ${teamCode}, Password: ${password}`);
      
      // Reset form
      setSingleTeam({
        teamName: "",
        leaderEmail: "",
        members: [{ name: "", email: "", role: "Member" }],
        institution: "",
        phone: ""
      });

    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Failed to register team");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle bulk upload
  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data: BulkTeamData = JSON.parse(content);
        setBulkTeams(data.teams || []);
        toast.success(`Loaded ${data.teams?.length || 0} teams from file`);
      } catch (error) {
        toast.error("Invalid JSON file format");
      }
    };
    reader.readAsText(file);
  };

  // Register bulk teams
  const registerBulkTeams = async () => {
    if (bulkTeams.length === 0) {
      toast.error("No teams to register");
      return;
    }

    setIsLoading(true);
    const results = [];

    try {
      for (const team of bulkTeams) {
        const teamCode = generateTeamCode(team.teamName);
        const password = generatePassword();
        const passwordHash = await hashPassword(password);

        const { data, error } = await supabase
          .from("teams")
          .insert({
            team_name: team.teamName,
            team_code: teamCode,
            leader_email: team.leaderEmail,
            password_hash: passwordHash,
            is_active: true,
            is_disqualified: false,
            current_round: 0,
            total_score: 0,
            round1_score: 0,
            round2_score: 0,
            round3_score: 0
          })
          .select()
          .single();

        if (error) {
          results.push({ team: team.teamName, success: false, error: error.message });
        } else {
          results.push({ 
            team: team.teamName, 
            success: true, 
            teamCode, 
            password,
            leaderEmail: team.leaderEmail
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      toast.success(`Registered ${successful} teams successfully. ${failed} failed.`);
      
      // TODO: Send bulk emails with credentials
      console.log("Registration results:", results);

      setBulkTeams([]);
    } catch (error) {
      console.error("Bulk registration error:", error);
      toast.error("Failed to register teams");
    } finally {
      setIsLoading(false);
    }
  };

  // Download sample JSON
  const downloadSampleJSON = () => {
    const sample: BulkTeamData = {
      teams: [
        {
          teamName: "Code Warriors",
          leaderEmail: "leader1@example.com",
          members: [
            { name: "John Doe", email: "john@example.com", role: "Leader" },
            { name: "Jane Smith", email: "jane@example.com", role: "Member" }
          ],
          institution: "University XYZ",
          phone: "+1234567890"
        },
        {
          teamName: "Debug Masters",
          leaderEmail: "leader2@example.com",
          members: [
            { name: "Alice Johnson", email: "alice@example.com", role: "Leader" },
            { name: "Bob Wilson", email: "bob@example.com", role: "Member" }
          ],
          institution: "Tech Institute ABC",
          phone: "+0987654321"
        }
      ]
    };

    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "team_registration_sample.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            TEAM REGISTRATION
          </h2>
          <p className="text-muted-foreground font-mono mt-1">
            Register teams for CodeWars 2.0 competition
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={registrationMode === "single" ? "neon" : "outline"}
            size="sm"
            onClick={() => setRegistrationMode("single")}
          >
            Single Team
          </Button>
          <Button
            variant={registrationMode === "bulk" ? "neon" : "outline"}
            size="sm"
            onClick={() => setRegistrationMode("bulk")}
          >
            Bulk Upload
          </Button>
        </div>
      </div>

      {registrationMode === "single" ? (
        /* Single Team Registration */
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Register Single Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Team Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name *</Label>
                <Input
                  id="teamName"
                  value={singleTeam.teamName}
                  onChange={(e) => setSingleTeam(prev => ({ ...prev, teamName: e.target.value }))}
                  placeholder="Enter team name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaderEmail">Leader Email *</Label>
                <Input
                  id="leaderEmail"
                  type="email"
                  value={singleTeam.leaderEmail}
                  onChange={(e) => setSingleTeam(prev => ({ ...prev, leaderEmail: e.target.value }))}
                  placeholder="leader@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution">Institution</Label>
                <Input
                  id="institution"
                  value={singleTeam.institution}
                  onChange={(e) => setSingleTeam(prev => ({ ...prev, institution: e.target.value }))}
                  placeholder="University/College name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={singleTeam.phone}
                  onChange={(e) => setSingleTeam(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1234567890"
                />
              </div>
            </div>

            <Separator />

            {/* Team Members */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">Team Members</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addMember}
                  disabled={singleTeam.members.length >= 4}
                >
                  <Plus className="w-4 h-4" />
                  Add Member
                </Button>
              </div>

              {singleTeam.members.map((member, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded-lg"
                >
                  <Input
                    placeholder="Member name"
                    value={member.name}
                    onChange={(e) => updateMember(index, "name", e.target.value)}
                  />
                  <Input
                    placeholder="member@example.com"
                    type="email"
                    value={member.email}
                    onChange={(e) => updateMember(index, "email", e.target.value)}
                  />
                  <Input
                    placeholder="Role"
                    value={member.role}
                    onChange={(e) => updateMember(index, "role", e.target.value)}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeMember(index)}
                    disabled={singleTeam.members.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </div>

            <Button
              onClick={registerSingleTeam}
              disabled={isLoading}
              className="w-full"
              variant="neon"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Register Team
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Bulk Team Registration */
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Bulk Team Registration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={downloadSampleJSON}
              >
                <Download className="w-4 h-4" />
                Download Sample JSON
              </Button>
              
              <div className="flex-1">
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleBulkUpload}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                />
              </div>
            </div>

            {bulkTeams.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Teams to Register ({bulkTeams.length})</Label>
                  <Badge variant="secondary">{bulkTeams.length} teams loaded</Badge>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2">
                  {bulkTeams.map((team, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-semibold">{team.teamName}</p>
                        <p className="text-sm text-muted-foreground">{team.leaderEmail}</p>
                      </div>
                      <Badge variant="outline">{team.members.length} members</Badge>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={registerBulkTeams}
                  disabled={isLoading}
                  className="w-full"
                  variant="neon"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Registering Teams...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Register All Teams
                    </>
                  )}
                </Button>
              </div>
            )}

            {bulkTeams.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Upload a JSON file to register multiple teams at once</p>
                <p className="text-sm mt-2">Download the sample file to see the required format</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};