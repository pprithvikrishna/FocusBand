import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square, Video, VideoOff } from "lucide-react";
import { CameraFeed } from "@/components/camera-feed";
import { AttentionScoreDisplay } from "@/components/attention-score-display";
import { MetricsGrid } from "@/components/metrics-grid";
import type { LiveAttentionData } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ActiveSession() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [cameraPermission, setCameraPermission] = useState<
    "pending" | "granted" | "denied"
  >("pending");

  const [liveData, setLiveData] = useState<LiveAttentionData>({
    attentionScore: 0,
    eyeOpenness: 0,
    blinkRate: 0,
    gazeDirection: "center",
    headYaw: 0,
    headPitch: 0,
    faceDetected: false,
  });

  const [allScores, setAllScores] = useState<number[]>([]);
  const [blinkCounter, setBlinkCounter] = useState(0);
  const [eyeOpennessSum, setEyeOpennessSum] = useState(0);
  const [dataPointCount, setDataPointCount] = useState(0);
  const [pendingMetrics, setPendingMetrics] = useState<any[]>([]);

  const sessionStartTime = useRef<number>(0);
  const currentSessionId = useRef<string>("");
  const pendingMetricsRef = useRef<any[]>([]);
  const isSavingMetricsRef = useRef(false);
  const isStoppingRef = useRef(false);
  const timerInterval = useRef<NodeJS.Timeout>();
  const metricsInterval = useRef<NodeJS.Timeout>();

  // For throttling vibration/notification alerts
  const lastAlertTimeRef = useRef<number>(0);
  // To ensure we send ONE SMS each time score crosses from >=50 to <50
  const lastBelowThresholdRef = useRef<boolean>(false);

  const saveSessionMutation = useMutation({
    mutationFn: async (sessionData: any) => {
      return apiRequest("POST", "/api/sessions", sessionData);
    },
    onSuccess: (data) => {
      currentSessionId.current = data.id;
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Session Created",
        description: "Your attention tracking session has started.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveMetricsMutation = useMutation({
    mutationFn: async (metrics: any[]) => {
      return apiRequest("POST", "/api/metrics", metrics);
    },
    onError: (error) => {
      console.error("Metrics save mutation error:", error);
      toast({
        title: "Warning",
        description: "Some attention metrics failed to save. Retrying...",
        variant: "destructive",
      });
    },
  });

  // Ask for notification permission once (for alerts on phone)
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        console.log("[FocusBand] Notification permission:", permission);
      });
    }
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    pendingMetricsRef.current = pendingMetrics;
  }, [pendingMetrics]);

  // Handle session timer + periodic metrics save
  useEffect(() => {
    if (isSessionActive && !isPaused) {
      // timer
      timerInterval.current = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - sessionStartTime.current) / 1000));
      }, 1000);

      // periodic batch save
      metricsInterval.current = setInterval(async () => {
        if (isSavingMetricsRef.current) {
          console.log("Skipping batch save - previous save still in progress");
          return;
        }

        if (pendingMetricsRef.current.length > 0 && currentSessionId.current) {
          const metricsToSave = [...pendingMetricsRef.current];
          const saveCount = metricsToSave.length;

          isSavingMetricsRef.current = true;
          try {
            await saveMetricsMutation.mutateAsync(metricsToSave);
            setPendingMetrics((current) => {
              if (current.length >= saveCount) {
                return current.slice(saveCount);
              }
              return current;
            });
          } catch (error) {
            console.error("Error saving metrics batch:", error);
          } finally {
            isSavingMetricsRef.current = false;
          }
        }
      }, 10000);
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (metricsInterval.current) clearInterval(metricsInterval.current);
    }

    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (metricsInterval.current) clearInterval(metricsInterval.current);
    };
  }, [isSessionActive, isPaused, saveMetricsMutation]);

  const handleStartSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraPermission("granted");
      sessionStartTime.current = Date.now();

      // Create session on backend
      const sessionData = {
        startTime: new Date().toISOString(),
        endTime: null,
        duration: null,
        averageAttention: null,
        peakAttention: null,
        lowestAttention: null,
        totalBlinks: null,
        averageEyeOpenness: null,
      };

      const session = await saveSessionMutation.mutateAsync(sessionData);
      currentSessionId.current = session.id;

      setIsSessionActive(true);
      setIsPaused(false);
      setSessionDuration(0);
      setAllScores([]);
      setBlinkCounter(0);
      setEyeOpennessSum(0);
      setDataPointCount(0);
      setPendingMetrics([]);
      lastBelowThresholdRef.current = false;
    } catch (error) {
      setCameraPermission("denied");
      console.error("Error starting session:", error);
      toast({
        title: "Error",
        description: "Failed to start session. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      sessionStartTime.current = Date.now() - sessionDuration * 1000;
    }
    setIsPaused(!isPaused);
  };

  const handleStopSession = async () => {
    // Stop accepting new data
    isStoppingRef.current = true;

    // Stop session
    setIsSessionActive(false);
    setIsPaused(false);

    // Give intervals a moment to clear
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Wait for any in-flight batch save
    const maxWaitIterations = 50;
    let waitIterations = 0;
    while (isSavingMetricsRef.current && waitIterations < maxWaitIterations) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waitIterations++;
    }

    if (waitIterations >= maxWaitIterations) {
      console.warn("Timed out waiting for in-flight batch save");
      toast({
        title: "Warning",
        description: "Batch save timeout - attempting final save anyway.",
        variant: "destructive",
      });
    }

    // Save final batch
    await new Promise((resolve) => setTimeout(resolve, 100));
    const finalMetrics = [...pendingMetrics];

    if (finalMetrics.length > 0 && currentSessionId.current) {
      try {
        await saveMetricsMutation.mutateAsync(finalMetrics);
        setPendingMetrics([]);
      } catch (error) {
        console.error("Error saving final metrics:", error);
        toast({
          title: "Error Saving Final Metrics",
          description: `Failed to save ${finalMetrics.length} metrics. Click Stop again to retry.`,
          variant: "destructive",
          duration: 10000,
        });
        isStoppingRef.current = false;
        setIsSessionActive(true);
        return;
      }
    }

    // Update session with final statistics
    if (sessionDuration > 0 && allScores.length > 0 && currentSessionId.current) {
      const averageAttention =
        allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
      const peakAttention = Math.max(...allScores);
      const lowestAttention = Math.min(...allScores);
      const averageEyeOpenness =
        dataPointCount > 0 ? eyeOpennessSum / dataPointCount : 0;

      const sessionUpdate = {
        endTime: new Date().toISOString(),
        duration: sessionDuration,
        averageAttention,
        peakAttention,
        lowestAttention,
        totalBlinks: blinkCounter,
        averageEyeOpenness,
      };

      try {
        const response = await fetch(`/api/sessions/${currentSessionId.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionUpdate),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Session update failed: ${response.status} ${errorText}`);
        }

        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

        toast({
          title: "Session Complete",
          description: "Your session has been saved successfully.",
        });
      } catch (error) {
        console.error("Error updating session:", error);
        toast({
          title: "Error Saving Session",
          description: "Failed to save session statistics.",
          variant: "destructive",
        });
      }
    }

    // Reset state
    isStoppingRef.current = false;
    setSessionDuration(0);
    setAllScores([]);
    setBlinkCounter(0);
    setEyeOpennessSum(0);
    setDataPointCount(0);
    setPendingMetrics([]);
    currentSessionId.current = "";
    lastBelowThresholdRef.current = false;
  };

  const updateAttentionData = (data: LiveAttentionData) => {
    setLiveData(data);

    if (isStoppingRef.current) {
      return;
    }

    if (isSessionActive && !isPaused && data.faceDetected && currentSessionId.current) {
      setAllScores((prev) => [...prev, data.attentionScore]);
      setEyeOpennessSum((prev) => prev + data.eyeOpenness);
      setDataPointCount((prev) => prev + 1);

      if (data.eyeOpenness < 0.15) {
        setBlinkCounter((prev) => prev + 1);
      }

      const metric = {
        sessionId: currentSessionId.current,
        timestamp: new Date().toISOString(),
        attentionScore: data.attentionScore,
        eyeOpenness: data.eyeOpenness,
        blinkDetected: data.eyeOpenness < 0.15 ? 1 : 0,
        gazeDirection: data.gazeDirection,
        headYaw: data.headYaw,
        headPitch: data.headPitch,
      };

      setPendingMetrics((prev) => [...prev, metric]);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Test button to manually trigger phone alert
  const sendTestAlert = () => {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate([300, 150, 300]);
      } catch (err) {
        console.error("Vibration error:", err);
      }
    }

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("FocusBand Test Alert", {
          body: "This is a test alert from FocusBand.",
          icon: "/icon-192.png",
        });
      } catch (err) {
        console.error("Notification error:", err);
      }
    } else {
      console.log("Notification not allowed or not supported");
    }
  };

  // ⚡ Vibrate phone + send notification + SMS when attention is low
  useEffect(() => {
    if (!isSessionActive || isPaused) return;

    const score = liveData.attentionScore ?? 0;
    const faceDetected = liveData.faceDetected;

    if (!faceDetected) {
      // Reset SMS trigger when face is gone
      lastBelowThresholdRef.current = false;
      return;
    }

    const now = Date.now();
    const threshold = 50;

    if (score < threshold) {
      // Vibration + Notification (10s cooldown)
      if (now - lastAlertTimeRef.current >= 10000) {
        lastAlertTimeRef.current = now;

        console.log("[FocusBand] Low attention! Triggering vibration + notification");

        if ("vibrate" in navigator) {
          try {
            navigator.vibrate([300, 150, 300]);
          } catch (err) {
            console.error("Vibration error:", err);
          }
        }

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("Focus Alert", {
              body: "Your attention dropped below 50 — time to refocus!",
              icon: "/icon-192.png",
            });
          } catch (err) {
            console.error("Notification error:", err);
          }
        }
      }

      // SMS: send once per drop below threshold
      if (!lastBelowThresholdRef.current) {
        lastBelowThresholdRef.current = true;
        fetch("/api/send-alert-sms", { method: "POST" }).catch((err) => {
          console.error("Failed to send SMS alert:", err);
        });
      }
    } else {
      // Score back to normal
      if ("vibrate" in navigator) {
        try {
          navigator.vibrate(0);
        } catch (err) {
          console.error("Stop vibration error:", err);
        }
      }
      lastBelowThresholdRef.current = false;
    }
  }, [liveData.attentionScore, liveData.faceDetected, isSessionActive, isPaused]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Active Session</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor your attention in real-time
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={sendTestAlert}>
              Test Alert
            </Button>
            {isSessionActive && (
              <Badge variant="secondary" className="px-3 py-2 text-base font-medium">
                {formatDuration(sessionDuration)}
              </Badge>
            )}
          </div>
        </header>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column - Camera Feed */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-card-foreground">
                    Camera Feed
                  </h2>
                  {liveData.faceDetected ? (
                    <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                      Face Detected
                    </Badge>
                  ) : isSessionActive ? (
                    <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
                      <VideoOff className="w-3 h-3 mr-1" />
                      No Face
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Video className="w-3 h-3 mr-1" />
                      Ready
                    </Badge>
                  )}
                </div>

                <CameraFeed
                  isActive={isSessionActive && !isPaused}
                  onDataUpdate={updateAttentionData}
                  data-testid="camera-feed"
                />

                {/* Session Controls */}
                <div className="flex items-center justify-center gap-3 pt-2">
                  {!isSessionActive ? (
                    <Button
                      size="lg"
                      onClick={handleStartSession}
                      className="px-8"
                      data-testid="button-start-session"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Start Session
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={handlePauseResume}
                        data-testid="button-pause-session"
                      >
                        {isPaused ? (
                          <>
                            <Play className="w-5 h-5 mr-2" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Pause className="w-5 h-5 mr-2" />
                            Pause
                          </>
                        )}
                      </Button>
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={handleStopSession}
                        data-testid="button-stop-session"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        Stop
                      </Button>
                    </>
                  )}
                </div>

                {cameraPermission === "denied" && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <p className="text-sm text-destructive-foreground text-center">
                      Camera permission denied. Please enable camera access to use this
                      feature.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column - Metrics */}
          <div className="lg:col-span-2 space-y-6">
            <AttentionScoreDisplay
              score={liveData.attentionScore}
              isActive={isSessionActive && !isPaused && liveData.faceDetected}
            />

            <MetricsGrid
              eyeOpenness={liveData.eyeOpenness}
              blinkRate={liveData.blinkRate}
              gazeDirection={liveData.gazeDirection}
              headYaw={liveData.headYaw}
              headPitch={liveData.headPitch}
            />

            {isSessionActive && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-card-foreground mb-3">
                  Session Info
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-card-foreground">
                      {isPaused ? "Paused" : "Active"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium text-card-foreground">
                      {formatDuration(sessionDuration)}
                    </span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
