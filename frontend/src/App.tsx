import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import History from "./pages/History";
import Configuration from "./pages/Configuration";
import type { Session } from "./services/api";

const DEFAULT_THRESHOLDS = {
  ear_threshold: 0.21,
  mar_threshold: 0.50,
  pitch_threshold: 16.0,
  yaw_threshold: 22.0,
};

export const App: React.FC = () => {
  // Global Active Session state
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  // Global calibration thresholds (load from localStorage or use defaults)
  const [thresholds, setThresholds] = useState(() => {
    const saved = localStorage.getItem("drowsiness_thresholds");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_THRESHOLDS;
      }
    }
    return DEFAULT_THRESHOLDS;
  });

  return (
    <Router>
      <div className="app-container">
        {/* Main Dashboard Sidebar Deck */}
        <Sidebar activeSessionId={activeSession ? activeSession.id : null} status="NORMAL" />

        {/* Dynamic Route Pages viewport */}
        <main className="main-content">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  activeSession={activeSession}
                  setActiveSession={setActiveSession}
                  thresholds={thresholds}
                />
              }
            />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/history" element={<History />} />
            <Route
              path="/config"
              element={
                <Configuration thresholds={thresholds} setThresholds={setThresholds} />
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
};
export default App;
