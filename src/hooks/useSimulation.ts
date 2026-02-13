import { useState, useEffect, useCallback, useRef } from "react";
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

const initialAircraft: AircraftState = {
  battery: 87,
  payloadWeight: 0,
  maxPayload: 5.0,
  status: "Idle",
  signal: 98,
  satellites: 12,
  cameraActive: true,
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

const initialOrders: Order[] = [
  { id: "ORD-4821", packageType: "Medical Supplies", weight: "2.4 kg", pickup: "Warehouse A", delivery: "Hospital B", status: "Pending" },
  { id: "ORD-4822", packageType: "Electronics", weight: "1.8 kg", pickup: "Depot C", delivery: "Office Park D", status: "Pending" },
  { id: "ORD-4823", packageType: "Food Package", weight: "3.1 kg", pickup: "Kitchen Hub", delivery: "Residential Zone E", status: "Pending" },
  { id: "ORD-4824", packageType: "Documents", weight: "0.5 kg", pickup: "HQ Tower", delivery: "Branch Office F", status: "Pending" },
  { id: "ORD-4825", packageType: "Lab Samples", weight: "1.2 kg", pickup: "Lab Center G", delivery: "Research Facility H", status: "Pending" },
  { id: "ORD-4826", packageType: "Spare Parts", weight: "4.0 kg", pickup: "Factory I", delivery: "Maintenance Bay J", status: "Pending" },
];

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

export function useSimulation() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [aircraft, setAircraft] = useState<AircraftState>(initialAircraft);
  const [mission, setMission] = useState<MissionState>(initialMission);
  const [activeMissionOrderId, setActiveMissionOrderId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          setAircraft((a) => ({ ...a, status: "Idle", payloadWeight: 0, speed: 0 }));
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
    }, 600); // tick every 600ms for visible updates

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeMissionOrderId]);

  // Emergency stop - immediately halt the aircraft
  const emergencyStop = useCallback(() => {
    if (!activeMissionOrderId) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === activeMissionOrderId ? { ...o, status: "Pending" as const } : o
      )
    );
    setAircraft((prev) => ({ ...prev, status: "Idle", payloadWeight: 0 }));
    setMission(initialMission);
    setActiveMissionOrderId(null);
  }, [activeMissionOrderId]);

  // Return to home - gracefully end mission
  const returnHome = useCallback(() => {
    if (!activeMissionOrderId) return;
    // Speed up mission completion
    setMission((prev) => ({ ...prev, progress: 95 }));
  }, [activeMissionOrderId]);

  // Toggle camera on/off
  const toggleCamera = useCallback(() => {
    setAircraft((prev) => ({ ...prev, cameraActive: !prev.cameraActive }));
  }, []);

  return {
    orders,
    aircraft,
    mission,
    activeMissionOrderId,
    approveOrder,
    rejectOrder,
    startMission,
    addOrder,
    emergencyStop,
    returnHome,
    toggleCamera,
  };
}
