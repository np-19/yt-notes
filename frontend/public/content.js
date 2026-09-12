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

    // Listen for close messages from inside iframe
    window.addEventListener("message", (event) => {
      if (event.data?.type === "CLOSE_LECTURE_PANEL") {
        closeSidePanel();
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

  const fetchClientTranscript = async (videoId) => {
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { credentials: "omit" });
      const html = await pageRes.text();
      const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
      if (!captionMatch) return null;

      const tracks = JSON.parse(captionMatch[1]);
      if (!Array.isArray(tracks) || tracks.length === 0) return null;

      const chosen =
        tracks.find((t) => t.languageCode === "en" || t.vssId?.includes("en")) ||
        tracks[0];

      if (!chosen || !chosen.baseUrl) return null;

      const timedTextRes = await fetch(chosen.baseUrl);
      const xml = await timedTextRes.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");
      const textElements = Array.from(doc.querySelectorAll("text"));

      const transcript = textElements
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
            lang: chosen.languageCode || "en",
          };
        })
        .filter((entry) => Boolean(entry.text));

      if (transcript.length > 0) {
        if (chrome.storage?.local) {
          chrome.storage.local.set({ [`transcript_${videoId}`]: transcript });
        }
        return transcript;
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
    
    button.onmouseover = () => { button.style.backgroundColor = "#b45309"; button.style.transform = "scale(1.04)"; };
    button.onmouseout = () => { button.style.backgroundColor = "#d97706"; button.style.transform = "scale(1)"; };

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
