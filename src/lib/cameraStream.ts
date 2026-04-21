const CAMERA_FALLBACK_PATHS = ["/video", "/stream", "/mjpeg", "/video_feed"];

const ensureHttpProtocol = (raw: string): string => {
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
};

const stripTrailingSlash = (raw: string): string => raw.replace(/\/+$/, "");

export const buildCameraSourceCandidates = (cameraStreamUrl: string, cameraIp: string): string[] => {
  const candidates: string[] = [];

  const addCandidate = (value: string) => {
    const normalized = value.trim();
    if (!normalized || candidates.includes(normalized)) return;
    candidates.push(normalized);
  };

  const normalizedStreamUrl = ensureHttpProtocol(cameraStreamUrl.trim());
  if (normalizedStreamUrl) {
    addCandidate(normalizedStreamUrl);

    try {
      const parsed = new URL(normalizedStreamUrl);
      const base = `${parsed.protocol}//${parsed.host}`;
      const isRootPath = !parsed.pathname || parsed.pathname === "/";

      if (isRootPath) {
        CAMERA_FALLBACK_PATHS.forEach((path) => addCandidate(`${base}${path}`));
      }

      if (parsed.protocol === "https:") {
        const insecureBase = `http://${parsed.host}`;
        addCandidate(normalizedStreamUrl.replace(/^https:\/\//i, "http://"));
        if (isRootPath) {
          CAMERA_FALLBACK_PATHS.forEach((path) => addCandidate(`${insecureBase}${path}`));
        }
      }
    } catch {
      // Keep the original value if URL parsing fails.
    }
  }

  const normalizedCameraIp = ensureHttpProtocol(cameraIp.trim());
  if (normalizedCameraIp) {
    const base = stripTrailingSlash(normalizedCameraIp);
    addCandidate(base);
    CAMERA_FALLBACK_PATHS.forEach((path) => addCandidate(`${base}${path}`));
  }

  return candidates;
};
