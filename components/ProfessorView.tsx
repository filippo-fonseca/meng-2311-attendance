"use client";

import { useEffect, useMemo, useState } from "react";
import {
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import dayjs from "dayjs";
import { auth, db, ts } from "../config/firebase";
import {
  classDatesBetween,
  TERM_START,
  TERM_END,
  passwordForDate,
  TZ,
  dateKey,
} from "../lib/schedule";

type RosterUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
};

type AttendanceDoc = {
  date: string;
  word?: string;
  presentUIDs?: string[];
  present?: Record<string, RosterUser & { markedAt?: any }>;
};

export default function ProfessorView() {
  const [user, setUser] = useState<User | null>(null);
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<AttendanceDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const dates = useMemo(() => classDatesBetween(TERM_START, TERM_END), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // ensure professor exists in users as well (optional)
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
      const qs = await getDocs(collection(db, "users"));
      const list: RosterUser[] = [];
      qs.forEach((d) => {
        const data = d.data() as any;
        if (data?.email) {
          list.push({
            uid: data.uid,
            email: data.email,
            displayName: data.displayName ?? "",
            photoURL: data.photoURL ?? "",
          });
        }
      });
      // By requirement: any user not professor is a student
      const filtered = list.filter(
        (u) => (u.email ?? "").toLowerCase() !== "filippo.fonseca@yale.edu"
      );
      setRoster(filtered);
    })();
  }, []);

  const openDay = async (k: string) => {
    setSelectedKey(k);
    const ref = doc(db, "attendance", k);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setSelectedData(snap.data() as AttendanceDoc);
    } else {
      setSelectedData({
        date: k,
        word: passwordForDate(dayjs.tz(k, TZ)) ?? undefined,
        presentUIDs: [],
        present: {},
      });
    }
  };

  const presentUIDs = useMemo(
    () =>
      new Set(
        selectedData?.presentUIDs ?? Object.keys(selectedData?.present ?? {})
      ),
    [selectedData]
  );

  const presentList = useMemo(
    () => roster.filter((r) => presentUIDs.has(r.uid)),
    [roster, presentUIDs]
  );

  const absentList = useMemo(
    () => roster.filter((r) => !presentUIDs.has(r.uid)),
    [roster, presentUIDs]
  );

  const exportCSV = () => {
    if (!selectedKey) return;
    const rows = [
      ["date", "uid", "email", "displayName", "present"],
      ...roster.map((r) => [
        selectedKey,
        r.uid,
        r.email,
        r.displayName,
        presentUIDs.has(r.uid) ? "TRUE" : "FALSE",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${selectedKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto p-6">Loading…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-400">Professor View</div>
          <h1 className="text-2xl font-semibold">MENG 2311 – Attendance</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-zinc-400">{user?.email}</div>
          <button
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700"
            onClick={() => signOut(auth)}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="text-sm text-zinc-400 mb-2">
            Term: {dayjs(TERM_START).format("MMM D")} –{" "}
            {dayjs(TERM_END).format("MMM D, YYYY")} (NY)
          </div>
          <div className="max-h-[60vh] overflow-auto pr-2 space-y-1">
            {dates.map((d) => {
              const k = dateKey(d);
              const pw = passwordForDate(d);
              return (
                <button
                  key={k}
                  onClick={() => openDay(k)}
                  className={`w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700 ${
                    selectedKey === k ? "bg-zinc-800 border-zinc-700" : ""
                  }`}
                >
                  <div className="font-medium">{d.format("ddd, MMM D")}</div>
                  <div className="text-xs text-zinc-400">
                    Expected word: <span className="font-mono">{pw}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          {!selectedKey ? (
            <div className="text-zinc-400">
              Select a class day to view details.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-400">Date</div>
                  <div className="text-xl font-semibold">
                    {dayjs.tz(selectedKey, TZ).format("dddd, MMM D, YYYY")}
                  </div>
                </div>
                <button
                  onClick={exportCSV}
                  className="px-3 py-2 rounded-lg bg-brand-600 hover:opacity-95"
                >
                  Export CSV
                </button>
              </div>

              <div className="mt-3 text-sm">
                Word:{" "}
                <span className="font-mono text-zinc-100">
                  {selectedData?.word ?? "(none)"}
                </span>
              </div>

              <div className="mt-5 grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-zinc-400 mb-1">
                    Present ({presentList.length})
                  </div>
                  <ul className="space-y-1">
                    {presentList.map((u) => (
                      <li
                        key={u.uid}
                        className="px-3 py-2 rounded-lg bg-zinc-800/50"
                      >
                        <div className="font-medium">
                          {u.displayName || u.email}
                        </div>
                        <div className="text-xs text-zinc-400">{u.email}</div>
                      </li>
                    ))}
                    {presentList.length === 0 && (
                      <div className="text-xs text-zinc-500">No one yet.</div>
                    )}
                  </ul>
                </div>
                <div>
                  <div className="text-sm text-zinc-400 mb-1">
                    Absent ({absentList.length})
                  </div>
                  <ul className="space-y-1">
                    {absentList.map((u) => (
                      <li
                        key={u.uid}
                        className="px-3 py-2 rounded-lg bg-zinc-800/30"
                      >
                        <div className="font-medium">
                          {u.displayName || u.email}
                        </div>
                        <div className="text-xs text-zinc-500">{u.email}</div>
                      </li>
                    ))}
                    {absentList.length === 0 && (
                      <div className="text-xs text-zinc-500">None 🎉</div>
                    )}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 text-xs text-zinc-500">
        Roster = everyone who has signed in at least once (excluding professor).
      </div>
    </div>
  );
}
