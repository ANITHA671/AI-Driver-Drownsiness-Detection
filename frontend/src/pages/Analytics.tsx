import React, { useState, useEffect, useMemo } from "react";
import { apiService } from "../services/api";
import type { DashboardStats } from "../services/api";
import { ShieldAlert, Award, Clock, AlertOctagon, RefreshCw } from "lucide-react";

export const Analytics: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const fetchStats = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiService.getDashboardStats();
      setStats(data);
    } catch (e) {
      console.error(e);
      setError("Failed to sync aggregates. Ensure backend and SQLite are online.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Format total seconds into hours and minutes
  const totalDrivingTime = useMemo(() => {
    if (!stats) return "0h 0m";
    const hrs = Math.floor(stats.total_duration_seconds / 3600);
    const mins = Math.floor((stats.total_duration_seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }, [stats]);

  // Construct visual progress bars for warning types distributions
  const warningDistributionList = useMemo(() => {
    if (!stats) return [];
    const dist = stats.status_distribution;
    const total = dist.total_alerts || 1; // avoid division by zero

    return [
      {
        name: "Eyes Closed Fatigue (EAR)",
        count: dist.drowsy_ear_alerts,
        percent: ((dist.drowsy_ear_alerts / total) * 100).toFixed(0),
        color: "var(--color-danger)",
      },
      {
        name: "Mouth Yawning Fatigue (MAR)",
        count: dist.drowsy_yawn_alerts,
        percent: ((dist.drowsy_yawn_alerts / total) * 100).toFixed(0),
        color: "var(--color-warning)",
      },
      {
        name: "Attention Distraction (Looking Away)",
        count: dist.distracted_look_away_alerts,
        percent: ((dist.distracted_look_away_alerts / total) * 100).toFixed(0),
        color: "var(--color-info)",
      },
      {
        name: "Nodding Off Alert (Head Slumped)",
        count: dist.distracted_head_down_alerts,
        percent: ((dist.distracted_head_down_alerts / total) * 100).toFixed(0),
        color: "#9c27b0", // violet purple
      },
    ];
  }, [stats]);

  // Weekly Trend Chart Calculations
  const weeklyChartConfig = useMemo(() => {
    if (!stats || stats.session_trend.length === 0) return null;
    
    const trend = stats.session_trend;
    const width = 600;
    const height = 180;
    const padding = { top: 20, right: 20, bottom: 25, left: 35 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Find max boundaries for Y axis (duration in minutes and alerts count)
    const maxDur = Math.max(...trend.map(t => t.duration), 10);
    const maxAlerts = Math.max(...trend.map(t => t.alerts), 5);
    
    // Draw 2 trend lines (Driving minutes in Cyan, Alert count in Red)
    const points = trend.map((t, idx) => {
      const x = padding.left + (idx / (trend.length - 1)) * chartW;
      const yDur = padding.top + chartH - (t.duration / maxDur) * chartH;
      const yAlert = padding.top + chartH - (t.alerts / maxAlerts) * chartH;
      return { x, yDur, yAlert, date: t.date, duration: t.duration, alerts: t.alerts };
    });

    let dDur = "";
    let dAlert = "";
    
    points.forEach((pt, idx) => {
      if (idx === 0) {
        dDur = `M ${pt.x} ${pt.yDur}`;
        dAlert = `M ${pt.x} ${pt.yAlert}`;
      } else {
        dDur += ` L ${pt.x} ${pt.yDur}`;
        dAlert += ` L ${pt.x} ${pt.yAlert}`;
      }
    });

    const dAreaDur = points.length > 0
      ? `${dDur} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
      : "";

    return {
      width,
      height,
      padding,
      points,
      dDur,
      dAlert,
      dAreaDur,
      maxDur: maxDur.toFixed(0),
      maxAlerts: maxAlerts.toFixed(0),
    };
  }, [stats]);

  if (loading) {
    return (
      <div className="page-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", color: "var(--text-muted)" }}>
        <div className="spinner" style={{ marginBottom: "1rem" }} />
        <span>Aggregating analytics registers...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="page-body" style={{ textAlign: "center", padding: "4rem 2rem", color: "var(--text-muted)" }}>
        <AlertOctagon size={48} style={{ color: "var(--color-danger)", marginBottom: "1rem", opacity: 0.8 }} />
        <h3 style={{ color: "var(--text-main)", marginBottom: "0.5rem" }}>Stats Synch Issue</h3>
        <p style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>{error || "Could not retrieve statistics."}</p>
        <button onClick={fetchStats} className="custom-btn secondary">
          <RefreshCw size={14} />
          <span>Retry Sync</span>
        </button>
      </div>
    );
  }

  // Calculate generic safety score based on: total alerts and total minutes
  // 1 alert per 5 minutes = 100% score (ideal)
  // more frequent alerts penalise score
  const totalMinutes = stats.total_duration_seconds / 60;
  const safetyScore = Math.max(
    30,
    stats.total_alerts === 0
      ? 100
      : Math.round(Math.max(30, 100 - (stats.total_alerts / Math.max(1, totalMinutes / 12)) * 10))
  );

  const getSafetyComment = (score: number) => {
    if (score >= 90) return { title: "Excellent Status", text: "Exceptional alertness levels. Keep up the high standard of safety!" };
    if (score >= 75) return { title: "Secure Status", text: "Good driving focus. Standard fatigue triggers spotted occasionally." };
    if (score >= 55) return { title: "Moderate Drowsiness Risk", text: "Elevated drowsiness spikes. Ensure regular rest intervals during shifts." };
    return { title: "Critical Attention Required", text: "Driver fatigue triggers are critically high. Immediate rest adjustment recommended." };
  };

  const advice = getSafetyComment(safetyScore);

  return (
    <div className="page-body" style={{ padding: "1.5rem" }}>
      {/* Overview Analytics Row */}
      <div className="analytics-grid">
        <div className="glass-panel analytics-card">
          <div className="analytics-icon info">
            <Clock size={20} />
          </div>
          <div className="analytics-meta">
            <p>Driving telemetry logged</p>
            <h3>{totalDrivingTime}</h3>
          </div>
        </div>

        <div className="glass-panel analytics-card">
          <div className="analytics-icon success">
            <Award size={20} />
          </div>
          <div className="analytics-meta">
            <p>Aggregate Safety Rating</p>
            <h3 style={{ color: safetyScore >= 75 ? "var(--color-success)" : safetyScore >= 55 ? "var(--color-warning)" : "var(--color-danger)" }}>
              {safetyScore}%
            </h3>
          </div>
        </div>

        <div className="glass-panel analytics-card">
          <div className="analytics-icon danger">
            <ShieldAlert size={20} />
          </div>
          <div className="analytics-meta">
            <p>Total Alert Incidents</p>
            <h3>{stats.total_alerts}</h3>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem", marginTop: "1.5rem" }}>
        {/* Left Card: 7-Day Performance trend waves */}
        <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", color: "var(--text-main)", fontFamily: "var(--font-display)" }}>
                Weekly Fleet Analytics
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Comparative view of active drive duration against fatigue flags.
              </p>
            </div>
            <button onClick={fetchStats} className="custom-btn secondary" style={{ padding: "0.45rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem" }}>
              <RefreshCw size={12} />
              <span>Reload Deck</span>
            </button>
          </div>

          <div style={{ flex: 1, minHeight: "220px", position: "relative" }}>
            {weeklyChartConfig ? (
              <svg viewBox={`0 0 ${weeklyChartConfig.width} ${weeklyChartConfig.height}`} width="100%" height="100%">
                <defs>
                  <linearGradient id="cyan-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-info)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--color-info)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                {[0, 1, 2, 3].map((idx) => {
                  const y = weeklyChartConfig.padding.top + (idx / 3) * (weeklyChartConfig.height - weeklyChartConfig.padding.top - weeklyChartConfig.padding.bottom);
                  return (
                    <line
                      key={idx}
                      x1={weeklyChartConfig.padding.left}
                      y1={y}
                      x2={weeklyChartConfig.width - weeklyChartConfig.padding.right}
                      y2={y}
                      className="chart-gridline"
                    />
                  );
                })}

                {/* Shaded Area Cyan */}
                {weeklyChartConfig.dAreaDur && <path d={weeklyChartConfig.dAreaDur} fill="url(#cyan-fill)" />}

                {/* Graph Lines */}
                {weeklyChartConfig.dDur && (
                  <path d={weeklyChartConfig.dDur} fill="none" stroke="var(--color-info)" strokeWidth="2.5" strokeLinecap="round" />
                )}
                {weeklyChartConfig.dAlert && (
                  <path d={weeklyChartConfig.dAlert} fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeDasharray="3,3" />
                )}

                {/* Node Circles */}
                {weeklyChartConfig.points.map((pt, idx) => (
                  <g key={idx}>
                    <circle cx={pt.x} cy={pt.yDur} r="4" fill="var(--bg-panel)" stroke="var(--color-info)" strokeWidth="2" />
                    <circle cx={pt.x} cy={pt.yAlert} r="3" fill="var(--color-danger)" />
                  </g>
                ))}

                {/* Axis lines */}
                <line x1={weeklyChartConfig.padding.left} y1={weeklyChartConfig.height - weeklyChartConfig.padding.bottom} x2={weeklyChartConfig.width - weeklyChartConfig.padding.right} y2={weeklyChartConfig.height - weeklyChartConfig.padding.bottom} className="chart-axis" />
                <line x1={weeklyChartConfig.padding.left} y1={weeklyChartConfig.padding.top} x2={weeklyChartConfig.padding.left} y2={weeklyChartConfig.height - weeklyChartConfig.padding.bottom} className="chart-axis" />

                {/* Y Left Axis labels: Minutes */}
                <text x={weeklyChartConfig.padding.left - 8} y={weeklyChartConfig.padding.top + 4} fill="var(--color-info)" fontSize="8" textAnchor="end" fontFamily="Outfit">
                  {weeklyChartConfig.maxDur}m
                </text>
                <text x={weeklyChartConfig.padding.left - 8} y={weeklyChartConfig.height - weeklyChartConfig.padding.bottom} fill="var(--color-info)" fontSize="8" textAnchor="end" fontFamily="Outfit">
                  0m
                </text>

                {/* Y Right Axis labels: Alerts */}
                <text x={weeklyChartConfig.width - weeklyChartConfig.padding.right + 8} y={weeklyChartConfig.padding.top + 4} fill="var(--color-danger)" fontSize="8" textAnchor="start" fontFamily="Outfit">
                  {weeklyChartConfig.maxAlerts}
                </text>
                <text x={weeklyChartConfig.width - weeklyChartConfig.padding.right + 8} y={weeklyChartConfig.height - weeklyChartConfig.padding.bottom} fill="var(--color-danger)" fontSize="8" textAnchor="start" fontFamily="Outfit">
                  0
                </text>

                {/* X labels: Dates */}
                {weeklyChartConfig.points.map((pt, idx) => {
                  if (idx % 2 !== 0 && stats.session_trend.length > 5) return null; // skip alternating if too long
                  const dateStr = pt.date.slice(5); // show MM-DD
                  return (
                    <text key={idx} x={pt.x} y={weeklyChartConfig.height - 8} fill="var(--text-muted)" fontSize="8" textAnchor="middle" fontFamily="Outfit">
                      {dateStr}
                    </text>
                  );
                })}
              </svg>
            ) : (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-dimmed)" }}>
                No weekly telemetry registered yet.
              </div>
            )}
          </div>

          <div className="chart-legend" style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
            <div className="chart-legend-item">
              <div className="chart-legend-dot" style={{ backgroundColor: "var(--color-info)" }} />
              <span>Driving Time (Minutes)</span>
            </div>
            <div className="chart-legend-item">
              <div className="chart-legend-dot" style={{ backgroundColor: "var(--color-danger)" }} />
              <span>Fatigue Flag Count</span>
            </div>
          </div>
        </div>

        {/* Right Card: Warning type distributions */}
        <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", color: "var(--text-main)", fontFamily: "var(--font-display)" }}>
              Fatigue Footprint Analysis
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Frequency breakdown of active alert profiles.
            </p>
          </div>

          {stats.total_alerts === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dimmed)", fontSize: "0.875rem" }}>
              Awaiting alert statistics...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1 }}>
              {warningDistributionList.map((item, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.825rem" }}>
                    <span style={{ fontWeight: 500, color: "var(--text-main)" }}>{item.name}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      <strong>{item.count}</strong> alerts ({item.percent}%)
                    </span>
                  </div>
                  {/* Progress bar container */}
                  <div style={{ width: "100%", height: "8px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--border-glass)" }}>
                    <div style={{ width: `${item.percent}%`, height: "100%", backgroundColor: item.color, borderRadius: "4px", boxShadow: `0 0 8px ${item.color}66` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Safety advice callout panel */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-glass)", padding: "1rem", borderRadius: "10px", marginTop: "auto" }}>
            <h4 style={{ fontSize: "0.875rem", color: safetyScore >= 55 ? "var(--color-success)" : "var(--color-danger)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ShieldAlert size={14} />
              <span>{advice.title}</span>
            </h4>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", lineHeight: 1.4 }}>
              {advice.text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Analytics;
