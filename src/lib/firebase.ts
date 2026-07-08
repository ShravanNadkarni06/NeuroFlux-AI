import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDJGNIMr5CMFR5FRKQj3jpwUMncsSyumTA",
  authDomain: "gen-lang-client-0105936967.firebaseapp.com",
  projectId: "gen-lang-client-0105936967",
  storageBucket: "gen-lang-client-0105936967.firebasestorage.app",
  messagingSenderId: "1038152193381",
  appId: "1:1038152193381:web:05e1e1448a6d6200d83d8c"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the custom database ID from configuration
const firestoreDatabaseId = "ai-studio-neuroflux-887a6bc6-499e-48bc-9b70-518b7abf5b59";
export const db = getFirestore(app, firestoreDatabaseId);
