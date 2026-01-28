// Round 1 scoring and evaluation system

import { supabase } from "@/integrations/supabase/client";
import { QuestionLoader, Round1Question } from "./questionLoader";

export interface Round1Submission {
  team_id: string;
  question_id: number;
  answer_index: number;
  is_correct: boolean;
  points_earned: number;
  submitted_at: string;
}

export interface Round1Results {
  team_id: string;
  team_name: string;
  team_code: string;
  total_score: number;
  correct_answers: number;
  total_questions: number;
  completion_time: number; // in seconds
  rank: number;
  is_qualified: boolean;
}

export class Round1Scoring {
  // Calculate team score for Round 1
  static async calculateTeamScore(teamId: string, submissions: Round1Submission[]): Promise<number> {
    let totalScore = 0;
    
    for (const submission of submissions) {
      if (submission.is_correct) {
        totalScore += submission.points_earned;
      }
    }
    
    return totalScore;
  }

  // Evaluate a single answer
  static evaluateAnswer(question: Round1Question, answerIndex: number): {
    isCorrect: boolean;
    pointsEarned: number;
  } {
    const isCorrect = answerIndex === question.correct_answer;
    const pointsEarned = isCorrect ? question.points : 0;
    
    return { isCorrect, pointsEarned };
  }

  // Get Round 1 leaderboard
  static async getRound1Leaderboard(): Promise<Round1Results[]> {
    try {
      // Get all teams with their Round 1 scores
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select(`
          id,
          team_name,
          team_code,
          round1_score,
          round1_completed_at,
          is_active,
          is_disqualified
        `)
        .eq("is_active", true)
        .eq("is_disqualified", false)
        .not("round1_completed_at", "is", null)
        .order("round1_score", { ascending: false });

      if (teamsError) throw teamsError;

      // Get submissions for completion time calculation
      const { data: submissions, error: submissionsError } = await supabase
        .from("submissions")
        .select("team_id, submitted_at")
        .eq("round_number", 1);

      if (submissionsError) throw submissionsError;

      // Load questions to get total count
      const roundData = await QuestionLoader.loadRound1Questions();
      const totalQuestions = roundData.questions.length;

      // Calculate results
      const results: Round1Results[] = teams.map((team, index) => {
        // Get team submissions for completion time
        const teamSubmissions = submissions.filter(s => s.team_id === team.id);
        const completionTime = teamSubmissions.length > 0 
          ? Math.max(...teamSubmissions.map(s => new Date(s.submitted_at).getTime())) - 
            Math.min(...teamSubmissions.map(s => new Date(s.submitted_at).getTime()))
          : 0;

        // Get correct answers count from submissions
        const { data: correctAnswers } = supabase
          .from("submissions")
          .select("is_correct")
          .eq("team_id", team.id)
          .eq("round_number", 1)
          .eq("is_correct", true);

        return {
          team_id: team.id,
          team_name: team.team_name,
          team_code: team.team_code,
          total_score: team.round1_score || 0,
          correct_answers: correctAnswers?.length || 0,
          total_questions: totalQuestions,
          completion_time: Math.floor(completionTime / 1000), // Convert to seconds
          rank: index + 1,
          is_qualified: true // Will be updated based on elimination logic
        };
      });

      return results;

    } catch (error) {
      console.error("Error getting Round 1 leaderboard:", error);
      throw error;
    }
  }

  // Check if team qualifies for Round 2
  static async checkTeamQualification(teamId: string): Promise<boolean> {
    try {
      const leaderboard = await this.getRound1Leaderboard();
      const teamResult = leaderboard.find(result => result.team_id === teamId);
      
      if (!teamResult) return false;

      // Top teams qualify for Round 2 (configurable threshold)
      const qualificationThreshold = Math.ceil(leaderboard.length * 0.7); // Top 70%
      return teamResult.rank <= qualificationThreshold;

    } catch (error) {
      console.error("Error checking team qualification:", error);
      return false;
    }
  }

  // Update team elimination status after Round 1
  static async updateTeamElimination(): Promise<void> {
    try {
      const leaderboard = await this.getRound1Leaderboard();
      const qualificationThreshold = Math.ceil(leaderboard.length * 0.7); // Top 70%

      // Eliminate teams that didn't qualify
      const eliminatedTeams = leaderboard
        .filter(result => result.rank > qualificationThreshold)
        .map(result => result.team_id);

      if (eliminatedTeams.length > 0) {
        const { error } = await supabase
          .from("teams")
          .update({
            is_active: false,
            round_eliminated: 1,
            eliminated_at: new Date().toISOString()
          })
          .in("id", eliminatedTeams);

        if (error) throw error;
      }

      // Update qualified teams
      const qualifiedTeams = leaderboard
        .filter(result => result.rank <= qualificationThreshold)
        .map(result => result.team_id);

      if (qualifiedTeams.length > 0) {
        const { error } = await supabase
          .from("teams")
          .update({ is_active: true })
          .in("id", qualifiedTeams);

        if (error) throw error;
      }

    } catch (error) {
      console.error("Error updating team elimination:", error);
      throw error;
    }
  }

  // Get team statistics for Round 1
  static async getTeamStatistics(teamId: string): Promise<{
    totalScore: number;
    correctAnswers: number;
    totalQuestions: number;
    accuracy: number;
    rank: number;
    completionTime: number;
  } | null> {
    try {
      const leaderboard = await this.getRound1Leaderboard();
      const teamResult = leaderboard.find(result => result.team_id === teamId);

      if (!teamResult) return null;

      return {
        totalScore: teamResult.total_score,
        correctAnswers: teamResult.correct_answers,
        totalQuestions: teamResult.total_questions,
        accuracy: teamResult.total_questions > 0 
          ? (teamResult.correct_answers / teamResult.total_questions) * 100 
          : 0,
        rank: teamResult.rank,
        completionTime: teamResult.completion_time
      };

    } catch (error) {
      console.error("Error getting team statistics:", error);
      return null;
    }
  }

  // Recalculate all Round 1 scores (admin function)
  static async recalculateAllScores(): Promise<void> {
    try {
      // Get all teams
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id")
        .eq("is_active", true);

      if (teamsError) throw teamsError;

      // Get all Round 1 submissions
      const { data: submissions, error: submissionsError } = await supabase
        .from("submissions")
        .select("*")
        .eq("round_number", 1);

      if (submissionsError) throw submissionsError;

      // Recalculate scores for each team
      for (const team of teams) {
        const teamSubmissions = submissions.filter(s => s.team_id === team.id);
        const totalScore = teamSubmissions.reduce((sum, sub) => sum + (sub.points_earned || 0), 0);

        // Update team score
        const { error: updateError } = await supabase
          .from("teams")
          .update({
            round1_score: totalScore,
            total_score: totalScore
          })
          .eq("id", team.id);

        if (updateError) throw updateError;
      }

    } catch (error) {
      console.error("Error recalculating scores:", error);
      throw error;
    }
  }
}
      