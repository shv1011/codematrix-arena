import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import { TeamRegistration } from "@/components/admin/TeamRegistration";
import { TeamManagement } from "@/components/admin/TeamManagement";
import { TeamAccessControl } from "@/components/admin/TeamAccessControl";
import { EmailManagement } from "@/components/admin/EmailManagement";
import { QuestionManager } from "@/components/admin/QuestionManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Play, 
  Pause, 
  SkipForward, 
  Users, 
  Settings, 
  Trophy,
  AlertTriangle,
  Ban,
  CheckCircle,
  Terminal,
  Zap,
  UserPlus,
  Users as UsersIcon,
  Mail,
  Shield,
  FileText
} from "lucide-react";

interface Team {
  id: string;
  team_name: string;
  team_code: string;
  leader_email: string;
  is_active: boolean;
  is_disqualified: boolean;
  total_score: number;
  round1_score: number;
  round2_score: number;
  round3_score: number;
}

interface GameState {
  id: string;
  current_round: number;
  is_competition_active: boolean;
}

interface Round {
  id: string;
  round_number: number;
  round_name: string;
  is_active: boolean;
}

export const AdminDashboard = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    // Subscribe to realtime updates
    const teamsChannel = supabase
      .channel('admin-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchTeams();
      })
      .subscribe();

    const gameStateChannel = supabase
      .channel('admin-gamestate')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, () => {
        fetchGameState();
      })
      .subscribe();

    return () => {
      teamsChannel.unsubscribe();
      gameStateChannel.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchTeams(), fetchGameState(), fetchRounds()]);
    setIsLoading(false);
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("total_score", { ascending: false });
    
    if (!error && data) {
      setTeams(data);
    }
  };

  const fetchGameState = async () => {
    const { data, error } = await supabase
      .from("game_state")
      .select("*")
      .single();
    
    if (!error && data) {
      setGameState(data);
    }
  };

  const fetchRounds = async () => {
    const { data, error } = await supabase
      .from("rounds")
      .select("*")
      .order("round_number");
    
    if (!error && data) {
      setRounds(data);
    }
  };

  const toggleCompetition = async () => {
    if (!gameState) return;
    
    const { error } = await supabase
      .from("game_state")
      .update({ is_competition_active: !gameState.is_competition_active })
      .eq("id", gameState.id);
    
    if (error) {
      toast.error("Failed to toggle competition");
    } else {
      toast.success(gameState.is_competition_active ? "Competition paused" : "Competition started!");
    }
  };

  const startRound = async (roundNumber: number) => {
    if (!gameState) return;

    // Deactivate all rounds first
    await supabase
      .from("rounds")
      .update({ is_active: false })
      .neq("round_number", 0);

    // Activate the selected round
    const { error: roundError } = await supabase
      .from("rounds")
      .update({ is_active: true, start_time: new Date().toISOString() })
      .eq("round_number", roundNumber);

    // Update game state
    const { error: gameError } = await supabase
      .from("game_state")
      .update({ current_round: roundNumber, is_competition_active: true })
      .eq("id", gameState.id);

    if (roundError || gameError) {
      toast.error("Failed to start round");
    } else {
      toast.success(`Round ${roundNumber} started!`);
    }
  };

  const toggleTeamStatus = async (teamId: string, field: "is_active" | "is_disqualified", currentValue: boolean) => {
    const { error } = await supabase
      .from("teams")
      .update({ [field]: !currentValue })
      .eq("id", teamId);

    if (error) {
      toast.error("Failed to update team status");
    } else {
      toast.success("Team status updated");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const activeTeams = teams.filter(t => t.is_active && !t.is_disqualified);
  const currentRound = rounds.find(r => r.is_active);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Terminal className="w-8 h-8 text-primary" />
            ADMIN CONTROL
          </h1>
          <p className="text-muted-foreground font-mono mt-1">
            Manage competition, teams, and rounds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-mono ${
            gameState?.is_competition_active 
              ? "bg-accent/20 text-accent" 
              : "bg-muted text-muted-foreground"
          }`}>
            <span className={`w-2 h-2 rounded-full ${gameState?.is_competition_active ? "bg-accent animate-pulse" : "bg-muted-foreground"}`} />
            {gameState?.is_competition_active ? "LIVE" : "PAUSED"}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Teams", value: teams.length, icon: Users },
          { label: "Active Teams", value: activeTeams.length, icon: CheckCircle },
          { label: "Current Round", value: gameState?.current_round || 0, icon: Zap },
          { label: "Top Score", value: teams[0]?.total_score || 0, icon: Trophy },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card variant="glass" className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-mono">{stat.label}</p>
                  <p className="text-2xl font-display font-bold text-primary">{stat.value}</p>
                </div>
                <stat.icon className="w-8 h-8 text-primary/50" />
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="control" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="control" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Control
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Questions
          </TabsTrigger>
          <TabsTrigger value="register" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Register Teams
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4" />
            Manage Teams
          </TabsTrigger>
          <TabsTrigger value="access" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Access Control
          </TabsTrigger>
          <TabsTrigger value="emails" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        {/* Competition Control Tab */}
        <TabsContent value="control" className="space-y-6">
          {/* Round Control */}
          <Card variant="neon">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                ROUND CONTROL
              </CardTitle>
              <CardDescription>Start, stop, and manage competition rounds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button
                  variant={gameState?.is_competition_active ? "destructive" : "success"}
                  size="lg"
                  onClick={toggleCompetition}
                >
                  {gameState?.is_competition_active ? (
                    <>
                      <Pause className="w-5 h-5" />
                      Pause Competition
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Start Competition
                    </>
                  )}
                </Button>

                {rounds.map((round) => (
                  <Button
                    key={round.id}
                    variant={round.is_active ? "neon" : "outline"}
                    onClick={() => startRound(round.round_number)}
                    disabled={round.is_active}
                  >
                    <SkipForward className="w-4 h-4" />
                    {round.round_name}
                    {round.is_active && " (Active)"}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Team Overview */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                TEAM OVERVIEW
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto scrollbar-cyber">
              <div className="space-y-2">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      team.is_disqualified 
                        ? "border-destructive/30 bg-destructive/5" 
                        : team.is_active 
                          ? "border-border bg-card" 
                          : "border-muted bg-muted/30"
                    }`}
                  >
                    <div>
                      <p className="font-display font-semibold">{team.team_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{team.team_code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-primary">{team.total_score} pts</span>
                      <Button
                        size="sm"
                        variant={team.is_disqualified ? "success" : "destructive"}
                        onClick={() => toggleTeamStatus(team.id, "is_disqualified", team.is_disqualified)}
                      >
                        {team.is_disqualified ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}

                {teams.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No teams registered</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Question Management Tab */}
        <TabsContent value="questions">
          <QuestionManager />
        </TabsContent>

        {/* Team Registration Tab */}
        <TabsContent value="register">
          <TeamRegistration />
        </TabsContent>

        {/* Team Management Tab */}
        <TabsContent value="manage">
          <TeamManagement />
        </TabsContent>

        {/* Team Access Control Tab */}
        <TabsContent value="access">
          <TeamAccessControl />
        </TabsContent>

        {/* Email Management Tab */}
        <TabsContent value="emails">
          <EmailManagement />
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard">
          <Leaderboard 
            teams={activeTeams.map(t => ({
              id: t.id,
              team_name: t.team_name,
              total_score: t.total_score,
              round1_score: t.round1_score,
              round2_score: t.round2_score,
              round3_score: t.round3_score,
            }))} 
            currentRound={gameState?.current_round}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
