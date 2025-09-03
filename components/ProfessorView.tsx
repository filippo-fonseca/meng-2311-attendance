// components/ProfessorView.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  User,
  signInWithPopup,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { auth, db, ts } from "../config/firebase";
import {
  classDatesBetween,
  TERM_START,
  TERM_END,
  passwordForDate,
  TZ,
  dateKey,
  PROFESSOR_EMAIL,
} from "../lib/schedule";

dayjs.extend(utc);
dayjs.extend(timezone);

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

  // Refs to each date button so we can scroll the selected one into view
  const listRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // All class dates in the term (M/W/F) as Dayjs objects (NY time)
  const dates = useMemo(() => classDatesBetween(TERM_START, TERM_END), []);

  // Key (YYYY-MM-DD) for the class date nearest to today (NY time)
  const closestKey = useMemo(() => {
    if (!dates.length) return null;
    const today = dayjs().tz(TZ).startOf("day");
    let bestIdx = 0;
    let bestDiff = Infinity;
    dates.forEach((d, i) => {
      const diff = Math.abs(d.diff(today, "day"));
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    });
    return dateKey(dates[bestIdx]);
  }, [dates]);

  // Auth/init
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // upsert user for roster
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

  // Build roster (everyone who has ever signed in, excluding professor)
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
      const filtered = list.filter(
        (u) => (u.email ?? "").toLowerCase() !== PROFESSOR_EMAIL
      );
      setRoster(filtered);
    })();
  }, []);

  // Fetch/open a specific day; synthesize content if doc doesn't exist yet
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
    // smooth scroll selected into view
    requestAnimationFrame(() => {
      listRefs.current[k]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });
  };

  // Auto-open the closest class day on first load
  useEffect(() => {
    if (!selectedKey && closestKey) void openDay(closestKey);
  }, [closestKey, selectedKey]);

  // Keyboard navigation across class days (← / →)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedKey) return;
      const idx = dates.findIndex((d) => dateKey(d) === selectedKey);
      if (idx < 0) return;
      if (e.key === "ArrowLeft" && idx > 0) {
        void openDay(dateKey(dates[idx - 1]));
      }
      if (e.key === "ArrowRight" && idx < dates.length - 1) {
        void openDay(dateKey(dates[idx + 1]));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedKey, dates]);

  // Present/Absent lists for selected day
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

  // CSV export for selected day
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
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          Loading professor view…
        </div>
      </div>
    );
  }

  const exportAllCSV = async () => {
    // Fetch all attendance docs at once
    const qs = await getDocs(collection(db, "attendance"));
    const attMap = new Map<
      string,
      { word?: string; presentUIDs?: string[]; present?: Record<string, any> }
    >();
    qs.forEach((docSnap) => {
      const data = docSnap.data() as any;
      attMap.set(docSnap.id, {
        word: data?.word,
        presentUIDs: data?.presentUIDs ?? Object.keys(data?.present ?? {}),
        present: data?.present ?? {},
      });
    });

    // Build rows across every class day + every roster user
    const rows: string[][] = [
      ["date", "word", "uid", "email", "displayName", "present"],
    ];

    dates.forEach((d) => {
      const k = dateKey(d);
      const att = attMap.get(k);
      const word = (att?.word ?? passwordForDate(d)) || "";
      const presentSet = new Set(
        att?.presentUIDs ?? Object.keys(att?.present ?? {})
      );

      roster.forEach((r) => {
        rows.push([
          k,
          word,
          r.uid,
          r.email,
          r.displayName,
          presentSet.has(r.uid) ? "TRUE" : "FALSE",
        ]);
      });
    });

    const csv = rows
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_ALL_${dayjs(TERM_START).format(
      "YYYYMMDD"
    )}_${dayjs(TERM_END).format("YYYYMMDD")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl p-6 font-louize">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-400">Professor View</div>
          <h1 className="text-2xl font-semibold">MENG 2311 – Attendance</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-zinc-400">{user?.email}</div>
          <button
            className="rounded-lg bg-zinc-800 px-3 py-2 hover:bg-zinc-700"
            onClick={() => signOut(auth)}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {/* Left: list of class days */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm text-zinc-400">
              Term: {dayjs(TERM_START).format("MMM D")} –{" "}
              {dayjs(TERM_END).format("MMM D, YYYY")}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                onClick={() => closestKey && openDay(closestKey)}
              >
                Jump to Today
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-95"
                onClick={exportAllCSV}
              >
                Export ALL CSV
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] space-y-1 overflow-auto pr-2">
            {dates.map((d) => {
              const k = dateKey(d);
              const pw = passwordForDate(d);
              const isSelected = selectedKey === k;
              const isToday = k === dayjs().tz(TZ).format("YYYY-MM-DD");
              return (
                <button
                  key={k}
                  //@ts-ignore
                  ref={(el) => (listRefs.current[k] = el)}
                  onClick={() => openDay(k)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition
                    ${
                      isSelected
                        ? "bg-zinc-800 border-zinc-700"
                        : "border-transparent hover:border-zinc-700 hover:bg-zinc-800/60"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{d.format("ddd, MMM D")}</div>
                    {isToday && (
                      <span className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-[10px] font-medium text-pink-300">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400">
                    Expected word: <span className="font-mono">{pw}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail panel */}
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
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-300">
                    Present {presentList.length} · Absent {absentList.length}
                  </span>
                  <button
                    onClick={exportCSV}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:opacity-95"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="mt-3 text-sm">
                Word:{" "}
                <span className="font-mono text-zinc-100">
                  {selectedData?.word ?? "(none)"}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm text-zinc-400">
                    Present ({presentList.length})
                  </div>
                  <ul className="space-y-1">
                    {presentList.map((u) => (
                      <li
                        key={u.uid}
                        className="rounded-lg bg-zinc-800/50 px-3 py-2"
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
                  <div className="mb-1 text-sm text-zinc-400">
                    Absent ({absentList.length})
                  </div>
                  <ul className="space-y-1">
                    {absentList.map((u) => (
                      <li
                        key={u.uid}
                        className="rounded-lg bg-zinc-800/30 px-3 py-2"
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
        Use ← / → to switch days.
      </div>
    </div>
  );
}
