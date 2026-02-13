import { useState, useCallback } from "react";
import {
  Route,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Play,
  Save,
  X,
  Navigation,
  Clock,
  Ruler,
  ChevronRight,
  ChevronDown,
  Target,
  Flag,
  MoreVertical,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  altitude: number;
  action?: "hover" | "photo" | "drop" | "pickup" | "none";
}

export interface FlightRoute {
  id: string;
  name: string;
  description?: string;
  waypoints: Waypoint[];
  distance: number; // km
  estimatedTime: number; // minutes
  isActive: boolean;
  createdAt: string;
  color: string;
}

interface RoutesPanelProps {
  onRouteSelect?: (route: FlightRoute | null) => void;
  onPreviewRoute?: (route: FlightRoute | null) => void;
}

const locationCoordinates: Record<string, { lat: number; lng: number }> = {
  "Warehouse A": { lat: 13.0827, lng: 80.2707 }, // Chennai Central
  "Hospital B": { lat: 13.0604, lng: 80.2496 }, // Apollo Hospital area
  "Depot C": { lat: 13.0878, lng: 80.2785 }, // Parrys Corner
  "Office Park D": { lat: 13.0569, lng: 80.2425 }, // T Nagar
  "Kitchen Hub": { lat: 13.0475, lng: 80.2090 }, // Guindy
  "Residential Zone E": { lat: 13.1067, lng: 80.2206 }, // Anna Nagar
  "HQ Tower": { lat: 13.0843, lng: 80.2705 }, // Fort area
  "Branch Office F": { lat: 13.0108, lng: 80.2270 }, // Adyar
};

const initialRoutes: FlightRoute[] = [
  {
    id: "RT-001",
    name: "Medical Express",
    description: "Priority medical supply route",
    waypoints: [
      { id: "WP-001", name: "Warehouse A", ...locationCoordinates["Warehouse A"], altitude: 150, action: "pickup" },
      { id: "WP-002", name: "Checkpoint Alpha", lat: 13.0715, lng: 80.2601, altitude: 180, action: "none" },
      { id: "WP-003", name: "Hospital B", ...locationCoordinates["Hospital B"], altitude: 150, action: "drop" },
    ],
    distance: 2.8,
    estimatedTime: 8,
    isActive: true,
    createdAt: "2026-02-10",
    color: "#ef4444",
  },
  {
    id: "RT-002",
    name: "Office Circuit",
    description: "Daily office delivery loop",
    waypoints: [
      { id: "WP-004", name: "Depot C", ...locationCoordinates["Depot C"], altitude: 150, action: "pickup" },
      { id: "WP-005", name: "Office Park D", ...locationCoordinates["Office Park D"], altitude: 150, action: "drop" },
      { id: "WP-006", name: "HQ Tower", ...locationCoordinates["HQ Tower"], altitude: 150, action: "drop" },
    ],
    distance: 4.5,
    estimatedTime: 12,
    isActive: true,
    createdAt: "2026-02-08",
    color: "#3b82f6",
  },
  {
    id: "RT-003",
    name: "Residential Run",
    description: "Food delivery to residential areas",
    waypoints: [
      { id: "WP-007", name: "Kitchen Hub", ...locationCoordinates["Kitchen Hub"], altitude: 120, action: "pickup" },
      { id: "WP-008", name: "Residential Zone E", ...locationCoordinates["Residential Zone E"], altitude: 120, action: "drop" },
    ],
    distance: 7.5,
    estimatedTime: 18,
    isActive: false,
    createdAt: "2026-02-05",
    color: "#22c55e",
  },
];

