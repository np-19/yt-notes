(() => {
  let panelContainer = null;
  let panelIframe = null;
  let isPanelOpen = false;
  let pollInterval = null;
  let lastCachedVideoId = null; // avoid re-fetching same video

  const isExtensionValid = () => {
    try {
      return Boolean(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  };

  // ── Transcript helpers ──────────────────────────────────────────────────────

  const decodeEntities = (s) =>
    s.replace(/&amp;/g, "&")
     .replace(/&lt;/g, "<")
     .replace(/&gt;/g, ">")
     .replace(/&quot;/g, '"')
     .replace(/&#39;/g, "'")
     .replace(/&apos;/g, "'")
     .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
     .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));

  const parseXml = (xml, lang = "en") => {
    // Format 1: new YouTube XML → <p t="offsetMs" d="durMs"><s>word</s></p>
    const newResults = [];
    let m;
    const pRe = /<p\s+[^>]*\bt="(\d+)"[^>]*\bd="(\d+)"[^>]*>([\s\S]*?)<\/p>/gi;
    while ((m = pRe.exec(xml)) !== null) {
      const inner = m[3];
      let text = "";
      const sRe = /<s[^>]*>([^<]*)<\/s>/gi;
      let sm;
      while ((sm = sRe.exec(inner)) !== null) text += sm[1];
      if (!text) text = inner.replace(/<[^>]+>/g, "");
      text = decodeEntities(text).trim();
      if (text) newResults.push({ text, offset: parseInt(m[1], 10), duration: parseInt(m[2], 10), lang });
    }
    if (newResults.length > 0) return newResults;

    // Format 2: classic XML → <text start="s" dur="s">text</text>
    const classicResults = [];
    const cRe = /<text\s+start="([^"]*)"\s+dur="([^"]*)"[^>]*>([^<]*)<\/text>/gi;
    while ((m = cRe.exec(xml)) !== null) {
      const text = decodeEntities(m[3]).trim();
      if (text) classicResults.push({
        text,
        offset: Math.round(parseFloat(m[1]) * 1000),
        duration: Math.round(parseFloat(m[2]) * 1000),
        lang,
      });
    }
    return classicResults;
  };

  // Ask page-bridge.js (runs in MAIN world) for the caption track list
  const getCapTracks = (videoId) =>
    new Promise((resolve) => {
      let done = false;
      const handler = (e) => {
        if (e.data?.type === "YT_CAPTIONS_TRACK_RESPONSE" && e.data.videoId === videoId) {
          window.removeEventListener("message", handler);
          done = true;
          resolve(e.data.tracks || []);
        }
      };
      window.addEventListener("message", handler);
      window.postMessage({ type: "GET_YT_CAPTIONS_TRACK", videoId }, "*");
      setTimeout(() => {
        if (!done) { window.removeEventListener("message", handler); resolve([]); }
      }, 3000);
    });

  // Fetch transcript from YouTube and cache in chrome.storage
  const fetchAndCacheTranscript = async (videoId) => {
    if (!isExtensionValid() || !chrome.storage?.local) return;
    if (lastCachedVideoId === videoId) return; // already done this session
    lastCachedVideoId = videoId;

    try {
      const tracks = await getCapTracks(videoId);
      if (!tracks || tracks.length === 0) return;

      const chosen =
        tracks.find((t) => t.languageCode === "en" || t.vssId?.includes(".en")) ||
        tracks[0];
      if (!chosen?.baseUrl) return;

      const res = await fetch(chosen.baseUrl);
      if (!res.ok) return;

      const xml = await res.text();
      const transcript = parseXml(xml, chosen.languageCode || "en");
      if (transcript.length === 0) return;

      // Store so the panel + web app (via storage API) can read it
      chrome.storage.local.set({ [`transcript_${videoId}`]: transcript });

      // Immediately notify the iframe if it's waiting
      panelIframe?.contentWindow?.postMessage(
        { type: "CLIENT_TRANSCRIPT_RESULT", videoId, transcript },
        "*"
      );
    } catch (e) {
      // ignore — backend will try its own strategies
    }
  };

  // ── Panel helpers ───────────────────────────────────────────────────────────

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

      if (panelContainer) panelContainer.style.transform = "translateX(0)";
      isPanelOpen = true;

      const floatBtn = document.getElementById("lecture-notes-ai-button");
      if (floatBtn) {
        floatBtn.style.opacity = "0.7";
        floatBtn.textContent = "📖 Notes Open";
      }
    } catch (e) {
      console.warn("Failed to open side panel:", e);
    }
  };

  const closeSidePanel = () => {
    if (panelContainer) panelContainer.style.transform = "translateX(100%)";
    isPanelOpen = false;

    const floatBtn = document.getElementById("lecture-notes-ai-button");
    if (floatBtn) {
      floatBtn.style.opacity = "1";
      floatBtn.textContent = "✨ Generate Notes";
    }
  };

  // ── Global message handler ─────────────────────────────────────────────────
  // Single top-level listener — avoids duplicates from createSidePanel calls

  window.addEventListener("message", async (event) => {
    const { type, videoId: vId } = event.data || {};

    if (type === "CLOSE_LECTURE_PANEL") {
      closeSidePanel();
      return;
    }

    if (type === "REQUEST_CLIENT_TRANSCRIPT" && vId) {
      if (!isExtensionValid() || !chrome.storage?.local) return;

      const reply = (transcript) =>
        panelIframe?.contentWindow?.postMessage(
          { type: "CLIENT_TRANSCRIPT_RESULT", videoId: vId, transcript },
          "*"
        );

      // 1. Check chrome.storage cache first (fastest)
      try {
        const stored = await chrome.storage.local.get([`transcript_${vId}`]);
        const cached = stored[`transcript_${vId}`];
        if (Array.isArray(cached) && cached.length > 0) {
          reply(cached);
          return;
        }
      } catch (e) {}

      // 2. Not cached yet — fetch it now (fetchAndCacheTranscript will reply via postMessage when done)
      lastCachedVideoId = null; // reset so fetch runs even if called before
      await fetchAndCacheTranscript(vId);

      // 3. If still nothing, reply with empty so the panel doesn't hang
      try {
        const stored = await chrome.storage.local.get([`transcript_${vId}`]);
        const cached = stored[`transcript_${vId}`];
        reply(Array.isArray(cached) ? cached : []);
      } catch (e) {
        reply([]);
      }
    }
  });

  // ── Main init ──────────────────────────────────────────────────────────────

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

    const title =
      document.querySelector("h1.ytd-watch-metadata")?.textContent?.trim() ||
      document.title.replace(" - YouTube", "");
    const channel = document.querySelector("#channel-name a")?.textContent?.trim() || "";
    const currentVideo = { id, title, channel, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };

    try {
      if (chrome.storage?.local) chrome.storage.local.set({ currentVideo });
    } catch (e) {}

    // Proactively capture + cache transcript while user is on the page
    fetchAndCacheTranscript(id);

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
        const latestTitle =
          document.querySelector("h1.ytd-watch-metadata")?.textContent?.trim() || title;
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
