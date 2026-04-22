import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Map, Video, VideoOff, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AircraftState } from "@/hooks/useSimulation";
import { buildCameraSourceCandidates } from "@/lib/cameraStream";
import { useObjectDetection } from "@/hooks/useObjectDetection";
import { useGlobalObjectLabels } from "@/hooks/useGlobalObjectLabels";
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
  areaRatio: number;
  centerDistance: number;
}

type DetectionMode = "balanced" | "wide" | "obstacle" | "global";

const DETECTION_MODE_SETTINGS: Record<
  DetectionMode,
  { minScore: number; maxDetections: number; intervalMs: number; label: string }
> = {
  balanced: { minScore: 0.45, maxDetections: 12, intervalMs: 420, label: "Balanced" },
  wide: { minScore: 0.3, maxDetections: 22, intervalMs: 360, label: "Wide" },
  obstacle: { minScore: 0.28, maxDetections: 28, intervalMs: 300, label: "Obstacle" },
  global: { minScore: 0.24, maxDetections: 32, intervalMs: 280, label: "Global+" },
};

const OBSTACLE_PRIORITY_CLASSES = new Set([
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "bus",
  "truck",
  "train",
  "boat",
  "airplane",
  "bird",
  "dog",
  "cat",
]);

const isObstacleCandidate = (label: string): boolean => OBSTACLE_PRIORITY_CLASSES.has(label.toLowerCase());

const getThreatBand = (score: number): "low" | "medium" | "high" => {
  if (score >= 0.72) return "high";
  if (score >= 0.45) return "medium";
  return "low";
};

