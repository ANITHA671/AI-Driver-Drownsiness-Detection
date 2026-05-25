import React, { useRef, useEffect, useState } from "react";
import { CameraOff } from "lucide-react";

interface WebcamFeedProps {
  activeSessionId: string | null;
  thresholds: {
    ear_threshold: number;
    mar_threshold: number;
    pitch_threshold: number;
    yaw_threshold: number;
  };
  onFrameResult: (result: any) => void;
  status: string;
}

export const WebcamFeed: React.FC<WebcamFeedProps> = ({
  activeSessionId,
  thresholds,
  onFrameResult,
  status,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [fps, setFps] = useState<number>(0);
  
  // Track metrics locally for drawing the HUD canvas
  const metricsRef = useRef({
    ear: 0.28,
    mar: 0.15,
    pitch: 0.0,
    yaw: 0.0,
    roll: 0.0,
    faceDetected: false,
    fps: 0,
  });

  // 1. Request Webcam Permission & Stream
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startWebcam = async () => {
      try {
        setHasAccess(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasAccess(true);
        }
      } catch (err: any) {
        console.error("Webcam access error:", err);
        setHasAccess(false);
        setErrorMessage(
          err.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access in browser settings."
            : "No camera found or camera is currently occupied by another program."
        );
      }
    };

    startWebcam();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 2. Manage WebSocket Connection
  useEffect(() => {
    if (!activeSessionId || !hasAccess) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const connectWebSocket = () => {

      const wsUrl = "ws://127.0.0.1:8088/api/ws/detect";
      console.log("Connecting WebSocket to", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connection established!");

      };

      ws.onmessage = (event) => {
        try {
          const result = JSON.parse(event.data);
          if (result.error) {
            console.warn("Server side error:", result.error);
            return;
          }
          
          // Cache metrics for HUD rendering
          metricsRef.current = {
            ear: result.ear ?? 0.28,
            mar: result.mar ?? 0.15,
            pitch: result.head_pose?.pitch ?? 0.0,
            yaw: result.head_pose?.yaw ?? 0.0,
            roll: result.head_pose?.roll ?? 0.0,
            faceDetected: result.face_detected ?? false,
            fps: result.fps ?? 0,
          };
          
          setFps(result.fps ?? 0);
          onFrameResult(result);
        } catch (e) {
          console.error("Error parsing WebSocket result:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      ws.onclose = (event) => {
        console.log("WebSocket connection closed:", event.reason);

        // Retry connection after 3 seconds if session is still active
        if (activeSessionId) {
          setTimeout(() => {
            if (activeSessionId && !wsRef.current) {
              connectWebSocket();
            }
          }, 3000);
        }
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeSessionId, hasAccess]);

  // 3. Process Frame Loop (Stream base64 to WebSocket)
  useEffect(() => {
    let intervalId: any = null;

    const captureAndSend = () => {
      const video = videoRef.current;
      const hiddenCanvas = hiddenCanvasRef.current;
      const ws = wsRef.current;

      if (
        !video ||
        !hiddenCanvas ||
        !ws ||
        ws.readyState !== WebSocket.OPEN ||
        !activeSessionId
      ) {
        return;
      }

      const ctx = hiddenCanvas.getContext("2d");
      if (!ctx) return;

      // Draw mirrored frame on hidden canvas to send to backend
      ctx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
      
      // Get base64 string
      const base64Image = hiddenCanvas.toDataURL("image/jpeg", 0.7); // 0.7 compression ratio for network performance

      // Send payload
      const payload = {
        session_id: activeSessionId,
        image: base64Image,
        thresholds: {
          ear_threshold: thresholds.ear_threshold,
          mar_threshold: thresholds.mar_threshold,
          pitch_threshold: thresholds.pitch_threshold,
          yaw_threshold: thresholds.yaw_threshold,
        },
      };

      ws.send(JSON.stringify(payload));
    };

    if (activeSessionId && hasAccess) {
      // Send frames at 150ms intervals (~6.6 FPS)
      intervalId = setInterval(captureAndSend, 150);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeSessionId, hasAccess, thresholds]);

  // 4. Render Beautiful Sci-Fi Pilot HUD Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const renderHUD = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const w = canvas.width;
      const h = canvas.height;
      const m = metricsRef.current;

      // Draw Cyberpunk scanner border lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      
      // Corner brackets
      const size = 20;
      ctx.strokeStyle = status === "DANGER" ? "rgba(255, 23, 68, 0.8)" : "rgba(0, 176, 255, 0.5)";
      ctx.lineWidth = 2;
      
      // Top Left corner
      ctx.beginPath();
      ctx.moveTo(15, 15 + size); ctx.lineTo(15, 15); ctx.lineTo(15 + size, 15);
      ctx.stroke();
      
      // Top Right corner
      ctx.beginPath();
      ctx.moveTo(w - 15, 15 + size); ctx.lineTo(w - 15, 15); ctx.lineTo(w - 15 - size, 15);
      ctx.stroke();

      // Bottom Left corner
      ctx.beginPath();
      ctx.moveTo(15, h - 15 - size); ctx.lineTo(15, h - 15); ctx.lineTo(15 + size, h - 15);
      ctx.stroke();

      // Bottom Right corner
      ctx.beginPath();
      ctx.moveTo(w - 15, h - 15 - size); ctx.lineTo(w - 15, h - 15); ctx.lineTo(w - 15 - size, h - 15);
      ctx.stroke();

      // Draw Center Targeting Reticle
      ctx.strokeStyle = "rgba(0, 176, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 45, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(w / 2 - 60, h / 2); ctx.lineTo(w / 2 - 10, h / 2);
      ctx.moveTo(w / 2 + 10, h / 2); ctx.lineTo(w / 2 + 60, h / 2);
      ctx.moveTo(w / 2, h / 2 - 60); ctx.lineTo(w / 2, h / 2 - 10);
      ctx.moveTo(w / 2, h / 2 + 10); ctx.lineTo(w / 2, h / 2 + 60);
      ctx.stroke();

      // Draw Status banner and labels
      ctx.font = "bold 11px Outfit, Inter, sans-serif";
      
      // Face detection status
      if (m.faceDetected) {
        ctx.fillStyle = status === "DANGER" ? "#ff1744" : status === "WARNING" ? "#ff9100" : "#00e676";
        ctx.fillText("SHIELD: ACTIVE", 25, 30);
        ctx.fillStyle = "#f3f4f6";
        ctx.fillText(`EAR: ${m.ear.toFixed(3)}`, 25, 48);
        ctx.fillText(`MAR: ${m.mar.toFixed(3)}`, 25, 63);
        ctx.fillText(`POSE: P:${m.pitch.toFixed(1)}° Y:${m.yaw.toFixed(1)}°`, 25, 78);
      } else {
        ctx.fillStyle = "#ff1744";
        ctx.fillText("SHIELD: FACE NOT SPOTTED", 25, 30);
      }

      // Draw FPS & Connection status on top right
      ctx.font = "10px Outfit, Inter, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillText(`FPS: ${fps}`, w - 75, 30);
      
      if (activeSessionId) {
        ctx.fillStyle = "#00b0ff";
        ctx.fillText("LIVE STREAM", w - 75, 45);
      }

      // Pitch and Yaw visual bars (Heads-up display gauges)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w - 25, h / 2 - 40);
      ctx.lineTo(w - 25, h / 2 + 40);
      ctx.stroke();

      // Pitch indicator (moves vertically inside the bar)
      const pitchOffset = Math.max(-40, Math.min(40, (m.pitch / 25) * 40));
      ctx.fillStyle = Math.abs(m.pitch) > thresholds.pitch_threshold ? "#ff1744" : "#00b0ff";
      ctx.beginPath();
      ctx.arc(w - 25, h / 2 + pitchOffset, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText("PITCH", w - 45, h / 2 - 48);

      // Warning Overlay Red Grid (flashes when Danger triggers)
      if (status === "DANGER") {
        ctx.fillStyle = "rgba(255, 23, 68, 0.08)";
        ctx.fillRect(0, 0, w, h);
        
        ctx.strokeStyle = "rgba(255, 23, 68, 0.3)";
        ctx.lineWidth = 1.5;
        // Cross lines
        ctx.beginPath();
        ctx.moveTo(25, 25); ctx.lineTo(w - 25, h - 25);
        ctx.moveTo(w - 25, 25); ctx.lineTo(25, h - 25);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(renderHUD);
    };

    renderHUD();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [status, fps, thresholds]);

  return (
    <div className={`video-container status-${status}`}>
      {/* Hidden canvas for image resizing and serializing to base64 */}
      <canvas
        ref={hiddenCanvasRef}
        width={320}
        height={240}
        style={{ display: "none" }}
      />

      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-feed"
        style={{ display: hasAccess ? "block" : "none" }}
      />

      {/* HUD Canvas overlay */}
      <canvas
        ref={canvasRef}
        width={640}
        height={400}
        className="video-canvas"
        style={{ display: hasAccess ? "block" : "none" }}
      />

      {/* Diagnostics / Overlay headers */}
      <div className="video-overlay">
        <div className="video-overlay-header">
          {activeSessionId ? (
            <div className={`rec-indicator ${status}`}>
              <div className="rec-dot" />
              <span>{status === "DANGER" ? "ALERT TRIGGERED" : status === "WARNING" ? "FATIGUE ADVISORY" : "MONITORING ACTIVE"}</span>
            </div>
          ) : (
            <div className="rec-indicator" style={{ background: "rgba(0,0,0,0.5)" }}>
              <span>SYSTEM ON STANDBY</span>
            </div>
          )}
        </div>

        {!activeSessionId && hasAccess && (
          <div style={{ textAlign: "center", width: "100%", paddingBottom: "1.5rem", zIndex: 5 }}>
            <span
              style={{
                background: "rgba(17, 20, 28, 0.8)",
                border: "1px solid var(--border-glass)",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                fontSize: "0.875rem",
                color: "var(--text-muted)",
              }}
            >
              Start session to enable real-time facial AI scanning.
            </span>
          </div>
        )}
      </div>

      <div className="video-scanline" />

      {/* Permission Fallbacks */}
      {hasAccess === false && (
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          <CameraOff size={48} style={{ color: "var(--color-danger)", marginBottom: "1rem" }} />
          <h3 style={{ color: "var(--text-main)", marginBottom: "0.5rem" }}>Camera Access Required</h3>
          <p style={{ fontSize: "0.875rem", maxWidth: "400px" }}>{errorMessage}</p>
        </div>
      )}

      {hasAccess === null && (
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
          }}
        >
          <div className="spinner" style={{ marginBottom: "1rem" }} />
          <p style={{ fontSize: "0.875rem" }}>Connecting capture devices...</p>
        </div>
      )}
    </div>
  );
};
export default WebcamFeed;
