import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, 
  Search, 
  Edit, 
  Trash2, 
  Ban, 
  CheckCircle, 
  Mail,
  Key,
  RefreshCw,
  AlertTriangle,
  Crown,
  UserX,
  UserCheck,
  Filter
} from "lucide-react";

interface Team {
  id: string;
  team_name: string;
  team_code: string;
  leader_email: string;
  is_active: boolean;
  is_disqualified: boolean;
  eliminated_at: string | null;
  round_eliminated: number | null;
  total_score: number;
  round1_score: number;
  round2_score: number;
  round3_score: number;
  created_at: string;
}

type FilterStatus = "all" | "active" | "eliminated" | "disqualified";

export const TeamManagement = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

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

  // Filter teams based on search and status
  useEffect(() => {
    let filtered = teams;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(team => 
        team.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.team_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.leader_email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    switch (filterStatus) {
      case "active":
        filtered = filtered.filter(team => team.is_active && !team.is_disqualified);
        break;
      case "eliminated":
        filtered = filtered.filter(team => !team.is_active || team.eliminated_at);
        break;
      case "disqualified":
        filtered = filtered.filter(team => team.is_disqualified);
        break;
      default:
        // "all" - no additional filtering
        break;
    }

    setFilteredTeams(filtered);
  }, [teams, searchTerm, filterStatus]);

  // Load teams on component mount
  useEffect(() => {
    fetchTeams();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('team-management')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchTeams();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Toggle team active status
  const toggleTeamStatus = async (teamId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("teams")
        .update({ is_active: !currentStatus })
        .eq("id", teamId);

      if (error) throw error;
      toast.success(`Team ${!currentStatus ? "activated" : "deactivated"} successfully`);
    } catch (error) {
      console.error("Error updating team status:", error);
      toast.error("Failed to update team status");
    }
  };

  // Toggle team disqualification
  const toggleDisqualification = async (teamId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("teams")
        .update({ is_disqualified: !currentStatus })
        .eq("id", teamId);

      if (error) throw error;
      toast.success(`Team ${!currentStatus ? "disqualified" : "reinstated"} successfully`);
    } catch (error) {
      console.error("Error updating disqualification:", error);
      toast.error("Failed to update disqualification status");
    }
  };

  // Delete team
  const deleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete team "${teamName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", teamId);

      if (error) throw error;
      toast.success("Team deleted successfully");
    } catch (error) {
      console.error("Error deleting team:", error);
      toast.error("Failed to delete team");
    }
  };

  // Update team details
  const updateTeam = async (updatedTeam: Partial<Team>) => {
    if (!selectedTeam) return;

    try {
      const { error } = await supabase
        .from("teams")
        .update(updatedTeam)
        .eq("id", selectedTeam.id);

      if (error) throw error;
      toast.success("Team updated successfully");
      setIsEditDialogOpen(false);
      setSelectedTeam(null);
    } catch (error) {
      console.error("Error updating team:", error);
      toast.error("Failed to update team");
    }
  };

  // Generate new password for team
  const generateNewPassword = async (teamId: string, teamName: string) => {
    if (!confirm(`Generate new password for team "${teamName}"?`)) {
      return;
    }

    try {
      const newPassword = Math.random().toString(36).substring(2, 10);
      const encoder = new TextEncoder();
      const data = encoder.encode(newPassword);
      const hash = await crypto.subtle.digest('SHA-256', data);
      const passwordHash = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { error } = await supabase
        .from("teams")
        .update({ password_hash: passwordHash })
        .eq("id", teamId);

      if (error) throw error;
      
      // TODO: Send email with new password
      toast.success(`New password generated: ${newPassword}`);
    } catch (error) {
      console.error("Error generating new password:", error);
      toast.error("Failed to generate new password");
    }
  };

  // Get team status badge
  const getStatusBadge = (team: Team) => {
    if (team.is_disqualified) {
      return <Badge variant="destructive">Disqualified</Badge>;
    }
    if (!team.is_active || team.eliminated_at) {
      return <Badge variant="secondary">Eliminated</Badge>;
    }
    return <Badge variant="success">Active</Badge>;
  };

  // Get team stats
  const getTeamStats = () => {
    const active = teams.filter(t => t.is_active && !t.is_disqualified).length;
    const eliminated = teams.filter(t => !t.is_active || t.eliminated_at).length;
    const disqualified = teams.filter(t => t.is_disqualified).length;
    
    return { total: teams.length, active, eliminated, disqualified };
  };

  const stats = getTeamStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Teams</p>
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
            </div>
            <Users className="w-8 h-8 text-primary/50" />
          </div>
        </Card>
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-500">{stats.active}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-500/50" />
          </div>
        </Card>
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Eliminated</p>
              <p className="text-2xl font-bold text-yellow-500">{stats.eliminated}</p>
            </div>
            <UserX className="w-8 h-8 text-yellow-500/50" />
          </div>
        </Card>
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Disqualified</p>
              <p className="text-2xl font-bold text-red-500">{stats.disqualified}</p>
            </div>
            <Ban className="w-8 h-8 text-red-500/50" />
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card variant="glass">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search teams by name, code, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {(["all", "active", "eliminated", "disqualified"] as FilterStatus[]).map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === status ? "neon" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                >
                  <Filter className="w-4 h-4 mr-1" />
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teams List */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Teams ({filteredTeams.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {filteredTeams.map((team) => (
                <motion.div
                  key={team.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{team.team_name}</h3>
                      {getStatusBadge(team)}
                      <Badge variant="outline" className="font-mono">
                        {team.team_code}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {team.leader_email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        {team.total_score} pts
                      </span>
                      <span>
                        Registered: {new Date(team.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTeam(team);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant={team.is_active ? "destructive" : "success"}
                      size="sm"
                      onClick={() => toggleTeamStatus(team.id, team.is_active)}
                    >
                      {team.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </Button>

                    <Button
                      variant={team.is_disqualified ? "outline" : "destructive"}
                      size="sm"
                      onClick={() => toggleDisqualification(team.id, team.is_disqualified)}
                    >
                      {team.is_disqualified ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateNewPassword(team.id, team.team_name)}
                    >
                      <Key className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteTeam(team.id, team.team_name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredTeams.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No teams found matching your criteria</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Team Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team: {selectedTeam?.team_name}</DialogTitle>
          </DialogHeader>
          {selectedTeam && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Team Name</Label>
                <Input
                  value={selectedTeam.team_name}
                  onChange={(e) => setSelectedTeam(prev => prev ? { ...prev, team_name: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Leader Email</Label>
                <Input
                  type="email"
                  value={selectedTeam.leader_email}
                  onChange={(e) => setSelectedTeam(prev => prev ? { ...prev, leader_email: e.target.value } : null)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Round 1 Score</Label>
                  <Input
                    type="number"
                    value={selectedTeam.round1_score}
                    onChange={(e) => setSelectedTeam(prev => prev ? { ...prev, round1_score: parseInt(e.target.value) || 0 } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Round 2 Score</Label>
                  <Input
                    type="number"
                    value={selectedTeam.round2_score}
                    onChange={(e) => setSelectedTeam(prev => prev ? { ...prev, round2_score: parseInt(e.target.value) || 0 } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Round 3 Score</Label>
                  <Input
                    type="number"
                    value={selectedTeam.round3_score}
                    onChange={(e) => setSelectedTeam(prev => prev ? { ...prev, round3_score: parseInt(e.target.value) || 0 } : null)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => updateTeam(selectedTeam)}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};