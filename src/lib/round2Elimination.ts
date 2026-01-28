// Round 2 elimination system - reduces teams to final 7 for Jeopardy

import { supabase } from "@/integrations/supabase/client";

export interface Round2Results {
  team_id: string;
  team_name: string;
  team_code: string;
  round1_score: number;
  round2_score: number;
  total_score: number;
  questions_attempted: number;
  questions_correct: number;
  average_ai_score: number;
  completion_time: number;
  rank: number;
  is_qualified: boolean;
}

export class Round2Elimination {
  // Get Round 2 leaderboard with combined scores
  static async getRound2Leaderboard(): Promise<Round2Results[]> {
    try {
      // Get all teams with their Round 1 and Round 2 scores
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select(`
          id,
          team_name,
          team_code,
          round1_score,
          round2_score,
          round2_completed_at,
          is_active,
          is_disqualified
        `)
        .eq("is_active", true)
        .eq("is_disqualified", false)
        .not("round2_completed_at", "is", null)
        .order("round2_score", { ascending: false });

      if (teamsError) throw teamsError;

      // Get Round 2 submissions for detailed analysis
      const { data: submissions, error: submissionsError } = await supabase
        .from("submissions")
        .select(`
          team_id,
          is_correct,
          points_earned,
          ai_evaluation,
          submitted_at
        `)
        .eq("round_number", 2);

      if (submissionsError) throw submissionsError;

      // Calculate detailed results
      const results: Round2Results[] = teams.map((team, index) => {
        const teamSubmissions = submissions.filter(s => s.team_id === team.id);
        
        // Calculate statistics
        const questionsAttempted = teamSubmissions.length;
        const questionsCorrect = teamSubmissions.filter(s => s.is_correct).length;
        
        // Calculate average AI score
        const aiScores = teamSubmissions
          .map(s => s.ai_evaluation?.score || 0)
          .filter(score => score > 0);
        const averageAiScore = aiScores.length > 0 
          ? aiScores.reduce((sum, score) => sum + score, 0) / aiScores.length 
          : 0;

        // Calculate completion time (time from first to last submission)
        const submissionTimes = teamSubmissions.map(s => new Date(s.submitted_at).getTime());
        const completionTime = submissionTimes.length > 1
          ? Math.max(...submissionTimes) - Math.min(...submissionTimes)
          : 0;

        const totalScore = (team.round1_score || 0) + (team.round2_score || 0);

        return {
          team_id: team.id,
          team_name: team.team_name,
          team_code: team.team_code,
          round1_score: team.round1_score || 0,
          round2_score: team.round2_score || 0,
          total_score: totalScore,
          questions_attempted: questionsAttempted,
          questions_correct: questionsCorrect,
          average_ai_score: Math.round(averageAiScore * 100) / 100,
          completion_time: Math.floor(completionTime / 1000), // Convert to seconds
          rank: index + 1,
          is_qualified: false // Will be updated based on elimination logic
        };
      });

      // Sort by total score (Round 1 + Round 2)
      results.sort((a, b) => {
        if (b.total_score !== a.total_score) {
          return b.total_score - a.total_score;
        }
        // Tiebreaker 1: Round 2 score
        if (b.round2_score !== a.round2_score) {
          return b.round2_score - a.round2_score;
        }
        // Tiebreaker 2: Average AI score
        if (b.average_ai_score !== a.average_ai_score) {
          return b.average_ai_score - a.average_ai_score;
        }
        // Tiebreaker 3: Completion time (faster is better)
        return a.completion_time - b.completion_time;
      });

      // Update ranks and qualification status
      results.forEach((result, index) => {
        result.rank = index + 1;
        result.is_qualified = index < 7; // Top 7 teams qualify for Round 3
      });

      return results;

    } catch (error) {
      console.error("Error getting Round 2 leaderboard:", error);
      throw error;
    }
  }

  // Execute elimination to final 7 teams
  static async executeElimination(): Promise<{
    qualified: Round2Results[];
    eliminated: Round2Results[];
    summary: {
      totalTeams: number;
      qualifiedCount: number;
      eliminatedCount: number;
    };
  }> {
    try {
      const leaderboard = await this.getRound2Leaderboard();
      
      const qualified = leaderboard.filter(result => result.is_qualified);
      const eliminated = leaderboard.filter(result => !result.is_qualified);

      // Update team statuses in database
      if (eliminated.length > 0) {
        const eliminatedTeamIds = eliminated.map(result => result.team_id);
        
        const { error: eliminationError } = await supabase
          .from("teams")
          .update({
            is_active: false,
            round_eliminated: 2,
            eliminated_at: new Date().toISOString()
          })
          .in("id", eliminatedTeamIds);

        if (eliminationError) throw eliminationError;
      }

      // Ensure qualified teams remain active
      if (qualified.length > 0) {
        const qualifiedTeamIds = qualified.map(result => result.team_id);
        
        const { error: qualificationError } = await supabase
          .from("teams")
          .update({ is_active: true })
          .in("id", qualifiedTeamIds);

        if (qualificationError) throw qualificationError;
      }

      return {
        qualified,
        eliminated,
        summary: {
          totalTeams: leaderboard.length,
          qualifiedCount: qualified.length,
          eliminatedCount: eliminated.length
        }
      };

    } catch (error) {
      console.error("Error executing Round 2 elimination:", error);
      throw error;
    }
  }

