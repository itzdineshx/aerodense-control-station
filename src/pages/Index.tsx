import { useState } from "react";
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
import type { Order } from "@/components/OrdersPanel";
import { useSimulation } from "@/hooks/useSimulation";

const Index = () => {
  const [activeModule, setActiveModule] = useState("orders");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const {
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
  } = useSimulation();

  // Keep selectedOrder in sync with simulation state
  const currentSelectedOrder = selectedOrder
    ? orders.find((o) => o.id === selectedOrder.id) || null
    : null;

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
                />
              </div>
              <MapView
                mission={mission}
                isFlying={!!activeMissionOrderId}
                className="flex-1"
                selectedOrder={currentSelectedOrder}
              />
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
