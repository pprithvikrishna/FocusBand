import { Card } from "@/components/ui/card";
import { Eye, Activity, Compass, Move } from "lucide-react";

interface MetricsGridProps {
  eyeOpenness: number;
  blinkRate: number;
  gazeDirection: string;
  headYaw: number;
  headPitch: number;
}

export function MetricsGrid({ eyeOpenness, blinkRate, gazeDirection, headYaw, headPitch }: MetricsGridProps) {
  const formatValue = (value: number, decimals: number = 2) => {
    if (isNaN(value) || !isFinite(value)) {
      return "0." + "0".repeat(decimals);
    }
    return value.toFixed(decimals);
  };

  const getGazeLabel = (direction: string) => {
    const labels: { [key: string]: string } = {
      center: "Center",
      left: "Left",
      right: "Right",
      up: "Up",
      down: "Down",
      unknown: "Unknown"
    };
    return labels[direction] || direction;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-card-foreground mb-4">
        Detailed Metrics
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Eye Openness */}
        <div className="space-y-2" data-testid="metric-eye-openness">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-chart-1" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Eye Openness
            </span>
          </div>
          <div className="text-2xl font-bold text-card-foreground">
            {formatValue(eyeOpenness, 2)}
          </div>
          <div className="text-xs text-muted-foreground">
            EAR (0-1 scale)
          </div>
        </div>

        {/* Blink Rate */}
        <div className="space-y-2" data-testid="metric-blink-rate">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-chart-2" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Blink Rate
            </span>
          </div>
          <div className="text-2xl font-bold text-card-foreground">
            {blinkRate}
          </div>
          <div className="text-xs text-muted-foreground">
            per minute
          </div>
        </div>

        {/* Gaze Direction */}
        <div className="space-y-2" data-testid="metric-gaze">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-chart-3" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Gaze
            </span>
          </div>
          <div className="text-2xl font-bold text-card-foreground">
            {getGazeLabel(gazeDirection)}
          </div>
          <div className="text-xs text-muted-foreground">
            direction
          </div>
        </div>

        {/* Head Pose */}
        <div className="space-y-2" data-testid="metric-head-pose">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-chart-4" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Head Pose
            </span>
          </div>
          <div className="text-lg font-bold text-card-foreground">
            Y: {formatValue(headYaw, 0)}°
          </div>
          <div className="text-xs text-muted-foreground">
            P: {formatValue(headPitch, 0)}° (yaw/pitch)
          </div>
        </div>
      </div>
    </Card>
  );
}
