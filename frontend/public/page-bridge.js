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

      // 3. Check window.ytInitialPlayerResponse
      if (window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        const tracks = window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
        if (Array.isArray(tracks) && tracks.length > 0) return tracks;
      }

      // 4. Scan script tags
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

  window.addEventListener("message", (e) => {
    if (e.data?.type === "GET_YT_CAPTIONS_TRACK") {
      const videoId = e.data.videoId;
      const tracks = findCaptionTracks();

      window.postMessage(
        {
          type: "YT_CAPTIONS_TRACK_RESPONSE",
          videoId,
          tracks: tracks || [],
        },
        "*"
      );
    }
  });
})();
