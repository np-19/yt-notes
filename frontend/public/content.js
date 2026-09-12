(() => {
  let panelContainer = null;
  let panelIframe = null;
  let isPanelOpen = false;
  let pollInterval = null;

  const isExtensionValid = () => {
    try {
      return Boolean(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  };

  const createSidePanel = () => {
    if (!isExtensionValid()) return;
    if (document.getElementById("lecture-notes-panel-container")) return;

    panelContainer = document.createElement("div");
    panelContainer.id = "lecture-notes-panel-container";
    panelContainer.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 540px;
      max-width: 92vw;
      height: 100vh;
      z-index: 2147483646;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.35);
      background: #1c1917;
      display: flex;
      flex-direction: column;
    `;

    panelIframe = document.createElement("iframe");
    panelIframe.id = "lecture-notes-iframe";
    panelIframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: #ffffff;
    `;

    panelContainer.appendChild(panelIframe);
    document.body.appendChild(panelContainer);

    // Listen for messages from inside iframe
    window.addEventListener("message", async (event) => {
      if (event.data?.type === "CLOSE_LECTURE_PANEL") {
        closeSidePanel();
      } else if (event.data?.type === "REQUEST_CLIENT_TRANSCRIPT") {
        const vId = event.data?.videoId;
        if (vId) {
          const transcript = await fetchClientTranscript(vId);
          panelIframe?.contentWindow?.postMessage(
            {
              type: "CLIENT_TRANSCRIPT_RESULT",
              videoId: vId,
              transcript: transcript || [],
            },
            "*"
          );
        }
      }
    });
  };

  const openSidePanel = (videoId, videoTitle) => {
    if (!isExtensionValid()) {
      alert("Extension reloaded. Please refresh this YouTube page (F5) to use the latest version.");
      return;
    }

    createSidePanel();
    try {
      const targetUrl = chrome.runtime.getURL(
        `index.html#/sidepanel?v=${encodeURIComponent(videoId)}&title=${encodeURIComponent(videoTitle)}`
      );

      if (panelIframe && panelIframe.src !== targetUrl) {
        panelIframe.src = targetUrl;
      }

      if (panelContainer) {
        panelContainer.style.transform = "translateX(0)";
      }
      isPanelOpen = true;

      const floatBtn = document.getElementById("lecture-notes-ai-button");
      if (floatBtn) {
        floatBtn.style.opacity = "0.7";
        floatBtn.textContent = "📖 Notes Open";
      }

      // Pre-extract transcript
      fetchClientTranscript(videoId);
    } catch (e) {
      console.warn("Failed to open side panel:", e);
    }
  };

  const closeSidePanel = () => {
    if (panelContainer) {
      panelContainer.style.transform = "translateX(100%)";
    }
    isPanelOpen = false;

    const floatBtn = document.getElementById("lecture-notes-ai-button");
    if (floatBtn) {
      floatBtn.style.opacity = "1";
      floatBtn.textContent = "✨ Generate Notes";
    }
  };

  // Ask page-bridge (MAIN world) for internal player caption tracks
  const getTracksFromPageBridge = (videoId) => {
    return new Promise((resolve) => {
      const handler = (e) => {
        if (e.data?.type === "YT_CAPTIONS_TRACK_RESPONSE" && e.data.videoId === videoId) {
          window.removeEventListener("message", handler);
          resolve(e.data.tracks || []);
        }
      };
      window.addEventListener("message", handler);
      window.postMessage({ type: "GET_YT_CAPTIONS_TRACK", videoId }, "*");
      setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve([]);
      }, 1500);
    });
  };

  const parseTimedTextXml = (xml, lang = "en") => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");
      const textElements = Array.from(doc.querySelectorAll("text"));

      return textElements
        .map((el) => {
          const raw = el.textContent || "";
          return {
            text: raw
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .replace(/\n/g, " ")
              .trim(),
            offset: Math.round(parseFloat(el.getAttribute("start") || "0") * 1000),
            duration: Math.round(parseFloat(el.getAttribute("dur") || "0") * 1000),
            lang,
          };
        })
        .filter((entry) => Boolean(entry.text));
    } catch (err) {
      return [];
    }
  };

  const fetchClientTranscript = async (videoId) => {
    try {
      // 1. Try getting caption tracks via page bridge (playerResponse / movie_player)
      const tracks = await getTracksFromPageBridge(videoId);
      if (Array.isArray(tracks) && tracks.length > 0) {
        const chosen =
          tracks.find((t) => t.languageCode === "en" || t.vssId?.includes("en")) ||
          tracks[0];
        if (chosen && chosen.baseUrl) {
          const timedTextRes = await fetch(chosen.baseUrl);
          const xml = await timedTextRes.text();
          const parsed = parseTimedTextXml(xml, chosen.languageCode || "en");
          if (parsed.length > 0) {
            if (chrome.storage?.local) {
              chrome.storage.local.set({ [`transcript_${videoId}`]: parsed });
            }
            return parsed;
          }
        }
      }

      // 2. Fallback: fetch YouTube page directly in browser context
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { credentials: "omit" });
      const html = await pageRes.text();
      const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
      if (captionMatch) {
        const fallbackTracks = JSON.parse(captionMatch[1]);
        if (Array.isArray(fallbackTracks) && fallbackTracks.length > 0) {
          const chosen =
            fallbackTracks.find((t) => t.languageCode === "en" || t.vssId?.includes("en")) ||
            fallbackTracks[0];
          if (chosen && chosen.baseUrl) {
            const timedTextRes = await fetch(chosen.baseUrl);
            const xml = await timedTextRes.text();
            const parsed = parseTimedTextXml(xml, chosen.languageCode || "en");
            if (parsed.length > 0) {
              if (chrome.storage?.local) {
                chrome.storage.local.set({ [`transcript_${videoId}`]: parsed });
              }
              return parsed;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Client transcript extraction error:", e);
    }
    return null;
  };

  const initExtension = () => {
    if (!isExtensionValid()) {
      if (pollInterval) clearInterval(pollInterval);
      return;
    }

    const id = new URL(location.href).searchParams.get("v");
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
      document.getElementById("lecture-notes-ai-button")?.remove();
      closeSidePanel();
      return;
    }

    const title = document.querySelector("h1.ytd-watch-metadata")?.textContent?.trim() || document.title.replace(" - YouTube", "");
    const channel = document.querySelector("#channel-name a")?.textContent?.trim() || "";
    const currentVideo = { id, title, channel, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };

    try {
      if (chrome.storage?.local) {
        chrome.storage.local.set({ currentVideo });
      }
    } catch (e) {}

    // Extract caption track directly in browser where YouTube does not block residential IP
    fetchClientTranscript(id);

    createSidePanel();

    if (document.getElementById("lecture-notes-ai-button")) return;

    const button = document.createElement("button");
    button.id = "lecture-notes-ai-button";
    button.textContent = "✨ Generate Notes";
    button.setAttribute("aria-label", "Open LectureNotes AI for this video");
    button.style.cssText = `
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 2147483647;
      padding: 12px 20px;
      border: none;
      border-radius: 12px;
      background: #d97706;
      color: #ffffff;
      font: 600 14px system-ui, -apple-system, sans-serif;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      cursor: pointer;
      transition: transform 0.15s ease, background-color 0.15s ease, opacity 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    button.onmouseover = () => {
      button.style.backgroundColor = "#b45309";
      button.style.transform = "scale(1.04)";
    };
    button.onmouseout = () => {
      button.style.backgroundColor = "#d97706";
      button.style.transform = "scale(1)";
    };

    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isPanelOpen) {
        closeSidePanel();
      } else {
        const latestTitle = document.querySelector("h1.ytd-watch-metadata")?.textContent?.trim() || title;
        openSidePanel(id, latestTitle);
      }
    });

    document.body.appendChild(button);
  };

  let lastUrl = "";
  pollInterval = setInterval(() => {
    if (!isExtensionValid()) {
      clearInterval(pollInterval);
      return;
    }
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      initExtension();
    }
  }, 1000);

  initExtension();
})();
