import { apiClient } from './client';

export interface User {
  id: number;
  email: string;
  username: string | null;
  avatar: string | null;
  balance: number;
}

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<{ access: string; refresh: string }>(
    '/auth/login/',
    { email, password },
  );
  return data;
}

export async function fetchMe() {
  const { data } = await apiClient.get<User>('/auth/me/');
  return data;
}
