import { useState } from "react";
import {
  Radio,
  Battery,
  Wifi,
  Satellite,
  Camera,
  Thermometer,
  Wind,
  Gauge,
  AlertTriangle,
  Home,
  Power,
  Video,
  VideoOff,
  Plane,
  Activity,
  MapPin,
  Clock,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { AircraftState, MissionState } from "@/hooks/useSimulation";

interface AircraftPanelProps {
  aircraft: AircraftState;
  mission: MissionState;
  isFlying: boolean;
  onEmergencyStop?: () => void;
  onReturnHome?: () => void;
  onToggleCamera?: () => void;
}

interface TelemetryItemProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit?: string;
  status?: "normal" | "warning" | "danger";
}

const TelemetryItem = ({ icon: Icon, label, value, unit, status = "normal" }: TelemetryItemProps) => {
  const statusColors = {
    normal: "text-aero-success",
    warning: "text-aero-warning",
    danger: "text-aero-danger",
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <span className={`text-xs font-mono ${statusColors[status]}`}>
        {value}{unit && <span className="text-muted-foreground ml-0.5">{unit}</span>}
      </span>
    </div>
  );
};

const AircraftPanel = ({
  aircraft,
  mission,
  isFlying,
  onEmergencyStop,
  onReturnHome,
  onToggleCamera,
}: AircraftPanelProps) => {
  const [selectedAircraft] = useState("AeroSense-01");

  // Calculate status colors
  const batteryStatus = aircraft.battery > 50 ? "normal" : aircraft.battery > 20 ? "warning" : "danger";
  const signalStatus = aircraft.signal > 80 ? "normal" : aircraft.signal > 50 ? "warning" : "danger";

  // Simulated environmental data
  const temperature = 22 + Math.random() * 3;
  const windSpeed = 8 + Math.random() * 4;
  const humidity = 45 + Math.random() * 10;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Aircraft Management
          </h2>
          <Badge
            variant={aircraft.status === "Idle" ? "default" : "secondary"}
            className={
              aircraft.status === "In Flight"
                ? "bg-aero-cyan/20 text-aero-cyan border-aero-cyan/30"
                : aircraft.status === "Idle"
                ? "bg-aero-success/20 text-aero-success border-aero-success/30"
                : "bg-aero-warning/20 text-aero-warning border-aero-warning/30"
            }
          >
            {aircraft.status}
          </Badge>
        </div>

        {/* Aircraft selector */}
        <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 border border-border">
          <Plane className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-foreground">{selectedAircraft}</div>
            <div className="text-[10px] text-muted-foreground">DJI Matrice 300 RTK</div>
          </div>
          <div className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${aircraft.status === "Idle" ? "bg-aero-success" : "bg-aero-cyan animate-pulse"}`} />
          </div>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Battery & Power Section */}
        <div className="aero-panel p-3">
          <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-aero-warning" />
            Power System
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Battery className="h-3 w-3" /> Battery Level
                </span>
                <span className={batteryStatus === "normal" ? "text-aero-success" : batteryStatus === "warning" ? "text-aero-warning" : "text-aero-danger"}>
                  {Math.round(aircraft.battery)}%
                </span>
              </div>
              <Progress
                value={aircraft.battery}
                className={`h-2 bg-secondary ${
                  batteryStatus === "normal"
                    ? "[&>div]:bg-aero-success"
                    : batteryStatus === "warning"
                    ? "[&>div]:bg-aero-warning"
                    : "[&>div]:bg-aero-danger"
                }`}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>~{Math.round(aircraft.battery * 0.45)} min remaining</span>
                <span>4500mAh × 2</span>
              </div>
            </div>
          </div>
        </div>

        {/* Connectivity Section */}
        <div className="aero-panel p-3">
          <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Wifi className="h-3 w-3 text-aero-cyan" />
            Connectivity
          </h3>
          <TelemetryItem
            icon={Wifi}
            label="Signal Strength"
            value={Math.round(aircraft.signal)}
            unit="%"
            status={signalStatus}
          />
          <TelemetryItem
            icon={Satellite}
            label="GPS Satellites"
            value={aircraft.satellites}
            unit=" SAT"
            status={aircraft.satellites >= 10 ? "normal" : "warning"}
          />
          <TelemetryItem
            icon={Radio}
            label="Latency"
            value={45 + Math.round(Math.random() * 20)}
            unit="ms"
            status="normal"
          />
        </div>

        {/* Flight Telemetry */}
        <div className="aero-panel p-3">
          <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-primary" />
            Flight Telemetry
          </h3>
          <TelemetryItem
            icon={MapPin}
            label="Altitude"
            value={mission.altitude}
            unit="m"
          />
          <TelemetryItem
            icon={Gauge}
            label="Speed"
            value={isFlying ? mission.speed : 0}
            unit="km/h"
          />
          <TelemetryItem
            icon={Gauge}
            label="Payload"
            value={aircraft.payloadWeight.toFixed(1)}
            unit={`/ ${aircraft.maxPayload} kg`}
          />
          {isFlying && (
            <>
              <TelemetryItem
                icon={MapPin}
                label="Distance"
                value={mission.distance.toFixed(2)}
                unit="km"
              />
              <TelemetryItem
                icon={Clock}
                label="Flight Time"
                value={formatTime(mission.elapsed)}
              />
            </>
          )}
        </div>

        {/* Environmental Data */}
        <div className="aero-panel p-3">
          <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Wind className="h-3 w-3 text-muted-foreground" />
            Environment
          </h3>
          <TelemetryItem
            icon={Thermometer}
            label="Temperature"
            value={temperature.toFixed(1)}
            unit="°C"
          />
          <TelemetryItem
            icon={Wind}
            label="Wind Speed"
            value={windSpeed.toFixed(1)}
            unit="m/s"
            status={windSpeed > 10 ? "warning" : "normal"}
          />
          <TelemetryItem
            icon={Activity}
            label="Humidity"
            value={humidity.toFixed(0)}
            unit="%"
          />
        </div>

        {/* Camera Status */}
        <div className="aero-panel p-3">
          <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Camera className="h-3 w-3 text-muted-foreground" />
            Camera System
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {aircraft.cameraActive ? (
                <Video className="h-4 w-4 text-aero-success" />
              ) : (
                <VideoOff className="h-4 w-4 text-aero-danger" />
              )}
              <span className="text-xs text-muted-foreground">
                {aircraft.cameraActive ? "Recording • 4K 60fps" : "Camera Off"}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleCamera}
              className="h-7 text-xs"
            >
              {aircraft.cameraActive ? "Stop" : "Start"}
            </Button>
          </div>
          {aircraft.cameraActive && (
            <div className="mt-2 p-2 rounded bg-black/50 aspect-video flex items-center justify-center">
              <div className="text-[10px] text-aero-cyan font-mono">
                LIVE FEED • {new Date().toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReturnHome}
            disabled={!isFlying}
            className="h-9 text-xs border-aero-warning/30 text-aero-warning hover:bg-aero-warning/10"
          >
            <Home className="h-3.5 w-3.5 mr-1.5" />
            Return Home
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEmergencyStop}
            disabled={!isFlying}
            className="h-9 text-xs border-aero-danger/30 text-aero-danger hover:bg-aero-danger/10"
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Emergency Stop
          </Button>
        </div>
        <div className="text-[10px] text-center text-muted-foreground">
          Mode: <span className="text-aero-success font-semibold">{aircraft.mode}</span> • 
          Control: <span className="text-foreground">Connected</span>
        </div>
      </div>
    </div>
  );
};

export default AircraftPanel;
