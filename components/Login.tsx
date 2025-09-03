// components/Login.tsx
"use client";

import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../config/firebase";

export default function Login() {
  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center font-louize">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">
          MENG 2311 Attendance
        </h1>
        <p className="text-gray-300 text-center mb-8">
          Sign in with your Yale Google account to mark your attendance
        </p>
        <button
          onClick={signInWithGoogle}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
