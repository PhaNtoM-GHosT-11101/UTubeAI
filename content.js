// YouTube TurboScribe & AI Studio - Content Script
// Created by Aditya Priyadarshi

// 1. Playback Speed & Video Controls
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const video = document.querySelector('video');
  
  if (request.action === "ping") {
    sendResponse({ status: "ready" });
    return true;
  }

  if (!video) {
    sendResponse({ error: "No active video player found on this page." });
    return true;
  }

  switch (request.action) {
    case "getPlayState": {
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('v');
      const titleElement = document.querySelector('h1.ytd-watch-metadata, #container > h1 > yt-formatted-string');
      const title = titleElement ? titleElement.textContent.trim() : document.title.replace(" - YouTube", "");
      sendResponse({
        speed: video.playbackRate,
        videoId: videoId,
        title: title,
        currentTime: video.currentTime,
        paused: video.paused
      });
      break;
    }
    case "setSpeed": {
      const speed = parseFloat(request.speed);
      if (!isNaN(speed) && speed > 0) {
        // Limit custom speed to Chrome's architectural limit of 16x
        const finalSpeed = Math.min(speed, 16.0);
        video.playbackRate = finalSpeed;
        sendResponse({ success: true, speed: finalSpeed });
      } else {
        sendResponse({ success: false, error: "Invalid speed value." });
      }
      break;
    }
    case "seekTo": {
      const time = parseFloat(request.time);
      if (!isNaN(time)) {
        video.currentTime = time;
        if (video.paused) {
          video.play().catch(() => {});
        }
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Invalid time value." });
      }
      break;
    }
    case "fetchYtData": {
      // Retrieve transcript URLs and title by injecting a main-world reader script
      injectMainWorldReader((data) => {
        sendResponse({ success: true, data: data });
      });
      return true; // Keep message channel open for async response
    }
    default:
      sendResponse({ error: "Unknown action: " + request.action });
  }
  return true;
});

// 2. Main-World Script Injection for Captions
function injectMainWorldReader(callback) {
  const listenerName = 'YT_DATA_RESPONSE_' + Math.random().toString(36).substring(2, 9);
  
  const onResponse = (event) => {
    document.removeEventListener(listenerName, onResponse);
    callback(event.detail);
  };
  
  document.addEventListener(listenerName, onResponse);

  const script = document.createElement('script');
  script.textContent = `
    (function() {
      try {
        const player = document.querySelector('#movie_player');
        let playerResponse = null;
        
        if (player && typeof player.getPlayerResponse === 'function') {
          playerResponse = player.getPlayerResponse();
        } else if (window.ytInitialPlayerResponse) {
          playerResponse = window.ytInitialPlayerResponse;
        }

        const data = {
          captions: playerResponse?.captions || null,
          title: playerResponse?.videoDetails?.title || document.title,
          videoId: playerResponse?.videoDetails?.videoId || new URLSearchParams(window.location.search).get('v')
        };
        
        document.dispatchEvent(new CustomEvent('${listenerName}', { detail: data }));
      } catch (e) {
        document.dispatchEvent(new CustomEvent('${listenerName}', { detail: { error: e.message } }));
      }
    })();
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// 3. Ultra-Lightweight Auto Ad-Skipper
function initAdSkipper() {
  const skipAds = () => {
    const video = document.querySelector('video');
    const moviePlayer = document.querySelector('.html5-video-player');
    const isAdActive = moviePlayer && (moviePlayer.classList.contains('ad-showing') || moviePlayer.classList.contains('ad-interrupting'));
    
    // Detect and click skip buttons
    const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
    if (skipButton) {
      skipButton.click();
    }
    
    // Close overlay ads
    const overlayClose = document.querySelector('.ytp-ad-overlay-close-button');
    if (overlayClose) {
      overlayClose.click();
    }
    
    // Speed up and mute unskippable bumper/pre-roll ads
    if (isAdActive && video) {
      if (!video.dataset.adMuted) {
        video.dataset.adMuted = 'true';
        video.dataset.preAdMute = video.muted;
        video.dataset.preAdSpeed = video.playbackRate;
        video.muted = true;
      }
      if (video.playbackRate < 16.0) {
        video.playbackRate = 16.0;
      }
    } else if (video && video.dataset.adMuted === 'true') {
      // Ad ended: Restore regular speed and mute settings
      video.muted = video.dataset.preAdMute === 'true';
      video.playbackRate = parseFloat(video.dataset.preAdSpeed || '1.0');
      delete video.dataset.adMuted;
      delete video.dataset.preAdMute;
      delete video.dataset.preAdSpeed;
    }
  };

  // Run skip cycle every 300ms (ultra-light, near-zero CPU footprint)
  setInterval(skipAds, 300);
}

// Start ad skipper automatically
initAdSkipper();
