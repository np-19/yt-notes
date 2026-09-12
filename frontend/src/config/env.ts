const getWebStudioUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_WEB_STUDIO_URL || import.meta.env.VITE_FRONTEND_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  // If running in a web browser context (not chrome-extension or moz-extension)
  if (
    typeof window !== "undefined" &&
    window.location.protocol.startsWith("http")
  ) {
    return window.location.origin.replace(/\/+$/, "");
  }

  // Fallback for local extension development
  return "http://localhost:5173";
};

const sanitizeBackendUrl = (url?: string): string => {
  let u = (url || "http://localhost:5000").trim().replace(/\/+$/, "");
  // Fix accidental https:// on localhost
  if (u.startsWith("https://localhost") || u.startsWith("https://127.0.0.1")) {
    u = u.replace(/^https:/, "http:");
  }
  return u;
};

export const env = {
  backendUrl: sanitizeBackendUrl(import.meta.env.VITE_BACKEND_URL),
  webStudioUrl: getWebStudioUrl(),
  isDev: import.meta.env.DEV,
  appTitle: "LectureNotes AI",
};
