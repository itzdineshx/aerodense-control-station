import { useEffect, useState } from "react";
import { Camera, Map, Video, VideoOff, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AircraftState } from "@/hooks/useSimulation";
import { buildCameraSourceCandidates } from "@/lib/cameraStream";

interface CameraFullscreenPaneProps {
  aircraft: AircraftState;
  onBackToMap: () => void;
  onToggleCamera?: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 0.2;

const CameraFullscreenPane = ({ aircraft, onBackToMap, onToggleCamera }: CameraFullscreenPaneProps) => {
  const [cameraStreamError, setCameraStreamError] = useState(false);
  const [cameraStreamNonce, setCameraStreamNonce] = useState(0);
  const [cameraSourceCandidates, setCameraSourceCandidates] = useState<string[]>(() =>
    buildCameraSourceCandidates(aircraft.cameraStreamUrl, aircraft.cameraIp)
  );
  const [cameraSourceIndex, setCameraSourceIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1.2);

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

  useEffect(() => {
    if (!aircraft.cameraActive) {
      setZoomLevel(1.2);
    }
  }, [aircraft.cameraActive]);

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

  const zoomIn = () => {
    setZoomLevel((prev) => Math.min(MAX_ZOOM, Number((prev + ZOOM_STEP).toFixed(1))));
  };

  const zoomOut = () => {
    setZoomLevel((prev) => Math.max(MIN_ZOOM, Number((prev - ZOOM_STEP).toFixed(1))));
  };

  return (
    <div className="aero-panel flex-1 relative overflow-hidden bg-black">
      <div className="absolute top-3 left-3 right-3 z-20 rounded-md border border-border bg-background/85 backdrop-blur-sm p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-aero-cyan" />
              Camera Full Screen
            </div>
            <div className="text-[10px] text-muted-foreground truncate" title={activeCameraSource || "Set VITE_AIRCRAFT_CAMERA_IP in .env"}>
              Source: {activeCameraSource || "Set VITE_AIRCRAFT_CAMERA_IP in .env"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={zoomOut}
              className="h-7 text-xs"
              disabled={!aircraft.cameraActive}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={zoomIn}
              className="h-7 text-xs"
              disabled={!aircraft.cameraActive}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleCamera}
              className="h-7 text-xs"
            >
              {aircraft.cameraActive ? (
                <>
                  <VideoOff className="h-3.5 w-3.5" />
                  Stop
                </>
              ) : (
                <>
                  <Video className="h-3.5 w-3.5" />
                  Start
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onBackToMap}
              className="h-7 text-xs"
            >
              <Map className="h-3.5 w-3.5" />
              Map View
            </Button>
          </div>
        </div>
      </div>

      <div className="h-full w-full flex items-center justify-center">
        {!aircraft.cameraActive ? (
          <div className="text-center px-4">
            <p className="text-sm text-muted-foreground">Camera is currently off.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Press Start to show camera in full-screen map area.</p>
          </div>
        ) : !hasCameraSource ? (
          <div className="text-center px-4 text-muted-foreground text-sm">
            Set VITE_AIRCRAFT_CAMERA_IP or VITE_AIRCRAFT_CAMERA_STREAM_URL in .env.
          </div>
        ) : cameraStreamError ? (
          <div className="text-center px-4">
            <p className="text-sm text-aero-danger">Unable to load camera stream from the configured IP.</p>
            <Button size="sm" variant="secondary" className="h-8 text-xs mt-2" onClick={handleRetryCameraStream}>
              Retry Stream
            </Button>
          </div>
        ) : (
          <div className="h-full w-full overflow-hidden">
            <img
              src={cameraStreamSrc}
              alt="Aircraft camera full-screen feed"
              className="h-full w-full object-cover transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
              onLoad={() => setCameraStreamError(false)}
              onError={handleCameraStreamError}
            />
          </div>
        )}
      </div>

      {aircraft.cameraActive && (
        <div className="absolute bottom-3 right-3 rounded-md border border-border bg-background/85 px-2 py-1 text-[10px] font-mono text-muted-foreground z-20">
          Zoom: {zoomLevel.toFixed(1)}x
        </div>
      )}
    </div>
  );
};

export default CameraFullscreenPane;
