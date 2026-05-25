import React from "react";
import type { Alert } from "../services/api";
import { AlertTriangle, Eye, ShieldAlert, Compass } from "lucide-react";

interface HistoryTableProps {
  alerts: Alert[];
  loading?: boolean;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ alerts, loading = false }) => {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case "DROWSY_EAR":
        return <Eye size={14} />;
      case "DROWSY_YAWN":
        return <ShieldAlert size={14} />;
      case "DISTRACTED_LOOK_AWAY":
      case "DISTRACTED_HEAD_DOWN":
        return <Compass size={14} />;
      default:
        return <AlertTriangle size={14} />;
    }
  };

  const getAlertName = (type: string) => {
    switch (type) {
      case "DROWSY_EAR":
        return "Eyes Closed Warning";
      case "DROWSY_YAWN":
        return "Yawning Fatigue Warning";
      case "DISTRACTED_LOOK_AWAY":
        return "Distracted: Looking Away";
      case "DISTRACTED_HEAD_DOWN":
        return "Distracted: Head Nodded Down";
      default:
        return "Fatigue Alert Triggered";
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " - " + date.toLocaleDateString();
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="glass-panel" style={{ width: "100%", padding: "1.5rem" }}>
      <h3 style={{ fontSize: "1.1rem", color: "var(--text-main)", marginBottom: "0.25rem", fontFamily: "var(--font-display)" }}>
        Session Alerts Feed
      </h3>
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
        Chronological list of drowsiness, yawning, and looking away events log.
      </p>

      <div className="table-container">
        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            <div className="spinner" style={{ margin: "0 auto 1rem auto" }} />
            Retrieving alert registries...
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-dimmed)", fontSize: "0.875rem" }}>
            <AlertTriangle size={32} style={{ margin: "0 auto 1rem auto", opacity: 0.3 }} />
            No alarms or warning events logged yet for this feed.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Time & Date</th>
                <th>Alert Event</th>
                <th>Severity</th>
                <th>EAR Metrics</th>
                <th>MAR Metrics</th>
                <th>Hold Duration</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td style={{ fontWeight: 500, color: "var(--text-main)" }}>
                    {formatTimestamp(alert.timestamp)}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div className={`badge ${alert.severity.toLowerCase()}`} style={{ padding: "4px" }}>
                        {getAlertIcon(alert.alert_type)}
                      </div>
                      <span>{getAlertName(alert.alert_type)}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${alert.severity.toLowerCase()}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td style={{ fontFamily: "Outfit, monospace" }}>
                    {alert.ear_value ? alert.ear_value.toFixed(3) : "—"}
                  </td>
                  <td style={{ fontFamily: "Outfit, monospace" }}>
                    {alert.mar_value ? alert.mar_value.toFixed(3) : "—"}
                  </td>
                  <td style={{ fontWeight: 600, color: alert.severity === "DANGER" ? "var(--color-danger)" : "var(--color-warning)" }}>
                    {alert.duration_seconds > 0 ? `${alert.duration_seconds.toFixed(1)}s` : "Instant"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
export default HistoryTable;
