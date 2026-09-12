(() => {
  window.addEventListener("message", (e) => {
    if (e.data?.type === "GET_YT_CAPTIONS_TRACK") {
      try {
        const videoId = e.data.videoId;
        let playerResponse = window.ytInitialPlayerResponse;
        const player = document.getElementById("movie_player");

        if (player && typeof player.getPlayerResponse === "function") {
          const resp = player.getPlayerResponse();
          if (resp) playerResponse = resp;
        }

        let tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

        if ((!tracks || tracks.length === 0) && player && typeof player.getOption === "function") {
          try {
            const optTracks = player.getOption("captions", "tracklist");
            if (Array.isArray(optTracks) && optTracks.length > 0) {
              tracks = optTracks;
            }
          } catch (err) {}
        }

        window.postMessage(
          {
            type: "YT_CAPTIONS_TRACK_RESPONSE",
            videoId,
            tracks: tracks || [],
          },
          "*"
        );
      } catch (err) {
        window.postMessage(
          {
            type: "YT_CAPTIONS_TRACK_RESPONSE",
            videoId: e.data.videoId,
            tracks: [],
            error: err?.message,
          },
          "*"
        );
      }
    }
  });
})();
