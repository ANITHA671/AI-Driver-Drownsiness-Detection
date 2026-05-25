import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, BarChart2, History, Sliders, ShieldAlert, User } from "lucide-react";

interface SidebarProps {
  activeSessionId: string | null;
  status?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSessionId }) => {
  const location = useLocation();
  
  const menuItems = [
    { path: "/", name: "Live Dashboard", icon: LayoutDashboard },
    { path: "/analytics", name: "Analytics Trends", icon: BarChart2 },
    { path: "/history", name: "History Logs", icon: History },
    { path: "/config", name: "Sensitivity", icon: Sliders },
  ];

  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar-logo">
        <div className="logo-icon">
          <ShieldAlert size={20} />
        </div>
        <span>AI Driver Shield</span>
      </Link>

      <nav style={{ flex: 1 }}>
        <ul className="sidebar-menu">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="driver-profile">
          <div className="driver-avatar">
            <User size={18} />
          </div>
          <div className="driver-info">
            <h4>Anitha V.</h4>
            {activeSessionId ? (
              <span className={`badge success`} style={{ padding: "1px 6px", fontSize: "10px", marginTop: "3px" }}>
                MONITORING
              </span>
            ) : (
              <span className="badge warning" style={{ padding: "1px 6px", fontSize: "10px", marginTop: "3px" }}>
                STANDBY
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
