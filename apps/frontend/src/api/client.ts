import axios from 'axios';
import { auth } from '../lib/firebase';

// Ensure the frontend hits the absolute backend URL, which can be configured via Env.
// Default to the local backend port 5000 if not specified.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Intercept requests to attach Firebase Auth token globally
apiClient.interceptors.request.use(async (config) => {
    await auth.authStateReady(); // Wait for Firebase Auth to initialize on hard reloads
    const currentUser = auth.currentUser;

    if (currentUser) {
        const token = await currentUser.getIdToken(true);
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        console.warn("API Client: No currentUser found. Request may be unauthorized.");
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

// Generic response error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
            url: error.config?.url,
            method: error.config?.method,
        });
        if (error.response?.status === 401) {
            // Optional: Trigger a logout or redirect if unauthorized
        }
        return Promise.reject(error);
    }
);
