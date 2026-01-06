
import { initializeApp } from "firebase/app";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { getFirestore } from "firebase/firestore";

// --- CẤU HÌNH CỦA BẠN ---
const firebaseConfig = {
    apiKey: "AIzaSyAPvcz6uQkoFmU4nUmGinDiN_rwTS4eSEs",
    authDomain: "glowwedding-e5f9b.firebaseapp.com",
    projectId: "glowwedding-e5f9b",
    storageBucket: "glowwedding-e5f9b.firebasestorage.app",
    messagingSenderId: "574284120272",
    appId: "1:574284120272:web:a344b3bb05d1cd5ab1ded5",
    measurementId: "G-TCS6LG5RKL"
};

// Khởi tạo Firebase
// Using compat style for app and auth due to environment resolution issues with modular exports
const app = firebase.initializeApp(firebaseConfig);
export const auth = firebase.auth();
export const googleProvider = new firebase.auth.GoogleAuthProvider();

// Firestore keeps using modular style as it was reported working
export const db = getFirestore(app);
