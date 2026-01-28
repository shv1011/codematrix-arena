// Team elimination utilities for CodeWars 2.0

import { supabase } from "@/integrations/supabase/client";

export interface EliminationResult {
  success: boolean;
  eliminatedCount: number;
  remainingCount: number;
  eliminatedTeams: Array<{
    id: string;
    team_name: string;
    score: number;
  }>;
  error?: string;
}

/**
 * Eliminate teams below a certain rank after a specific round
 */
export async function eliminateTeamsBelowRank(
  roundNumber: number, 
  keepTopN: number
): Promise<EliminationResult> {
  try {
    // Call the database function
    const { data, error } = await supabase.rpc('eliminate_teams_below_rank', {
      _round_number: roundNumber,
      _keep_top_n: keepTopN
    });

    if (error) throw error;

    // Get the eliminated teams for reporting
    const { data: eliminatedTeams, error: fetchError } = await supabase
      .from("teams")
      .select("id, team_name, total_score, round1_score, round2_score, round3_score")
      .eq("round_eliminated", roundNumber)
      .not("eliminated_at", "is", null);

    if (fetchError) throw fetchError;

    // Get remaining active teams count
    const { count: remainingCount, error: countError } = await supabase
      .from("teams")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_disqualified", false)
      .is("eliminated_at", null);

    if (countError) throw countError;

    return {
      success: true,
      eliminatedCount: data || 0,
      remainingCount: remainingCount || 0,
      eliminatedTeams: (eliminatedTeams || []).map(team => ({
        id: team.id,
        team_name: team.team_name,
        score: roundNumber === 1 ? team.round1_score || 0 :
               roundNumber === 2 ? team.round2_score || 0 :
               roundNumber === 3 ? team.round3_score || 0 :
               team.total_score || 0
      }))
    };

  } catch (error) {
    console.error("Error eliminating teams:", error);
    return {
      success: false,
      eliminatedCount: 0,
      remainingCount: 0,
      eliminatedTeams: [],
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Get active teams for a specific round
 */
export async function getActiveTeamsForRound(roundNumber: number) {
  try {
    const { data, error } = await supabase.rpc('get_active_teams_for_round', {
      _round_number: roundNumber
    });

    if (error) throw error;
    return { success: true, teams: data || [] };

  } catch (error) {
    console.error("Error fetching active teams:", error);
    return { 
      success: false, 
      teams: [], 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Manually eliminate specific teams
 */
export async function eliminateSpecificTeams(
  teamIds: string[], 
  roundNumber: number
): Promise<EliminationResult> {
  try {
    const eliminatedTeams = [];
    
    for (const teamId of teamIds) {
      // Get team info before elimination
      const { data: team, error: fetchError } = await supabase
        .from("teams")
        .select("id, team_name, total_score, round1_score, round2_score, round3_score")
        .eq("id", teamId)
        .single();

      if (fetchError) throw fetchError;

      // Eliminate the team
      const { error: updateError } = await supabase
        .from("teams")
        .update({
          eliminated_at: new Date().toISOString(),
          round_eliminated: roundNumber,
          is_active: false
        })
        .eq("id", teamId);

      if (updateError) throw updateError;

      eliminatedTeams.push({
        id: team.id,
        team_name: team.team_name,
        score: roundNumber === 1 ? team.round1_score || 0 :
               roundNumber === 2 ? team.round2_score || 0 :
               roundNumber === 3 ? team.round3_score || 0 :
               team.total_score || 0
      });
    }

    // Get remaining active teams count
    const { count: remainingCount, error: countError } = await supabase
      .from("teams")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_disqualified", false)
      .is("eliminated_at", null);

    if (countError) throw countError;

    return {
      success: true,
      eliminatedCount: teamIds.length,
      remainingCount: remainingCount || 0,
      eliminatedTeams
    };

  } catch (error) {
    console.error("Error eliminating specific teams:", error);
    return {
      success: false,
      eliminatedCount: 0,
      remainingCount: 0,
      eliminatedTeams: [],
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Reinstate an eliminated team
 */
export async function reinstateTeam(teamId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("teams")
      .update({
        is_active: true,
        eliminated_at: null,
        round_eliminated: null
      })
      .eq("id", teamId);

    if (error) throw error;

    return { success: true };

  } catch (error) {
    console.error("Error reinstating team:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Get elimination statistics
 */
export async function getEliminationStats() {
  try {
    const { data: teams, error } = await supabase
      .from("teams")
      .select("is_active, is_disqualified, eliminated_at, round_eliminated");

    if (error) throw error;

    const stats = {
      total: teams.length,
      active: teams.filter(t => t.is_active && !t.is_disqualified && !t.eliminated_at).length,
      eliminated: teams.filter(t => t.eliminated_at).length,
      disqualified: teams.filter(t => t.is_disqualified).length,
      eliminatedByRound: {
        round1: teams.filter(t => t.round_eliminated === 1).length,
        round2: teams.filter(t => t.round_eliminated === 2).length,
        round3: teams.filter(t => t.round_eliminated === 3).length,
      }
    };

    return { success: true, stats };

  } catch (error) {
    console.error("Error fetching elimination stats:", error);
    return { 
      success: false, 
      stats: null, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}