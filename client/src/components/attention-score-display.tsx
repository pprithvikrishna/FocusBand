import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Brain } from "lucide-react";

interface AttentionScoreDisplayProps {
  score: number;
  isActive: boolean;
}

export function AttentionScoreDisplay({ score, isActive }: AttentionScoreDisplayProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent Focus";
    if (score >= 60) return "Good Attention";
    if (score >= 40) return "Fair Attention";
    if (score > 0) return "Low Focus";
    return "No Data";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-card-foreground">Attention Score</h2>
          <Brain className="w-5 h-5 text-primary" />
        </div>

        <div className="text-center space-y-2">
          <div className={`text-6xl font-bold transition-colors ${getScoreColor(score)}`} data-testid="text-attention-score">
            {isActive ? Math.round(score) : '--'}
          </div>
          <div className="text-sm text-muted-foreground font-medium tracking-wide uppercase">
            {isActive ? getScoreLabel(score) : 'Waiting for session'}
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor(score)}`}
              style={{ width: `${isActive ? score : 0}%` }}
              data-testid="progress-attention"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Poor</div>
              <div className="h-2 bg-red-500/20 rounded" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Good</div>
              <div className="h-2 bg-yellow-500/20 rounded" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Excellent</div>
              <div className="h-2 bg-green-500/20 rounded" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
