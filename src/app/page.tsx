"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, User } from "firebase/auth";
import ProfessorView from "../../components/ProfessorView";
import StudentView from "../../components/StudentView";
import { auth, provider } from "../../config/firebase";
import { PROFESSOR_EMAIL } from "../../lib/schedule";

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  if (checking) {
    return <div className="max-w-xl mx-auto p-6">Loading…</div>;
  }

  // Not signed in? Show a minimal landing with sign in button.
  if (!user) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <div className="text-sm text-zinc-400">MENG 2311</div>
        <h1 className="text-2xl font-semibold">Attendance Portal</h1>
        <p className="mt-3 text-zinc-300">
          Sign in with your Yale Google account to continue.
        </p>
        <button
          className="mt-5 px-4 py-2 rounded-lg bg-brand-600 hover:opacity-95"
          onClick={() => signInWithPopup(auth, provider)}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  // Professor sees the dashboard; everyone else sees the student page
  const isProfessor = (user.email ?? "").toLowerCase() === PROFESSOR_EMAIL;
  return isProfessor ? <ProfessorView /> : <StudentView />;
}