const getThreatLabel = (band: "low" | "medium" | "high"): string => {
  if (band === "high") return "Immediate obstacle";
  if (band === "medium") return "Potential obstacle";
  return "Low obstacle risk";
};

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

  const clippedWidth = clippedRight - clippedLeft;
  const clippedHeight = clippedBottom - clippedTop;
  const areaRatio = (clippedWidth * clippedHeight) / Math.max(1, viewWidth * viewHeight);

  const boxCenterX = clippedLeft + clippedWidth / 2;
  const boxCenterY = clippedTop + clippedHeight / 2;
  const dx = boxCenterX - viewWidth / 2;
  const dy = boxCenterY - viewHeight / 2;
  const diagonal = Math.sqrt(viewWidth * viewWidth + viewHeight * viewHeight) / 2;
  const centerDistance = Math.min(1, Math.sqrt(dx * dx + dy * dy) / Math.max(1, diagonal));

  return {
    key: `${detection.class}-${index}-${Math.round(rawLeft)}-${Math.round(rawTop)}`,
    label: detection.class,
    confidence: Math.round((detection.score ?? 0) * 100),
    left: clippedLeft,
    top: clippedTop,
    width: clippedWidth,
    height: clippedHeight,
    areaRatio,
    centerDistance,
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
  const [detectionMode, setDetectionMode] = useState<DetectionMode>("obstacle");
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
  const activeDetectionSettings = DETECTION_MODE_SETTINGS[detectionMode];
  const hasGlobalApiKey = Boolean(import.meta.env.VITE_OPENROUTER_API_KEY?.trim());
  const globalExpansionEnabled = detectionEnabled && detectionMode === "global" && hasGlobalApiKey;

  const {
    status: detectionStatus,
    detections,
    error: detectionError,
  } = useObjectDetection({
    enabled: detectionEnabled,
    sourceRef: streamImageRef,
    sourceKey: activeCameraSource,
    minScore: activeDetectionSettings.minScore,
    maxDetections: activeDetectionSettings.maxDetections,
    intervalMs: activeDetectionSettings.intervalMs,
  });

  const {
    status: globalStatus,
    labels: globalLabels,
    error: globalError,
  } = useGlobalObjectLabels({
    enabled: globalExpansionEnabled,
    sourceRef: streamImageRef,
    sourceKey: `${activeCameraSource}-${detectionMode}`,
    apiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
    intervalMs: 2600,
    maxLabels: 16,
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
    const labels = [
      ...overlayBoxes.map((box) => box.label),
      ...globalLabels.map((label) => label.label),
    ];
    return [...new Set(labels)].slice(0, 10);
  }, [globalLabels, overlayBoxes]);

  const topGlobalObstacle = useMemo(() => {
    const obstacleLabels = globalLabels
      .filter((label) => label.isObstacle)
      .sort((a, b) => b.confidence - a.confidence);
    return obstacleLabels[0] ?? null;
  }, [globalLabels]);

  const obstacleInsight = useMemo(() => {
    if (overlayBoxes.length === 0) return null;

    let top: { label: string; score: number; confidence: number } | null = null;

    for (const box of overlayBoxes) {
      const classWeight = isObstacleCandidate(box.label) ? 0.58 : 0.36;
      const sizeWeight = Math.min(1, box.areaRatio * 9.5);
      const centerWeight = 1 - box.centerDistance;
      const confidenceWeight = box.confidence / 100;
      const score =
        classWeight * 0.45 +
        sizeWeight * 0.25 +
        centerWeight * 0.2 +
        confidenceWeight * 0.1;

      if (!top || score > top.score) {
        top = { label: box.label, score, confidence: box.confidence };
      }
    }

    if (!top) return null;

    const band = getThreatBand(top.score);
    return {
      ...top,
      band,
      message: getThreatLabel(band),
    };
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
            <div className="text-[10px] text-muted-foreground/90">
              Mode: {activeDetectionSettings.label} • Threshold {(activeDetectionSettings.minScore * 100).toFixed(0)}% • Max {activeDetectionSettings.maxDetections}
            </div>
            {detectionMode === "global" && (
              <div className="text-[10px] text-muted-foreground/90">
                Global+: {hasGlobalApiKey
                  ? globalStatus === "loading"
                    ? "expanding labels"
                    : globalStatus === "ready"
                    ? `${globalLabels.length} extra labels`
                    : globalStatus === "error"
                    ? "unavailable"
                    : "standby"
                  : "set VITE_OPENROUTER_API_KEY"}
              </div>
            )}
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
        <div className="mt-2 flex items-center gap-1">
          {(Object.keys(DETECTION_MODE_SETTINGS) as DetectionMode[]).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={detectionMode === mode ? "secondary" : "outline"}
              className="h-6 px-2 text-[10px]"
              onClick={() => setDetectionMode(mode)}
              disabled={!aircraft.cameraActive || (mode === "global" && !hasGlobalApiKey)}
              title={mode === "global" && !hasGlobalApiKey ? "Set VITE_OPENROUTER_API_KEY" : undefined}
            >
              {DETECTION_MODE_SETTINGS[mode].label}
            </Button>
          ))}
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
                    className={`absolute border-2 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.35)] ${
                      isObstacleCandidate(box.label)
                        ? "border-orange-400"
                        : "border-lime-400"
                    }`}
                    style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                  >
                    <div
                      className={`absolute -top-6 left-0 bg-black/80 px-1.5 py-0.5 rounded-sm text-[10px] font-mono whitespace-nowrap ${
                        isObstacleCandidate(box.label)
                          ? "border border-orange-400/60 text-orange-300"
                          : "border border-lime-400/60 text-lime-300"
                      }`}
                    >
                      {box.label} {box.confidence}%
                    </div>
                  </div>
                ))}
              </div>
            )}

            {detectionStatus === "ready" && obstacleInsight && (
              <div
                className={`absolute bottom-3 left-3 z-20 rounded-md px-2 py-1 text-[10px] font-mono border ${
                  obstacleInsight.band === "high"
                    ? "bg-aero-danger/20 border-aero-danger/50 text-aero-danger"
                    : obstacleInsight.band === "medium"
                    ? "bg-aero-warning/20 border-aero-warning/50 text-aero-warning"
                    : "bg-aero-success/20 border-aero-success/50 text-aero-success"
                }`}
              >
                {obstacleInsight.message}: {obstacleInsight.label} ({obstacleInsight.confidence}%)
              </div>
            )}

            {detectionMode === "global" && globalStatus === "ready" && topGlobalObstacle && (
              <div className="absolute bottom-12 left-3 z-20 rounded-md px-2 py-1 text-[10px] font-mono border bg-aero-warning/20 border-aero-warning/50 text-aero-warning">
                Global obstacle class: {topGlobalObstacle.label} ({topGlobalObstacle.confidence}%)
              </div>
            )}

            {detectionStatus === "error" && (
              <div className="absolute bottom-3 left-3 z-20 rounded-md border border-aero-warning/30 bg-black/70 px-2 py-1 text-[10px] text-aero-warning max-w-[70%]">
                AI detection unavailable for this stream. {detectionError ? `(${detectionError})` : ""}
              </div>
            )}

            {detectionMode === "global" && globalStatus === "error" && (
              <div className="absolute bottom-12 right-3 z-20 rounded-md border border-aero-warning/30 bg-black/70 px-2 py-1 text-[10px] text-aero-warning max-w-[60%]">
                Global+ unavailable. {globalError ? `(${globalError})` : ""}
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
