import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import type { Session, SessionDetails } from "../services/api";
import { Clock, Calendar, AlertOctagon, Trash2, X, RefreshCw, ChevronRight } from "lucide-react";

export const History: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [error, setError] = useState<string>("");

  const fetchSessions = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiService.listSessions();
      setSessions(data);
    } catch (e) {
      console.error(e);
      setError("Failed to sync session logs. Verify SQLite backend status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSelectSession = async (sessionId: string) => {
    try {
      const details = await apiService.getSessionDetails(sessionId);
      setSelectedSession(details);
    } catch (e) {
      console.error(e);
      alert("Failed to load detailed logs for this drive.");
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent card selection trigger
    if (!window.confirm("Are you sure you want to permanently delete this session and all its associated logs?")) return;

    try {
      await apiService.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (selectedSession && selectedSession.id === sessionId) {
        setSelectedSession(null);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete session records.");
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return {
        date: d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
        time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
    } catch (e) {
      return { date: isoString, time: "" };
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0s";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="page-body" style={{ padding: "1.5rem", display: "flex", gap: "1.5rem" }}>
      {/* Left panel: List of sessions */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.25rem", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: "1.15rem", color: "var(--text-main)", fontFamily: "var(--font-display)" }}>
              Driving Logs Database
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Purge or inspect detailed analytics charts from historical driver records.
            </p>
          </div>
          <button onClick={fetchSessions} className="custom-btn secondary" style={{ padding: "0.45rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem" }}>
            <RefreshCw size={12} />
            <span>Sync DB</span>
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
            <div className="spinner" style={{ margin: "0 auto 1rem auto" }} />
            Syncing database registries...
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
            <AlertOctagon size={36} style={{ color: "var(--color-danger)", marginBottom: "0.75rem", opacity: 0.8 }} />
            <p style={{ fontSize: "0.875rem" }}>{error}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-dimmed)" }}>
            <Clock size={36} style={{ margin: "0 auto 1rem auto", opacity: 0.3 }} />
            <p style={{ fontSize: "0.875rem" }}>No driving sessions logged in the database yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            {sessions.map((s) => {
              const { date, time } = formatDateTime(s.start_time);
              const isActive = selectedSession && selectedSession.id === s.id;
              
              return (
                <div
                  key={s.id}
                  className="glass-panel"
                  onClick={() => handleSelectSession(s.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem 1.25rem",
                    cursor: "pointer",
                    borderLeft: isActive ? "3px solid var(--color-info)" : "1px solid var(--border-glass)",
                    background: isActive ? "var(--bg-active)" : "var(--bg-card)",
                    transition: "var(--transition-smooth)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                    {/* Visual Cal Icon */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "3.25rem", height: "3.25rem", borderRadius: "10px", background: "var(--bg-input)", border: "1px solid var(--border-glass)" }}>
                      <Calendar size={16} className="text-info" />
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, marginTop: "2px" }}>
                        {date.split(" ")[0]}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <h4 style={{ fontSize: "0.95rem", color: "var(--text-main)", margin: 0 }}>
                        {s.driver_name}
                      </h4>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Clock size={12} />
                          {time} ({date})
                        </span>
                        <span>•</span>
                        <span>Duration: {formatDuration(s.duration)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    {s.status === "ACTIVE" ? (
                      <span className="badge success" style={{ fontSize: "10px" }}>
                        ACTIVE
                      </span>
                    ) : (
                      <span className="badge info" style={{ fontSize: "10px" }}>
                        SAVED
                      </span>
                    )}

                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="custom-btn secondary"
                      style={{
                        padding: "0.5rem",
                        borderRadius: "8px",
                        border: "1px solid rgba(255, 23, 68, 0.15)",
                        color: "var(--color-danger)",
                        background: "rgba(255, 23, 68, 0.04)",
                      }}
                      title="Delete Logs"
                    >
                      <Trash2 size={14} />
                    </button>
                    
                    <ChevronRight size={18} style={{ color: "var(--text-dimmed)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right panel: Details of selected session */}
      {selectedSession ? (
        <div className="glass-panel" style={{ width: "380px", display: "flex", flexDirection: "column", borderLeft: "2px solid var(--border-glow)", alignSelf: "flex-start", position: "sticky", top: "1.5rem", maxHeight: "calc(100vh - 3rem)", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1rem", color: "var(--text-main)", fontFamily: "var(--font-display)" }}>
              Drive Diagnostic Deck
            </h3>
            <button onClick={() => setSelectedSession(null)} className="custom-btn secondary" style={{ padding: "0.25rem", borderRadius: "50%" }}>
              <X size={14} />
            </button>
          </div>

          <div className="config-group" style={{ gap: "1rem" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Driver Operator</span>
              <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)" }}>
                {selectedSession.driver_name}
              </h4>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div style={{ background: "var(--bg-input)", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Drive Time</span>
                <strong style={{ fontSize: "0.875rem", color: "var(--color-info)" }}>
                  {formatDuration(selectedSession.duration)}
                </strong>
              </div>
              <div style={{ background: "var(--bg-input)", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Alert Flags</span>
                <strong style={{ fontSize: "0.875rem", color: "var(--color-danger)" }}>
                  {selectedSession.alerts.length} Flagged
                </strong>
              </div>
            </div>

            {/* List alerts detail feed */}
            <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "1rem", marginTop: "0.5rem" }}>
              <h4 style={{ fontSize: "0.825rem", color: "var(--text-main)", fontWeight: 600, marginBottom: "0.75rem" }}>
                Session Warning Log ({selectedSession.alerts.length})
              </h4>
              
              {selectedSession.alerts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--text-dimmed)", fontSize: "0.75rem" }}>
                  Outstanding! Safe drive with no fatigue indices flagged.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "250px", overflowY: "auto", paddingRight: "0.25rem" }}>
                  {selectedSession.alerts.map((a, idx) => {
                    const alertLabel = 
                      a.alert_type === "DROWSY_EAR" ? "Eyes Closed Alert" :
                      a.alert_type === "DROWSY_YAWN" ? "Yawn Fatigue Alert" :
                      a.alert_type === "DISTRACTED_LOOK_AWAY" ? "Distracted: Looking Away" :
                      a.alert_type === "DISTRACTED_HEAD_DOWN" ? "Head Slumped Off" : "Fatigue Alert";
                      
                    const dateDetails = new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.5rem 0.75rem",
                          background: "rgba(255,255,255,0.01)",
                          border: "1px solid var(--border-glass)",
                          borderRadius: "8px",
                          fontSize: "0.75rem",
                        }}
                      >
                        <div>
                          <strong style={{ color: a.severity === "DANGER" ? "var(--color-danger)" : "var(--color-warning)", display: "block" }}>
                            {alertLabel}
                          </strong>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                            {dateDetails} (Duration: {a.duration_seconds.toFixed(1)}s)
                          </span>
                        </div>
                        <span className={`badge ${a.severity.toLowerCase()}`} style={{ fontSize: "9px", padding: "1px 5px" }}>
                          {a.severity}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Empty state details deck
        <div className="glass-panel" style={{ width: "380px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem", color: "var(--text-dimmed)", textAlign: "center", alignSelf: "flex-start", position: "sticky", top: "1.5rem" }}>
          <Clock size={32} style={{ marginBottom: "1rem", opacity: 0.3 }} />
          <h4 style={{ color: "var(--text-muted)", fontSize: "0.875rem", fontWeight: 600 }}>
            Inspect Driving Details
          </h4>
          <p style={{ fontSize: "0.75rem", marginTop: "0.25rem", lineHeight: 1.4 }}>
            Click on any driving session from the database log on the left to analyze diagnostic records.
          </p>
        </div>
      )}
    </div>
  );
};
export default History;
