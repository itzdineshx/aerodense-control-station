import { useState, useEffect, useCallback, useRef } from "react";
import mqtt, { type IClientOptions, type MqttClient } from "mqtt";
import type { Order } from "@/components/OrdersPanel";

export interface AircraftState {
  battery: number;
  payloadWeight: number;
  maxPayload: number;
  status: "Idle" | "In Flight" | "Landing" | "Charging";
  mode: "Manual" | "Semi-Auto" | "Auto";
  signal: number;
  satellites: number;
  cameraActive: boolean;
  cameraIp: string;
  cameraStreamUrl: string;
}

export interface MissionState {
  progress: number;
  elapsed: number; // seconds
  eta: number; // seconds
  distance: number; // km
  altitude: number; // meters
  speed: number; // km/h
  routeProgress: number; // 0-1 for aircraft position on route
  route: [number, number][]; // [lng, lat] coordinates
}

export interface DroneProfile {
  id: string;
  model: string;
  maxPayloadKg: number;
  maxRangeKm: number;
  cruiseSpeedKmh: number;
  batteryPercent: number;
  status: "Ready" | "In Flight" | "Charging" | "Maintenance";
}

export interface DeliverySimulationInput {
  packageType: string;
  weightKg: number;
  pickup: string;
  delivery: string;
  priority: "Standard" | "Express" | "Critical";
}

type FlightAction =
  | "engine_on"
  | "engine_off"
  | "turn_right"
  | "turn_left"
  | "roll_right"
  | "roll_left"
  | "throttle_up"
  | "throttle_down"
  | "emergency_stop";

type RouteCommandStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

export interface RouteCommand {
  id: string;
  action: FlightAction;
  command: string;
  triggerProgress: number;
  value?: number;
  note?: string;
  status: RouteCommandStatus;
  sentAt?: number;
  failureReason?: string;
}

export interface CommandLogEntry {
  id: string;
  timestamp: string;
  direction: "outgoing" | "incoming";
  topic: string;
  payload: string;
  status: "sent" | "failed" | "received" | "skipped";
  detail?: string;
}

export interface MqttConnectionState {
  enabled: boolean;
  status: "disabled" | "connecting" | "connected" | "error";
  brokerUrl: string;
  controlTopic: string;
  statusTopic: string;
  lastError?: string;
}

interface SimulationStartResult {
  ok: boolean;
  message: string;
}

const configuredCameraIp = (import.meta.env.VITE_AIRCRAFT_CAMERA_IP ?? "").trim();
const configuredCameraPath = (import.meta.env.VITE_AIRCRAFT_CAMERA_STREAM_PATH ?? "/video").trim();
const configuredCameraStreamUrl = (import.meta.env.VITE_AIRCRAFT_CAMERA_STREAM_URL ?? "").trim();

