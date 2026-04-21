import { useMemo, useState } from "react";
import {
  Battery,
  Gauge,
  PackageCheck,
  Play,
  Radio,
  Route,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type {
  CommandLogEntry,
  DeliverySimulationInput,
  DroneProfile,
  MissionState,
  MqttConnectionState,
  RouteCommand,
} from "@/hooks/useSimulation";

interface SimulationPanelProps {
  locations: string[];
  droneFleet: DroneProfile[];
  selectedDrone: DroneProfile | null;
  mission: MissionState;
  isFlying: boolean;
  routeCommands: RouteCommand[];
  commandLog: CommandLogEntry[];
  mqttState: MqttConnectionState;
  onRunSimulation: (input: DeliverySimulationInput) => Promise<{ ok: boolean; message: string }>;
  onEmergencyStop: () => void;
  onClearLog: () => void;
}

const mqttStatusStyle: Record<MqttConnectionState["status"], string> = {
  disabled: "bg-muted text-muted-foreground border-border",
  connecting: "bg-aero-warning/15 text-aero-warning border-aero-warning/30",
  connected: "bg-aero-success/15 text-aero-success border-aero-success/30",
  error: "bg-aero-danger/15 text-aero-danger border-aero-danger/30",
};

const commandStatusStyle: Record<RouteCommand["status"], string> = {
  pending: "text-muted-foreground",
  sending: "text-aero-warning",
  sent: "text-aero-success",
  failed: "text-aero-danger",
  skipped: "text-muted-foreground",
};

const priorityHints: Record<DeliverySimulationInput["priority"], string> = {
  Standard: "Balanced speed and battery usage",
  Express: "Faster cruise speed",
  Critical: "Maximum response profile",
};

const formatTimestamp = (timestamp: string) => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "--:--:--";
  }
  return parsed.toLocaleTimeString("en-US", { hour12: false });
};

