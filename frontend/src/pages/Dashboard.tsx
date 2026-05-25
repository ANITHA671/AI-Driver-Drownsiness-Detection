import React, { useState, useEffect, useRef } from "react";
import { apiService } from "../services/api";
import type { Session, Alert } from "../services/api";
import WebcamFeed from "../components/WebcamFeed";
import StatusCard from "../components/StatusCard";
import AlertBanner from "../components/AlertBanner";
import StatsChart from "../components/StatsChart";
import HistoryTable from "../components/HistoryTable";
import { Play, Square, ShieldCheck, Hourglass } from "lucide-react";

interface DashboardProps {
  activeSession: Session | null;
  setActiveSession: (session: Session | null) => void;
  thresholds: {
    ear_threshold: number;
    mar_threshold: number;
    pitch_threshold: number;
    yaw_threshold: number;
  };
}

export const Dashboard: React.FC<DashboardProps> = ({
  activeSession,
  setActiveSession,
  thresholds,
}) => {
  const [driverName, setDriverName] = useState<string>("Anitha V.");
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [sessionTime, setSessionTime] = useState<string>("00:00:00");
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  
  // Real-time live frame metrics state
  const [liveMetrics, setLiveMetrics] = useState({
    ear: 0.28,
    mar: 0.15,
    pitch: 0.0,
    yaw: 0.0,
    status: "NORMAL",
    alertType: null as string | null,
    durationSeconds: 0.0,
    faceDetected: false,
  });

  // Telemetry buffer for chart (rolling last 30 frames)
  const [chartHistory, setChartHistory] = useState<
    { ear: number; mar: number; timestamp: number }[]
  >([]);

  const sessionTimerRef = useRef<any>(null);

  // 1. Recover active session from backend on page mount
  useEffect(() => {
    const checkActive = async () => {
      try {
        const session = await apiService.getActiveSession();
        setActiveSession(session);
        setDriverName(session.driver_name);
        
        // Fetch existing alerts for this active session
        const alerts = await apiService.getSessionDetails(session.id);
        setRecentAlerts(alerts.alerts);
      } catch (e) {
        // No active session, standby state is normal
      }
    };
    checkActive();
  }, [setActiveSession]);

  // 2. Track Session Timer duration
  useEffect(() => {
    if (activeSession) {
      const start = new Date(activeSession.start_time).getTime();
      
      sessionTimerRef.current = setInterval(() => {
        const diff = Date.now() - start;
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        
        setSessionTime(
          `${hrs.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
        );
      }, 1000);
    } else {
      setSessionTime("00:00:00");
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    }

    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [activeSession]);

  // 3. API - Start monitoring session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) return;
    
    setIsStarting(true);
    try {
      const session = await apiService.startSession(driverName);
      setActiveSession(session);
      setRecentAlerts([]);
      setChartHistory([]);
      setLiveMetrics({
        ear: 0.28,
        mar: 0.15,
        pitch: 0.0,
        yaw: 0.0,
        status: "NORMAL",
        alertType: null,
        durationSeconds: 0.0,
        faceDetected: false,
      });
    } catch (err) {
      console.error(err);
      alert("Error starting monitoring session. Ensure backend is running.");
    } finally {
      setIsStarting(false);
    }
  };

  // 4. API - End session
  const handleEndSession = async () => {
    if (!activeSession) return;

    try {
      await apiService.endSession(activeSession.id);
      setActiveSession(null);
      setLiveMetrics((prev) => ({ ...prev, status: "NORMAL", faceDetected: false }));
      setChartHistory([]);
    } catch (err) {
      console.error(err);
      alert("Failed to end session cleanly.");
    }
  };

  // 5. WebSocket - Process Real-time result frame
  const handleFrameResult = (result: any) => {
    setLiveMetrics({
      ear: result.ear,
      mar: result.mar,
      pitch: result.head_pose?.pitch ?? 0.0,
      yaw: result.head_pose?.yaw ?? 0.0,
      status: result.status,
      alertType: result.alert_type,
      durationSeconds: result.duration_seconds,
      faceDetected: result.face_detected,
    });

    if (result.face_detected) {
      // Add telemetry to graph rolling buffer (max 30 points)
      setChartHistory((prev) => {
        const next = [...prev, { ear: result.ear, mar: result.mar, timestamp: Date.now() }];
        if (next.length > 30) next.shift();
        return next;
      });

      // If an alert was logged on server, pull fresh alerts list
      if (result.alert_triggered) {
        fetchAlertsList();
      }
    }
  };

  const fetchAlertsList = async () => {
    if (!activeSession) return;
    try {
      const details = await apiService.getSessionDetails(activeSession.id);
      setRecentAlerts(details.alerts.slice(0, 10)); // Fetch top 10 recent
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="page-body" style={{ padding: "1.5rem" }}>
      {/* Visual Header Warning Banner */}
      <AlertBanner
        status={liveMetrics.status}
        alertType={liveMetrics.alertType}
        durationSeconds={liveMetrics.durationSeconds}
      />

      <div className="dashboard-grid">
        {/* Left Side: Live Feed & Dashboard Stats */}
        <div className="dashboard-left">
          {/* Webcam Component */}
          <WebcamFeed
            activeSessionId={activeSession ? activeSession.id : null}
            thresholds={thresholds}
            onFrameResult={handleFrameResult}
            status={liveMetrics.status}
          />

          {/* Running Status Numeric cards */}
          <StatusCard
            ear={liveMetrics.ear}
            mar={liveMetrics.mar}
            pitch={liveMetrics.pitch}
            yaw={liveMetrics.yaw}
            status={liveMetrics.status}
            faceDetected={liveMetrics.faceDetected}
            earThreshold={thresholds.ear_threshold}
            marThreshold={thresholds.mar_threshold}
          />
        </div>

        {/* Right Side: Control Panels & Real-Time charts */}
        <div className="dashboard-right">
          {/* Session Controller Panel */}
          <div className="glass-panel">
            <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem", fontFamily: "var(--font-display)" }}>
              Session Controller
            </h3>

            {!activeSession ? (
              // Start form
              <form onSubmit={handleStartSession} className="config-group">
                <div className="input-group">
                  <label htmlFor="driverName">Driver Identification</label>
                  <input
                    id="driverName"
                    type="text"
                    className="custom-input"
                    placeholder="Enter driver name..."
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="custom-btn primary"
                  disabled={isStarting}
                >
                  <Play size={16} />
                  {isStarting ? "Launching Engine..." : "Start Monitoring Deck"}
                </button>
              </form>
            ) : (
              // Running Info state
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem",
                    background: "var(--bg-input)",
                    padding: "1rem",
                    borderRadius: "10px",
                    border: "1px solid var(--border-glass)",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
                      Active Operator
                    </span>
                    <strong style={{ fontSize: "0.95rem", color: "var(--text-main)" }}>
                      {activeSession.driver_name}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
                      Drive Duration
                    </span>
                    <strong style={{ fontSize: "1.1rem", color: "var(--color-info)", fontFamily: "Outfit, monospace" }}>
                      {sessionTime}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    fontSize: "0.875rem",
                    color: liveMetrics.faceDetected ? "var(--color-success)" : "var(--color-danger)",
                    background: "rgba(255,255,255,0.02)",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "8px",
                  }}
                >
                  {liveMetrics.faceDetected ? (
                    <>
                      <ShieldCheck size={16} />
                      <span>Facial tracking locked. AI scanning active.</span>
                    </>
                  ) : (
                    <>
                      <Hourglass size={16} className="spinner" style={{ background: "none" }} />
                      <span>Searching for operator face in view...</span>
                    </>
                  )}
                </div>

                <button onClick={handleEndSession} className="custom-btn danger">
                  <Square size={16} />
                  <span>Stop Monitoring & Save Logs</span>
                </button>
              </div>
            )}
          </div>

          {/* Real-time Scrolling Area Chart */}
          <StatsChart history={chartHistory} />
        </div>
      </div>

      {/* Alert Feed history log */}
      <div style={{ marginTop: "1.5rem" }}>
        <HistoryTable alerts={recentAlerts} />
      </div>
    </div>
  );
};
export default Dashboard;