function normalizeCameraBaseUrl(raw: string): string {
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

function buildCameraStreamUrl(cameraIp: string, streamPath: string): string {
  const normalizedBase = normalizeCameraBaseUrl(cameraIp);
  const normalizedPath = streamPath.startsWith("/") ? streamPath : `/${streamPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

const resolvedCameraStreamUrl =
  configuredCameraStreamUrl ||
  (configuredCameraIp ? buildCameraStreamUrl(configuredCameraIp, configuredCameraPath || "/video") : "");

const initialAircraft: AircraftState = {
  battery: 87,
  payloadWeight: 0,
  maxPayload: 5.0,
  status: "Idle",
  signal: 98,
  satellites: 12,
  cameraActive: true,
  cameraIp: configuredCameraIp,
  cameraStreamUrl: resolvedCameraStreamUrl,
  mode: "Semi-Auto",
};

const initialMission: MissionState = {
  progress: 0,
  elapsed: 0,
  eta: 0,
  distance: 0,
  altitude: 150,
  speed: 0,
  routeProgress: 0,
  route: [],
};

const initialDroneFleet: DroneProfile[] = [
  {
    id: "DR-101",
    model: "Falcon X4",
    maxPayloadKg: 2.5,
    maxRangeKm: 18,
    cruiseSpeedKmh: 48,
    batteryPercent: 82,
    status: "Ready",
  },
  {
    id: "DR-102",
    model: "Atlas Lift",
    maxPayloadKg: 5.2,
    maxRangeKm: 22,
    cruiseSpeedKmh: 44,
    batteryPercent: 76,
    status: "Ready",
  },
  {
    id: "DR-103",
    model: "Swift Courier",
    maxPayloadKg: 1.8,
    maxRangeKm: 15,
    cruiseSpeedKmh: 56,
    batteryPercent: 69,
    status: "Charging",
  },
  {
    id: "DR-104",
    model: "Ranger VTOL",
    maxPayloadKg: 4.2,
    maxRangeKm: 28,
    cruiseSpeedKmh: 52,
    batteryPercent: 91,
    status: "Ready",
  },
];

const locationCoordinates: Record<string, { lat: number; lng: number }> = {
  "Warehouse A": { lat: 13.0827, lng: 80.2707 }, // Chennai Central
  "Hospital B": { lat: 13.0604, lng: 80.2496 }, // Apollo Hospital area
  "Depot C": { lat: 13.0878, lng: 80.2785 }, // Parrys Corner
  "Office Park D": { lat: 13.0569, lng: 80.2425 }, // T Nagar
  "Kitchen Hub": { lat: 13.0475, lng: 80.2090 }, // Guindy
  "Residential Zone E": { lat: 13.1067, lng: 80.2206 }, // Anna Nagar
  "HQ Tower": { lat: 13.0843, lng: 80.2705 }, // Fort area
  "Branch Office F": { lat: 13.0108, lng: 80.2270 }, // Adyar
  "Lab Center G": { lat: 13.0127, lng: 80.2351 }, // IIT Madras area
  "Research Facility H": { lat: 13.0674, lng: 80.2376 }, // Nungambakkam
  "Factory I": { lat: 13.1143, lng: 80.1548 }, // Ambattur
  "Maintenance Bay J": { lat: 13.0358, lng: 80.1790 }, // Porur
};

export const simulationLocations = Object.keys(locationCoordinates);

const initialOrders: Order[] = [
  { id: "ORD-4821", packageType: "Medical Supplies", weight: "2.4 kg", pickup: "Warehouse A", delivery: "Hospital B", status: "Pending" },
  { id: "ORD-4822", packageType: "Electronics", weight: "1.8 kg", pickup: "Depot C", delivery: "Office Park D", status: "Pending" },
  { id: "ORD-4823", packageType: "Food Package", weight: "3.1 kg", pickup: "Kitchen Hub", delivery: "Residential Zone E", status: "Pending" },
  { id: "ORD-4824", packageType: "Documents", weight: "0.5 kg", pickup: "HQ Tower", delivery: "Branch Office F", status: "Pending" },
  { id: "ORD-4825", packageType: "Lab Samples", weight: "1.2 kg", pickup: "Lab Center G", delivery: "Research Facility H", status: "Pending" },
  { id: "ORD-4826", packageType: "Spare Parts", weight: "4.0 kg", pickup: "Factory I", delivery: "Maintenance Bay J", status: "Pending" },
];

const toNumber = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (raw: string | undefined, fallback: boolean): boolean => {
  if (raw == null) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const MQTT_ENABLED = toBoolean(import.meta.env.VITE_FLIGHT_MQTT_ENABLED, false);
const MQTT_URL = import.meta.env.VITE_FLIGHT_MQTT_URL ?? "";
const MQTT_CLIENT_ID = import.meta.env.VITE_FLIGHT_MQTT_CLIENT_ID ?? "zara-control-station-web";
const MQTT_USERNAME = import.meta.env.VITE_FLIGHT_MQTT_USERNAME ?? "";
const MQTT_PASSWORD = import.meta.env.VITE_FLIGHT_MQTT_PASSWORD ?? "";
const MQTT_CONTROL_TOPIC = import.meta.env.VITE_FLIGHT_MQTT_CONTROL_TOPIC ?? "zara/flight/control";
const MQTT_STATUS_TOPIC = import.meta.env.VITE_FLIGHT_MQTT_STATUS_TOPIC ?? "zara/flight/status";
const MQTT_KEEPALIVE_SECONDS = Math.max(10, toNumber(import.meta.env.VITE_FLIGHT_MQTT_KEEPALIVE_S, 30));
const MQTT_QOS = Math.min(2, Math.max(0, Math.round(toNumber(import.meta.env.VITE_FLIGHT_MQTT_QOS, 1)))) as 0 | 1 | 2;
const MQTT_PUBLISH_TIMEOUT_MS = Math.max(300, toNumber(import.meta.env.VITE_FLIGHT_MQTT_PUBLISH_TIMEOUT_MS, 1500));
const DEFAULT_THROTTLE_LEVEL = Math.min(255, Math.max(10, Math.round(toNumber(import.meta.env.VITE_FLIGHT_THROTTLE_DEFAULT_LEVEL, 80))));

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Generate an aerial (straight-line) route between two coordinates.
 * Produces intermediate waypoints along the great-circle path so the
 * route renders as a smooth line on the map.
 */
function generateAerialRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  numPoints = 50
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lng = from.lng + (to.lng - from.lng) * t;
    const lat = from.lat + (to.lat - from.lat) * t;
    points.push([lng, lat]);
  }
  return points;
}

/**
 * Build an S-curve route so the simulation naturally includes left and right turns.
 */
function generateCurvedRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  numPoints = 60
): [number, number][] {
  const points: [number, number][] = [];
  const dx = to.lng - from.lng;
  const dy = to.lat - from.lat;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;

  const perpLng = -dy / length;
  const perpLat = dx / length;
  const sign = from.lat + from.lng > to.lat + to.lng ? 1 : -1;
  const leftOffset = Math.min(0.034, Math.max(0.008, length * 0.34));
  const rightOffset = Math.min(0.031, Math.max(0.007, length * 0.28));

  const control1 = {
    lat: from.lat + dy * 0.3 + perpLat * leftOffset * sign,
    lng: from.lng + dx * 0.3 + perpLng * leftOffset * sign,
  };

  const control2 = {
    lat: from.lat + dy * 0.68 - perpLat * rightOffset * sign,
    lng: from.lng + dx * 0.68 - perpLng * rightOffset * sign,
  };

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const oneMinusT = 1 - t;
    const lat =
      oneMinusT * oneMinusT * oneMinusT * from.lat +
      3 * oneMinusT * oneMinusT * t * control1.lat +
      3 * oneMinusT * t * t * control2.lat +
      t * t * t * to.lat;
    const lng =
      oneMinusT * oneMinusT * oneMinusT * from.lng +
      3 * oneMinusT * oneMinusT * t * control1.lng +
      3 * oneMinusT * t * t * control2.lng +
      t * t * t * to.lng;
    points.push([lng, lat]);
  }

  return points;
}

/**
 * Haversine distance between two points in km.
 */
function haversineDistance(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function bearingBetween(start: [number, number], end: [number, number]): number {
  const [startLng, startLat] = start;
  const [endLng, endLat] = end;

  const startLatRad = toRad(startLat);
  const endLatRad = toRad(endLat);
  const deltaLngRad = toRad(endLng - startLng);

  const y = Math.sin(deltaLngRad) * Math.cos(endLatRad);
  const x =
    Math.cos(startLatRad) * Math.sin(endLatRad) -
    Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(deltaLngRad);

  return (Math.atan2(y, x) * 180) / Math.PI + 360;
}

function normalizeHeadingDelta(delta: number): number {
  let normalized = delta;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;
  return normalized;
}

function collectRouteCheckpoints(route: [number, number][], count: number): [number, number][] {
  if (route.length <= count) return route;

  const checkpoints: [number, number][] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    const index = Math.round((i / (count - 1)) * (route.length - 1));
    const point = route[index];
    const key = `${point[0].toFixed(6)}:${point[1].toFixed(6)}`;
    if (!seen.has(key)) {
      checkpoints.push(point);
      seen.add(key);
    }
  }

  return checkpoints;
}

function buildRouteCommands(route: [number, number][], throttleLevel: number): RouteCommand[] {
  const commands: RouteCommand[] = [
    {
      id: createId("cmd"),
      action: "engine_on",
      command: "start engine",
      triggerProgress: 0,
      value: throttleLevel,
      note: "Arm motor and begin takeoff sequence",
      status: "pending",
    },
    {
      id: createId("cmd"),
      action: "throttle_up",
      command: "increase throttle",
      triggerProgress: 3,
      value: throttleLevel,
      note: "Apply cruise throttle",
      status: "pending",
    },
  ];

  const checkpointTarget = Math.min(18, Math.max(10, Math.floor(route.length / 5)));
  const checkpoints = collectRouteCheckpoints(route, checkpointTarget);
  if (checkpoints.length >= 3) {
    const bearings: number[] = [];
    for (let i = 0; i < checkpoints.length - 1; i++) {
      bearings.push(bearingBetween(checkpoints[i], checkpoints[i + 1]));
    }

    for (let i = 1; i < bearings.length; i++) {
      const delta = normalizeHeadingDelta(bearings[i] - bearings[i - 1]);
      if (Math.abs(delta) < 10) continue;

      const action: FlightAction = delta > 0 ? "turn_right" : "turn_left";
      const label = delta > 0 ? "turn right" : "turn left";
      const triggerProgress = Math.max(10, Math.min(92, Math.round(((i + 1) / bearings.length) * 100)));
      const last = commands[commands.length - 1];

      if (last && last.action === action && Math.abs(last.triggerProgress - triggerProgress) < 8) {
        continue;
      }

      commands.push({
        id: createId("cmd"),
        action,
        command: label,
        triggerProgress,
        note: `Route heading change ${Math.abs(delta).toFixed(1)} deg`,
        status: "pending",
      });
    }
  }

  const hasLeftTurn = commands.some((command) => command.action === "turn_left");
  const hasRightTurn = commands.some((command) => command.action === "turn_right");

  if (!hasLeftTurn) {
    commands.push({
      id: createId("cmd"),
      action: "turn_left",
      command: "turn left",
      triggerProgress: 38,
      note: "Route shaping left turn",
      status: "pending",
    });
  }

  if (!hasRightTurn) {
    commands.push({
      id: createId("cmd"),
      action: "turn_right",
      command: "turn right",
      triggerProgress: 62,
      note: "Route shaping right turn",
      status: "pending",
    });
  }

  const turnCommands = commands
    .filter((command) => command.action === "turn_left" || command.action === "turn_right")
    .sort((a, b) => a.triggerProgress - b.triggerProgress);

  for (const turnCommand of turnCommands) {
    const isLeftTurn = turnCommand.action === "turn_left";
    commands.push({
      id: createId("cmd"),
      action: isLeftTurn ? "roll_left" : "roll_right",
      command: isLeftTurn ? "left roll" : "right roll",
      triggerProgress: Math.min(95, turnCommand.triggerProgress + 1),
      note: isLeftTurn ? "Bank left for turn execution" : "Bank right for turn execution",
      status: "pending",
    });
  }

  commands.push({
    id: createId("cmd"),
    action: "throttle_down",
    command: "decrease throttle",
    triggerProgress: 96,
    value: Math.max(35, Math.round(throttleLevel * 0.6)),
    note: "Prepare landing approach",
    status: "pending",
  });

  commands.push({
    id: createId("cmd"),
    action: "engine_off",
    command: "stop engine",
    triggerProgress: 99,
    note: "Complete delivery and cut engine",
    status: "pending",
  });

  return commands;
}

function chooseDrone(
  fleet: DroneProfile[],
  weightKg: number,
  routeDistanceKm: number
): DroneProfile | null {
  const requiredRangeKm = routeDistanceKm * 1.4;

  const candidates = fleet
    .filter((drone) => {
      if (drone.status !== "Ready") return false;
      if (drone.maxPayloadKg < weightKg) return false;
      if (drone.maxRangeKm < requiredRangeKm) return false;
      if (drone.batteryPercent < 30) return false;
      return true;
    })
    .map((drone) => {
      const payloadSlack = drone.maxPayloadKg - weightKg;
      const rangeSlack = drone.maxRangeKm - requiredRangeKm;
      const score = payloadSlack * 0.35 + rangeSlack * 0.25 - drone.batteryPercent * 0.2 - drone.cruiseSpeedKmh * 0.2;
      return { drone, score };
    })
    .sort((a, b) => a.score - b.score);

  return candidates[0]?.drone ?? null;
}

export function useSimulation() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [aircraft, setAircraft] = useState<AircraftState>(initialAircraft);
  const [mission, setMission] = useState<MissionState>(initialMission);
  const [activeMissionOrderId, setActiveMissionOrderId] = useState<string | null>(null);
  const [droneFleet, setDroneFleet] = useState<DroneProfile[]>(initialDroneFleet);
  const [selectedDrone, setSelectedDrone] = useState<DroneProfile | null>(null);
  const [simulationInput, setSimulationInput] = useState<DeliverySimulationInput | null>(null);
  const [routeCommands, setRouteCommands] = useState<RouteCommand[]>([]);
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([]);
  const [activeDroneId, setActiveDroneId] = useState<string | null>(null);
  const [mqttState, setMqttState] = useState<MqttConnectionState>({
    enabled: MQTT_ENABLED,
    status: MQTT_ENABLED ? "connecting" : "disabled",
    brokerUrl: MQTT_URL,
    controlTopic: MQTT_CONTROL_TOPIC,
    statusTopic: MQTT_STATUS_TOPIC,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mqttClientRef = useRef<MqttClient | null>(null);

  const appendLog = useCallback((entry: Omit<CommandLogEntry, "id" | "timestamp">) => {
    setCommandLog((prev) => [
      {
        id: createId("log"),
        timestamp: new Date().toISOString(),
        ...entry,
      },
      ...prev,
    ].slice(0, 120));
  }, []);

  useEffect(() => {
    if (!MQTT_ENABLED) {
      setMqttState({
        enabled: false,
        status: "disabled",
        brokerUrl: MQTT_URL,
        controlTopic: MQTT_CONTROL_TOPIC,
        statusTopic: MQTT_STATUS_TOPIC,
      });
      return;
    }

    if (!MQTT_URL) {
      setMqttState({
        enabled: true,
        status: "error",
        brokerUrl: "",
        controlTopic: MQTT_CONTROL_TOPIC,
        statusTopic: MQTT_STATUS_TOPIC,
        lastError: "VITE_FLIGHT_MQTT_URL is empty.",
      });
      return;
    }

    const options: IClientOptions = {
      clientId: `${MQTT_CLIENT_ID}-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 6000,
      keepalive: MQTT_KEEPALIVE_SECONDS,
    };

    if (MQTT_USERNAME) {
      options.username = MQTT_USERNAME;
    }

    if (MQTT_PASSWORD) {
      options.password = MQTT_PASSWORD;
    }

    setMqttState((prev) => ({ ...prev, status: "connecting", lastError: undefined }));

    const client = mqtt.connect(MQTT_URL, options);
    mqttClientRef.current = client;

    client.on("connect", () => {
      setMqttState((prev) => ({ ...prev, status: "connected", lastError: undefined }));

      client.subscribe(MQTT_STATUS_TOPIC, { qos: MQTT_QOS }, (error) => {
        if (error) {
          setMqttState((prev) => ({ ...prev, status: "error", lastError: error.message }));
          appendLog({
            direction: "incoming",
            topic: MQTT_STATUS_TOPIC,
            payload: "",
            status: "failed",
            detail: `Status topic subscribe failed: ${error.message}`,
          });
          return;
        }

        appendLog({
          direction: "incoming",
          topic: MQTT_STATUS_TOPIC,
          payload: "",
          status: "received",
          detail: "Subscribed to ESP32 status feed",
        });
      });
    });

    client.on("reconnect", () => {
      setMqttState((prev) => ({ ...prev, status: "connecting" }));
    });

    client.on("close", () => {
      setMqttState((prev) => {
        if (prev.status === "error") {
          return prev;
        }
        return { ...prev, status: "connecting" };
      });
    });

    client.on("error", (error) => {
      setMqttState((prev) => ({ ...prev, status: "error", lastError: error.message }));
      appendLog({
        direction: "incoming",
        topic: MQTT_STATUS_TOPIC,
        payload: "",
        status: "failed",
        detail: `MQTT error: ${error.message}`,
      });
    });

    client.on("message", (topic, payload) => {
      appendLog({
        direction: "incoming",
        topic,
        payload: payload.toString(),
        status: "received",
      });
    });

    return () => {
      client.removeAllListeners();
      client.end(true);
      mqttClientRef.current = null;
    };
  }, [appendLog]);

  const publishFlightCommand = useCallback(
    async (command: Pick<RouteCommand, "action" | "command" | "value"> & { note?: string }) => {
      const payloadObject: Record<string, unknown> = {
        action: command.action,
        command: command.command,
        source: "simulation",
        timestamp: new Date().toISOString(),
      };

      if (typeof command.value === "number") {
        payloadObject.value = command.value;
      }

      const payload = JSON.stringify(payloadObject);

      if (!MQTT_ENABLED) {
        appendLog({
          direction: "outgoing",
          topic: MQTT_CONTROL_TOPIC,
          payload,
          status: "skipped",
          detail: "MQTT disabled in environment",
        });
        return { ok: false, skipped: true, reason: "MQTT disabled" };
      }

      const mqttClient = mqttClientRef.current;
      if (!mqttClient || !mqttClient.connected) {
        appendLog({
          direction: "outgoing",
          topic: MQTT_CONTROL_TOPIC,
          payload,
          status: "failed",
          detail: "MQTT client not connected",
        });
        return { ok: false, reason: "MQTT not connected" };
      }

      return new Promise<{ ok: boolean; skipped?: boolean; reason?: string }>((resolve) => {
        let settled = false;

        const timeoutHandle = globalThis.setTimeout(() => {
          if (settled) return;
          settled = true;

          appendLog({
            direction: "outgoing",
            topic: MQTT_CONTROL_TOPIC,
            payload,
            status: "failed",
            detail: "Publish timeout",
          });

          resolve({ ok: false, reason: "Publish timeout" });
        }, MQTT_PUBLISH_TIMEOUT_MS);

        mqttClient.publish(MQTT_CONTROL_TOPIC, payload, { qos: MQTT_QOS, retain: false }, (error) => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(timeoutHandle);

          if (error) {
            appendLog({
              direction: "outgoing",
              topic: MQTT_CONTROL_TOPIC,
              payload,
              status: "failed",
              detail: error.message,
            });

            resolve({ ok: false, reason: error.message });
            return;
          }

          appendLog({
            direction: "outgoing",
            topic: MQTT_CONTROL_TOPIC,
            payload,
            status: "sent",
            detail: command.note,
          });

          resolve({ ok: true });
        });
      });
    },
    [appendLog]
  );

  // Approve an order
  const approveOrder = useCallback((orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "Approved" as const } : o))
    );
  }, []);

  // Reject an order (remove it)
  const rejectOrder = useCallback((orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  }, []);

  // Add a new order
  const addOrder = useCallback((order: Order) => {
    setOrders((prev) => [...prev, order]);
  }, []);

  const startMission = useCallback(
    async (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order || order.status !== "Approved") return;
      if (activeMissionOrderId) return; // already flying

      const pickupCoord = locationCoordinates[order.pickup];
      const deliveryCoord = locationCoordinates[order.delivery];
      if (!pickupCoord || !deliveryCoord) return;

      // Generate aerial (straight-line) route for drone flight
      const coordinates = generateAerialRoute(pickupCoord, deliveryCoord);
      const distance = haversineDistance(pickupCoord, deliveryCoord);
      const droneSpeed = 42; // km/h
      const totalEta = Math.round((distance / droneSpeed) * 3600); // seconds

      const weight = parseFloat(order.weight) || 2.0;

      setSimulationInput(null);
      setSelectedDrone(null);
      setActiveDroneId(null);
      setRouteCommands([]);

      setActiveMissionOrderId(orderId);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "In Flight" as const } : o))
      );
      setAircraft((prev) => ({
        ...prev,
        status: "In Flight",
        payloadWeight: weight,
        speed: droneSpeed,
      }));
      setMission({
        progress: 0,
        elapsed: 0,
        eta: totalEta,
        distance,
        altitude: 150,
        speed: droneSpeed,
        routeProgress: 0,
        route: coordinates,
      });
    },
    [orders, activeMissionOrderId]
  );

  const runAutomatedSimulation = useCallback(
    async (input: DeliverySimulationInput): Promise<SimulationStartResult> => {
      if (activeMissionOrderId) {
        return { ok: false, message: "Another mission is already in progress." };
      }

      if (input.pickup === input.delivery) {
        return { ok: false, message: "Pickup and delivery locations must be different." };
      }

      const pickupCoord = locationCoordinates[input.pickup];
      const deliveryCoord = locationCoordinates[input.delivery];

      if (!pickupCoord || !deliveryCoord) {
        return { ok: false, message: "Selected locations are not available on the route map." };
      }

      const distance = haversineDistance(pickupCoord, deliveryCoord);
      const chosenDrone = chooseDrone(droneFleet, input.weightKg, distance);

      if (!chosenDrone) {
        return {
          ok: false,
          message: "No ready drone can safely carry this payload and route distance."
        };
      }

      const route = generateCurvedRoute(pickupCoord, deliveryCoord, 72);
      const speedBoost = input.priority === "Critical" ? 1.12 : input.priority === "Express" ? 1.06 : 1;
      const missionSpeed = Math.round(chosenDrone.cruiseSpeedKmh * speedBoost);
      const totalEta = Math.max(60, Math.round((distance / missionSpeed) * 3600));
      const commandPlan = buildRouteCommands(route, DEFAULT_THROTTLE_LEVEL);
      const missionId = `SIM-${Date.now().toString().slice(-6)}`;

      setSimulationInput(input);
      setSelectedDrone({ ...chosenDrone, status: "In Flight" });
      setActiveDroneId(chosenDrone.id);
      setRouteCommands(commandPlan);
      setCommandLog([]);

      setDroneFleet((prev) =>
        prev.map((drone) =>
          drone.id === chosenDrone.id
            ? { ...drone, status: "In Flight", batteryPercent: Math.max(drone.batteryPercent, 35) }
            : drone
        )
      );

      setActiveMissionOrderId(missionId);
      setAircraft((prev) => ({
        ...prev,
        status: "In Flight",
        payloadWeight: input.weightKg,
        maxPayload: chosenDrone.maxPayloadKg,
        battery: chosenDrone.batteryPercent,
        speed: missionSpeed,
        mode: "Auto",
      }));

      setMission({
        progress: 0,
        elapsed: 0,
        eta: totalEta,
        distance,
        altitude: 150,
        speed: missionSpeed,
        routeProgress: 0,
        route,
      });

      return {
        ok: true,
        message: `Drone ${chosenDrone.model} selected. Route and command plan initialized.`
      };
    },
    [activeMissionOrderId, droneFleet]
  );

  const clearCommandLog = useCallback(() => {
    setCommandLog([]);
  }, []);

  // Simulation tick - runs when a mission is active
  useEffect(() => {
    if (!activeMissionOrderId) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setMission((prev) => {
        const newProgress = Math.min(prev.progress + 1.5, 100);
        const newRouteProgress = newProgress / 100;
        const newElapsed = prev.elapsed + 1;
        const remainingFraction = 1 - newRouteProgress;
        const totalTime = prev.distance / (prev.speed / 3600);
        const newEta = Math.max(0, totalTime * remainingFraction);
        const altitudeVariation = 150 + Math.sin(newElapsed * 0.3) * 8;
        const speedVariation = 40 + Math.random() * 6;

        if (newProgress >= 100) {
          // Mission complete
          setOrders((prev) =>
            prev.map((o) =>
              o.id === activeMissionOrderId ? { ...o, status: "Delivered" as const } : o
            )
          );

          if (activeDroneId) {
            setDroneFleet((prev) =>
              prev.map((drone) =>
                drone.id === activeDroneId
                  ? { ...drone, status: "Ready", batteryPercent: Math.max(10, drone.batteryPercent - 6) }
                  : drone
              )
            );
            setSelectedDrone((drone) =>
              drone ? { ...drone, status: "Ready", batteryPercent: Math.max(10, drone.batteryPercent - 6) } : drone
            );
          }

          setAircraft((a) => ({ ...a, status: "Idle", payloadWeight: 0, speed: 0 }));
          setRouteCommands((prev) =>
            prev.map((command) =>
              command.status === "pending" || command.status === "sending"
                ? {
                    ...command,
                    status: "skipped",
                    sentAt: Date.now(),
                    failureReason: "Mission completed before dispatch",
                  }
                : command
            )
          );
          setActiveDroneId(null);
          setActiveMissionOrderId(null);
          return { ...prev, progress: 100, routeProgress: 1, eta: 0, speed: 0 };
        }

        return {
          ...prev,
          progress: newProgress,
          routeProgress: newRouteProgress,
          elapsed: newElapsed,
          eta: newEta,
          altitude: Math.round(altitudeVariation),
          speed: Math.round(speedVariation),
        };
      });

      // Battery drain
      setAircraft((prev) => ({
        ...prev,
        battery: Math.max(0, prev.battery - 0.08),
        signal: Math.min(100, Math.max(85, prev.signal + (Math.random() - 0.5) * 2)),
        satellites: Math.max(8, Math.min(14, prev.satellites + Math.round((Math.random() - 0.5) * 1))),
      }));

      if (activeDroneId) {
        setDroneFleet((prev) =>
          prev.map((drone) =>
            drone.id === activeDroneId
              ? { ...drone, status: "In Flight", batteryPercent: Math.max(0, drone.batteryPercent - 0.06) }
              : drone
          )
        );
        setSelectedDrone((drone) =>
          drone && drone.id === activeDroneId
            ? { ...drone, status: "In Flight", batteryPercent: Math.max(0, drone.batteryPercent - 0.06) }
            : drone
        );
      }
    }, 600); // tick every 600ms for visible updates

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeMissionOrderId, activeDroneId]);

  useEffect(() => {
    if (!activeMissionOrderId || routeCommands.length === 0) return;

    const dueCommands = routeCommands.filter(
      (command) => command.status === "pending" && mission.progress >= command.triggerProgress
    );

    if (dueCommands.length === 0) return;

    const dueIds = new Set(dueCommands.map((command) => command.id));
    setRouteCommands((prev) =>
      prev.map((command) =>
        dueIds.has(command.id) ? { ...command, status: "sending" } : command
      )
    );

    dueCommands.forEach((command) => {
      void (async () => {
        const result = await publishFlightCommand({
          action: command.action,
          command: command.command,
          value: command.value,
          note: command.note,
        });

        setRouteCommands((prev) =>
          prev.map((item) => {
            if (item.id !== command.id) return item;
            return {
              ...item,
              status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
              sentAt: Date.now(),
              failureReason: result.ok ? undefined : result.reason,
            };
          })
        );
      })();
    });
  }, [activeMissionOrderId, mission.progress, publishFlightCommand, routeCommands]);

  // Emergency stop - immediately halt the aircraft
  const emergencyStop = useCallback(() => {
    if (!activeMissionOrderId) return;

    void publishFlightCommand({
      action: "emergency_stop",
      command: "emergency stop",
      note: "Manual emergency stop triggered from control station",
    });

    if (intervalRef.current) clearInterval(intervalRef.current);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === activeMissionOrderId ? { ...o, status: "Pending" as const } : o
      )
    );

    if (activeDroneId) {
      setDroneFleet((prev) =>
        prev.map((drone) =>
          drone.id === activeDroneId ? { ...drone, status: "Ready" } : drone
        )
      );
      setSelectedDrone((drone) =>
        drone && drone.id === activeDroneId ? { ...drone, status: "Ready" } : drone
      );
      setActiveDroneId(null);
    }

    setRouteCommands((prev) =>
      prev.map((command) =>
        command.status === "pending" || command.status === "sending"
          ? {
              ...command,
              status: "skipped",
              sentAt: Date.now(),
              failureReason: "Mission aborted by emergency stop",
            }
          : command
      )
    );

    setAircraft((prev) => ({ ...prev, status: "Idle", payloadWeight: 0 }));
    setMission(initialMission);
    setActiveMissionOrderId(null);
  }, [activeMissionOrderId, activeDroneId, publishFlightCommand]);

  // Return to home - gracefully end mission
  const returnHome = useCallback(() => {
    if (!activeMissionOrderId) return;

    void publishFlightCommand({
      action: "throttle_down",
      command: "decrease throttle",
      value: Math.max(30, Math.round(DEFAULT_THROTTLE_LEVEL * 0.6)),
      note: "Return-to-home sequence requested",
    });

    // Speed up mission completion
    setMission((prev) => ({ ...prev, progress: 95 }));
  }, [activeMissionOrderId, publishFlightCommand]);

  // Toggle camera on/off
  const toggleCamera = useCallback(() => {
    setAircraft((prev) => ({ ...prev, cameraActive: !prev.cameraActive }));
  }, []);

  return {
    orders,
    aircraft,
    mission,
    activeMissionOrderId,
    droneFleet,
    selectedDrone,
    simulationInput,
    routeCommands,
    commandLog,
    mqttState,
    simulationLocations,
    approveOrder,
    rejectOrder,
    startMission,
    runAutomatedSimulation,
    addOrder,
    emergencyStop,
    returnHome,
    toggleCamera,
    clearCommandLog,
  };
}
