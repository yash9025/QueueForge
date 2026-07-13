import axios from 'axios';

// In production, this should be set to your backend URL (e.g., https://queueforge-api.onrender.com)
// In development, it falls back to an empty string so the Vite proxy handles it.
export const baseURL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL
});
