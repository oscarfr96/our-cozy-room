import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
export const firebaseConfigured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
export const auth = firebaseConfigured ? getAuth(initializeApp({ apiKey: import.meta.env.VITE_FIREBASE_API_KEY, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN })) : null;
