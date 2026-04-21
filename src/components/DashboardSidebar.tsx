import { useState } from "react";
import {
  Package, MapPin, Shield, Radio, Navigation, Route, Activity,
  ChevronLeft, ChevronRight, Plane, Sparkles, PlayCircle
} from "lucide-react";

interface NavItem {
  icon: React.ElementType;
  label: string;
  id: string;
}

const navItems: NavItem[] = [
  { icon: Package, label: "Orders", id: "orders" },
  { icon: MapPin, label: "Map View", id: "map" },
  { icon: Sparkles, label: "AI Assistant", id: "ai" },
  { icon: Shield, label: "Admin", id: "admin" },
  { icon: Radio, label: "Aircraft", id: "aircraft" },
  { icon: Navigation, label: "Pilot", id: "pilot" },
  { icon: Route, label: "Routes", id: "routes" },
  { icon: PlayCircle, label: "Simulation", id: "simulation" },
  { icon: Activity, label: "System", id: "system" },
];

interface DashboardSidebarProps {
  activeModule: string;
  onModuleChange: (id: string) => void;
}

const DashboardSidebar = ({ activeModule, onModuleChange }: DashboardSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col border-r border-border bg-sidebar transition-all duration-300 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
        <Plane className="h-6 w-6 text-primary shrink-0" />
        {!collapsed && (
          <span className="font-semibold text-foreground tracking-wide text-sm">
            AEROSENSE
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-1 px-2">
        {navItems.map((item) => {
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all ${
                active
                  ? "bg-primary/10 text-primary aero-glow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
};

export default DashboardSidebar;
