import { apiClient, Paginated } from './client';
import { Match, Team } from './matches';

export interface VoteHistoryItem {
  id: number;
  match: Match;
  predicted_team: Team;
  stake: number;
  status: 'active' | 'win' | 'lose';
  amount: number;
  created_at: string;
}

export async function fetchHistory() {
  const { data } = await apiClient.get<Paginated<VoteHistoryItem>>('/votes/history/');
  return data.results;
}

export interface LeaderboardEntry {
  username: string;
  avatar: string | null;
  balance: number;
}

export async function fetchLeaderboard() {
  const { data } = await apiClient.get<Paginated<LeaderboardEntry>>('/leaderboard/');
  return data.results;
}