  // Check if a specific team qualified for Round 3
  static async checkTeamQualification(teamId: string): Promise<{
    isQualified: boolean;
    rank: number;
    totalTeams: number;
    details: Round2Results | null;
  }> {
    try {
      const leaderboard = await this.getRound2Leaderboard();
      const teamResult = leaderboard.find(result => result.team_id === teamId);

      if (!teamResult) {
        return {
          isQualified: false,
          rank: 0,
          totalTeams: leaderboard.length,
          details: null
        };
      }

      return {
        isQualified: teamResult.is_qualified,
        rank: teamResult.rank,
        totalTeams: leaderboard.length,
        details: teamResult
      };

    } catch (error) {
      console.error("Error checking team qualification:", error);
      return {
        isQualified: false,
        rank: 0,
        totalTeams: 0,
        details: null
      };
    }
  }

  // Get elimination statistics
  static async getEliminationStats(): Promise<{
    round1Participants: number;
    round2Participants: number;
    round3Qualified: number;
    eliminationRate: number;
    averageRound2Score: number;
    topScore: number;
  }> {
    try {
      // Get Round 1 participants
      const { data: round1Teams, error: round1Error } = await supabase
        .from("teams")
        .select("id")
        .not("round1_completed_at", "is", null);

      if (round1Error) throw round1Error;

      // Get Round 2 participants
      const { data: round2Teams, error: round2Error } = await supabase
        .from("teams")
        .select("round2_score")
        .not("round2_completed_at", "is", null);

      if (round2Error) throw round2Error;

      // Get qualified teams for Round 3
      const { data: qualifiedTeams, error: qualifiedError } = await supabase
        .from("teams")
        .select("round2_score")
        .eq("is_active", true)
        .eq("is_disqualified", false)
        .not("round2_completed_at", "is", null);

      if (qualifiedError) throw qualifiedError;

      const round1Count = round1Teams.length;
      const round2Count = round2Teams.length;
      const qualifiedCount = Math.min(qualifiedTeams.length, 7); // Cap at 7

      const round2Scores = round2Teams.map(t => t.round2_score || 0);
      const averageRound2Score = round2Scores.length > 0
        ? round2Scores.reduce((sum, score) => sum + score, 0) / round2Scores.length
        : 0;

      const topScore = round2Scores.length > 0 ? Math.max(...round2Scores) : 0;

      const eliminationRate = round1Count > 0 
        ? ((round1Count - qualifiedCount) / round1Count) * 100 
        : 0;

      return {
        round1Participants: round1Count,
        round2Participants: round2Count,
        round3Qualified: qualifiedCount,
        eliminationRate: Math.round(eliminationRate * 100) / 100,
        averageRound2Score: Math.round(averageRound2Score * 100) / 100,
        topScore
      };

    } catch (error) {
      console.error("Error getting elimination stats:", error);
      return {
        round1Participants: 0,
        round2Participants: 0,
        round3Qualified: 0,
        eliminationRate: 0,
        averageRound2Score: 0,
        topScore: 0
      };
    }
  }

  // Manual team qualification override (admin function)
  static async overrideTeamQualification(
    teamId: string, 
    qualified: boolean, 
    reason: string
  ): Promise<void> {
    try {
      const updates: any = {
        is_active: qualified,
        qualification_override: true,
        qualification_reason: reason
      };

      if (!qualified) {
        updates.round_eliminated = 2;
        updates.eliminated_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", teamId);

      if (error) throw error;

    } catch (error) {
      console.error("Error overriding team qualification:", error);
      throw error;
    }
  }

  // Get detailed team performance analysis
  static async getTeamPerformanceAnalysis(teamId: string): Promise<{
    teamInfo: any;
    round1Performance: any;
    round2Performance: any;
    overallRanking: any;
    qualificationStatus: any;
  } | null> {
    try {
      // Get team info
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (teamError) throw teamError;

      // Get Round 2 submissions
      const { data: submissions, error: submissionsError } = await supabase
        .from("submissions")
        .select("*")
        .eq("team_id", teamId)
        .eq("round_number", 2);

      if (submissionsError) throw submissionsError;

      // Get overall ranking
      const leaderboard = await this.getRound2Leaderboard();
      const teamRanking = leaderboard.find(r => r.team_id === teamId);

      // Analyze Round 2 performance
      const round2Analysis = {
        questionsAttempted: submissions.length,
        questionsCorrect: submissions.filter(s => s.is_correct).length,
        totalPoints: submissions.reduce((sum, s) => sum + (s.points_earned || 0), 0),
        averageAiScore: submissions.length > 0
          ? submissions.reduce((sum, s) => sum + (s.ai_evaluation?.score || 0), 0) / submissions.length
          : 0,
        constraintViolations: submissions.reduce((sum, s) => 
          sum + (s.ai_evaluation?.constraintViolations?.length || 0), 0),
        submissionPattern: submissions.map(s => ({
          questionId: s.question_id,
          isCorrect: s.is_correct,
          aiScore: s.ai_evaluation?.score || 0,
          pointsEarned: s.points_earned || 0,
          submittedAt: s.submitted_at
        }))
      };

      return {
        teamInfo: team,
        round1Performance: {
          score: team.round1_score || 0,
          completedAt: team.round1_completed_at
        },
        round2Performance: round2Analysis,
        overallRanking: teamRanking,
        qualificationStatus: {
          isQualified: teamRanking?.is_qualified || false,
          rank: teamRanking?.rank || 0,
          totalScore: teamRanking?.total_score || 0
        }
      };

    } catch (error) {
      console.error("Error getting team performance analysis:", error);
      return null;
    }
  }
}