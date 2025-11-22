import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, Clock, Calendar } from "lucide-react";
import type { SessionStats } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardsProps {
  stats?: SessionStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-20" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Total Sessions */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">Total Sessions</span>
          <Calendar className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="text-3xl font-bold text-card-foreground" data-testid="stat-total-sessions">
            {stats.totalSessions}
          </div>
          <p className="text-xs text-muted-foreground">All time</p>
        </div>
      </Card>

      {/* Average Attention */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">Avg Attention</span>
          <Activity className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="text-3xl font-bold text-card-foreground" data-testid="stat-avg-attention">
            {Math.round(stats.averageAttention)}%
          </div>
          <p className="text-xs text-muted-foreground">Overall average</p>
        </div>
      </Card>

      {/* Total Study Time */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">Study Time</span>
          <Clock className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="text-3xl font-bold text-card-foreground" data-testid="stat-study-time">
            {Math.round(stats.totalStudyTime)}
          </div>
          <p className="text-xs text-muted-foreground">minutes this week</p>
        </div>
      </Card>

      {/* Weekly Trend */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">Weekly Trend</span>
          {stats.weeklyTrend >= 0 ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
        </div>
        <div className="space-y-1">
          <div
            className={`text-3xl font-bold ${stats.weeklyTrend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            data-testid="stat-weekly-trend"
          >
            {stats.weeklyTrend > 0 ? '+' : ''}{stats.weeklyTrend.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">vs last week</p>
        </div>
      </Card>
    </div>
  );
}
