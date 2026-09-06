import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// 10.0.2.2 is the Android emulator's alias for the host machine's localhost,
// where the Django dev server runs.
export const API_BASE_URL = 'http://10.0.2.2:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Shape of every DRF ListAPIView response now that pagination is enabled
// (PageNumberPagination, PAGE_SIZE=20 - see backend config/settings.py).
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

apiClient.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
