// Team access control utilities for CodeWars 2.0
import { supabase } from '@/integrations/supabase/client';

export interface TeamAccessInfo {
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
}

export interface EliminationResult {
  eliminated_teams: TeamAccessInfo[];
  remaining_teams: TeamAccessInfo[];
  eliminated_count: number;
}

class TeamAccessControl {
  // Get all teams with access information
  async getAllTeams(): Promise<TeamAccessInfo[]> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('total_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch teams: ${error.message}`);
    }

    return data || [];
  }

  // Get active teams for a specific round
  async getActiveTeamsForRound(roundNumber: number): Promise<TeamAccessInfo[]> {
    const { data, error } = await supabase
      .rpc('get_active_teams_for_round', { _round_number: roundNumber });

    if (error) {
      throw new Error(`Failed to fetch active teams: ${error.message}`);
    }

    return data || [];
  }

  // Enable team access
  async enableTeamAccess(teamId: string): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .update({ 
        is_active: true,
        eliminated_at: null,
        round_eliminated: null
      })
      .eq('id', teamId);

    if (error) {
      throw new Error(`Failed to enable team access: ${error.message}`);
    }
  }

  // Disable team access
  async disableTeamAccess(teamId: string, reason?: string): Promise<void> {
    const { error } = await 