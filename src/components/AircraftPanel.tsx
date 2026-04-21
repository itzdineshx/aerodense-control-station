import { useEffect, useState } from "react";
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
  Maximize2,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { AircraftState, MissionState } from "@/hooks/useSimulation";
import { buildCameraSourceCandidates } from "@/lib/cameraStream";

interface AircraftPanelProps {
  aircraft: AircraftState;
  mission: MissionState;
  isFlying: boolean;
  onEmergencyStop?: () => void;
  onReturnHome?: () => void;
  onToggleCamera?: () => void;
  onOpenCameraFullscreen?: () => void;
  onCloseCameraFullscreen?: () => void;
  isCameraFullscreen?: boolean;
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
  onOpenCameraFullscreen,
  onCloseCameraFullscreen,
  isCameraFullscreen = false,
}: AircraftPanelProps) => {
  const [selectedAircraft] = useState("AeroSense-01");
  const [cameraStreamError, setCameraStreamError] = useState(false);
  const [cameraStreamNonce, setCameraStreamNonce] = useState(0);
  const [cameraSourceCandidates, setCameraSourceCandidates] = useState<string[]>(() =>
    buildCameraSourceCandidates(aircraft.cameraStreamUrl, aircraft.cameraIp)
  );
  const [cameraSourceIndex, setCameraSourceIndex] = useState(0);

  // Calculate status colors
  const batteryStatus = aircraft.battery > 50 ? "normal" : aircraft.battery > 20 ? "warning" : "danger";
  const signalStatus = aircraft.signal > 80 ? "normal" : aircraft.signal > 50 ? "warning" : "danger";
  const activeCameraSource = cameraSourceCandidates[cameraSourceIndex] ?? "";
  const hasCameraSource = activeCameraSource.length > 0;
  const cameraStreamSrc = hasCameraSource
    ? `${activeCameraSource}${activeCameraSource.includes("?") ? "&" : "?"}streamNonce=${cameraStreamNonce}`
    : "";

  useEffect(() => {
    const candidates = buildCameraSourceCandidates(aircraft.cameraStreamUrl, aircraft.cameraIp);
    setCameraSourceCandidates(candidates);
    setCameraSourceIndex(0);
    setCameraStreamError(false);
  }, [aircraft.cameraIp, aircraft.cameraStreamUrl]);

  // Simulated environmental data
  const temperature = 22 + Math.random() * 3;
  const windSpeed = 8 + Math.random() * 4;
  const humidity = 45 + Math.random() * 10;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleToggleCamera = () => {
    const candidates = buildCameraSourceCandidates(aircraft.cameraStreamUrl, aircraft.cameraIp);
    setCameraSourceCandidates(candidates);
    setCameraSourceIndex(0);
    setCameraStreamError(false);
    setCameraStreamNonce((prev) => prev + 1);
    onToggleCamera?.();
  };

  const handleRetryCameraStream = () => {
    setCameraSourceIndex(0);
    setCameraStreamError(false);
    setCameraStreamNonce((prev) => prev + 1);
  };

  const handleCameraStreamError = () => {
    if (cameraSourceIndex < cameraSourceCandidates.length - 1) {
      setCameraSourceIndex((prev) => prev + 1);
      setCameraStreamError(false);
      setCameraStreamNonce((prev) => prev + 1);
      return;
    }

    setCameraStreamError(true);
  };

  const handleCameraFullscreen = () => {
    if (isCameraFullscreen) {
      onCloseCameraFullscreen?.();
      return;
    }
    onOpenCameraFullscreen?.();
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar p-4 space-y-4">
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {aircraft.cameraActive ? (
                <Video className="h-4 w-4 text-aero-success" />
              ) : (
                <VideoOff className="h-4 w-4 text-aero-danger" />
              )}
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">
                  {aircraft.cameraActive
                    ? hasCameraSource
                      ? "Live stream connecting"
                      : "Camera IP not configured"
                    : "Camera Off"}
                </div>
                <div className="text-[10px] text-muted-foreground/80 truncate" title={activeCameraSource || "Set VITE_AIRCRAFT_CAMERA_IP in .env"}>
                  Source: {activeCameraSource || "Set VITE_AIRCRAFT_CAMERA_IP in .env"}
                </div>
                {cameraSourceCandidates.length > 1 && cameraSourceIndex > 0 && (
                  <div className="text-[10px] text-aero-warning">
                    Trying fallback source {cameraSourceIndex + 1}/{cameraSourceCandidates.length}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleCamera}
                className="h-7 text-xs"
              >
                {aircraft.cameraActive ? "Stop" : "Start"}
              </Button>
              <Button
                size="sm"
                variant={isCameraFullscreen ? "secondary" : "outline"}
                onClick={handleCameraFullscreen}
                className="h-7 text-xs"
              >
                {isCameraFullscreen ? (
                  <>
                    <Map className="h-3.5 w-3.5" />
                    Map
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5" />
                    Full
                  </>
                )}
              </Button>
            </div>
          </div>
          {aircraft.cameraActive && (
            <div
              className={`mt-2 rounded bg-black/70 border border-border/40 overflow-hidden aspect-video ${
                isCameraFullscreen ? "ring-1 ring-aero-cyan/40" : "cursor-zoom-in"
              }`}
              onClick={!isCameraFullscreen ? onOpenCameraFullscreen : undefined}
              role={!isCameraFullscreen ? "button" : undefined}
            >
              {!hasCameraSource ? (
                <div className="h-full w-full flex items-center justify-center px-3 text-center text-[11px] text-muted-foreground">
                  Add VITE_AIRCRAFT_CAMERA_IP in .env to load the live feed.
                </div>
              ) : cameraStreamError ? (
                <div className="h-full w-full flex flex-col items-center justify-center gap-2 px-3 text-center">
                  <span className="text-[11px] text-aero-danger">Unable to load camera stream from the configured IP.</span>
                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleRetryCameraStream}>
                    Retry Stream
                  </Button>
                </div>
              ) : (
                <img
                  src={cameraStreamSrc}
                  alt="Aircraft live camera stream"
                  className="h-full w-full object-cover"
                  onLoad={() => setCameraStreamError(false)}
                  onError={handleCameraStreamError}
                />
              )}
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
