// client/src/pages/parent-dashboard.tsx

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DashboardSession {
  studentName: string;
  studentGrade: string;
  parentName: string;
  parentEmail: string;
  duration: number;
  averageAttention: number;
  endedAt: string;
}

export default function ParentDashboard() {
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [parentFilter, setParentFilter] = useState("");

  // Load sessions from localStorage when the page opens
  useEffect(() => {
    try {
      const key = "focusband_parent_dashboard_v1";
      const raw = window.localStorage.getItem(key);
      const data: DashboardSession[] = raw ? JSON.parse(raw) : [];
      console.log("[FocusBand] Loaded sessions from localStorage:", data);
      setSessions(data);
    } catch (err) {
      console.error("Error reading dashboard data:", err);
    }
  }, []);

  // Filter by parent name/email (optional)
  const filtered = sessions.filter((s) => {
    if (!parentFilter.trim()) return true;
    const f = parentFilter.trim().toLowerCase();
    return (
      s.parentEmail.toLowerCase().includes(f) ||
      s.parentName.toLowerCase().includes(f)
    );
  });

  const handleClear = () => {
    if (!window.confirm("Clear all locally stored sessions?")) return;
    window.localStorage.removeItem("focusband_parent_dashboard_v1");
    setSessions([]);
  };

  const reload = () => {
    try {
      const key = "focusband_parent_dashboard_v1";
      const raw = window.localStorage.getItem(key);
      const data: DashboardSession[] = raw ? JSON.parse(raw) : [];
      setSessions(data);
    } catch (err) {
      console.error("Error reloading dashboard data:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-3xl font-semibold text-foreground">Parent Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Each row below is one study session saved from the Active Session page.
        </p>

        {/* Filter + Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex flex-col w-full sm:w-80">
            <label className="text-xs text-muted-foreground mb-1">
              Filter by parent email or name (optional)
            </label>
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="e.g. parent@example.com"
              value={parentFilter}
              onChange={(e) => setParentFilter(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reload}>
              Reload
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClear}>
              Clear All
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sessions found. Run a session on the main page, then press Stop and come back here.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((s, index) => (
              <Card key={index} className="p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {s.studentName}{" "}
                      <span className="text-sm text-muted-foreground">
                        (Grade {s.studentGrade})
                      </span>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Parent: {s.parentName} • {s.parentEmail}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ended at:{" "}
                    {new Date(s.endedAt).toLocaleString()}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Duration</div>
                    <div className="font-medium">
                      {Math.round(s.duration)} seconds
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Average Attention</div>
                    <div className="font-medium">
                      {Math.round(s.averageAttention)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Device Storage</div>
                    <div className="font-medium">
                      Local (this browser)
                    </div>
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
