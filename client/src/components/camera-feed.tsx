import { useRef, useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl"; // ensure webgl backend is available
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import type { LiveAttentionData } from "@shared/schema";

interface CameraFeedProps {
  isActive: boolean;
  onDataUpdate: (data: LiveAttentionData) => void;
}

export function CameraFeed({ isActive, onDataUpdate }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const detectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const lastBlinkTime = useRef<number>(Date.now());
  const blinkCount = useRef<number>(0);
  const blinkWindowStart = useRef<number>(Date.now());

  useEffect(() => {
    let mounted = true;

    const initializeModel = async () => {
      try {
        console.log("[FocusBand] tf.ready()");
        setIsModelLoading(true);

        // Ensure TF backend is ready and set to webgl for best performance
        await tf.ready();
        await tf.setBackend("webgl");
        await tf.ready(); // ensure backend switched
        console.log("[FocusBand] TF backend:", tf.getBackend());

        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;

        const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshTfjsModelConfig = {
          runtime: "tfjs", // use tfjs runtime (no wasm/CDN cross-origin issues)
          refineLandmarks: true,
          // maxFaces isn't part of this config type strictly but createDetector accepts
          // options in the detector creation too — we'll rely on default of 1
        };

        console.log("[FocusBand] Creating detector...");
        const detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
        console.log("[FocusBand] Detector created:", !!detector);

        if (mounted) {
          detectorRef.current = detector;
          setIsModelLoading(false);
        } else {
          detector?.dispose?.();
        }
      } catch (err) {
        console.error("[FocusBand] Error loading model:", err);
        setError("Failed to load AI model");
        setIsModelLoading(false);
      }
    };

    initializeModel();

    return () => {
      mounted = false;
      if (detectorRef.current) {
        try {
          detectorRef.current.dispose();
        } catch {}
        detectorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isActive && !isModelLoading) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive, isModelLoading]);

  const startCamera = async () => {
    try {
      console.log("[FocusBand] Requesting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log("[FocusBand] Video metadata loaded", videoRef.current?.videoWidth, videoRef.current?.videoHeight);
          videoRef.current?.play();
          // start detection loop (it will early-return until model + video ready)
          detectFaces();
        };
      }
    } catch (err) {
      console.error("[FocusBand] Error accessing camera:", err);
      setError("Unable to access camera");
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const calculateEAR = (eye: number[][]) => {
    const verticalDist1 = Math.hypot(eye[1][0] - eye[5][0], eye[1][1] - eye[5][1]);
    const verticalDist2 = Math.hypot(eye[2][0] - eye[4][0], eye[2][1] - eye[4][1]);
    const horizontalDist = Math.hypot(eye[0][0] - eye[3][0], eye[0][1] - eye[3][1]);
    return (verticalDist1 + verticalDist2) / (2.0 * horizontalDist);
  };

  const detectFaces = async () => {
    // keep loop running even if early-return so we can recover
    try {
      const detector = detectorRef.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!canvas || !video) {
        animationFrameRef.current = requestAnimationFrame(detectFaces);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animationFrameRef.current = requestAnimationFrame(detectFaces);
        return;
      }

      // Wait until video has enough data
      if (video.readyState < 2 || !detector) {
        // log helpful info occasionally
        // (don't spam logs every frame — only log if model is still loading)
        if (isModelLoading) {
          console.log("[FocusBand] Waiting for model/video to be ready...", { readyState: video.readyState, detector: !!detector });
        }
        animationFrameRef.current = requestAnimationFrame(detectFaces);
        return;
      }

      // set canvas size to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // estimate faces from video element
      const faces = await detector.estimateFaces(video as HTMLVideoElement);

      // debug log (throttled by requestAnimationFrame)
      // eslint-disable-next-line no-console
      console.log("[FocusBand] Faces found:", faces.length);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (faces.length > 0) {
        const face = faces[0];
        // face.keypoints may be objects with x,y properties
        const keypoints = (face as any).keypoints || (face as any).scaledMesh || [];

        // If keypoints are as objects: convert to {x,y}
        const normalizedKeypoints: { x: number; y: number }[] = keypoints.map((kp: any) => {
          if (Array.isArray(kp)) {
            return { x: kp[0], y: kp[1] };
          }
          return { x: kp.x ?? kp[0], y: kp.y ?? kp[1] };
        });

        // Draw small points for landmarks
        ctx.fillStyle = "#22c55e";
        for (let i = 0; i < normalizedKeypoints.length; i++) {
          const p = normalizedKeypoints[i];
          if (!p || Number.isNaN(p.x) || Number.isNaN(p.y)) continue;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Extract eye landmarks by indices (ensure indices exist)
        const safe = (i: number) => normalizedKeypoints[i] ?? { x: 0, y: 0 };
        const leftEye = [safe(33), safe(160), safe(158), safe(133), safe(153), safe(144)].map(kp => [kp.x, kp.y]);
        const rightEye = [safe(362), safe(385), safe(387), safe(263), safe(373), safe(380)].map(kp => [kp.x, kp.y]);

        // Calculate EAR
        const leftEAR = calculateEAR(leftEye);
        const rightEAR = calculateEAR(rightEye);
        const avgEAR = (leftEAR + rightEAR) / 2;

        // Blink detection
        const EAR_THRESHOLD = 0.2;
        const now = Date.now();
        if (avgEAR < EAR_THRESHOLD && now - lastBlinkTime.current > 300) {
          blinkCount.current++;
          lastBlinkTime.current = now;
        }
        if (now - blinkWindowStart.current > 10000) {
          blinkWindowStart.current = now;
          blinkCount.current = 0;
        }
        const blinkRate = (blinkCount.current / ((now - blinkWindowStart.current) / 1000)) * 60;

        // Gaze (simplified)
        const noseTip = safe(1);
        const faceCenter = {
          x: (safe(234).x + safe(454).x) / 2,
          y: (safe(10).y + safe(152).y) / 2,
        };
        const gazeOffsetX = noseTip.x - faceCenter.x;
        const gazeOffsetY = noseTip.y - faceCenter.y;
        let gazeDirection = "center";
        if (Math.abs(gazeOffsetX) > 15) gazeDirection = gazeOffsetX > 0 ? "right" : "left";
        else if (Math.abs(gazeOffsetY) > 15) gazeDirection = gazeOffsetY > 0 ? "down" : "up";

        const headYaw = gazeOffsetX * 0.5;
        const headPitch = gazeOffsetY * 0.5;

        // Attention score (your original logic)
        let attentionScore = 100;
        if (avgEAR < 0.25) attentionScore -= 20;
        if (gazeDirection !== "center") attentionScore -= 30;
        if (Math.abs(headYaw) > 20 || Math.abs(headPitch) > 20) attentionScore -= 25;
        if (blinkRate > 30) attentionScore -= 10;
        attentionScore = Math.max(0, Math.min(100, attentionScore));

        onDataUpdate({
          attentionScore,
          eyeOpenness: avgEAR,
          blinkRate: Math.round(blinkRate),
          gazeDirection,
          headYaw,
          headPitch,
          faceDetected: true,
        });
      } else {
        onDataUpdate({
          attentionScore: 0,
          eyeOpenness: 0,
          blinkRate: 0,
          gazeDirection: "unknown",
          headYaw: 0,
          headPitch: 0,
          faceDetected: false,
        });
      }
    } catch (err) {
      console.error("[FocusBand] Error detecting face:", err);
    } finally {
      animationFrameRef.current = requestAnimationFrame(detectFaces);
    }
  };

  return (
    <div className="relative w-full bg-muted rounded-lg overflow-hidden" style={{ aspectRatio: "4/3" }}>
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {isModelLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="text-center space-y-2">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading AI model...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!isActive && !isModelLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <p className="text-sm text-muted-foreground">Camera inactive</p>
        </div>
      )}
    </div>
  );
}
