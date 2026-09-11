(() => {
  const getVideo = () => {
    const id = new URL(location.href).searchParams.get("v");
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    const title = document.querySelector("h1.ytd-watch-metadata")?.textContent?.trim() || document.title.replace(" - YouTube", "");
    const channel = document.querySelector("#channel-name a")?.textContent?.trim() || "";
    const currentVideo = { id, title, channel, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    chrome.storage.local.set({ currentVideo });
    document.getElementById("lecture-notes-ai-button")?.remove();
    const button = document.createElement("button");
    button.id = "lecture-notes-ai-button";
    button.textContent = "✨ Generate Notes";
    button.setAttribute("aria-label", "Open LectureNotes AI for this video");
    button.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:2147483647;padding:12px 18px;border:0;border-radius:10px;background:#e85d3f;color:#fff;font:600 14px system-ui;box-shadow:0 8px 24px #0003;cursor:pointer";
    button.addEventListener("click", () => { chrome.storage.local.set({ currentVideo }, () => window.open(chrome.runtime.getURL("index.html"), "_blank", "noopener")); });
    document.body.appendChild(button);
  };
  let lastUrl = "";
  setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; getVideo(); } }, 750);
  getVideo();
})();
