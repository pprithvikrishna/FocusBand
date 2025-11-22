import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Session } from "@shared/schema";
import { format } from "date-fns";

interface SessionHistoryProps {
  sessions: Session[];
  isLoading: boolean;
}

export function SessionHistory({ sessions, isLoading }: SessionHistoryProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
        <p className="text-muted-foreground">No sessions recorded yet</p>
        <p className="text-sm text-muted-foreground mt-1">Start a session to begin tracking your attention</p>
      </div>
    );
  }

  const getScoreBadge = (score: number | null) => {
    if (score === null) return <Badge variant="secondary">N/A</Badge>;
    
    if (score >= 80) {
      return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">Excellent</Badge>;
    }
    if (score >= 60) {
      return <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">Good</Badge>;
    }
    if (score >= 40) {
      return <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20">Fair</Badge>;
    }
    return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">Low</Badge>;
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-2">
      {sessions.map((session, index) => (
        <div
          key={session.id}
          className="flex items-center justify-between p-4 rounded-lg border border-border hover-elevate"
          data-testid={`session-${index}`}
        >
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-medium text-card-foreground">
                {format(new Date(session.startTime), "MMM d, yyyy 'at' h:mm a")}
              </span>
              {getScoreBadge(session.averageAttention)}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Duration: {formatDuration(session.duration)}</span>
              {session.averageAttention !== null && (
                <span>Average: {Math.round(session.averageAttention)}%</span>
              )}
              {session.peakAttention !== null && (
                <span>Peak: {Math.round(session.peakAttention)}%</span>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-card-foreground">
              {session.averageAttention !== null ? Math.round(session.averageAttention) : '--'}
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
