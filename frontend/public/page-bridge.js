(() => {
  const findCaptionTracks = () => {
    try {
      const player = document.getElementById("movie_player");
      
      // 1. Check movie_player.getPlayerResponse()
      if (player && typeof player.getPlayerResponse === "function") {
        const resp = player.getPlayerResponse();
        const tracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (Array.isArray(tracks) && tracks.length > 0) return tracks;
      }

      // 2. Check movie_player.getOption("captions", "tracklist")
      if (player && typeof player.getOption === "function") {
        try {
          const optTracks = player.getOption("captions", "tracklist");
          if (Array.isArray(optTracks) && optTracks.length > 0) return optTracks;
        } catch {}
      }

      // 3. Check ytd-watch-flexy component data
      const flexy = document.querySelector("ytd-watch-flexy");
      if (flexy && flexy.playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        const tracks = flexy.playerData.captions.playerCaptionsTracklistRenderer.captionTracks;
        if (Array.isArray(tracks) && tracks.length > 0) return tracks;
      }

      // 4. Check window.ytInitialPlayerResponse
      if (window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        const tracks = window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
        if (Array.isArray(tracks) && tracks.length > 0) return tracks;
      }

      // 5. Scan script tags
      const scripts = document.querySelectorAll("script");
      for (const s of scripts) {
        const text = s.textContent || "";
        if (text.includes("ytInitialPlayerResponse") && text.includes("captionTracks")) {
          const m = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});(?:<\/script>|var\s+)/s) ||
                    text.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
          if (m) {
            try {
              const pr = JSON.parse(m[1]);
              const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
              if (Array.isArray(tracks) && tracks.length > 0) return tracks;
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn("[LectureNotes PageBridge] Error finding tracks:", e);
    }
    return [];
  };

  const attemptGetTracks = (videoId, callback, retries = 5) => {
    const tracks = findCaptionTracks();
    if (tracks.length > 0 || retries <= 0) {
      callback(tracks);
      return;
    }
    setTimeout(() => {
      attemptGetTracks(videoId, callback, retries - 1);
    }, 600);
  };

  window.addEventListener("message", (e) => {
    if (e.data?.type === "GET_YT_CAPTIONS_TRACK") {
      const videoId = e.data.videoId;
      attemptGetTracks(videoId, (tracks) => {
        window.postMessage(
          {
            type: "YT_CAPTIONS_TRACK_RESPONSE",
            videoId,
            tracks: tracks || [],
          },
          "*"
        );
      });
    }
  });

  // Listen for YouTube SPA video change
  document.addEventListener("yt-navigate-finish", () => {
    const vId = new URL(location.href).searchParams.get("v");
    if (vId) {
      setTimeout(() => {
        const tracks = findCaptionTracks();
        if (tracks.length > 0) {
          window.postMessage({ type: "YT_CAPTIONS_TRACK_RESPONSE", videoId: vId, tracks }, "*");
        }
      }, 800);
    }
  });
})();
