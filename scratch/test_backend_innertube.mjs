import fetch from 'node-fetch';

async function testInnerTube(videoId) {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '20.10.38',
          },
        },
        videoId,
      }),
    });
    const data = await res.json();
    console.log('Captions found:', Boolean(data?.captions?.playerCaptionsTracklistRenderer?.captionTracks));
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (tracks && tracks.length > 0) {
      console.log('Tracks:', tracks.map(t => ({ lang: t.languageCode, vssId: t.vssId })));
      const trackRes = await fetch(tracks[0].baseUrl);
      const xml = await trackRes.text();
      console.log('XML snippet:', xml.slice(0, 200));
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

testInnerTube('fmT5nIEkl3U');