const SimulationPanel = ({
  locations,
  droneFleet,
  selectedDrone,
  mission,
  isFlying,
  routeCommands,
  commandLog,
  mqttState,
  onRunSimulation,
  onEmergencyStop,
  onClearLog,
}: SimulationPanelProps) => {
  const { toast } = useToast();
  const [packageType, setPackageType] = useState("Medical Supplies");
  const [weightKg, setWeightKg] = useState("2.4");
  const [pickup, setPickup] = useState(locations[0] ?? "");
  const [delivery, setDelivery] = useState(locations[1] ?? locations[0] ?? "");
  const [priority, setPriority] = useState<DeliverySimulationInput["priority"]>("Standard");
  const [launching, setLaunching] = useState(false);

  const sortedCommands = useMemo(
    () => [...routeCommands].sort((a, b) => a.triggerProgress - b.triggerProgress),
    [routeCommands]
  );

  const readyFleet = useMemo(
    () => droneFleet.filter((drone) => drone.status === "Ready" || drone.status === "In Flight"),
    [droneFleet]
  );

  const commandSummary = useMemo(() => {
    const sent = sortedCommands.filter((item) => item.status === "sent").length;
    const failed = sortedCommands.filter((item) => item.status === "failed").length;
    return { sent, failed, total: sortedCommands.length };
  }, [sortedCommands]);

  const canStart =
    !isFlying &&
    pickup.length > 0 &&
    delivery.length > 0 &&
    Number(weightKg) > 0 &&
    Number(weightKg) <= 25;

  const handleLaunch = async () => {
    const parsedWeight = Number(weightKg);

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      toast({
        title: "Invalid weight",
        description: "Enter a valid package weight in kilograms.",
        variant: "destructive",
      });
      return;
    }

    if (pickup === delivery) {
      toast({
        title: "Invalid route",
        description: "Pickup and delivery must be different locations.",
        variant: "destructive",
      });
      return;
    }

    setLaunching(true);
    try {
      const result = await onRunSimulation({
        packageType,
        weightKg: parsedWeight,
        pickup,
        delivery,
        priority,
      });

      toast({
        title: result.ok ? "Simulation started" : "Simulation blocked",
        description: result.message,
        variant: result.ok ? "default" : "destructive",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start simulation.";
      toast({
        title: "Simulation error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="w-[26rem] flex flex-col h-full border-r border-border bg-card/80">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            Auto Simulation
          </h2>
          <Badge variant="outline" className={`text-[10px] ${mqttStatusStyle[mqttState.status]}`}>
            MQTT {mqttState.status.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground">
          <span>Control: {mqttState.controlTopic}</span>
          <span>Status: {mqttState.statusTopic}</span>
        </div>

        {mqttState.lastError && (
          <p className="text-[10px] text-aero-danger font-mono">{mqttState.lastError}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="aero-panel p-3 space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Delivery Input</h3>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Package Type</Label>
            <Input
              value={packageType}
              onChange={(event) => setPackageType(event.target.value)}
              className="h-8 text-xs"
              placeholder="Medical Supplies"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Weight (kg)</Label>
            <Input
              type="number"
              min={0.1}
              step={0.1}
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Pickup</Label>
            <Select value={pickup} onValueChange={setPickup}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select pickup" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={`pickup-${location}`} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Delivery</Label>
            <Select value={delivery} onValueChange={setDelivery}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select delivery" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={`delivery-${location}`} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Priority</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as DeliverySimulationInput["priority"])}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Express">Express</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground font-mono">{priorityHints[priority]}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              onClick={handleLaunch}
              disabled={!canStart || launching}
              className="h-8 text-xs bg-primary hover:bg-primary/80"
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              {launching ? "Starting" : "Run"}
            </Button>
            <Button
              variant="outline"
              onClick={onEmergencyStop}
              disabled={!isFlying}
              className="h-8 text-xs border-aero-danger/30 text-aero-danger hover:bg-aero-danger/10"
            >
              <Square className="h-3.5 w-3.5 mr-1" />
              Abort
            </Button>
          </div>
        </div>

        <div className="aero-panel p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Drone Selection</h3>
            {selectedDrone && (
              <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30" variant="outline">
                Assigned
              </Badge>
            )}
          </div>

          {selectedDrone ? (
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="text-foreground">{selectedDrone.model}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><PackageCheck className="h-3 w-3" /> Payload</span>
                <span>{selectedDrone.maxPayloadKg.toFixed(1)} kg</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Gauge className="h-3 w-3" /> Cruise</span>
                <span>{selectedDrone.cruiseSpeedKmh} km/h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Battery className="h-3 w-3" /> Battery</span>
                <span>{Math.round(selectedDrone.batteryPercent)}%</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Run simulation to auto-select a drone.</p>
          )}

          <div className="pt-1 space-y-1 max-h-24 overflow-y-auto">
            {readyFleet.map((drone) => (
              <div key={drone.id} className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span className="truncate pr-2">{drone.model}</span>
                <span>{drone.status} • {Math.round(drone.batteryPercent)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="aero-panel p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">Mission Progress</span>
            <span className="text-aero-cyan">{Math.round(mission.progress)}%</span>
          </div>
          <Progress value={mission.progress} className="h-2 bg-secondary [&>div]:bg-aero-cyan" />

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground">
            <span>ETA {Math.max(0, Math.ceil(mission.eta / 60))} min</span>
            <span>Distance {mission.distance.toFixed(2)} km</span>
            <span>Cmd sent {commandSummary.sent}/{commandSummary.total}</span>
            <span className={commandSummary.failed > 0 ? "text-aero-danger" : ""}>
              Cmd failed {commandSummary.failed}
            </span>
          </div>
        </div>

        <div className="aero-panel p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Send className="h-3 w-3 text-primary" />
              Route Commands
            </h3>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {sortedCommands.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No route commands generated yet.</p>
            )}

            {sortedCommands.map((command) => (
              <div key={command.id} className="rounded border border-border/60 px-2 py-1.5 text-[10px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-foreground uppercase">{command.action}</span>
                  <span className={commandStatusStyle[command.status]}>{command.status}</span>
                </div>
                <div className="text-muted-foreground flex items-center justify-between mt-1">
                  <span>{command.command}</span>
                  <span>@ {command.triggerProgress}%</span>
                </div>
                {command.failureReason && (
                  <p className="text-aero-danger mt-1">{command.failureReason}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="aero-panel p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Radio className="h-3 w-3 text-aero-cyan" />
              MQTT Traffic
            </h3>
            <Button size="sm" variant="ghost" onClick={onClearLog} className="h-6 px-2 text-[10px]">
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
            {commandLog.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No MQTT events yet.</p>
            )}

            {commandLog.map((entry) => (
              <div key={entry.id} className="rounded border border-border/60 px-2 py-1.5 text-[10px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                  <span className={entry.status === "failed" ? "text-aero-danger" : entry.status === "sent" ? "text-aero-success" : "text-aero-cyan"}>
                    {entry.direction.toUpperCase()} • {entry.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-foreground truncate mt-1">{entry.topic}</div>
                <div className="text-muted-foreground truncate">{entry.payload || "(no payload)"}</div>
                {entry.detail && <div className="text-muted-foreground">{entry.detail}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationPanel;
