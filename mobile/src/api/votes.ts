import { apiClient, Paginated } from './client';
import { Match, Team } from './matches';

export interface VoteHistoryItem {
  id: number;
  match: Match;
  predicted_team: Team;
  stake: number;
  status: 'active' | 'win' | 'lose' | 'void';
  amount: number;
  created_at: string;
}

export async function fetchHistory(pageUrl?: string) {
  const { data } = await apiClient.get<Paginated<VoteHistoryItem>>(pageUrl ?? '/votes/history/');
  return data;
}

export interface LeaderboardEntry {
  username: string;
  avatar: string | null;
  balance: number;
}

export async function fetchLeaderboard(pageUrl?: string) {
  const { data } = await apiClient.get<Paginated<LeaderboardEntry>>(pageUrl ?? '/leaderboard/');
  return data;
}
