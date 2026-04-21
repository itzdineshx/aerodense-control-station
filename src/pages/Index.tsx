import { useEffect, useState } from "react";
import DashboardSidebar from "@/components/DashboardSidebar";
import SystemStatusBar from "@/components/SystemStatusBar";
import OrdersPanel from "@/components/OrdersPanel";
import MapView from "@/components/MapView";
import MissionPanel from "@/components/MissionPanel";
import AIAssistant from "@/components/AIAssistant";
import AircraftPanel from "@/components/AircraftPanel";
import PilotPanel from "@/components/PilotPanel";
import RoutesPanel from "@/components/RoutesPanel";
import SystemPanel from "@/components/SystemPanel";
import SimulationPanel from "@/components/SimulationPanel";
import CameraFullscreenPane from "@/components/CameraFullscreenPane";
import type { Order } from "@/components/OrdersPanel";
import { useSimulation } from "@/hooks/useSimulation";

const Index = () => {
  const [activeModule, setActiveModule] = useState("orders");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCameraFullscreen, setIsCameraFullscreen] = useState(false);

  const {
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
  } = useSimulation();

  // Keep selectedOrder in sync with simulation state
  const currentSelectedOrder = selectedOrder
    ? orders.find((o) => o.id === selectedOrder.id) || null
    : null;

  const simulationPreviewOrder: Order | null = simulationInput
    ? {
        id: "SIM-AUTO",
        packageType: simulationInput.packageType,
        weight: `${simulationInput.weightKg.toFixed(1)} kg`,
        pickup: simulationInput.pickup,
        delivery: simulationInput.delivery,
        status: activeMissionOrderId?.startsWith("SIM-") ? "In Flight" : "Approved",
      }
    : null;

  useEffect(() => {
    if (activeModule !== "aircraft") {
      setIsCameraFullscreen(false);
    }
  }, [activeModule]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <DashboardSidebar activeModule={activeModule} onModuleChange={setActiveModule} />

      <div className="flex-1 flex flex-col min-w-0">
        <SystemStatusBar aircraft={aircraft} />

        <div className="flex-1 flex min-h-0">
          {activeModule === "map" ? (
            <MapView
              mission={mission}
              isFlying={!!activeMissionOrderId}
              className="flex-1"
              selectedOrder={currentSelectedOrder}
              routeCommands={routeCommands}
            />
          ) : activeModule === "aircraft" ? (
            <>
              <div className="w-80 border-r border-border">
                <AircraftPanel
                  aircraft={aircraft}
                  mission={mission}
                  isFlying={!!activeMissionOrderId}
                  onEmergencyStop={emergencyStop}
                  onReturnHome={returnHome}
                  onToggleCamera={toggleCamera}
                  onOpenCameraFullscreen={() => setIsCameraFullscreen(true)}
                  onCloseCameraFullscreen={() => setIsCameraFullscreen(false)}
                  isCameraFullscreen={isCameraFullscreen}
                />
              </div>
              {isCameraFullscreen ? (
                <CameraFullscreenPane
                  aircraft={aircraft}
                  onToggleCamera={toggleCamera}
                  onBackToMap={() => setIsCameraFullscreen(false)}
                />
              ) : (
                <MapView
                  mission={mission}
                  isFlying={!!activeMissionOrderId}
                  className="flex-1"
                  selectedOrder={currentSelectedOrder}
                  routeCommands={routeCommands}
                />
              )}
            </>
          ) : activeModule === "pilot" ? (
            <>
              <div className="w-80 border-r border-border">
                <PilotPanel
                  isFlying={!!activeMissionOrderId}
                  activeMissionOrderId={activeMissionOrderId}
                />
              </div>
              <MapView
                mission={mission}
                isFlying={!!activeMissionOrderId}
                className="flex-1"
                selectedOrder={currentSelectedOrder}
                routeCommands={routeCommands}
              />
            </>
          ) : activeModule === "routes" ? (
            <>
              <div className="w-80 border-r border-border">
                <RoutesPanel />
              </div>
              <MapView
                mission={mission}
                isFlying={!!activeMissionOrderId}
                className="flex-1"
                selectedOrder={currentSelectedOrder}
                routeCommands={routeCommands}
              />
            </>
          ) : activeModule === "system" ? (
            <>
              <div className="w-80 border-r border-border">
                <SystemPanel aircraft={aircraft} />
              </div>
              <MapView
                mission={mission}
                isFlying={!!activeMissionOrderId}
                className="flex-1"
                selectedOrder={currentSelectedOrder}
                routeCommands={routeCommands}
              />
            </>
          ) : activeModule === "simulation" ? (
            <>
              <SimulationPanel
                locations={simulationLocations}
                droneFleet={droneFleet}
                selectedDrone={selectedDrone}
                mission={mission}
                isFlying={!!activeMissionOrderId}
                routeCommands={routeCommands}
                commandLog={commandLog}
                mqttState={mqttState}
                onRunSimulation={runAutomatedSimulation}
                onEmergencyStop={emergencyStop}
                onClearLog={clearCommandLog}
              />
              <MapView
                mission={mission}
                isFlying={!!activeMissionOrderId}
                className="flex-1"
                selectedOrder={simulationPreviewOrder || currentSelectedOrder}
                routeCommands={routeCommands}
              />
            </>
          ) : (
            <>
              <div className="w-72 border-r border-border">
                <OrdersPanel
                  orders={orders}
                  onSelectOrder={setSelectedOrder}
                  selectedOrderId={currentSelectedOrder?.id}
                  onAddOrder={addOrder}
                />
              </div>

              <div className="flex-1 flex flex-col min-w-0">
                <MapView
                  mission={mission}
                  isFlying={!!activeMissionOrderId}
                  selectedOrder={currentSelectedOrder}
                  routeCommands={routeCommands}
                />
              </div>

              <div className="border-l border-border">
                {activeModule === "ai" ? (
                  <AIAssistant />
                ) : (
                  <MissionPanel
                    selectedOrder={currentSelectedOrder}
                    aircraft={aircraft}
                    mission={mission}
                    isFlying={!!activeMissionOrderId}
                    activeMissionOrderId={activeMissionOrderId}
                    onApprove={() => currentSelectedOrder && approveOrder(currentSelectedOrder.id)}
                    onReject={() => currentSelectedOrder && rejectOrder(currentSelectedOrder.id)}
                    onStartMission={() => currentSelectedOrder && startMission(currentSelectedOrder.id)}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
