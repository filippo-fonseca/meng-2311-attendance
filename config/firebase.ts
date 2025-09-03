// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBIEWrLzboryXvvO9Z87UWNAANTGSIP0zA",
    authDomain: "meng-2311-attendance.firebaseapp.com",
    projectId: "meng-2311-attendance",
    storageBucket: "meng-2311-attendance.firebasestorage.app",
    messagingSenderId: "258196366202",
    appId: "1:258196366202:web:7ad995a0c3c2045658ecc3",
    measurementId: "G-KFGP71RTXV"
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const ts = serverTimestamp;
