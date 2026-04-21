import { useEffect, useRef, useState, type RefObject } from "react";
import type { ObjectDetection, DetectedObject } from "@tensorflow-models/coco-ssd";

interface DetectionRuntime {
  tf: typeof import("@tensorflow/tfjs-core");
  cocoSsd: typeof import("@tensorflow-models/coco-ssd");
}

type DetectionStatus = "idle" | "loading" | "ready" | "error";

interface UseObjectDetectionOptions {
  enabled: boolean;
  sourceRef: RefObject<HTMLImageElement>;
  sourceKey?: string;
  minScore?: number;
  maxDetections?: number;
  intervalMs?: number;
}

interface UseObjectDetectionResult {
  status: DetectionStatus;
  detections: DetectedObject[];
  error: string | null;
}

let sharedModelPromise: Promise<ObjectDetection> | null = null;
let runtimePromise: Promise<DetectionRuntime> | null = null;

const loadRuntime = async (): Promise<DetectionRuntime> => {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      await import("@tensorflow/tfjs-backend-webgl");
      const [tf, cocoSsd] = await Promise.all([
        import("@tensorflow/tfjs-core"),
        import("@tensorflow-models/coco-ssd"),
      ]);

      return { tf, cocoSsd };
    })();
  }

  return runtimePromise;
};

const loadModel = async (): Promise<ObjectDetection> => {
  if (!sharedModelPromise) {
    sharedModelPromise = (async () => {
      const { tf, cocoSsd } = await loadRuntime();
      await tf.setBackend("webgl");
      await tf.ready();
      return cocoSsd.load({ base: "lite_mobilenet_v2" });
    })();
  }

  return sharedModelPromise;
};

export const useObjectDetection = ({
  enabled,
  sourceRef,
  sourceKey,
  minScore = 0.45,
  maxDetections = 10,
  intervalMs = 450,
}: UseObjectDetectionOptions): UseObjectDetectionResult => {
  const [status, setStatus] = useState<DetectionStatus>(enabled ? "loading" : "idle");
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setDetections([]);
      setError(null);
      return;
    }

    let cancelled = false;

    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const runDetectionLoop = async (model: ObjectDetection) => {
      const source = sourceRef.current;

      if (!source || source.naturalWidth === 0 || source.naturalHeight === 0) {
        timerRef.current = window.setTimeout(() => {
          void runDetectionLoop(model);
        }, intervalMs);
        return;
      }

      try {
        const nextDetections = await model.detect(source, maxDetections, minScore);
        if (cancelled) return;
        setDetections(nextDetections);
        setStatus("ready");
        setError(null);
      } catch (detectionError) {
        if (cancelled) return;
        setStatus("error");
        setDetections([]);
        setError(
          detectionError instanceof Error
            ? detectionError.message
            : "Object detection is unavailable for this stream."
        );
        return;
      }

      timerRef.current = window.setTimeout(() => {
        void runDetectionLoop(model);
      }, intervalMs);
    };

    setStatus("loading");
    setDetections([]);
    setError(null);

    loadModel()
      .then((model) => {
        if (cancelled) return;
        void runDetectionLoop(model);
      })
      .catch((modelError) => {
        if (cancelled) return;
        setStatus("error");
        setDetections([]);
        setError(
          modelError instanceof Error
            ? modelError.message
            : "Failed to load AI object detection model."
        );
      });

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [enabled, sourceKey, sourceRef, minScore, maxDetections, intervalMs]);

  return { status, detections, error };
};
