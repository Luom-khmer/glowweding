import { getFirestore } from "firebase/firestore";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAPvcz6uQkoFmU4nUmGinDiN_rwTS4eSEs",
    authDomain: "glowwedding-e5f9b.firebaseapp.com",
    projectId: "glowwedding-e5f9b",
    storageBucket: "glowwedding-e5f9b.firebasestorage.app",
    messagingSenderId: "574284120272",
    appId: "1:574284120272:web:a344b3bb05d1cd5ab1ded5",
    measurementId: "G-TCS6LG5RKL"
};

// Initialize Compat App (This creates the [DEFAULT] app used by modular SDKs too)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // Ensure default app is accessible
}

// Modular Firestore (uses the default app initialized above)
export const db = getFirestore();

// Compat Auth (for usage in App.tsx)
export const auth = firebase.auth();
export const googleProvider = new firebase.auth.GoogleAuthProvider();
