// components/StudentView.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, provider, ts } from "../config/firebase";
import {
  inNY,
  isClassDay,
  dateKey,
  passwordForDate,
  TZ,
  isWithinWindowNow,
} from "../lib/schedule";

export default function StudentView() {
  const [user, setUser] = useState<User | null>(null);
  const [todayNY] = useState(() => inNY().startOf("day"));
  const [loading, setLoading] = useState(true);
  const [entered, setEntered] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [already, setAlready] = useState(false);
  const [ok, setOk] = useState(false);

  const todayIsClass = useMemo(() => isClassDay(todayNY), [todayNY]);
  const todayKey = useMemo(() => dateKey(todayNY), [todayNY]);
  const expected = useMemo(
    () => (todayIsClass ? passwordForDate(todayNY) : null),
    [todayIsClass, todayNY]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        await setDoc(
          doc(db, "users", u.uid),
          {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName ?? "",
            photoURL: u.photoURL ?? "",
            updatedAt: ts(),
          },
          { merge: true }
        );
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      if (!user || !todayIsClass) return;
      const snap = await getDoc(doc(db, "attendance", todayKey));
      if (snap.exists()) {
        const data = snap.data() as any;
        const presentUIDs: string[] = data.presentUIDs ?? [];
        if (presentUIDs.includes(user.uid)) {
          setAlready(true);
          setOk(true);
          setStatusMsg("You're already marked present for today ✅");
        }
      }
    })();
  }, [user, todayIsClass, todayKey]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      alert(e.message ?? "Sign-in error");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const submit = async () => {
    if (!user) return setStatusMsg("Please sign in first.");
    if (!todayIsClass) return setStatusMsg("No class today (M/W/F).");

    const now = inNY(); // NY-local now
    if (!isWithinWindowNow(todayNY, now)) {
      return setStatusMsg("Attendance window closed (10:30–2:00).");
    }

    if (!expected) return setStatusMsg("No password for today.");

    if (entered.trim().toUpperCase() !== expected.toUpperCase()) {
      return setStatusMsg("Incorrect password. Try again.");
    }

    const ref = doc(db, "attendance", todayKey);
    const snap = await getDoc(ref);

    const payload = {
      date: todayKey,
      word: expected,
      presentUIDs: arrayUnion(user.uid),
      present: {
        [user.uid]: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName ?? "",
          photoURL: user.photoURL ?? "",
          markedAt: ts(),
        },
      },
      updatedAt: ts(),
    };

    if (snap.exists()) {
      await updateDoc(ref, payload as any);
    } else {
      await setDoc(ref, { ...payload, createdAt: ts() });
    }

    setOk(true);
    setAlready(true);
    setStatusMsg("Marked present. Have a great class! 🎉");
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <Skeleton />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 font-louize">
      <Header user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="text-sm text-zinc-400">
          {todayNY.format("dddd, MMM D, YYYY")} · Yale time
        </div>
        <h1 className="mt-1 text-2xl font-semibold">Attendance</h1>

        {!todayIsClass && (
          <p className="mt-4 text-zinc-300">
            No class today. Attendance opens on Mondays, Wednesdays, and Fridays
            (10:30am–2:00pm).
          </p>
        )}

        {todayIsClass && (
          <>
            <p className="mt-4 text-zinc-300">
              Enter the{" "}
              <span className="font-semibold text-zinc-100">
                word on the board
              </span>{" "}
              to mark attendance. The window is{" "}
              <span className="font-medium">10:30–2:00</span> (Yale time).
            </p>

            {/* Show input + button ONLY if not already present */}
            {!already && (
              <div className="mt-5 flex gap-3">
                <input
                  disabled={!user}
                  className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 outline-none ring-1 ring-zinc-700 focus:ring-pink-600 disabled:opacity-60"
                  placeholder="Enter today's word…"
                  value={entered}
                  onChange={(e) => setEntered(e.target.value)}
                />
                <button
                  disabled={!user}
                  onClick={submit}
                  className="relative cursor-pointer overflow-hidden rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 font-medium text-white shadow-lg transition-all duration-300 ease-out hover:scale-105 hover:shadow-pink-500/40 active:scale-95 disabled:opacity-60"
                >
                  <span className="relative z-10">Mark Present</span>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 ease-out hover:translate-x-full" />
                </button>
              </div>
            )}

            {statusMsg && (
              <div
                className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                  ok
                    ? "border-emerald-900/60 bg-emerald-900/20 text-emerald-300"
                    : "border-amber-900/50 bg-amber-900/10 text-amber-300"
                }`}
              >
                {statusMsg}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

function Header({
  user,
  onSignIn,
  onSignOut,
}: {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      {/* Neumorphic course badge */}
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_30px_rgba(0,0,0,0.35)]">
          <span className="font-semibold tracking-wide text-zinc-100">
            MENG&nbsp;2311
          </span>
        </div>
        <div className="text-sm text-zinc-400">Yale · M/W/F</div>
      </div>

      <div>
        {!user ? (
          <button
            className="cursor-pointer rounded-xl bg-zinc-800 px-4 py-2 font-medium text-zinc-100 transition hover:bg-zinc-700"
            onClick={onSignIn}
          >
            Sign in with Google
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-sm text-zinc-400">{user.email}</div>
            <button
              className="cursor-pointer rounded-xl bg-zinc-800 px-3 py-2 transition hover:bg-zinc-700"
              onClick={onSignOut}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-10 text-xs text-zinc-500">
      Class is M/W/F 10:30–11:20 (Yale time). Attendance window: 10:30am–2:00pm.
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-3 h-5 w-40 rounded bg-zinc-800"></div>
      <div className="mb-4 h-8 w-full rounded bg-zinc-800"></div>
      <div className="h-48 w-full rounded bg-zinc-900"></div>
    </div>
  );
}
