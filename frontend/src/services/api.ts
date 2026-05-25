const BASE_URL = "http://127.0.0.1:8088/api";

export interface Session {
  id: string;
  driver_name: string;
  start_time: string;
  end_time: string | null;
  duration: number;
  status: string;
}

export interface Alert {
  id: number;
  session_id: string;
  timestamp: string;
  alert_type: string;
  severity: string;
  ear_value: number | null;
  mar_value: number | null;
  duration_seconds: number;
}

export interface Telemetry {
  id: number;
  session_id: string;
  timestamp: string;
  ear: number;
  mar: number;
  head_pitch: number;
  head_yaw: number;
  drowsiness_score: number;
  is_drowsy: boolean;
}

export interface StatusCounts {
  total_alerts: number;
  drowsy_ear_alerts: number;
  drowsy_yawn_alerts: number;
  distracted_look_away_alerts: number;
  distracted_head_down_alerts: number;
}

export interface DashboardStats {
  total_sessions: number;
  total_duration_seconds: number;
  total_alerts: number;
  average_session_duration: number;
  recent_alerts: Alert[];
  status_distribution: StatusCounts;
  session_trend: {
    date: string;
    sessions: number;
    duration: number;
    alerts: number;
  }[];
}

export interface SessionDetails extends Session {
  alerts: Alert[];
  telemetry_count: number;
}

export const apiService = {
  /**
   * Starts a new driver session.
   */
  async startSession(driverName: string = "Default Driver"): Promise<Session> {
    const res = await fetch(`${BASE_URL}/sessions/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver_name: driverName }),
    });
    if (!res.ok) throw new Error("Failed to start monitoring session.");
    return res.json();
  },

  /**
   * Ends an active session.
   */
  async endSession(sessionId: string): Promise<Session> {
    const res = await fetch(`${BASE_URL}/sessions/${sessionId}/end`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to end session.");
    return res.json();
  },

  /**
   * Retrieves the currently active session.
   */
  async getActiveSession(): Promise<Session> {
    const res = await fetch(`${BASE_URL}/sessions/active`);
    if (!res.ok) {
      if (res.status === 404) throw new Error("No active session");
      throw new Error("Failed to fetch active session.");
    }
    return res.json();
  },

  /**
   * Lists all historical sessions.
   */
  async listSessions(skip: number = 0, limit: number = 100): Promise<Session[]> {
    const res = await fetch(`${BASE_URL}/sessions/?skip=${skip}&limit=${limit}`);
    if (!res.ok) throw new Error("Failed to list sessions.");
    return res.json();
  },

  /**
   * Retrieves specific details of a session (alerts + counters).
   */
  async getSessionDetails(sessionId: string): Promise<SessionDetails> {
    const res = await fetch(`${BASE_URL}/sessions/${sessionId}`);
    if (!res.ok) throw new Error("Failed to fetch session details.");
    return res.json();
  },

  /**
   * Deletes a session.
   */
  async deleteSession(sessionId: string): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/sessions/${sessionId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete session.");
    return res.json();
  },

  /**
   * Retrieves dashboard statistics summary.
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${BASE_URL}/stats/dashboard`);
    if (!res.ok) throw new Error("Failed to fetch dashboard stats.");
    return res.json();
  },

  /**
   * Lists all warning alerts.
   */
  async listAlerts(skip: number = 0, limit: number = 100): Promise<Alert[]> {
    const res = await fetch(`${BASE_URL}/stats/alerts?skip=${skip}&limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch alerts.");
    return res.json();
  },

  /**
   * Retrieves time-series telemetry data for custom charts.
   */
  async getSessionTelemetry(sessionId: string, limit: number = 500): Promise<Telemetry[]> {
    const res = await fetch(`${BASE_URL}/stats/sessions/${sessionId}/telemetry?limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch session telemetry logs.");
    return res.json();
  },
};
