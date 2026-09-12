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

export const env = {
  backendUrl: (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, ""),
  webStudioUrl: getWebStudioUrl(),
  isDev: import.meta.env.DEV,
  appTitle: "LectureNotes AI",
};
