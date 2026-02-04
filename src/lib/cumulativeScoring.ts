// Cumulative Scoring System for CodeWars 2.0
// Handles score accumulation across all rounds

import { supabase } from "@/integrations/supabase/client";

export interface TeamScores {
  teamId: string;
  teamName: string;
  round1Score: number;
  round2Score: number;
  round3Score: number;
  totalScore: number;
  jeopardyStartingScore: number; // R1 + R2 + 500 bonus
}

export class CumulativeScoringService {
  
  // Update team score for a specific round
  static async updateRoundScore(
    teamId: string, 
    roundNumber: number, 
    pointsToAdd: number
  ): Promise<boolean> {
    try {
      const columnName = `round${roundNumber}_score`;
      
      // Get current score
      const { data: currentTeam, error: fetchError } = await supabase
        .from("teams")
        .select(`${columnName}, round1_score, round2_score, round3_score`)
        .eq("id", teamId)
        .single();

      if (fetchError) throw fetchError;

      const currentRoundScore = currentTeam[columnName] || 0;
      const newRoundScore = currentRoundScore + pointsToAdd;

      // Calculate new total score
      const round1 = roundNumber === 1 ? newRoundScore : (currentTeam.round1_score || 0);
      const round2 = roundNumber === 2 ? newRoundScore : (currentTeam.round2_score || 0);
      const round3 = roundNumber === 3 ? newRoundScore : (currentTeam.round3_score || 0);
      const newTotalScore = round1 + round2 + round3;

      // Update database
      const { error: updateError } = await supabase
        .from("teams")
        .update({
          [columnName]: newRoundScore,
          total_score: newTotalScore
        })
        .eq("id", teamId);

      if (updateError) throw updateError;

      console.log(`Updated team ${teamId} round ${roundNumber}: +${pointsToAdd} points (total: ${newTotalScore})`);
      return true;

    } catch (error) {
      console.error("Error updating round score:", error);
      return false;
    }
  }

  // Get team's cumulative scores
  static async getTeamScores(teamId: string): Promise<TeamScores | null> {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id, team_name, round1_score, round2_score, round3_score, total_score")
        .eq("id", teamId)
        .single();

      if (error) throw error;

      const round1Score = data.round1_score || 0;
      const round2Score = data.round2_score || 0;
      const round3Score = data.round3_score || 0;
      const jeopardyStartingScore = round1Score + round2Score + 500; // R1 + R2 + 500 bonus

      return {
        teamId: data.id,
        teamName: data.team_name,
        round1Score,
        round2Score,
        round3Score,
        totalScore: data.total_score || 0,
        jeopardyStartingScore
      };

    } catch (error) {
      console.error("Error fetching team scores:", error);
      return null;
    }
  }

  // Initialize Round 3 with cumulative score + 500 bonus
  static async initializeRound3Score(teamId: string): Promise<boolean> {
    try {
      const scores = await this.getTeamScores(teamId);
      if (!scores) return false;

      // Set Round 3 starting score (R1 + R2 + 500)
      const { error } = await supabase
        .from("teams")
        .update({
          round3_score: scores.jeopardyStartingScore,
          total_score: scores.round1Score + scores.round2Score + scores.jeopardyStartingScore
        })
        .eq("id", teamId);

      if (error) throw error;

      console.log(`Initialized Round 3 for team ${teamId}: ${scores.jeopardyStartingScore} points`);
      return true;

    } catch (error) {
      console.error("Error initializing Round 3 score:", error);
      return false;
    }
  }

  // Get leaderboard for a specific round
  static async getRoundLeaderboard(roundNumber: number): Promise<TeamScores[]> {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id, team_name, round1_score, round2_score, round3_score, total_score")
        .eq("is_active", true)
        .eq("is_disqualified", false)
        .order(`round${roundNumber}_score`, { ascending: false });

      if (error) throw error;

      return data.map(team => ({
        teamId: team.id,
        teamName: team.team_name,
        round1Score: team.round1_score || 0,
        round2Score: team.round2_score || 0,
        round3Score: team.round3_score || 0,
        totalScore: team.total_score || 0,
        jeopardyStartingScore: (team.round1_score || 0) + (team.round2_score || 0) + 500
      }));

    } catch (error) {
      console.error("Error fetching round leaderboard:", error);
      return [];
    }
  }

  // Get overall leaderboard
  static async getOverallLeaderboard(): Promise<TeamScores[]> {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id, team_name, round1_score, round2_score, round3_score, total_score")
        .eq("is_active", true)
        .eq("is_disqualified", false)
        .order("total_score", { ascending: false });

      if (error) throw error;

      return data.map(team => ({
        teamId: team.id,
        teamName: team.team_name,
        round1Score: team.round1_score || 0,
        round2Score: team.round2_score || 0,
        round3Score: team.round3_score || 0,
        totalScore: team.total_score || 0,
        jeopardyStartingScore: (team.round1_score || 0) + (team.round2_score || 0) + 500
      }));

    } catch (error) {
      console.error("Error fetching overall leaderboard:", error);
      return [];
    }
  }

  // Reset scores for a team (admin function)
  static async resetTeamScores(teamId: string, roundNumber?: number): Promise<boolean> {
    try {
      if (roundNumber) {
        // Reset specific round
        const columnName = `round${roundNumber}_score`;
        const { error } = await supabase
          .from("teams")
          .update({ [columnName]: 0 })
          .eq("id", teamId);

        if (error) throw error;
      } else {
        // Reset all scores
        const { error } = await supabase
          .from("teams")
          .update({
            round1_score: 0,
            round2_score: 0,
            round3_score: 0,
            total_score: 0
          })
          .eq("id", teamId);

        if (error) throw error;
      }

      // Recalculate total score
      const scores = await this.getTeamScores(teamId);
      if (scores) {
        const newTotal = scores.round1Score + scores.round2Score + scores.round3Score;
        await supabase
          .from("teams")
          .update({ total_score: newTotal })
          .eq("id", teamId);
      }

      return true;

    } catch (error) {
      console.error("Error resetting team scores:", error);
      return false;
    }
  }
}

// Export singleton instance
export const cumulativeScoring = CumulativeScoringService;