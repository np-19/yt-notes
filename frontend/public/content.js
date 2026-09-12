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

  const decodeEntities = (text) => {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
  };

  const parseTranscriptXml = (xml, lang = "en") => {
    try {
      const results = [];
      // 1. Try srv3 format (<p t="ms" d="ms"><s>word</s>...</p>)
      const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
      let match;
      while ((match = pRegex.exec(xml)) !== null) {
        const startMs = parseInt(match[1], 10);
        const durMs = parseInt(match[2], 10);
        const inner = match[3];
        let text = "";
        const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
        let sMatch;
        while ((sMatch = sRegex.exec(inner)) !== null) {
          text += sMatch[1];
        }
        if (!text) {
          text = inner.replace(/<[^>]+>/g, "");
        }
        text = decodeEntities(text).trim();
        if (text) {
          results.push({
            text,
            duration: durMs,
            offset: startMs,
            lang,
          });
        }
      }
      if (results.length > 0) return results;

      // 2. Fall back to classic format (<text start="s" dur="s">content</text>)
      const RE_XML_TRANSCRIPT = /<text\s+start="([^"]*)"\s+dur="([^"]*)"[^>]*>([^<]*)<\/text>/g;
      const classicResults = [...xml.matchAll(RE_XML_TRANSCRIPT)];
      return classicResults
        .map((res) => ({
          text: decodeEntities(res[3]).trim(),
          duration: Math.round(parseFloat(res[2]) * 1000),
          offset: Math.round(parseFloat(res[1]) * 1000),
          lang,
        }))
        .filter((e) => Boolean(e.text));
    } catch (err) {
      console.warn("Failed to parse transcript XML:", err);
      return [];
    }
  };

  const fetchClientTranscript = async (videoId) => {
    try {
      // Strategy 1: YouTube InnerTube API (Android client)
      try {
        const resp = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: "ANDROID",
                clientVersion: "20.10.38",
              },
            },
            videoId,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (Array.isArray(captionTracks) && captionTracks.length > 0) {
            const chosen =
              captionTracks.find((t) => t.languageCode === "en" || t.vssId?.includes("en")) ||
              captionTracks[0];
            if (chosen && chosen.baseUrl) {
              const xmlRes = await fetch(chosen.baseUrl);
              const xml = await xmlRes.text();
              const parsed = parseTranscriptXml(xml, chosen.languageCode || "en");
              if (parsed.length > 0) {
                if (chrome.storage?.local) {
                  chrome.storage.local.set({ [`transcript_${videoId}`]: parsed });
                }
                return parsed;
              }
            }
          }
        }
      } catch (err) {
        console.warn("InnerTube transcript fetch error:", err);
      }

      // Strategy 2: Request from Page Bridge
      try {
        const tracks = await getTracksFromPageBridge(videoId);
        if (Array.isArray(tracks) && tracks.length > 0) {
          const chosen =
            tracks.find((t) => t.languageCode === "en" || t.vssId?.includes("en")) ||
            tracks[0];
          if (chosen && chosen.baseUrl) {
            const timedTextRes = await fetch(chosen.baseUrl);
            const xml = await timedTextRes.text();
            const parsed = parseTranscriptXml(xml, chosen.languageCode || "en");
            if (parsed.length > 0) {
              if (chrome.storage?.local) {
                chrome.storage.local.set({ [`transcript_${videoId}`]: parsed });
              }
              return parsed;
            }
          }
        }
      } catch (err) {
        console.warn("Page bridge transcript fetch error:", err);
      }

      // Strategy 3: Direct Web Page fallback
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
            const parsed = parseTranscriptXml(xml, chosen.languageCode || "en");
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

      // Pre-extract transcript immediately
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

    // Extract caption track directly in browser
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
