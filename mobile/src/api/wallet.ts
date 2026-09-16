import { apiClient } from './client';

export interface AdRewardStatus {
  available: boolean;
  seconds_remaining: number;
  balance: number;
  reward: number;
}

export async function fetchAdRewardStatus() {
  const { data } = await apiClient.get<AdRewardStatus>('/wallet/ad-reward/');
  return data;
}

export async function claimAdReward() {
  const { data } = await apiClient.post<{ balance: number; reward: number }>('/wallet/ad-reward/');
  return data;
}
