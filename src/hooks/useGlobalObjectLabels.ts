import { useEffect, useRef, useState, type RefObject } from "react";

type GlobalDetectionStatus = "idle" | "loading" | "ready" | "error";

export interface GlobalObjectLabel {
  label: string;
  confidence: number;
  isObstacle: boolean;
}

interface UseGlobalObjectLabelsOptions {
  enabled: boolean;
  sourceRef: RefObject<HTMLImageElement>;
  sourceKey?: string;
  apiKey?: string;
  model?: string;
  intervalMs?: number;
  maxLabels?: number;
}

interface UseGlobalObjectLabelsResult {
  status: GlobalDetectionStatus;
  labels: GlobalObjectLabel[];
  error: string | null;
}

const OBSTACLE_HINTS = [
  "person",
  "car",
  "truck",
  "bus",
  "bicycle",
  "motorcycle",
  "bird",
  "animal",
  "tree",
  "building",
  "pole",
  "wire",
  "boat",
  "aircraft",
  "drone",
  "helicopter",
  "tower",
  "vehicle",
  "obstacle",
];

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const extractJsonPayload = (rawText: string): string | null => {
  const fencedJson = rawText.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJson?.[1]) return fencedJson[1].trim();

  const fenced = rawText.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const plainObject = rawText.match(/\{[\s\S]*\}/);
  return plainObject?.[0]?.trim() ?? null;
};

const isObstacleLabel = (label: string): boolean => {
  const normalized = label.toLowerCase();
  return OBSTACLE_HINTS.some((hint) => normalized.includes(hint));
};

const normalizeLabels = (rawObjects: unknown, maxLabels: number): GlobalObjectLabel[] => {
  if (!Array.isArray(rawObjects)) return [];

  const labelMap = new Map<string, GlobalObjectLabel>();

  rawObjects.forEach((item) => {
    if (!item || typeof item !== "object") return;

    const labelValue = "label" in item ? item.label : undefined;
    if (typeof labelValue !== "string") return;

    const normalizedLabel = labelValue.trim();
    if (!normalizedLabel) return;

    const confidenceValue = "confidence" in item ? item.confidence : undefined;
    const confidenceNumber =
      typeof confidenceValue === "number" && Number.isFinite(confidenceValue)
        ? clamp(Math.round(confidenceValue), 0, 100)
        : 55;

    const explicitObstacle = "isObstacle" in item ? item.isObstacle : undefined;
    const obstacleFlag =
      typeof explicitObstacle === "boolean" ? explicitObstacle : isObstacleLabel(normalizedLabel);

    const key = normalizedLabel.toLowerCase();
    const existing = labelMap.get(key);

    if (!existing || confidenceNumber > existing.confidence) {
      labelMap.set(key, {
        label: normalizedLabel,
        confidence: confidenceNumber,
        isObstacle: obstacleFlag,
      });
    }
  });

  return [...labelMap.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxLabels);
};

const captureImageDataUrl = (image: HTMLImageElement): string | null => {
  if (!image.naturalWidth || !image.naturalHeight) {
    return null;
  }

  const maxSide = 640;
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
  const outputHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d", { willReadFrequently: false });
  if (!context) return null;

  context.drawImage(image, 0, 0, outputWidth, outputHeight);
  return canvas.toDataURL("image/jpeg", 0.62);
};

export const useGlobalObjectLabels = ({
  enabled,
  sourceRef,
  sourceKey,
  apiKey,
  model = "openai/gpt-4o-mini",
  intervalMs = 2600,
  maxLabels = 14,
}: UseGlobalObjectLabelsOptions): UseGlobalObjectLabelsResult => {
  const [status, setStatus] = useState<GlobalDetectionStatus>(enabled ? "loading" : "idle");
  const [labels, setLabels] = useState<GlobalObjectLabel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setLabels([]);
      setError(null);
      return;
    }

    if (!apiKey?.trim()) {
      setStatus("error");
      setLabels([]);
      setError("Missing OpenRouter API key.");
      return;
    }

    let cancelled = false;

    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleNext = (fn: () => void) => {
      timerRef.current = window.setTimeout(fn, intervalMs);
    };

    const runLoop = async () => {
      if (cancelled) return;

      const source = sourceRef.current;
      if (!source || source.naturalWidth === 0 || source.naturalHeight === 0) {
        scheduleNext(() => {
          void runLoop();
        });
        return;
      }

      const imageDataUrl = captureImageDataUrl(source);
      if (!imageDataUrl) {
        scheduleNext(() => {
          void runLoop();
        });
        return;
      }

      setStatus((prev) => (prev === "ready" ? "ready" : "loading"));

      const abortController = new AbortController();
      const timeoutHandle = window.setTimeout(() => abortController.abort(), 18000);

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": window.location.origin,
            "X-Title": "AeroDense Control Station",
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            max_tokens: 450,
            messages: [
              {
                role: "system",
                content:
                  "You are a vision assistant for drone navigation. Return strict JSON only with object labels found in the image. Include likely obstacles.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text:
                      "Detect as many visible objects as possible from this frame, including non-COCO classes. Respond ONLY as JSON with this schema: {\"objects\":[{\"label\":\"string\",\"confidence\":0-100,\"isObstacle\":true|false}] }",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: imageDataUrl,
                    },
                  },
                ],
              },
            ],
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`OpenRouter request failed (${response.status}).`);
        }

        const data = await response.json();
        const rawContent = data?.choices?.[0]?.message?.content;

        const textContent =
          typeof rawContent === "string"
            ? rawContent
            : Array.isArray(rawContent)
            ? rawContent
                .map((part) => {
                  if (typeof part === "string") return part;
                  if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
                    return part.text;
                  }
                  return "";
                })
                .join("\n")
            : "";

        const jsonPayload = extractJsonPayload(textContent);
        if (!jsonPayload) {
          throw new Error("No JSON payload returned by global detector.");
        }

        const parsed = JSON.parse(jsonPayload);
        const nextLabels = normalizeLabels(parsed?.objects, maxLabels);

        if (!cancelled) {
          setLabels(nextLabels);
          setStatus("ready");
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setStatus("error");
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Global object detection failed."
          );
        }
      } finally {
        window.clearTimeout(timeoutHandle);
      }

      if (!cancelled) {
        scheduleNext(() => {
          void runLoop();
        });
      }
    };

    void runLoop();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [enabled, sourceRef, sourceKey, apiKey, model, intervalMs, maxLabels]);

  return { status, labels, error };
};
