import { useState, useEffect, useRef } from "react";
import Map, { Marker } from "react-map-gl";
import type mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MissionState, RouteCommand } from "@/hooks/useSimulation";
import type { Order } from "@/components/OrdersPanel";

// Chennai area coordinates for drone delivery locations
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

// Chennai fallback coordinates
const CHENNAI_COORDS = { lat: 13.0827, lng: 80.2707 };

interface MapViewProps {
  mission: MissionState;
  isFlying: boolean;
  className?: string;
  selectedOrder?: Order | null;
  routeCommands?: RouteCommand[];
}

const MapView = ({ mission, isFlying, className, selectedOrder, routeCommands = [] }: MapViewProps) => {
  const [viewState, setViewState] = useState({
    longitude: CHENNAI_COORDS.lng,
    latitude: CHENNAI_COORDS.lat,
    zoom: 12,
  });
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [locationInitialized, setLocationInitialized] = useState(false);
  const missionFocusKeyRef = useRef<string | null>(null);

  // Get device GPS location, fallback to Chennai
  useEffect(() => {
    if (locationInitialized) return;

    let cancelled = false;
    const finishWithFallback = () => {
      if (cancelled) return;
      setLocationInitialized(true);
    };

    if (!("geolocation" in navigator)) {
      finishWithFallback();
      return () => {
        cancelled = true;
      };
    }

    const requestCurrentPosition = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return;
          setViewState((prev) => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
          setLocationInitialized(true);
        },
        (error) => {
          // Permission denial is a normal user choice; silently fallback to Chennai.
          if (error.code !== error.PERMISSION_DENIED) {
            console.info("Geolocation unavailable, using Chennai fallback:", error.message);
          }
          finishWithFallback();
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    };

    if (!navigator.permissions?.query) {
      requestCurrentPosition();
      return () => {
        cancelled = true;
      };
    }

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (cancelled) return;
        if (status.state === "denied") {
          finishWithFallback();
          return;
        }
        requestCurrentPosition();
      })
      .catch(() => {
        if (cancelled) return;
        requestCurrentPosition();
      });

    return () => {
      cancelled = true;
    };
  }, [locationInitialized]);

  // Calculate current position along route
  const currentPos = isFlying && mission.route.length > 0
    ? getPositionAlongRoute(mission.route, mission.routeProgress)
    : null;

  // Route GeoJSON
  const routeGeoJson = {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: mission.route,
    },
  };

  useEffect(() => {
    if (map && mission.route.length > 0) {
      // Add or update route source
      if (map.getSource('route')) {
        (map.getSource('route') as mapboxgl.GeoJSONSource).setData(routeGeoJson);
      } else {
        map.addSource('route', {
          type: 'geojson',
          data: routeGeoJson,
        });
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#00aaff',
            'line-width': 4,
            'line-opacity': isFlying ? 0.9 : 0.6,
          },
        });
      }
    }
  }, [map, mission.route, isFlying]);

  // Auto-zoom once per mission so the active simulation area is immediately visible.
  useEffect(() => {
    if (!map) return;

    if (!isFlying || mission.route.length === 0) {
      missionFocusKeyRef.current = null;
      return;
    }

    const first = mission.route[0];
    const last = mission.route[mission.route.length - 1];
    const focusKey = `${first[0].toFixed(5)}:${first[1].toFixed(5)}-${last[0].toFixed(5)}:${last[1].toFixed(5)}-${mission.route.length}`;

    if (missionFocusKeyRef.current === focusKey) {
      return;
    }

    missionFocusKeyRef.current = focusKey;

    if (mission.route.length === 1) {
      map.easeTo({
        center: [first[0], first[1]],
        zoom: 14.5,
        duration: 1200,
        essential: true,
      });
      return;
    }

    const [southWest, northEast] = getRouteBounds(mission.route);
    map.fitBounds([southWest, northEast], {
      padding: { top: 80, bottom: 80, left: 80, right: 80 },
      duration: 1200,
      maxZoom: 14.8,
      essential: true,
    });
  }, [isFlying, map, mission.route]);

  const pickupCoord = selectedOrder ? locationCoordinates[selectedOrder.pickup] : null;
  const deliveryCoord = selectedOrder ? locationCoordinates[selectedOrder.delivery] : null;
  const turnCommands = routeCommands
    .filter((command) => command.action === "turn_left" || command.action === "turn_right")
    .sort((a, b) => a.triggerProgress - b.triggerProgress);

  return (
    <div className={`aero-panel flex-1 relative overflow-hidden ${className || ""}`}>
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
        onLoad={(evt) => setMap(evt.target)}
      >
        {/* Pickup Marker */}
        {pickupCoord && (
          <Marker longitude={pickupCoord.lng} latitude={pickupCoord.lat}>
            <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-mono">
              PICKUP
            </div>
          </Marker>
        )}

        {/* Delivery Marker */}
        {deliveryCoord && (
          <Marker longitude={deliveryCoord.lng} latitude={deliveryCoord.lat}>
            <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-mono">
              DROP
            </div>
          </Marker>
        )}

        {/* Aircraft Marker */}
        {currentPos && (
          <Marker longitude={currentPos[0]} latitude={currentPos[1]}>
            <div className="text-2xl">🚁</div>
          </Marker>
        )}

        {/* Turn Direction Markers */}
        {mission.route.length > 1 &&
          turnCommands.map((command, index) => {
            const markerPos = getPositionAlongRoute(
              mission.route,
              Math.max(0, Math.min(1, command.triggerProgress / 100))
            );
            const isLeft = command.action === "turn_left";

            return (
              <Marker key={command.id} longitude={markerPos[0]} latitude={markerPos[1]}>
                <div
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border shadow-sm ${
                    isLeft
                      ? "bg-orange-500/90 text-white border-orange-300"
                      : "bg-blue-500/90 text-white border-blue-300"
                  } ${command.status === "failed" ? "opacity-55" : "opacity-95"}`}
                  style={{ transform: `translateY(-${8 + (index % 3) * 2}px)` }}
                  title={`${isLeft ? "LEFT" : "RIGHT"} @ ${command.triggerProgress}%`}
                >
                  {isLeft ? "L" : "R"}
                </div>
              </Marker>
            );
          })}
      </Map>

      {/* Status Overlay */}
      <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm rounded-lg p-3 text-sm font-mono">
        <div className="text-foreground">LAT {viewState.latitude.toFixed(4)}°</div>
        <div className="text-foreground">LON {viewState.longitude.toFixed(4)}°</div>
        <div className="text-foreground">ALT {mission.altitude}m</div>
        {turnCommands.length > 0 && (
          <div className="text-muted-foreground text-xs mt-1">
            Turns L/R: {turnCommands.filter((command) => command.action === "turn_left").length}/
            {turnCommands.filter((command) => command.action === "turn_right").length}
          </div>
        )}
      </div>
    </div>
  );
};

function getPositionAlongRoute(route: [number, number][], progress: number): [number, number] {
  if (route.length < 2) return route[0] || [0, 0];
  const totalSegments = route.length - 1;
  const segmentIndex = Math.floor(progress * totalSegments);
  const segmentProgress = (progress * totalSegments) % 1;
  const start = route[Math.min(segmentIndex, route.length - 1)];
  const end = route[Math.min(segmentIndex + 1, route.length - 1)];
  const lng = start[0] + (end[0] - start[0]) * segmentProgress;
  const lat = start[1] + (end[1] - start[1]) * segmentProgress;
  return [lng, lat];
}

function getRouteBounds(route: [number, number][]): [[number, number], [number, number]] {
  let minLng = route[0][0];
  let maxLng = route[0][0];
  let minLat = route[0][1];
  let maxLat = route[0][1];

  for (const [lng, lat] of route) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return [[minLng, minLat], [maxLng, maxLat]];
}

export default MapView;
