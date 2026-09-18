import { apiClient, Paginated } from './client';
import type { VoteHistoryItem } from './votes';

export interface Team {
  id: number;
  name: string;
  logo: string | null;
}

export interface Game {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}

export interface Tournament {
  id: number;
  name: string;
  game: Game;
}

export interface Match {
  id: number;
  tournament: Tournament;
  team_a: Team;
  team_b: Team;
  start_time: string;
  status: 'upcoming' | 'live' | 'finished';
  winner: number | null;
  has_active_bet: boolean;
  // What a win pays: stake * payout_multiplier + payout_bonus. Sent by the
  // server so the Vote button quotes the live rule rather than a constant.
  payout_multiplier: number;
  payout_bonus: number;
}

// Returns the whole page, not just its rows: the caller needs `next` to be
// able to ask for the rest. `pageUrl` is one of those links, handed straight
// back to the server.
export async function fetchMatches(
  params: { game?: string; range?: 'today' | 'tomorrow' | 'week' },
  pageUrl?: string,
) {
  const { data } = await apiClient.get<Paginated<Match>>(pageUrl ?? '/matches/', {
    params: pageUrl ? undefined : params,
  });
  return data;
}

export async function fetchMatch(id: number) {
  const { data } = await apiClient.get<Match>(`/matches/${id}/`);
  return data;
}

export async function placeVote(
  matchId: number,
  predictedTeam: number,
  stake: number,
) {
  const { data } = await apiClient.post(`/matches/${matchId}/vote/`, {
    predicted_team: predictedTeam,
    stake,
  });
  return data;
}

export async function fetchMatchBets(matchId: number) {
  const { data } = await apiClient.get<Paginated<VoteHistoryItem>>(`/matches/${matchId}/bets/`);
  return data.results;
}
