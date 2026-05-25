import React, { useMemo } from "react";

interface TelemetryPoint {
  ear: number;
  mar: number;
  timestamp: number;
}

interface StatsChartProps {
  history: TelemetryPoint[];
}

export const StatsChart: React.FC<StatsChartProps> = ({ history }) => {
  // Config dimensions
  const width = 500;
  const height = 180;
  const padding = { top: 15, right: 15, bottom: 25, left: 35 };

  // Generate SVG coordinates for EAR & MAR
  const { earPath, marPath, earArea, marArea, gridLines } = useMemo(() => {
    if (history.length === 0) {
      return { earPath: "", marPath: "", earArea: "", marArea: "", gridLines: [] };
    }

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    
    // Bounds: EAR is typically between 0.10 and 0.40, MAR between 0.05 and 0.80
    // Let's set static ranges for stability in reading (Y ranges from 0.0 to 0.8)
    const yMax = 0.8;
    const yMin = 0.0;

    const points = history.map((pt, idx) => {
      // Map X-coordinate (proportion of history length)
      const x = padding.left + (idx / Math.max(1, history.length - 1)) * chartW;
      
      // Map Y-coordinates (inverted because SVG 0,0 is top-left)
      const yEar = padding.top + chartH - ((pt.ear - yMin) / (yMax - yMin)) * chartH;
      const yMar = padding.top + chartH - ((pt.mar - yMin) / (yMax - yMin)) * chartH;
      
      return { x, yEar: Math.min(height - padding.bottom, Math.max(padding.top, yEar)), yMar: Math.min(height - padding.bottom, Math.max(padding.top, yMar)) };
    });

    // 1. Create line paths
    let dEar = "";
    let dMar = "";
    
    points.forEach((pt, idx) => {
      if (idx === 0) {
        dEar = `M ${pt.x} ${pt.yEar}`;
        dMar = `M ${pt.x} ${pt.yMar}`;
      } else {
        // Curve to keep movements flowing nicely
        dEar += ` L ${pt.x} ${pt.yEar}`;
        dMar += ` L ${pt.x} ${pt.yMar}`;
      }
    });

    // 2. Create Area paths (by drawing line, closing to bottom right/left)
    const chartBottomY = padding.top + chartH;
    const dAreaEar = points.length > 0 
      ? `${dEar} L ${points[points.length - 1].x} ${chartBottomY} L ${points[0].x} ${chartBottomY} Z`
      : "";
    const dAreaMar = points.length > 0 
      ? `${dMar} L ${points[points.length - 1].x} ${chartBottomY} L ${points[0].x} ${chartBottomY} Z`
      : "";

    // 3. Gridlines details
    const lines = [];
    const step = 4; // 4 rows
    for (let i = 0; i <= step; i++) {
      const val = yMin + (i / step) * (yMax - yMin);
      const y = padding.top + chartH - (i / step) * chartH;
      lines.push({ y, label: val.toFixed(1) });
    }

    return {
      earPath: dEar,
      marPath: dMar,
      earArea: dAreaEar,
      marArea: dAreaMar,
      gridLines: lines,
    };
  }, [history]);

  const chartW = width - padding.left - padding.right;

  return (
    <div className="glass-panel" style={{ padding: "1.25rem 1.5rem" }}>
      <h3 style={{ fontSize: "1rem", color: "var(--text-main)", marginBottom: "0.25rem", fontFamily: "var(--font-display)" }}>
        Real-Time Face Telemetry
      </h3>
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
        Live eye openness (EAR) and yawning metric (MAR) wave logs.
      </p>

      <div className="chart-container">
        {history.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.875rem",
              color: "var(--text-dimmed)",
            }}
          >
            Awaiting diagnostic telemetry feeds...
          </div>
        ) : (
          <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
            <defs>
              {/* Glowing area gradients */}
              <linearGradient id="gradient-ear" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-info)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--color-info)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="gradient-mar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-warning)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--color-warning)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Gridlines */}
            {gridLines.map((line, idx) => (
              <g key={idx}>
                {/* Horizontal line */}
                <line
                  x1={padding.left}
                  y1={line.y}
                  x2={width - padding.right}
                  y2={line.y}
                  className="chart-gridline"
                />
                {/* Label text */}
                <text
                  x={padding.left - 10}
                  y={line.y + 4}
                  fill="var(--text-muted)"
                  fontSize="9"
                  textAnchor="end"
                  fontFamily="Outfit, sans-serif"
                >
                  {line.label}
                </text>
              </g>
            ))}

            {/* Filled Areas under curves */}
            {earArea && <path d={earArea} className="chart-area-ear" />}
            {marArea && <path d={marArea} className="chart-area-mar" />}

            {/* Path lines */}
            {earPath && <path d={earPath} className="chart-line-ear" />}
            {marPath && <path d={marPath} className="chart-line-mar" />}

            {/* Bottom X axis line */}
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              className="chart-axis"
            />
            
            {/* Left Y axis line */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={height - padding.bottom}
              className="chart-axis"
            />

            {/* X axis running caption */}
            <text
              x={padding.left + chartW / 2}
              y={height - 6}
              fill="var(--text-dimmed)"
              fontSize="9"
              textAnchor="middle"
              fontFamily="Outfit, sans-serif"
            >
              Diagnostic Frame Buffer (Rolling 30 Frames)
            </text>
          </svg>
        )}
      </div>

      <div className="chart-legend">
        <div className="chart-legend-item">
          <div className="chart-legend-dot ear" />
          <span>Eye Closure Ratio (EAR)</span>
        </div>
        <div className="chart-legend-item">
          <div className="chart-legend-dot mar" />
          <span>Mouth Yawn Ratio (MAR)</span>
        </div>
      </div>
    </div>
  );
};
export default StatsChart;
