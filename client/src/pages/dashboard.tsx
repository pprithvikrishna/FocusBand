import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Clock, Target } from "lucide-react";
import { StatsCards } from "@/components/stats-cards";
import { SessionHistory } from "@/components/session-history";
import { useQuery } from "@tanstack/react-query";
import type { Session, SessionStats } from "@shared/schema";

export default function Dashboard() {
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: stats } = useQuery<SessionStats>({
    queryKey: ["/api/stats"],
  });

  const handleExportCSV = () => {
    window.location.href = "/api/export/csv";
  };

  const handleExportJSON = () => {
    window.location.href = "/api/export/json";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track your attention patterns and progress
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJSON}
              data-testid="button-export-json"
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <StatsCards stats={stats} />

        {/* Quick Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-muted-foreground">Best Performance</h3>
                <p className="text-2xl font-bold text-card-foreground mt-1">
                  {stats ? Math.round(stats.averageAttention) : 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Average attention</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-chart-2/10 rounded-lg">
                <Clock className="w-6 h-6 text-chart-2" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-muted-foreground">Study Time</h3>
                <p className="text-2xl font-bold text-card-foreground mt-1">
                  {stats ? Math.round(stats.totalStudyTime) : 0} min
                </p>
                <p className="text-xs text-muted-foreground mt-1">Total this week</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-chart-3/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-chart-3" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-muted-foreground">Weekly Trend</h3>
                <p className="text-2xl font-bold text-card-foreground mt-1">
                  {stats ? (stats.weeklyTrend > 0 ? '+' : '') : ''}
                  {stats ? stats.weeklyTrend.toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">vs last week</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Session History */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-card-foreground">Recent Sessions</h2>
            <span className="text-sm text-muted-foreground">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
            </span>
          </div>
          <SessionHistory sessions={sessions} isLoading={isLoadingSessions} />
        </Card>
      </div>
    </div>
  );
}
