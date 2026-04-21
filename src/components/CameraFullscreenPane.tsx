import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Map, Video, VideoOff, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AircraftState } from "@/hooks/useSimulation";
import { buildCameraSourceCandidates } from "@/lib/cameraStream";
import { useObjectDetection } from "@/hooks/useObjectDetection";
import type { DetectedObject } from "@tensorflow-models/coco-ssd";

interface CameraFullscreenPaneProps {
  aircraft: AircraftState;
  onBackToMap: () => void;
  onToggleCamera?: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 0.2;

interface OverlayBox {
  key: string;
  label: string;
  confidence: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

const projectDetectionToViewport = (
  detection: DetectedObject,
  sourceWidth: number,
  sourceHeight: number,
  viewWidth: number,
  viewHeight: number,
  zoomLevel: number,
  index: number
): OverlayBox | null => {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }

  const [x, y, width, height] = detection.bbox;
  const coverScale = Math.max(viewWidth / sourceWidth, viewHeight / sourceHeight);
  const finalScale = coverScale * zoomLevel;

  const renderedWidth = sourceWidth * finalScale;
  const renderedHeight = sourceHeight * finalScale;

  const offsetLeft = (viewWidth - renderedWidth) / 2;
  const offsetTop = (viewHeight - renderedHeight) / 2;

  const rawLeft = offsetLeft + x * finalScale;
  const rawTop = offsetTop + y * finalScale;
  const rawRight = rawLeft + width * finalScale;
  const rawBottom = rawTop + height * finalScale;

  const clippedLeft = Math.max(0, rawLeft);
  const clippedTop = Math.max(0, rawTop);
  const clippedRight = Math.min(viewWidth, rawRight);
  const clippedBottom = Math.min(viewHeight, rawBottom);

  if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) {
    return null;
  }

  return {
    key: `${detection.class}-${index}-${Math.round(rawLeft)}-${Math.round(rawTop)}`,
    label: detection.class,
    confidence: Math.round((detection.score ?? 0) * 100),
    left: clippedLeft,
    top: clippedTop,
    width: clippedRight - clippedLeft,
    height: clippedBottom - clippedTop,
  };
};

const CameraFullscreenPane = ({ aircraft, onBackToMap, onToggleCamera }: CameraFullscreenPaneProps) => {
  const [cameraStreamError, setCameraStreamError] = useState(false);
  const [cameraStreamNonce, setCameraStreamNonce] = useState(0);
  const [cameraSourceCandidates, setCameraSourceCandidates] = useState<string[]>(() =>
    buildCameraSourceCandidates(aircraft.cameraStreamUrl, aircraft.cameraIp)
  );
  const [cameraSourceIndex, setCameraSourceIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1.2);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [sourceDimensions, setSourceDimensions] = useState({ width: 0, height: 0 });

  const streamViewportRef = useRef<HTMLDivElement | null>(null);
  const streamImageRef = useRef<HTMLImageElement | null>(null);

  const activeCameraSource = cameraSourceCandidates[cameraSourceIndex] ?? "";
  const hasCameraSource = activeCameraSource.length > 0;
  const cameraStreamSrc = hasCameraSource
    ? `${activeCameraSource}${activeCameraSource.includes("?") ? "&" : "?"}streamNonce=${cameraStreamNonce}`
    : "";

  const detectionEnabled = aircraft.cameraActive && hasCameraSource && !cameraStreamError;

  const {
    status: detectionStatus,
    detections,
    error: detectionError,
  } = useObjectDetection({
    enabled: detectionEnabled,
    sourceRef: streamImageRef,
    sourceKey: activeCameraSource,
    minScore: 0.45,
    maxDetections: 8,
    intervalMs: 450,
  });

  const overlayBoxes = useMemo(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return [];
    if (sourceDimensions.width <= 0 || sourceDimensions.height <= 0) return [];

    return detections
      .map((detection, index) =>
        projectDetectionToViewport(
          detection,
          sourceDimensions.width,
          sourceDimensions.height,
          viewportSize.width,
          viewportSize.height,
          zoomLevel,
          index
        )
      )
      .filter((item): item is OverlayBox => item != null);
  }, [detections, sourceDimensions.height, sourceDimensions.width, viewportSize.height, viewportSize.width, zoomLevel]);

  const uniqueDetectedLabels = useMemo(() => {
    const labels = [...new Set(overlayBoxes.map((box) => box.label))];
    return labels.slice(0, 4);
  }, [overlayBoxes]);

  useEffect(() => {
    const candidates = buildCameraSourceCandidates(aircraft.cameraStreamUrl, aircraft.cameraIp);
    setCameraSourceCandidates(candidates);
    setCameraSourceIndex(0);
    setCameraStreamError(false);
    setSourceDimensions({ width: 0, height: 0 });
  }, [aircraft.cameraIp, aircraft.cameraStreamUrl]);

  useEffect(() => {
    const node = streamViewportRef.current;
    if (!node) return;

    const updateViewport = () => {
      setViewportSize({ width: node.clientWidth, height: node.clientHeight });
    };

    updateViewport();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewport);
      return () => {
        window.removeEventListener("resize", updateViewport);
      };
    }

    const observer = new ResizeObserver(updateViewport);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!aircraft.cameraActive) {
      setZoomLevel(1.2);
    }
  }, [aircraft.cameraActive]);

  const handleRetryCameraStream = () => {
    setCameraSourceIndex(0);
    setCameraStreamError(false);
    setCameraStreamNonce((prev) => prev + 1);
    setSourceDimensions({ width: 0, height: 0 });
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
            <div className="text-[10px] text-muted-foreground/90">
              AI: {detectionStatus === "loading"
                ? "loading lightweight model"
                : detectionStatus === "error"
                ? "unavailable"
                : detectionStatus === "ready"
                ? `${overlayBoxes.length} object${overlayBoxes.length === 1 ? "" : "s"} detected`
                : "standby"}
            </div>
            {detectionStatus === "ready" && uniqueDetectedLabels.length > 0 && (
              <div className="text-[10px] text-aero-cyan truncate">
                {uniqueDetectedLabels.join(" • ")}
              </div>
            )}
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

      <div ref={streamViewportRef} className="h-full w-full flex items-center justify-center relative">
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
              ref={streamImageRef}
              src={cameraStreamSrc}
              alt="Aircraft camera full-screen feed"
              className="h-full w-full object-cover transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
              onLoad={(event) => {
                const image = event.currentTarget;
                setSourceDimensions({ width: image.naturalWidth, height: image.naturalHeight });
                setCameraStreamError(false);
              }}
              onError={handleCameraStreamError}
            />

            {overlayBoxes.length > 0 && (
              <div className="absolute inset-0 pointer-events-none z-10">
                {overlayBoxes.map((box) => (
                  <div
                    key={box.key}
                    className="absolute border-2 border-lime-400 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                    style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                  >
                    <div className="absolute -top-6 left-0 bg-black/80 border border-lime-400/60 px-1.5 py-0.5 rounded-sm text-[10px] font-mono text-lime-300 whitespace-nowrap">
                      {box.label} {box.confidence}%
                    </div>
                  </div>
                ))}
              </div>
            )}

            {detectionStatus === "error" && (
              <div className="absolute bottom-3 left-3 z-20 rounded-md border border-aero-warning/30 bg-black/70 px-2 py-1 text-[10px] text-aero-warning max-w-[70%]">
                AI detection unavailable for this stream. {detectionError ? `(${detectionError})` : ""}
              </div>
            )}
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