const RoutesPanel = ({ onRouteSelect, onPreviewRoute }: RoutesPanelProps) => {
  const [routes, setRoutes] = useState<FlightRoute[]>(initialRoutes);
  const [selectedRoute, setSelectedRoute] = useState<FlightRoute | null>(null);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  const [editingWaypoint, setEditingWaypoint] = useState<string | null>(null);
  const [previewingRouteId, setPreviewingRouteId] = useState<string | null>(null);

  const handleSelectRoute = useCallback((route: FlightRoute) => {
    setSelectedRoute(route);
    onRouteSelect?.(route);
  }, [onRouteSelect]);

  const handleExpandRoute = (routeId: string) => {
    setExpandedRouteId(expandedRouteId === routeId ? null : routeId);
  };

  const handleTogglePreview = (route: FlightRoute) => {
    if (previewingRouteId === route.id) {
      setPreviewingRouteId(null);
      onPreviewRoute?.(null);
    } else {
      setPreviewingRouteId(route.id);
      onPreviewRoute?.(route);
    }
  };

  const handleCreateRoute = () => {
    if (!newRouteName.trim()) return;
    
    const newRoute: FlightRoute = {
      id: `RT-${String(routes.length + 1).padStart(3, "0")}`,
      name: newRouteName,
      waypoints: [],
      distance: 0,
      estimatedTime: 0,
      isActive: false,
      createdAt: new Date().toISOString().split("T")[0],
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    };
    
    setRoutes([...routes, newRoute]);
    setNewRouteName("");
    setIsCreating(false);
    setSelectedRoute(newRoute);
    setExpandedRouteId(newRoute.id);
  };

  const handleDeleteRoute = (routeId: string) => {
    setRoutes(routes.filter((r) => r.id !== routeId));
    if (selectedRoute?.id === routeId) {
      setSelectedRoute(null);
      onRouteSelect?.(null);
    }
    if (previewingRouteId === routeId) {
      setPreviewingRouteId(null);
      onPreviewRoute?.(null);
    }
  };

  const handleDuplicateRoute = (route: FlightRoute) => {
    const newRoute: FlightRoute = {
      ...route,
      id: `RT-${String(routes.length + 1).padStart(3, "0")}`,
      name: `${route.name} (Copy)`,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setRoutes([...routes, newRoute]);
  };

  const handleToggleActive = (routeId: string) => {
    setRoutes(routes.map((r) => 
      r.id === routeId ? { ...r, isActive: !r.isActive } : r
    ));
  };

  const handleAddWaypoint = (routeId: string) => {
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;

    const newWaypoint: Waypoint = {
      id: `WP-${Date.now()}`,
      name: `Waypoint ${route.waypoints.length + 1}`,
      lat: 13.05 + Math.random() * 0.07, // Chennai area
      lng: 80.20 + Math.random() * 0.08, // Chennai area
      altitude: 150,
      action: "none",
    };

    setRoutes(routes.map((r) =>
      r.id === routeId
        ? { ...r, waypoints: [...r.waypoints, newWaypoint] }
        : r
    ));
  };

  const handleDeleteWaypoint = (routeId: string, waypointId: string) => {
    setRoutes(routes.map((r) =>
      r.id === routeId
        ? { ...r, waypoints: r.waypoints.filter((w) => w.id !== waypointId) }
        : r
    ));
  };

  const getActionIcon = (action?: Waypoint["action"]) => {
    switch (action) {
      case "pickup":
        return <Flag className="h-3 w-3 text-blue-400" />;
      case "drop":
        return <Target className="h-3 w-3 text-green-400" />;
      case "photo":
        return <Eye className="h-3 w-3 text-purple-400" />;
      case "hover":
        return <Navigation className="h-3 w-3 text-yellow-400" />;
      default:
        return <MapPin className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            Route Management
          </h2>
          <Badge variant="outline" className="text-xs">
            {routes.length} Routes
          </Badge>
        </div>

        {/* Create Route */}
        {isCreating ? (
          <div className="flex gap-2">
            <Input
              value={newRouteName}
              onChange={(e) => setNewRouteName(e.target.value)}
              placeholder="Route name..."
              className="h-8 text-xs"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateRoute()}
            />
            <Button size="sm" onClick={handleCreateRoute} className="h-8 px-2">
              <Save className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)} className="h-8 px-2">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCreating(true)}
            className="w-full h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create New Route
          </Button>
        )}
      </div>

      {/* Routes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {routes.map((route) => (
          <div
            key={route.id}
            className={`aero-panel overflow-hidden transition-all ${
              selectedRoute?.id === route.id ? "ring-1 ring-primary/50" : ""
            }`}
          >
            {/* Route Header */}
            <div
              className="p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
              onClick={() => handleExpandRoute(route.id)}
            >
              <div className="flex items-center gap-2">
                {expandedRouteId === route.id ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: route.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {route.name}
                    </span>
                    {route.isActive && (
                      <Badge className="text-[9px] h-4 bg-aero-success/20 text-aero-success border-aero-success/30">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Ruler className="h-2.5 w-2.5" />
                      {route.distance} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {route.estimatedTime} min
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" />
                      {route.waypoints.length} pts
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-xs">
                    <DropdownMenuItem onClick={() => handleSelectRoute(route)}>
                      <Play className="h-3 w-3 mr-2" /> Select Route
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTogglePreview(route)}>
                      {previewingRouteId === route.id ? (
                        <><EyeOff className="h-3 w-3 mr-2" /> Hide Preview</>
                      ) : (
                        <><Eye className="h-3 w-3 mr-2" /> Preview on Map</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleActive(route.id)}>
                      <Navigation className="h-3 w-3 mr-2" />
                      {route.isActive ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicateRoute(route)}>
                      <Copy className="h-3 w-3 mr-2" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteRoute(route.id)}
                      className="text-aero-danger"
                    >
                      <Trash2 className="h-3 w-3 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Expanded Waypoints */}
            {expandedRouteId === route.id && (
              <div className="border-t border-border bg-secondary/20 p-3">
                {route.description && (
                  <p className="text-[10px] text-muted-foreground mb-3 italic">
                    {route.description}
                  </p>
                )}
                
                <div className="space-y-2">
                  {route.waypoints.map((waypoint, index) => (
                    <div
                      key={waypoint.id}
                      className="flex items-center gap-2 p-2 rounded bg-background/50 border border-border/50"
                    >
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        {index + 1}
                      </div>
                      {getActionIcon(waypoint.action)}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {waypoint.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {waypoint.lat.toFixed(4)}, {waypoint.lng.toFixed(4)} • {waypoint.altitude}m
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] capitalize">
                        {waypoint.action || "pass"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-aero-danger"
                        onClick={() => handleDeleteWaypoint(route.id, waypoint.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  {route.waypoints.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-2">
                      No waypoints defined
                    </p>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddWaypoint(route.id)}
                    className="w-full h-7 text-[10px] mt-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Waypoint
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {routes.length === 0 && (
          <div className="text-center py-8">
            <Route className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-xs text-muted-foreground">No routes created yet</p>
          </div>
        )}
      </div>

      {/* Selected Route Summary */}
      {selectedRoute && (
        <div className="p-4 border-t border-border bg-primary/5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-foreground">Selected Route</h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => {
                setSelectedRoute(null);
                onRouteSelect?.(null);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedRoute.color }}
            />
            <span className="text-xs font-medium text-foreground">{selectedRoute.name}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="p-1.5 rounded bg-background/50">
              <div className="font-bold text-foreground">{selectedRoute.distance} km</div>
              <div className="text-muted-foreground">Distance</div>
            </div>
            <div className="p-1.5 rounded bg-background/50">
              <div className="font-bold text-foreground">{selectedRoute.estimatedTime} min</div>
              <div className="text-muted-foreground">ETA</div>
            </div>
            <div className="p-1.5 rounded bg-background/50">
              <div className="font-bold text-foreground">{selectedRoute.waypoints.length}</div>
              <div className="text-muted-foreground">Waypoints</div>
            </div>
          </div>
          <Button size="sm" className="w-full mt-3 h-8 text-xs bg-primary">
            <Play className="h-3 w-3 mr-1.5" />
            Use This Route
          </Button>
        </div>
      )}
    </div>
  );
};

export default RoutesPanel;
