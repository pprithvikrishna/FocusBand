import { useRef, useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
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
    const initializeModel = async () => {
      try {
        setIsModelLoading(true);
        await tf.ready();
        
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshTfjsModelConfig = {
        runtime: 'tfjs',
        refineLandmarks: true,
        };

        
        const detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
        detectorRef.current = detector;
        setIsModelLoading(false);
      } catch (err) {
        console.error("Error loading model:", err);
        setError("Failed to load AI model");
        setIsModelLoading(false);
      }
    };

    initializeModel();

    return () => {
      if (detectorRef.current) {
        detectorRef.current.dispose();
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          detectFaces();
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Unable to access camera");
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
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
    // Eye Aspect Ratio calculation
    const verticalDist1 = Math.hypot(eye[1][0] - eye[5][0], eye[1][1] - eye[5][1]);
    const verticalDist2 = Math.hypot(eye[2][0] - eye[4][0], eye[2][1] - eye[4][1]);
    const horizontalDist = Math.hypot(eye[0][0] - eye[3][0], eye[0][1] - eye[3][1]);
    return (verticalDist1 + verticalDist2) / (2.0 * horizontalDist);
  };

  const detectFaces = async () => {
    if (!videoRef.current || !detectorRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== 4) {
      animationFrameRef.current = requestAnimationFrame(detectFaces);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      const faces = await detectorRef.current.estimateFaces(video);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (faces.length > 0) {
        const face = faces[0];
        const keypoints = face.keypoints;

        // Extract eye landmarks (simplified indices)
        const leftEye = [
          keypoints[33], keypoints[160], keypoints[158],
          keypoints[133], keypoints[153], keypoints[144]
        ].map(kp => [kp.x, kp.y]);
        
        const rightEye = [
          keypoints[362], keypoints[385], keypoints[387],
          keypoints[263], keypoints[373], keypoints[380]
        ].map(kp => [kp.x, kp.y]);

        // Calculate EAR
        const leftEAR = calculateEAR(leftEye);
        const rightEAR = calculateEAR(rightEye);
        const avgEAR = (leftEAR + rightEAR) / 2;

        // Blink detection (EAR threshold)
        const EAR_THRESHOLD = 0.2;
        const now = Date.now();
        
        if (avgEAR < EAR_THRESHOLD && now - lastBlinkTime.current > 300) {
          blinkCount.current++;
          lastBlinkTime.current = now;
        }

        // Calculate blink rate (blinks per minute in last 10 seconds)
        if (now - blinkWindowStart.current > 10000) {
          blinkWindowStart.current = now;
          blinkCount.current = 0;
        }
        const blinkRate = (blinkCount.current / ((now - blinkWindowStart.current) / 1000)) * 60;

        // Estimate gaze direction (simplified)
        const noseTip = keypoints[1];
        const faceCenter = {
          x: (keypoints[234].x + keypoints[454].x) / 2,
          y: (keypoints[10].y + keypoints[152].y) / 2
        };
        
        const gazeOffsetX = noseTip.x - faceCenter.x;
        const gazeOffsetY = noseTip.y - faceCenter.y;
        
        let gazeDirection = "center";
        if (Math.abs(gazeOffsetX) > 15) {
          gazeDirection = gazeOffsetX > 0 ? "right" : "left";
        } else if (Math.abs(gazeOffsetY) > 15) {
          gazeDirection = gazeOffsetY > 0 ? "down" : "up";
        }

        // Estimate head pose (simplified using face bounds)
        const headYaw = gazeOffsetX * 0.5; // Simplified calculation
        const headPitch = gazeOffsetY * 0.5;

        // Calculate attention score (composite)
        let attentionScore = 100;
        
        // Penalize for eyes not fully open
        if (avgEAR < 0.25) {
          attentionScore -= 20;
        }
        
        // Penalize for looking away
        if (gazeDirection !== "center") {
          attentionScore -= 30;
        }
        
        // Penalize for extreme head rotation
        if (Math.abs(headYaw) > 20 || Math.abs(headPitch) > 20) {
          attentionScore -= 25;
        }
        
        // Penalize for excessive blinking
        if (blinkRate > 30) {
          attentionScore -= 10;
        }
        
        attentionScore = Math.max(0, Math.min(100, attentionScore));

        // Draw face landmarks (optional visualization)
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        
        // Draw face oval
        ctx.beginPath();
        const faceOval = [
          ...Array.from({length: 10}, (_, i) => keypoints[10 + i * 15]),
        ];
        faceOval.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();

        // Draw eyes
        [leftEye, rightEye].forEach(eye => {
          ctx.beginPath();
          eye.forEach((point, index) => {
            if (index === 0) {
              ctx.moveTo(point[0], point[1]);
            } else {
              ctx.lineTo(point[0], point[1]);
            }
          });
          ctx.closePath();
          ctx.stroke();
        });

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
      console.error("Error detecting face:", err);
    }

    animationFrameRef.current = requestAnimationFrame(detectFaces);
  };

  return (
    <div className="relative w-full bg-muted rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      
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
