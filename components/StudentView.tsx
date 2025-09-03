"use client";

import { useEffect, useMemo, useState } from "react";
import {
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import dayjs from "dayjs";
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

      // Upsert users/<uid> for roster
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
        const data = snap.data();
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

    const now = dayjs().tz(TZ);
    if (!isWithinWindowNow(todayNY, now)) {
      return setStatusMsg("Attendance window closed (10:30–12:00).");
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
      await setDoc(ref, {
        ...payload,
        createdAt: ts(),
      });
    }

    alert("Worked");
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
    <div className="max-w-xl mx-auto p-6">
      <Header user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="text-sm text-zinc-400">
          {todayNY.format("dddd, MMM D, YYYY")} · New York time
        </div>
        <h1 className="text-2xl font-semibold mt-1">MENG 2311 Attendance</h1>

        {!todayIsClass && (
          <p className="mt-4 text-zinc-300">
            No class today. Attendance opens on Mondays, Wednesdays, and Fridays
            (10:30–12:00).
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
              <span className="font-medium">10:30–12:00</span> (New York).
            </p>

            <div className="mt-5 flex gap-3">
              <input
                disabled={!user || already}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 outline-none ring-1 ring-zinc-700 focus:ring-brand-600 disabled:opacity-60"
                placeholder="Enter today's word…"
                value={entered}
                onChange={(e) => setEntered(e.target.value)}
              />
              <button
                disabled={!user || already}
                onClick={submit}
                className="rounded-xl px-5 py-3 bg-brand-600 hover:opacity-95 disabled:opacity-60"
              >
                Mark Present
              </button>
            </div>

            {statusMsg && (
              <div
                className={`mt-4 text-sm ${
                  ok ? "text-emerald-400" : "text-amber-400"
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
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-600 to-fuchsia-600" />
        <div className="font-medium">Attendance</div>
      </div>
      <div>
        {!user ? (
          <button
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700"
            onClick={onSignIn}
          >
            Sign in with Google
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-sm text-zinc-400">{user.email}</div>
            <button
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700"
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
      Class is M/W/F 10:30–11:20 (Yale time). The password will be provided by
      the professor during class.
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-5 w-40 bg-zinc-800 rounded mb-3"></div>
      <div className="h-8 w-full bg-zinc-800 rounded mb-4"></div>
      <div className="h-48 w-full bg-zinc-900 rounded"></div>
    </div>
  );
}
