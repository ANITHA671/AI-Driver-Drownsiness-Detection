import React from "react";
import { Eye, ShieldAlert, Compass, Activity } from "lucide-react";

interface StatusCardProps {
  ear: number;
  mar: number;
  pitch: number;
  yaw: number;
  status?: string;
  faceDetected: boolean;
  earThreshold: number;
  marThreshold: number;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  ear,
  mar,
  pitch,
  yaw,
  faceDetected,
  earThreshold,
  marThreshold,
}) => {
  // Determine card categories
  const getEarStatus = () => {
    if (!faceDetected) return "info";
    if (ear < earThreshold - 0.03) return "danger";
    if (ear < earThreshold) return "warning";
    return "success";
  };

  const getMarStatus = () => {
    if (!faceDetected) return "info";
    if (mar > marThreshold + 0.1) return "danger";
    if (mar > marThreshold) return "warning";
    return "success";
  };

  const getPoseStatus = () => {
    if (!faceDetected) return "info";
    if (Math.abs(pitch) > 20 || Math.abs(yaw) > 25) return "danger";
    if (Math.abs(pitch) > 15 || Math.abs(yaw) > 20) return "warning";
    return "success";
  };

  const items = [
    {
      title: "Eye Openness (EAR)",
      value: faceDetected ? ear.toFixed(3) : "—",
      status: getEarStatus(),
      icon: Eye,
      footer: faceDetected ? `Threshold: <${earThreshold.toFixed(2)}` : "No Face",
    },
    {
      title: "Mouth Opening (MAR)",
      value: faceDetected ? mar.toFixed(3) : "—",
      status: getMarStatus(),
      icon: ShieldAlert,
      footer: faceDetected ? `Threshold: >${marThreshold.toFixed(2)}` : "No Face",
    },
    {
      title: "Head Pitch (Tilt)",
      value: faceDetected ? `${pitch > 0 ? "+" : ""}${pitch.toFixed(1)}°` : "—",
      status: getPoseStatus(),
      icon: Compass,
      footer: faceDetected ? (pitch > 0 ? "Looking Down" : "Looking Up") : "No Face",
    },
    {
      title: "Attention (Yaw)",
      value: faceDetected ? `${yaw > 0 ? "+" : ""}${yaw.toFixed(1)}°` : "—",
      status: getPoseStatus(),
      icon: Activity,
      footer: faceDetected ? (Math.abs(yaw) > 5 ? "Looking Sideways" : "Forward Facing") : "No Face",
    },
  ];

  return (
    <div className="status-grid">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div key={idx} className={`status-card ${item.status}`}>
            <div className="status-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{item.title}</span>
              <Icon size={14} className={`text-${item.status}`} style={{ opacity: 0.7 }} />
            </div>
            <div className="status-card-value">{item.value}</div>
            <div className="status-card-footer">{item.footer}</div>
          </div>
        );
      })}
    </div>
  );
};
export default StatusCard;
