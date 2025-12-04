import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DashboardSession {
  studentName: string;
  studentGrade: string;
  parentName: string;
  parentEmail: string;
  startTime: string;
  endTime: string;
  duration: number;
  averageAttention: number;
  peakAttention: number;
  lowestAttention: number;
}

interface GroupedStudentData {
  studentName: string;
  studentGrade: string;
  parentName: string;
  parentEmail: string;
  totalMinutes: number;
  avgAttention: number;
  bestAttention: number;
  sessionCount: number;
  lastSessionEnd: string | null;
}

export default function ParentDashboard() {
  const [allSessions, setAllSessions] = useState<DashboardSession[]>([]);
  const [parentFilter, setParentFilter] = useState("");
  const [grouped, setGrouped] = useState<GroupedStudentData[]>([]);

  // Load from localStorage once on mount
  useEffect(() => {
    try {
      const key = "focusband_parent_dashboard_v1";
      const raw = window.localStorage.getItem(key);
      const data: DashboardSession[] = raw ? JSON.parse(raw) : [];
      setAllSessions(data);
    } catch (err) {
      console.error("Error reading local dashboard data:", err);
    }
  }, []);

  // Recompute grouped data when sessions or parent filter change
  useEffect(() => {
    let filtered = allSessions;

    if (parentFilter.trim()) {
      const f = parentFilter.trim().toLowerCase();
      filtered = allSessions.filter(
        (s) =>
          s.parentEmail.toLowerCase().includes(f) ||
          s.parentName.toLowerCase().includes(f)
      );
    }

    const byKey = new Map<string, GroupedStudentData>();

    for (const s of filtered) {
      const key = `${s.parentEmail}::${s.studentName}::${s.studentGrade}`;
      const existing = byKey.get(key);

      const minutes = s.duration / 60;

      if (!existing) {
        byKey.set(key, {
          studentName: s.studentName,
          studentGrade: s.studentGrade,
          parentName: s.parentName,
          parentEmail: s.parentEmail,
          totalMinutes: minutes,
          avgAttention: s.averageAttention,
          bestAttention: s.averageAttention,
          sessionCount: 1,
          lastSessionEnd: s.endTime,
        });
      } else {
        const totalMinutes = existing.totalMinutes + minutes;
        const sessionCount = existing.sessionCount + 1;
        const totalAttention =
          existing.avgAttention * existing.sessionCount + s.averageAttention;
        const avgAttention = totalAttention / sessionCount;
        const bestAttention = Math.max(existing.bestAttention, s.averageAttention);
        const lastSessionEnd =
          new Date(s.endTime) > new Date(existing.lastSessionEnd || 0)
            ? s.endTime
            : existing.lastSessionEnd;

        byKey.set(key, {
          ...existing,
          totalMinutes,
          avgAttention,
          bestAttention,
          sessionCount,
          lastSessionEnd,
        });
      }
    }

    setGrouped(Array.from(byKey.values()));
  }, [allSessions, parentFilter]);

  const handleClear = () => {
    if (!window.confirm("Clear all locally stored sessions? This cannot be undone.")) {
      return;
    }
    window.localStorage.removeItem("focusband_parent_dashboard_v1");
    setAllSessions([]);
    setGrouped([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-3xl font-semibold text-foreground">Parent Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          View study focus summaries for each student (stored locally on this device).
        </p>

        {/* Filter by parent */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex flex-col w-full sm:w-80">
            <label className="text-xs text-muted-foreground mb-1">
              Filter by parent email or name
            </label>
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="e.g. parent@example.com"
              value={parentFilter}
              onChange={(e) => setParentFilter(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParentFilter("")}
            >
              Clear Filter
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClear}
            >
              Clear All Data
            </Button>
          </div>
        </div>

        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sessions stored yet. Run a session in the Active Session page to see data here.
          </p>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => (
              <Card key={`${g.parentEmail}-${g.studentName}-${g.studentGrade}`} className="p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {g.studentName} <span className="text-sm text-muted-foreground"> (Grade {g.studentGrade})</span>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Parent: {g.parentName} • {g.parentEmail}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sessions: {g.sessionCount} • Last:{" "}
                    {g.lastSessionEnd
                      ? new Date(g.lastSessionEnd).toLocaleString()
                      : "—"}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Study Time</div>
                    <div className="font-medium">
                      {Math.round(g.totalMinutes)} minutes
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Average Attention</div>
                    <div className="font-medium">
                      {Math.round(g.avgAttention)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Best Session Attention</div>
                    <div className="font-medium">
                      {Math.round(g.bestAttention)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Sessions Recorded</div>
                    <div className="font-medium">{g.sessionCount}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

