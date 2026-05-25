import React, { useEffect, useRef } from "react";
import { AlertOctagon, Volume2, ShieldAlert } from "lucide-react";

interface AlertBannerProps {
  status: string;
  alertType: string | null;
  durationSeconds: number;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  status,
  alertType,
  durationSeconds,
}) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<any>(null);

  // Synthesize Alarm using browser Web Audio API
  const startAlarm = () => {
    try {
      if (audioCtxRef.current) return; // Alarm already running

      // 1. Create Audio Context
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // 2. Create nodes (Oscillator & Gain)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      oscRef.current = osc;
      gainRef.current = gain;

      osc.type = "sawtooth"; // Piercing sawtooth tone
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz (A5)
      
      // Connect nodes
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Start oscillator
      osc.start();

      // 3. Pulsing beeps effect (modulate volume every 200ms)
      let isBeeping = true;
      gain.gain.setValueAtTime(0.5, ctx.currentTime);

      timerRef.current = setInterval(() => {
        if (!gainRef.current || !audioCtxRef.current) return;
        const now = audioCtxRef.current.currentTime;
        if (isBeeping) {
          gainRef.current.gain.linearRampToValueAtTime(0.01, now + 0.05);
          isBeeping = false;
        } else {
          // Alternative between 880Hz and 780Hz for siren effect
          oscRef.current?.frequency.setValueAtTime(isBeeping ? 880 : 780, now);
          gainRef.current.gain.linearRampToValueAtTime(0.5, now + 0.05);
          isBeeping = true;
        }
      }, 200);
    } catch (e) {
      console.warn("Failed to trigger Web Audio API:", e);
    }
  };

  const stopAlarm = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (oscRef.current) {
      try {
        oscRef.current.stop();
      } catch (e) {}
      oscRef.current = null;
    }

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch (e) {}
      audioCtxRef.current = null;
    }
    gainRef.current = null;
  };

  // Trigger audio based on status changes
  useEffect(() => {
    if (status === "DANGER") {
      startAlarm();
    } else {
      stopAlarm();
    }

    return () => {
      stopAlarm();
    };
  }, [status]);

  if (status === "NORMAL") return null;

  const getAlertDetails = () => {
    switch (alertType) {
      case "DROWSY_EAR":
        return {
          title: "FATIGUE CRITICAL: EYES CLOSED",
          desc: "Prolonged eye closure detected. Wake up immediately!",
          severity: "DANGER",
        };
      case "DROWSY_YAWN":
        return {
          title: "FATIGUE ADVISORY: REPEATED YAWNING",
          desc: "Heavy yawning detected. Consider pulling over to rest.",
          severity: status === "DANGER" ? "DANGER" : "WARNING",
        };
      case "DISTRACTED_LOOK_AWAY":
        return {
          title: "DISTRACTION ADVISORY: LOOKING AWAY",
          desc: "Driver is distracted. Keep your eyes locked on the road ahead!",
          severity: status === "DANGER" ? "DANGER" : "WARNING",
        };
      case "DISTRACTED_HEAD_DOWN":
        return {
          title: "DISTRACTION WARNING: HEAD DROOPED",
          desc: "Driver's head is slumping down. Nodding off detected!",
          severity: "DANGER",
        };
      default:
        return {
          title: "ALERT ACTIVE: STATUS CRITICAL",
          desc: "Unusual activity pattern spotted. Stay alert!",
          severity: status,
        };
    }
  };

  const details = getAlertDetails();
  const isDanger = details.severity === "DANGER" || status === "DANGER";

  return (
    <div
      className={isDanger ? "danger-banner" : "glass-panel"}
      style={
        !isDanger
          ? {
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
              borderLeft: "4px solid var(--color-warning)",
              background: "rgba(255, 145, 0, 0.08)",
              padding: "1rem 1.5rem",
              marginBottom: "1rem",
            }
          : { marginBottom: "1rem" }
      }
    >
      <div className={isDanger ? "danger-banner-icon" : "analytics-icon warning"}>
        {isDanger ? <AlertOctagon size={28} /> : <ShieldAlert size={20} />}
      </div>
      
      <div className={isDanger ? "danger-banner-text" : "analytics-meta"}>
        <h3 style={{ margin: 0, fontSize: isDanger ? "1.25rem" : "1rem", color: isDanger ? "#fff" : "var(--color-warning)" }}>
          {details.title}
        </h3>
        <p style={{ margin: "2px 0 0 0", fontSize: "0.875rem", color: isDanger ? "rgba(255,255,255,0.9)" : "var(--text-muted)" }}>
          {details.desc}
          {durationSeconds > 0 && (
            <span style={{ fontWeight: 600, marginLeft: "0.5rem" }}>
              (Duration: {durationSeconds.toFixed(1)}s)
            </span>
          )}
        </p>
      </div>

      {isDanger && (
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(0,0,0,0.3)", padding: "0.35rem 0.75rem", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 700 }}>
          <Volume2 size={14} className="rec-dot" style={{ background: "none" }} />
          <span>AUDIO ACTIVE</span>
        </div>
      )}
    </div>
  );
};
export default AlertBanner;
