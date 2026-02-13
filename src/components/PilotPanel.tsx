import { useState } from "react";
import {
  User,
  Shield,
  Clock,
  Award,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Activity,
  CheckCircle,
  AlertCircle,
  Plane,
  Timer,
  TrendingUp,
  Star,
  FileText,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PilotInfo {
  id: string;
  name: string;
  callsign: string;
  avatar?: string;
  certificationLevel: number;
  status: "Available" | "On Mission" | "Off Duty" | "Training";
  flightHours: number;
  missionsCompleted: number;
  rating: number;
  email: string;
  phone: string;
  location: string;
  lastFlight: string;
  nextScheduled?: string;
}

interface PilotPanelProps {
  isFlying: boolean;
  activeMissionOrderId: string | null;
}

const pilots: PilotInfo[] = [
  {
    id: "PLT-001",
    name: "CPT. Elena Martinez",
    callsign: "Eagle-1",
    certificationLevel: 3,
    status: "Available",
    flightHours: 1247,
    missionsCompleted: 342,
    rating: 4.9,
    email: "e.martinez@aerosense.com",
    phone: "+1 (555) 234-5678",
    location: "San Francisco, CA",
    lastFlight: "2 hours ago",
    nextScheduled: "Today, 14:00",
  },
  {
    id: "PLT-002",
    name: "LT. James Chen",
    callsign: "Hawk-2",
    certificationLevel: 2,
    status: "On Mission",
    flightHours: 856,
    missionsCompleted: 198,
    rating: 4.7,
    email: "j.chen@aerosense.com",
    phone: "+1 (555) 345-6789",
    location: "San Francisco, CA",
    lastFlight: "Active",
  },
  {
    id: "PLT-003",
    name: "SGT. Maria Santos",
    callsign: "Falcon-3",
    certificationLevel: 2,
    status: "Training",
    flightHours: 423,
    missionsCompleted: 87,
    rating: 4.5,
    email: "m.santos@aerosense.com",
    phone: "+1 (555) 456-7890",
    location: "Oakland, CA",
    lastFlight: "Yesterday",
  },
];

const certifications = [
  { name: "Basic Flight Operations", completed: true, date: "2024-01-15" },
  { name: "Advanced Navigation", completed: true, date: "2024-03-22" },
  { name: "Emergency Procedures", completed: true, date: "2024-05-10" },
  { name: "Night Operations", completed: true, date: "2024-07-08" },
  { name: "Cargo Handling", completed: true, date: "2024-09-15" },
  { name: "Medical Transport", completed: false, date: null },
];

const recentFlights = [
  { id: "FLT-892", route: "Warehouse A → Hospital B", duration: "18 min", status: "Completed" },
  { id: "FLT-891", route: "Depot C → Office Park D", duration: "22 min", status: "Completed" },
  { id: "FLT-890", route: "Kitchen Hub → Residential E", duration: "15 min", status: "Completed" },
];

const PilotPanel = ({ isFlying, activeMissionOrderId }: PilotPanelProps) => {
  const [selectedPilot, setSelectedPilot] = useState<PilotInfo>(pilots[0]);
  const [activeTab, setActiveTab] = useState<"overview" | "certifications" | "history">("overview");

  const getStatusColor = (status: PilotInfo["status"]) => {
    switch (status) {
      case "Available":
        return "bg-aero-success/20 text-aero-success border-aero-success/30";
      case "On Mission":
        return "bg-aero-cyan/20 text-aero-cyan border-aero-cyan/30";
      case "Off Duty":
        return "bg-muted text-muted-foreground border-border";
      case "Training":
        return "bg-aero-warning/20 text-aero-warning border-aero-warning/30";
      default:
        return "";
    }
  };

  const completedCerts = certifications.filter((c) => c.completed).length;
  const certProgress = (completedCerts / certifications.length) * 100;

  // Update pilot status based on mission
  const currentPilotStatus = isFlying ? "On Mission" : selectedPilot.status;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Pilot Management
          </h2>
          <Badge variant="outline" className="text-xs">
            {pilots.filter((p) => p.status === "Available").length} Available
          </Badge>
        </div>

        {/* Pilot Selector */}
        <div className="space-y-2">
          {pilots.map((pilot) => (
            <button
              key={pilot.id}
              onClick={() => setSelectedPilot(pilot)}
              className={`w-full flex items-center gap-3 p-2 rounded-md transition-all ${
                selectedPilot.id === pilot.id
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-secondary/50 border border-transparent hover:bg-secondary"
              }`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={pilot.avatar} />
                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                  {pilot.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <div className="text-xs font-semibold text-foreground">{pilot.callsign}</div>
                <div className="text-[10px] text-muted-foreground">{pilot.name}</div>
              </div>
              <Badge variant="outline" className={`text-[10px] ${getStatusColor(pilot.id === selectedPilot.id && isFlying ? "On Mission" : pilot.status)}`}>
                {pilot.id === selectedPilot.id && isFlying ? "On Mission" : pilot.status}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["overview", "certifications", "history"] as const).map((tab) => (
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
        {activeTab === "overview" && (
          <>
            {/* Pilot Profile Card */}
            <div className="aero-panel p-4">
              <div className="flex items-start gap-3 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedPilot.avatar} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {selectedPilot.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{selectedPilot.name}</h3>
                    <Badge variant="outline" className={getStatusColor(currentPilotStatus)}>
                      {currentPilotStatus}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{selectedPilot.callsign} • {selectedPilot.id}</div>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${
                          i < Math.floor(selectedPilot.rating)
                            ? "text-aero-warning fill-aero-warning"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">{selectedPilot.rating}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span>{selectedPilot.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{selectedPilot.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{selectedPilot.location}</span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="aero-panel p-3 text-center">
                <Clock className="h-4 w-4 text-primary mx-auto mb-1" />
                <div className="text-lg font-bold text-foreground">{selectedPilot.flightHours.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">Flight Hours</div>
              </div>
              <div className="aero-panel p-3 text-center">
                <Plane className="h-4 w-4 text-aero-cyan mx-auto mb-1" />
                <div className="text-lg font-bold text-foreground">{selectedPilot.missionsCompleted}</div>
                <div className="text-[10px] text-muted-foreground">Missions</div>
              </div>
              <div className="aero-panel p-3 text-center">
                <Shield className="h-4 w-4 text-aero-success mx-auto mb-1" />
                <div className="text-lg font-bold text-foreground">Level {selectedPilot.certificationLevel}</div>
                <div className="text-[10px] text-muted-foreground">Certification</div>
              </div>
              <div className="aero-panel p-3 text-center">
                <TrendingUp className="h-4 w-4 text-aero-warning mx-auto mb-1" />
                <div className="text-lg font-bold text-foreground">98%</div>
                <div className="text-[10px] text-muted-foreground">Success Rate</div>
              </div>
            </div>

            {/* Schedule */}
            <div className="aero-panel p-3">
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                Schedule
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Flight</span>
                  <span className="text-foreground">{isFlying ? "Active Now" : selectedPilot.lastFlight}</span>
                </div>
                {selectedPilot.nextScheduled && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Scheduled</span>
                    <span className="text-aero-cyan">{selectedPilot.nextScheduled}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duty Status</span>
                  <span className="text-aero-success">On Duty</span>
                </div>
              </div>
            </div>

            {/* Current Mission */}
            {isFlying && (
              <div className="aero-panel p-3 border-aero-cyan/30 bg-aero-cyan/5">
                <h4 className="text-xs font-semibold text-aero-cyan mb-2 flex items-center gap-1.5">
                  <Radio className="h-3 w-3 animate-pulse" />
                  Active Mission
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mission ID</span>
                    <span className="text-foreground font-mono">{activeMissionOrderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aircraft</span>
                    <span className="text-foreground">AeroSense-01</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-aero-cyan">In Progress</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "certifications" && (
          <>
            {/* Certification Progress */}
            <div className="aero-panel p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Award className="h-3 w-3 text-aero-warning" />
                  Certification Progress
                </h4>
                <span className="text-xs text-muted-foreground">{completedCerts}/{certifications.length}</span>
              </div>
              <Progress value={certProgress} className="h-2 bg-secondary [&>div]:bg-aero-warning" />
            </div>

            {/* Certification List */}
            <div className="space-y-2">
              {certifications.map((cert, index) => (
                <div
                  key={index}
                  className={`aero-panel p-3 flex items-center gap-3 ${
                    cert.completed ? "" : "opacity-60"
                  }`}
                >
                  {cert.completed ? (
                    <CheckCircle className="h-4 w-4 text-aero-success shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="text-xs font-medium text-foreground">{cert.name}</div>
                    {cert.date && (
                      <div className="text-[10px] text-muted-foreground">
                        Completed: {new Date(cert.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {cert.completed && (
                    <Badge variant="outline" className="text-[10px] bg-aero-success/10 text-aero-success border-aero-success/30">
                      Certified
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            {/* Training Actions */}
            <div className="pt-2">
              <Button variant="outline" size="sm" className="w-full text-xs">
                <FileText className="h-3 w-3 mr-1.5" />
                Request New Certification
              </Button>
            </div>
          </>
        )}

        {activeTab === "history" && (
          <>
            {/* Flight History Stats */}
            <div className="aero-panel p-3">
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-primary" />
                This Month
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-foreground">28</div>
                  <div className="text-[10px] text-muted-foreground">Flights</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">42h</div>
                  <div className="text-[10px] text-muted-foreground">Duration</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-aero-success">100%</div>
                  <div className="text-[10px] text-muted-foreground">On-Time</div>
                </div>
              </div>
            </div>

            {/* Recent Flights */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Timer className="h-3 w-3 text-muted-foreground" />
                Recent Flights
              </h4>
              {recentFlights.map((flight) => (
                <div key={flight.id} className="aero-panel p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-primary">{flight.id}</span>
                    <Badge variant="outline" className="text-[10px] bg-aero-success/10 text-aero-success border-aero-success/30">
                      {flight.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-foreground">{flight.route}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Duration: {flight.duration}</div>
                </div>
              ))}
            </div>

            {/* View All */}
            <Button variant="outline" size="sm" className="w-full text-xs">
              View Complete History
            </Button>
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="h-9 text-xs">
            <Phone className="h-3.5 w-3.5 mr-1.5" />
            Contact
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Schedule
          </Button>
        </div>
        {!isFlying && selectedPilot.status === "Available" && (
          <Button size="sm" className="w-full h-9 text-xs bg-primary">
            <Plane className="h-3.5 w-3.5 mr-1.5" />
            Assign to Mission
          </Button>
        )}
      </div>
    </div>
  );
};

export default PilotPanel;
