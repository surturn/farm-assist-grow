import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration

const firebaseConfig = {

  apiKey: "AIzaSyAe_LD5kViCT-Lth5HAUOAFnn6ZuJ5QRjc",
  authDomain: "farm-assist-eb43d.firebaseapp.com",
  projectId: "farm-assist-eb43d",
  storageBucket: "farm-assist-eb43d.firebasestorage.app",
  messagingSenderId: "939036075395",
  appId: "1:939036075395:web:ca4627962cf52bba0d82b6",
  measurementId: "G-NZ29LCYHM0"

};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
