import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// 10.0.2.2 is the Android emulator's alias for the host machine's localhost,
// where the Django dev server runs.
export const API_BASE_URL = 'http://10.0.2.2:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
