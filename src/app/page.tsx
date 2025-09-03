// app/page.tsx
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

  if (checking) return <Loading />;

  if (!user)
    return <Landing onSignIn={() => signInWithPopup(auth, provider)} />;

  const isProfessor = (user.email ?? "").toLowerCase() === PROFESSOR_EMAIL;
  return isProfessor ? <ProfessorView /> : <StudentView />;
}

/* ─────────────────────────────────────
   Loading state
   ───────────────────────────────────── */
function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">
      <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/70 px-6 py-4">
        Loading attendance portal…
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   Landing (signed-out)
   ───────────────────────────────────── */
function Landing({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="relative bg-zinc-950 text-zinc-100 font-louize">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto flex max-w-lg min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          MENG 2311 Attendance (F25)
        </h1>
        <p className="mt-3 text-zinc-300">
          Hi all 👋. This is just a simple place to check in for Dr. Subasi's
          class. <br />
          Every lecture the word will be writen on the board. <br />
          Enter it here and you’re marked present.
        </p>

        <button
          onClick={onSignIn}
          className="
    relative mt-6 w-full cursor-pointer overflow-hidden rounded-full 
    bg-gradient-to-r from-indigo-600 to-fuchsia-600 
    px-6 py-3 font-medium text-white shadow-lg
    transition-all duration-300 ease-out
    hover:scale-105 hover:shadow-indigo-500/40
    active:scale-95
  "
        >
          <span className="relative z-10">Log in with Yale email</span>
          {/* animated glow sweep */}
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 ease-out hover:translate-x-full" />
        </button>

        <p className="mt-4 text-sm text-zinc-400">
          Works from{" "}
          <span className="font-medium">10:30am–2:00pm (Yale time)</span> on
          class days.
        </p>
      </main>
    </div>
  );
}
