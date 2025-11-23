import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square, Video, VideoOff } from "lucide-react";
import { CameraFeed } from "@/components/camera-feed";
import { AttentionScoreDisplay } from "@/components/attention-score-display";
import { LiveGraph } from "@/components/live-graph";
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
  const [cameraPermission, setCameraPermission] = useState<"pending" | "granted" | "denied">("pending");
  
  const [liveData, setLiveData] = useState<LiveAttentionData>({
    attentionScore: 0,
    eyeOpenness: 0,
    blinkRate: 0,
    gazeDirection: "center",
    headYaw: 0,
    headPitch: 0,
    faceDetected: false,
  });

  const [graphData, setGraphData] = useState<Array<{ time: number; score: number }>>([]);
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

  // 🔵 BLE: state for the watch connection
  const [bleDevice, setBleDevice] = useState<BluetoothDevice | null>(null);
  const [bleCharacteristic, setBleCharacteristic] =
    useState<BluetoothRemoteGATTCharacteristic | null>(null);

  const saveSessionMutation = useMutation({
    mutationFn: async (sessionData: any) => {
      return apiRequest("POST", "/api/sessions", sessionData);
    },
    onSuccess: (data) => {
      currentSessionId.current = data.id;
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Session Saved",
        description: "Your attention tracking session has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save session. Please try again.",
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

  // Keep ref in sync with state
  useEffect(() => {
    pendingMetricsRef.current = pendingMetrics;
  }, [pendingMetrics]);

  useEffect(() => {
    if (isSessionActive && !isPaused) {
      timerInterval.current = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - sessionStartTime.current) / 1000));
      }, 1000);

      // Save metrics every 10 seconds (stable interval - no dependencies to avoid resets)
      metricsInterval.current = setInterval(async () => {
        // Guard against overlapping mutations using ref
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
            // Only remove exactly the metrics that were just saved (first saveCount items)
            setPendingMetrics(current => {
              // Remove only if current queue still starts with the same metrics we saved
              if (current.length >= saveCount) {
                return current.slice(saveCount);
              }
              return current;
            });
          } catch (error) {
            console.error("Error saving metrics batch:", error);
            // Keep all metrics in queue for retry on next interval
          } finally {
            isSavingMetricsRef.current = false;
          }
        }
      }, 10000);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      if (metricsInterval.current) {
        clearInterval(metricsInterval.current);
      }
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      if (metricsInterval.current) {
        clearInterval(metricsInterval.current);
      }
    };
  }, [isSessionActive, isPaused]);

  const handleStartSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission("granted");
      sessionStartTime.current = Date.now();
      
      // Create session immediately to get session ID
      const sessionData = {
        startTime: new Date(Date.now()).toISOString(),
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
      setGraphData([]);
      setAllScores([]);
      setBlinkCounter(0);
      setEyeOpennessSum(0);
      setDataPointCount(0);
      setPendingMetrics([]);
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
    // STEP 1: Set stopping flag immediately to freeze new data capture
    isStoppingRef.current = true;
    
    // STEP 2: Stop session to trigger cleanup of intervals and camera
    setIsSessionActive(false);
    setIsPaused(false);
    
    // Wait a brief moment for intervals to clear
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // STEP 3: Wait for any in-flight batch save to complete
    const maxWaitIterations = 50; // 5 seconds max
    let waitIterations = 0;
    while (isSavingMetricsRef.current && waitIterations < maxWaitIterations) {
      await new Promise(resolve => setTimeout(resolve, 100));
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
    
    // STEP 4: Save final batch of metrics (single attempt - user can retry if it fails)
    // Wait for any pending state updates to settle
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Capture final metrics snapshot
    const finalMetrics = [...pendingMetrics];
    
    if (finalMetrics.length > 0 && currentSessionId.current) {
      try {
        await saveMetricsMutation.mutateAsync(finalMetrics);
        // Success - clear the metrics
        setPendingMetrics([]);
      } catch (error) {
        console.error("Error saving final metrics:", error);
        toast({
          title: "Error Saving Final Metrics",
          description: `Failed to save ${finalMetrics.length} metrics. Click Stop again to retry.`,
          variant: "destructive",
          duration: 10000,
        });
        // Reset stopping flag and re-enable session for retry
        isStoppingRef.current = false;
        setIsSessionActive(true);
        return; // Early return - don't proceed to session update or state reset
      }
    }

    // STEP 5: Update session with final statistics
    if (sessionDuration > 0 && allScores.length > 0 && currentSessionId.current) {
      // Calculate session statistics
      const averageAttention = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
      const peakAttention = Math.max(...allScores);
      const lowestAttention = Math.min(...allScores);
      const averageEyeOpenness = dataPointCount > 0 ? eyeOpennessSum / dataPointCount : 0;

      // Update session with final statistics
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
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
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

    // STEP 6: Reset all remaining state (only after all saves succeeded)
    isStoppingRef.current = false;
    setSessionDuration(0);
    setGraphData([]);
    setAllScores([]);
    setBlinkCounter(0);
    setEyeOpennessSum(0);
    setDataPointCount(0);
    setPendingMetrics([]);
    currentSessionId.current = "";
  };

  const updateAttentionData = (data: LiveAttentionData) => {
    setLiveData(data);
    
    // Don't accept new metrics if session is stopping
    if (isStoppingRef.current) {
      return;
    }
    
    if (isSessionActive && !isPaused && data.faceDetected && currentSessionId.current) {
      // Update graph data (keep last 60 seconds)
      setGraphData(prev => {
        const newData = [...prev, { time: sessionDuration, score: data.attentionScore }];
        return newData.slice(-60);
      });

      // Track all scores for statistics
      setAllScores(prev => [...prev, data.attentionScore]);
      
      // Track eye openness sum
      setEyeOpennessSum(prev => prev + data.eyeOpenness);
      setDataPointCount(prev => prev + 1);

      // Track blinks (simple detection based on low eye openness)
      if (data.eyeOpenness < 0.15) {
        setBlinkCounter(prev => prev + 1);
      }

      // Queue metric for batch save (only if we have a valid session ID)
      if (currentSessionId.current) {
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
        
        setPendingMetrics(prev => [...prev, metric]);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 🔵 BLE: function to connect to the Fire-Boltt watch
  async function connectWatch() {
    try {
      const nav: any = navigator;

      if (!nav.bluetooth) {
        alert("This browser does not support Web Bluetooth. Try Chrome on Android.");
        return;
      }

      const device: BluetoothDevice = await nav.bluetooth.requestDevice({
        filters: [
          {
            services: [0xAE01] // primary custom service we want
          }
        ],
        optionalServices: [0xAE01, 0xFEEA, 0x190E]
      });

      console.log("[FocusBand] Selected device:", device.name || device.id);
      setBleDevice(device);

      const server = await device.gatt?.connect();
      if (!server) {
        alert("Failed to connect to watch.");
        return;
      }

      const service = await server.getPrimaryService(0xAE01);
      const characteristic = await service.getCharacteristic(0xAE01); // WRITE NO RESPONSE

      setBleCharacteristic(characteristic);
      alert("Watch connected on service AE01!");
    } catch (err) {
      console.error("[FocusBand] Error connecting to watch:", err);
      alert("Could not connect to watch. Check Bluetooth and try again.");
    }
  }

  // 🔵 BLE: whenever attentionScore changes, send a signal if watch is connected
  useEffect(() => {
    if (!bleCharacteristic) return;

    const score = liveData.attentionScore ?? 0;

    async function sendAlert() {
      try {
        if (score < 50) {
          // ⚠️ EXPERIMENT ZONE:
          // Try different byte patterns here and test if the watch vibrates.
          // Example 1: a simple 1-byte command
          // const data = new Uint8Array([0x01]);

          // Example 2: the pattern you saw in the scanner (you can change this)
          const data = new Uint8Array([0xFE, 0xEA, 0x20, 0x07, 0x53, 0x0E, 0xFF]);

          await bleCharacteristic.writeValueWithoutResponse(data);
          console.log("[FocusBand] Sent LOW attention alert to watch");
        } else {
          // Optional: send a "clear" value when attention is OK
          const data = new Uint8Array([0x00]);
          await bleCharacteristic.writeValueWithoutResponse(data);
          console.log("[FocusBand] Sent NORMAL attention signal to watch");
        }
      } catch (err) {
        console.error("[FocusBand] Error writing to watch:", err);
      }
    }

    void sendAlert();
  }, [liveData.attentionScore, bleCharacteristic]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Active Session</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor your attention in real-time
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 🔵 BLE: Connect Watch button */}
            <Button
              variant={bleCharacteristic ? "secondary" : "outline"}
              size="sm"
              onClick={connectWatch}
            >
              {bleCharacteristic ? "Watch Connected" : "Connect Watch"}
            </Button>

            {isSessionActive && (
              <Badge variant="secondary" className="px-3 py-2 text-base font-medium">
                {formatDuration(sessionDuration)}
              </Badge>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column - Camera Feed (60%) */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-card-foreground">Camera Feed</h2>
                  {liveData.faceDetected ? (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                      Face Detected
                    </Badge>
                  ) : isSessionActive ? (
                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
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
                      Camera permission denied. Please enable camera access to use this feature.
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Live Graph */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-card-foreground mb-4">
                Attention Timeline
              </h2>
              <LiveGraph data={graphData} />
            </Card>
          </div>

          {/* Right Column - Metrics (40%) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Attention Score */}
            <AttentionScoreDisplay
              score={liveData.attentionScore}
              isActive={isSessionActive && !isPaused && liveData.faceDetected}
            />

            {/* Individual Metrics */}
            <MetricsGrid
              eyeOpenness={liveData.eyeOpenness}
              blinkRate={liveData.blinkRate}
              gazeDirection={liveData.gazeDirection}
              headYaw={liveData.headYaw}
              headPitch={liveData.headPitch}
            />

            {/* Session Info */}
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
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data Points</span>
                    <span className="font-medium text-card-foreground">
                      {graphData.length}
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
