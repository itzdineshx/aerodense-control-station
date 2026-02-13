import { useState, useEffect } from "react";
import {
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Server,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Download,
  Settings,
  Bell,
  Shield,
  Thermometer,
  Zap,
  Database,
  Cloud,
  Radio,
  MemoryStick,
  CircleAlert,
  CircleCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { AircraftState } from "@/hooks/useSimulation";

interface SystemPanelProps {
  aircraft: AircraftState;
}

interface SystemMetric {
  name: string;
  value: number;
  max: number;
  unit: string;
  status: "normal" | "warning" | "critical";
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "success";
  source: string;
  message: string;
}

interface ServiceStatus {
  name: string;
  status: "online" | "degraded" | "offline";
  latency?: number;
  uptime: string;
}

const SystemPanel = ({ aircraft }: SystemPanelProps) => {
  const [activeTab, setActiveTab] = useState<"status" | "diagnostics" | "logs" | "settings">("status");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [metrics, setMetrics] = useState<SystemMetric[]>([
    { name: "CPU Usage", value: 32, max: 100, unit: "%", status: "normal" },
    { name: "Memory", value: 4.2, max: 8, unit: "GB", status: "normal" },
    { name: "Storage", value: 156, max: 256, unit: "GB", status: "normal" },
    { name: "Network I/O", value: 24, max: 100, unit: "Mbps", status: "normal" },
  ]);

  const services: ServiceStatus[] = [
    { name: "Flight Controller", status: "online", latency: 12, uptime: "99.98%" },
    { name: "GPS Module", status: "online", latency: 45, uptime: "99.95%" },
    { name: "Telemetry Service", status: "online", latency: 8, uptime: "99.99%" },
    { name: "Camera System", status: aircraft.cameraActive ? "online" : "offline", latency: aircraft.cameraActive ? 18 : undefined, uptime: "98.50%" },
    { name: "Cloud Sync", status: "online", latency: 120, uptime: "99.80%" },
    { name: "AI Processing", status: "online", latency: 35, uptime: "99.92%" },
  ];

  // Simulate live metrics updates
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      setMetrics((prev) =>
        prev.map((m) => ({
          ...m,
          value: Math.max(0, Math.min(m.max * 0.9, m.value + (Math.random() - 0.5) * 5)),
          status: m.value / m.max > 0.85 ? "critical" : m.value / m.max > 0.7 ? "warning" : "normal",
        }))
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Generate log entries
  useEffect(() => {
    const initialLogs: LogEntry[] = [
      { id: "1", timestamp: "14:32:18", level: "success", source: "System", message: "All systems nominal" },
      { id: "2", timestamp: "14:31:45", level: "info", source: "GPS", message: "Satellite lock acquired (12 SAT)" },
      { id: "3", timestamp: "14:30:22", level: "info", source: "Telemetry", message: "Data stream initialized" },
      { id: "4", timestamp: "14:29:55", level: "warning", source: "Battery", message: "Battery at 87% - monitoring" },
      { id: "5", timestamp: "14:28:10", level: "info", source: "Camera", message: "4K recording started" },
      { id: "6", timestamp: "14:27:30", level: "success", source: "Network", message: "Connected to control station" },
      { id: "7", timestamp: "14:26:00", level: "info", source: "Flight", message: "Pre-flight checks complete" },
    ];
    setLogs(initialLogs);

    if (!autoRefresh) return;

    const logMessages = [
      { level: "info" as const, source: "Telemetry", message: "Heartbeat received" },
      { level: "info" as const, source: "GPS", message: "Position updated" },
      { level: "success" as const, source: "System", message: "Health check passed" },
      { level: "info" as const, source: "Network", message: "Packet sent successfully" },
    ];

    const interval = setInterval(() => {
      const newLog = logMessages[Math.floor(Math.random() * logMessages.length)];
      const now = new Date();
      setLogs((prev) => [
        {
          id: Date.now().toString(),
          timestamp: now.toLocaleTimeString("en-US", { hour12: false }),
          ...newLog,
        },
        ...prev.slice(0, 49),
      ]);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (status: "online" | "degraded" | "offline") => {
    switch (status) {
      case "online":
        return "text-aero-success";
      case "degraded":
        return "text-aero-warning";
      case "offline":
        return "text-aero-danger";
    }
  };

  const getStatusBg = (status: "online" | "degraded" | "offline") => {
    switch (status) {
      case "online":
        return "bg-aero-success";
      case "degraded":
        return "bg-aero-warning";
      case "offline":
        return "bg-aero-danger";
    }
  };

  const getLogIcon = (level: LogEntry["level"]) => {
    switch (level) {
      case "info":
        return <Info className="h-3 w-3 text-blue-400" />;
      case "warning":
        return <CircleAlert className="h-3 w-3 text-aero-warning" />;
      case "error":
        return <AlertTriangle className="h-3 w-3 text-aero-danger" />;
      case "success":
        return <CircleCheck className="h-3 w-3 text-aero-success" />;
    }
  };

  const getMetricColor = (status: SystemMetric["status"]) => {
    switch (status) {
      case "normal":
        return "bg-aero-success";
      case "warning":
        return "bg-aero-warning";
      case "critical":
        return "bg-aero-danger";
    }
  };

  const onlineCount = services.filter((s) => s.status === "online").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            System Monitor
          </h2>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs ${
                onlineCount === services.length
                  ? "bg-aero-success/20 text-aero-success border-aero-success/30"
                  : "bg-aero-warning/20 text-aero-warning border-aero-warning/30"
              }`}
            >
              {onlineCount}/{services.length} Online
            </Badge>
          </div>
        </div>

        {/* Quick Status Bar */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded bg-secondary/50">
            <Cpu className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-[10px] font-mono text-foreground">{Math.round(metrics[0].value)}%</div>
          </div>
          <div className="text-center p-2 rounded bg-secondary/50">
            <MemoryStick className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-[10px] font-mono text-foreground">{metrics[1].value.toFixed(1)}GB</div>
          </div>
          <div className="text-center p-2 rounded bg-secondary/50">
            <HardDrive className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-[10px] font-mono text-foreground">{Math.round(metrics[2].value)}GB</div>
          </div>
          <div className="text-center p-2 rounded bg-secondary/50">
            <Wifi className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-[10px] font-mono text-foreground">{Math.round(metrics[3].value)}Mb</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["status", "diagnostics", "logs", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "status" && (
          <>
            {/* Services Status */}
            <div className="aero-panel p-3">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Server className="h-3 w-3 text-muted-foreground" />
                Services
              </h4>
              <div className="space-y-2">
                {services.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${getStatusBg(service.status)}`} />
                      <span className="text-xs text-foreground">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {service.latency && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {service.latency}ms
                        </span>
                      )}
                      <span className={`text-[10px] font-medium ${getStatusColor(service.status)}`}>
                        {service.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Health */}
            <div className="aero-panel p-3">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-aero-success" />
                System Health
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded bg-aero-success/10 border border-aero-success/20">
                  <CheckCircle className="h-5 w-5 mx-auto mb-1 text-aero-success" />
                  <div className="text-lg font-bold text-aero-success">98.5%</div>
                  <div className="text-[10px] text-muted-foreground">Uptime</div>
                </div>
                <div className="text-center p-3 rounded bg-secondary/50 border border-border">
                  <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold text-foreground">4d 12h</div>
                  <div className="text-[10px] text-muted-foreground">Since Restart</div>
                </div>
              </div>
            </div>

            {/* Environment */}
            <div className="aero-panel p-3">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Thermometer className="h-3 w-3 text-muted-foreground" />
                Environment
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPU Temperature</span>
                  <span className="text-foreground font-mono">42°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Board Temperature</span>
                  <span className="text-foreground font-mono">38°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fan Speed</span>
                  <span className="text-foreground font-mono">2,400 RPM</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "diagnostics" && (
          <>
            {/* Resource Usage */}
            <div className="aero-panel p-3">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-primary" />
                Resource Usage
              </h4>
              <div className="space-y-3">
                {metrics.map((metric) => (
                  <div key={metric.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{metric.name}</span>
                      <span className="text-foreground font-mono">
                        {metric.name === "Memory" || metric.name === "Storage"
                          ? metric.value.toFixed(1)
                          : Math.round(metric.value)}
                        {metric.unit} / {metric.max}{metric.unit}
                      </span>
                    </div>
                    <Progress
                      value={(metric.value / metric.max) * 100}
                      className={`h-1.5 bg-secondary [&>div]:${getMetricColor(metric.status)}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Network Stats */}
            <div className="aero-panel p-3">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Radio className="h-3 w-3 text-aero-cyan" />
                Network Statistics
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-secondary/50 text-center">
                  <div className="text-muted-foreground mb-1">Packets Sent</div>
                  <div className="font-mono text-foreground">1,247,832</div>
                </div>
                <div className="p-2 rounded bg-secondary/50 text-center">
                  <div className="text-muted-foreground mb-1">Packets Recv</div>
                  <div className="font-mono text-foreground">1,245,109</div>
                </div>
                <div className="p-2 rounded bg-secondary/50 text-center">
                  <div className="text-muted-foreground mb-1">Packet Loss</div>
                  <div className="font-mono text-aero-success">0.02%</div>
                </div>
                <div className="p-2 rounded bg-secondary/50 text-center">
                  <div className="text-muted-foreground mb-1">Avg Latency</div>
                  <div className="font-mono text-foreground">28ms</div>
                </div>
              </div>
            </div>

            {/* Run Diagnostics */}
            <Button variant="outline" size="sm" className="w-full text-xs">
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Run Full Diagnostics
            </Button>
          </>
        )}

        {activeTab === "logs" && (
          <>
            {/* Log Filter */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {["all", "info", "warning", "error"].map((filter) => (
                  <Badge
                    key={filter}
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-secondary"
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Badge>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]">
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            </div>

            {/* Log Entries */}
            <div className="space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 p-2 rounded bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  {getLogIcon(log.level)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {log.timestamp}
                      </span>
                      <Badge variant="outline" className="text-[9px] h-4">
                        {log.source}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground truncate">{log.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "settings" && (
          <>
            {/* Auto Refresh */}
            <div className="aero-panel p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Auto Refresh</h4>
                  <p className="text-[10px] text-muted-foreground">Update metrics in real-time</p>
                </div>
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>
            </div>

            {/* Notifications */}
            <div className="aero-panel p-3">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Bell className="h-3 w-3 text-muted-foreground" />
                Notifications
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">System Alerts</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Performance Warnings</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Log Notifications</span>
                  <Switch />
                </div>
              </div>
            </div>

            {/* Data Management */}
            <div className="aero-panel p-3">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Database className="h-3 w-3 text-muted-foreground" />
                Data Management
              </h4>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start">
                  <Download className="h-3 w-3 mr-2" />
                  Export System Logs
                </Button>
                <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start">
                  <Cloud className="h-3 w-3 mr-2" />
                  Sync to Cloud
                </Button>
                <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start text-aero-danger hover:text-aero-danger">
                  <AlertTriangle className="h-3 w-3 mr-2" />
                  Clear Cache
                </Button>
              </div>
            </div>

            {/* System Info */}
            <div className="aero-panel p-3">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Settings className="h-3 w-3 text-muted-foreground" />
                System Information
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="text-foreground font-mono">2.4.1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Build</span>
                  <span className="text-foreground font-mono">20260210-1842</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">License</span>
                  <span className="text-aero-success">Enterprise</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Last updated: {new Date().toLocaleTimeString()}
          </span>
          <Button variant="ghost" size="sm" className="h-6 text-[10px]">
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SystemPanel;
