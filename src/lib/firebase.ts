import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Firebase configuration for Stegerholmens Hamn
const firebaseConfig = {
  apiKey: "AIzaSyCGGMhp8H7pVuYeEM12DXMMAqptsTWTjOI",
  authDomain: "stegerholmenshamn.firebaseapp.com",
  projectId: "stegerholmenshamn",
  storageBucket: "stegerholmenshamn.firebasestorage.app",
  messagingSenderId: "885107364018",
  appId: "1:885107364018:web:ec26d4b61d610e5344b9ab",
  measurementId: "G-RK69QMQ05P",
};

// Initialize Firebase (prevent re-initialization in dev with HMR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export default app;
