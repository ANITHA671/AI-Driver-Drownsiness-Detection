import React from "react";
import { Sliders, RotateCcw, Info } from "lucide-react";

interface ConfigurationProps {
  thresholds: {
    ear_threshold: number;
    mar_threshold: number;
    pitch_threshold: number;
    yaw_threshold: number;
  };
  setThresholds: React.Dispatch<
    React.SetStateAction<{
      ear_threshold: number;
      mar_threshold: number;
      pitch_threshold: number;
      yaw_threshold: number;
    }>
  >;
}

export const Configuration: React.FC<ConfigurationProps> = ({ thresholds, setThresholds }) => {
  
  const handleSliderChange = (key: string, value: number) => {
    setThresholds((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("drowsiness_thresholds", JSON.stringify(next));
      return next;
    });
  };

  const handleResetDefaults = () => {
    const defaults = {
      ear_threshold: 0.21,
      mar_threshold: 0.50,
      pitch_threshold: 16.0,
      yaw_threshold: 22.0,
    };
    setThresholds(defaults);
    localStorage.setItem("drowsiness_thresholds", JSON.stringify(defaults));
    alert("System calibrated back to default aviation security metrics.");
  };

  return (
    <div className="page-body" style={{ padding: "1.5rem", maxWidth: "800px" }}>
      <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "1.15rem", color: "var(--text-main)", fontFamily: "var(--font-display)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Sliders size={20} className="text-info" />
              <span>AI Sensitivity Calibration</span>
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Fine-tune neural classification boundaries and physical metric weights for drowsiness detection.
            </p>
          </div>
          
          <button onClick={handleResetDefaults} className="custom-btn secondary" style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <RotateCcw size={12} />
            <span>Calibrate Defaults</span>
          </button>
        </div>

        {/* Sliders Area */}
        <div className="config-group" style={{ gap: "1.5rem" }}>
          {/* EAR Slider */}
          <div className="config-item">
            <div className="config-item-header">
              <label htmlFor="earSlider">Eye Closure Ratio (EAR)</label>
              <span>{thresholds.ear_threshold.toFixed(2)}</span>
            </div>
            <div className="slider-container">
              <input
                id="earSlider"
                type="range"
                min="0.15"
                max="0.28"
                step="0.01"
                className="custom-slider"
                value={thresholds.ear_threshold}
                onChange={(e) => handleSliderChange("ear_threshold", parseFloat(e.target.value))}
              />
            </div>
            <p className="config-description">
              Sets the threshold below which the driver's eyes are classified as closed. Higher values increase sensitivity (faster alerts but higher chance of false alarms during quick blinks). Standard: 0.21.
            </p>
          </div>

          {/* MAR Slider */}
          <div className="config-item">
            <div className="config-item-header">
              <label htmlFor="marSlider">Mouth Yawn Ratio (MAR)</label>
              <span>{thresholds.mar_threshold.toFixed(2)}</span>
            </div>
            <div className="slider-container">
              <input
                id="marSlider"
                type="range"
                min="0.35"
                max="0.70"
                step="0.01"
                className="custom-slider"
                value={thresholds.mar_threshold}
                onChange={(e) => handleSliderChange("mar_threshold", parseFloat(e.target.value))}
              />
            </div>
            <p className="config-description">
              Defines the inner mouth vertical-to-horizontal opening ratio representing a yawn. When the mouth opening exceeds this reading for over 2 seconds, a warning sounds. Standard: 0.50.
            </p>
          </div>

          {/* Pitch Slider */}
          <div className="config-item">
            <div className="config-item-header">
              <label htmlFor="pitchSlider">Attention: Head Pitch (Nodding Down)</label>
              <span>{thresholds.pitch_threshold.toFixed(1)}°</span>
            </div>
            <div className="slider-container">
              <input
                id="pitchSlider"
                type="range"
                min="10.0"
                max="25.0"
                step="0.5"
                className="custom-slider"
                value={thresholds.pitch_threshold}
                onChange={(e) => handleSliderChange("pitch_threshold", parseFloat(e.target.value))}
              />
            </div>
            <p className="config-description">
              Estimates the downward chin slouch angle in degrees before classifying the driver as fatigued (e.g. nodding off). High sensitivity helps detect early stages of head slumping. Standard: 16.0°.
            </p>
          </div>

          {/* Yaw Slider */}
          <div className="config-item">
            <div className="config-item-header">
              <label htmlFor="yawSlider">Attention: Head Yaw (Looking Away)</label>
              <span>{thresholds.yaw_threshold.toFixed(1)}°</span>
            </div>
            <div className="slider-container">
              <input
                id="yawSlider"
                type="range"
                min="15.0"
                max="35.0"
                step="0.5"
                className="custom-slider"
                value={thresholds.yaw_threshold}
                onChange={(e) => handleSliderChange("yaw_threshold", parseFloat(e.target.value))}
              />
            </div>
            <p className="config-description">
              Tracks the horizontal look-away rotation angle in degrees. If the driver turns their head left or right past this limit for more than 1.5 seconds, a distraction alarm triggers. Standard: 22.0°.
            </p>
          </div>
        </div>

        {/* Callout Info note */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", background: "rgba(0, 176, 255, 0.05)", border: "1px solid rgba(0, 176, 255, 0.15)", padding: "1rem", borderRadius: "10px", marginTop: "0.5rem" }}>
          <Info size={16} className="text-info" style={{ marginTop: "2px" }} />
          <div style={{ fontSize: "0.75rem", lineHeight: 1.45, color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text-main)", display: "block", marginBottom: "2px" }}>Dynamic Shield Calibration Note:</strong>
            These sensitivity values are stored inside your browser's persistent cache. During real-time operations, the values are fed into our **hybrid deep learning ensemble pipeline** dynamically every frame to maximize prediction correctness for your specific lighting environment.
          </div>
        </div>
      </div>
    </div>
  );
};
export default Configuration;
