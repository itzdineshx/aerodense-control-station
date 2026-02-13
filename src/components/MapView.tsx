import { useState, useEffect } from "react";
import Map, { Marker } from "react-map-gl";
import type mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MissionState } from "@/hooks/useSimulation";
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
}

const MapView = ({ mission, isFlying, className, selectedOrder }: MapViewProps) => {
  const [viewState, setViewState] = useState({
    longitude: CHENNAI_COORDS.lng,
    latitude: CHENNAI_COORDS.lat,
    zoom: 12,
  });
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [locationInitialized, setLocationInitialized] = useState(false);

  // Get device GPS location, fallback to Chennai
  useEffect(() => {
    if (locationInitialized) return;

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setViewState((prev) => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
          setLocationInitialized(true);
        },
        (error) => {
          console.warn("Geolocation failed, using Chennai as fallback:", error.message);
          setLocationInitialized(true);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      console.warn("Geolocation not supported, using Chennai as fallback");
      setLocationInitialized(true);
    }
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

  const pickupCoord = selectedOrder ? locationCoordinates[selectedOrder.pickup] : null;
  const deliveryCoord = selectedOrder ? locationCoordinates[selectedOrder.delivery] : null;

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
      </Map>

      {/* Status Overlay */}
      <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm rounded-lg p-3 text-sm font-mono">
        <div className="text-foreground">LAT {viewState.latitude.toFixed(4)}°</div>
        <div className="text-foreground">LON {viewState.longitude.toFixed(4)}°</div>
        <div className="text-foreground">ALT {mission.altitude}m</div>
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

export default MapView;
