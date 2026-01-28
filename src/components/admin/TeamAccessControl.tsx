import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { eliminateTeamsBelowRank, reinstateTeam as reinstateTeamUtil } from "@/lib/teamElimination";
import { toast } from "sonner";
import { 
  Users, 
  UserX, 
  UserCheck, 
  Crown, 
  AlertTriangle,
  RefreshCw,
  Filter,
  Zap,
  Ban,
  CheckCircle,
  Trophy,
  Target,
  Scissors
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

interface GameState {
  id: string;
  current_round: number;
  is_competition_active: boolean;
}

export const TeamAccessControl = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [eliminationCount, setEliminationCount] = useState<number>(0);
  const [isEliminationDialogOpen, setIsEliminationDialogOpen] = useState(false);

  // Fetch data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [teamsResponse, gameStateResponse] = await Promise.all([
        supabase.from("teams").select("*").order("total_score", { ascending: false }),
        supabase.from("game_state").select("*").single()
      ]);

      if (teamsResponse.error) throw teamsResponse.error;
      if (gameStateResponse.error) throw gameStateResponse.error;

      setTeams(teamsResponse.data || []);
      setGameState(gameStateResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('team-access-control')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Get teams by status
  const getTeamsByStatus = () => {
    const active = teams.filter(t => t.is_active && !t.is_disqualified && !t.eliminated_at);
    const eliminated = teams.filter(t => t.eliminated_at || (!t.is_active && !t.is_disqualified));
    const disqualified = teams.filter(t => t.is_disqualified);
    
    return { active, eliminated, disqualified };
  };

  // Get teams eligible for a specific round
  const getEligibleTeams = (roundNumber: number) => {
    return teams.filter(team => 
      team.is_active && 
      !team.is_disqualified && 
      (team.round_eliminated === null || team.round_eliminated >= roundNumber)
    );
  };

  // Bulk eliminate teams below a certain rank
  const bulkEliminateTeams = async () => {
    if (eliminationCount <= 0) {
      toast.error("Please specify how many teams to eliminate");
      return;
    }

    const eligibleTeams = getEligibleTeams(selectedRound);
    const keepTopN = eligibleTeams.length - eliminationCount;
    
    if (keepTopN <= 0) {
      toast.error("Cannot eliminate all teams");
      return;
    }

    try {
      const result = await eliminateTeamsBelowRank(selectedRound, keepTopN);
      
      if (result.success) {
        toast.success(`Successfully eliminated ${result.eliminatedCount} teams from Round ${selectedRound}. ${result.remainingCount} teams remaining.`);
        setIsEliminationDialogOpen(false);
        setEliminationCount(0);
        fetchData(); // Refresh data
      } else {
        throw new Error(result.error || "Failed to eliminate teams");
      }
      
    } catch (error) {
      console.error("Error eliminating teams:", error);
      toast.error("Failed to eliminate teams");
    }
  };

  // Manually toggle team access
  const toggleTeamAccess = async (teamId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("teams")
        .update({ is_active: !currentStatus })
        .eq("id", teamId);

      if (error) throw error;
      toast.success(`Team access ${!currentStatus ? "granted" : "revoked"}`);
    } catch (error) {
      console.error("Error updating team access:", error);
      toast.error("Failed to update team access");
    }
  };

  // Reinstate eliminated team
  const reinstateTeam = async (teamId: string) => {
    try {
      const result = await reinstateTeamUtil(teamId);
      
      if (result.success) {
        toast.success("Team reinstated successfully");
        fetchData(); // Refresh data
      } else {
        throw new Error(result.error || "Failed to reinstate team");
      }
    } catch (error) {
      console.error("Error reinstating team:", error);
      toast.error("Failed to reinstate team");
    }
  };

  // Get round-specific score
  const getRoundScore = (team: Team, round: number) => {
    switch (round) {
      case 1: return team.round1_score || 0;
      case 2: return team.round2_score || 0;
      case 3: return team.round3_score || 0;
      default: return team.total_score || 0;
    }
  };

  const { active, eliminated, disqualified } = getTeamsByStatus();
  const eligibleForCurrentRound = getEligibleTeams(gameState?.current_round || 1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Teams</p>
              <p className="text-2xl font-bold text-green-500">{active.length}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-500/50" />
          </div>
        </Card>
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Eliminated</p>
              <p className="text-2xl font-bold text-yellow-500">{eliminated.length}</p>
            </div>
            <UserX className="w-8 h-8 text-yellow-500/50" />
          </div>
        </Card>
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Disqualified</p>
              <p className="text-2xl font-bold text-red-500">{disqualified.length}</p>
            </div>
            <Ban className="w-8 h-8 text-red-500/50" />
          </div>
        </Card>
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Round {gameState?.current_round || 1} Eligible</p>
              <p className="text-2xl font-bold text-primary">{eligibleForCurrentRound.length}</p>
            </div>
            <Target className="w-8 h-8 text-primary/50" />
          </div>
        </Card>
      </div>

      {/* Bulk Elimination Controls */}
      <Card variant="neon">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5" />
            BULK ELIMINATION CONTROL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Round:</Label>
              <Select value={selectedRound.toString()} onValueChange={(value) => setSelectedRound(parseInt(value))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Round 1</SelectItem>
                  <SelectItem value="2">Round 2</SelectItem>
                  <SelectItem value="3">Round 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label>Eligible Teams:</Label>
              <Badge variant="outline">{getEligibleTeams(selectedRound).length}</Badge>
            </div>

            <Dialog open={isEliminationDialogOpen} onOpenChange={setIsEliminationDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Scissors className="w-4 h-4" />
                  Eliminate Teams
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Team Elimination - Round {selectedRound}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Number of teams to eliminate (from bottom)</Label>
                    <Input
                      type="number"
                      min="1"
                      max={getEligibleTeams(selectedRound).length - 1}
                      value={eliminationCount}
                      onChange={(e) => setEliminationCount(parseInt(e.target.value) || 0)}
                      placeholder="Enter number of teams"
                    />
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <p>This will eliminate the <strong>{eliminationCount}</strong> lowest-scoring teams from Round {selectedRound}.</p>
                    <p>Remaining teams: <strong>{getEligibleTeams(selectedRound).length - eliminationCount}</strong></p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEliminationDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={bulkEliminateTeams}
                      disabled={eliminationCount <= 0 || eliminationCount >= getEligibleTeams(selectedRound).length}
                    >
                      Eliminate {eliminationCount} Teams
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Team Status Management */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Teams */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-500">
              <UserCheck className="w-5 h-5" />
              Active Teams ({active.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto space-y-2">
            <AnimatePresence>
              {active.map((team) => (
                <motion.div
                  key={team.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center justify-between p-3 border rounded-lg bg-green-500/5 border-green-500/20"
                >
                  <div>
                    <p className="font-semibold">{team.team_name}</p>
                    <p className="text-xs text-muted-foreground">{team.team_code}</p>
                    <p className="text-xs text-green-600">{team.total_score} pts</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => toggleTeamAccess(team.id, team.is_active)}
                  >
                    <UserX className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            {active.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <UserCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No active teams</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Eliminated Teams */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <UserX className="w-5 h-5" />
              Eliminated Teams ({eliminated.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto space-y-2">
            <AnimatePresence>
              {eliminated.map((team) => (
                <motion.div
                  key={team.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center justify-between p-3 border rounded-lg bg-yellow-500/5 border-yellow-500/20"
                >
                  <div>
                    <p className="font-semibold">{team.team_name}</p>
                    <p className="text-xs text-muted-foreground">{team.team_code}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-yellow-600">{team.total_score} pts</span>
                      {team.round_eliminated && (
                        <Badge variant="outline" className="text-xs">
                          R{team.round_eliminated}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => reinstateTeam(team.id)}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            {eliminated.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <UserX className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No eliminated teams</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disqualified Teams */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <Ban className="w-5 h-5" />
              Disqualified Teams ({disqualified.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto space-y-2">
            <AnimatePresence>
              {disqualified.map((team) => (
                <motion.div
                  key={team.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center justify-between p-3 border rounded-lg bg-red-500/5 border-red-500/20"
                >
                  <div>
                    <p className="font-semibold">{team.team_name}</p>
                    <p className="text-xs text-muted-foreground">{team.team_code}</p>
                    <p className="text-xs text-red-600">{team.total_score} pts</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTeamAccess(team.id, team.is_active)}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            {disqualified.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Ban className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No disqualified teams</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};