// YouTube TurboScribe & AI Studio - Side Panel Logic
// Created by Aditya Priyadarshi

const DEFAULT_API_KEY = "AIzaSyBUyQUhvSXc6nhliaqN3BhQURdVhO7M6OE";
const GEMINI_MODEL = "models/gemini-1.5-flash";

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
  currentTabId: null,
  title: "",
  videoId: "",
  transcriptSegments: [],
  transcriptText: "",
  summaryGenerated: false,
  chatHistory: [],
  geminiApiKey: DEFAULT_API_KEY,
};

// ─── DOM References ──────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const elements = {
  videoTitle: $("#text-video-title"),
  pulseIndicator: $(".pulse-indicator"),
  currentSpeed: $("#text-current-speed"),
  speedSlider: $("#slider-speed"),
  customSpeedInput: $("#input-custom-speed"),
  setCustomSpeedBtn: $("#btn-set-custom-speed"),
  presetBtns: $$(".preset-btn"),
  transcriptList: $("#transcript-list"),
  transcriptSearch: $("#input-transcript-search"),
  clearSearchBtn: $("#btn-clear-search"),
  downloadTranscriptBtn: $("#btn-download-transcript"),
  summaryViewer: $("#summary-viewer"),
  generateSummaryBtn: $("#btn-generate-summary"),
  chatMessages: $("#chat-messages"),
  chatInput: $("#input-chat"),
  sendChatBtn: $("#btn-send-chat"),
  tabBtns: $$(".tab-btn"),
  tabPanes: $$(".tab-pane"),
  settingsPanel: $("#panel-settings"),
  settingsBtn: $("#btn-settings"),
  inputApiKey: $("#input-api-key"),
  toggleKeyVisibility: $("#btn-toggle-key-visibility"),
  saveSettingsBtn: $("#btn-save-settings"),
  resetSettingsBtn: $("#btn-reset-settings"),
  settingsStatus: $("#settings-status"),
};

// ─── Initialization ──────────────────────────────────────────────────────────
async function init() {
  await restoreSettings();
  updateVideoInfo();
  setupEventListeners();
  setupSpeedSync();
}

// ─── Tab & Content Script Communication ──────────────────────────────────────
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(action, payload = {}) {
  try {
    const tab = await getCurrentTab();
    if (!tab) return { error: "No active tab" };
    return await chrome.tabs.sendMessage(tab.id, { action, ...payload });
  } catch (e) {
    return { error: e.message };
  }
}

async function updateVideoInfo() {
  const tab = await getCurrentTab();
  if (!tab || !tab.url?.includes("youtube.com/watch")) {
    elements.videoTitle.textContent = "Open a YouTube video to begin";
    elements.pulseIndicator.className = "pulse-indicator red-pulse";
    return;
  }

  state.currentTabId = tab.id;
  const res = await sendToContent("ping");
  if (res && res.status === "ready") {
    elements.pulseIndicator.className = "pulse-indicator green-pulse";
    const playState = await sendToContent("getPlayState");
    if (playState && !playState.error) {
      state.title = playState.title || "YouTube Video";
      state.videoId = playState.videoId || "";
      elements.videoTitle.textContent = state.title;
      elements.currentSpeed.textContent = parseFloat(playState.speed).toFixed(2) + "x";
      elements.speedSlider.value = Math.min(parseFloat(playState.speed), 4);
      // Auto-fetch transcript data
      fetchTranscriptData();
    }
  } else {
    elements.videoTitle.textContent = "Please refresh the YouTube tab";
    elements.pulseIndicator.className = "pulse-indicator red-pulse";
  }
}

// ─── Playback Speed ──────────────────────────────────────────────────────────
function setupSpeedSync() {
  // Slider
  elements.speedSlider.addEventListener("input", () => {
    const speed = parseFloat(elements.speedSlider.value);
    elements.currentSpeed.textContent = speed.toFixed(2) + "x";
    highlightPreset(speed);
    sendToContent("setSpeed", { speed });
  });

  // Preset buttons
  elements.presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const speed = parseFloat(btn.dataset.speed);
      setAndDisplaySpeed(speed);
    });
  });

  // Custom speed input
  elements.setCustomSpeedBtn.addEventListener("click", () => {
    const raw = elements.customSpeedInput.value.trim();
    if (!raw) return;
    const speed = Math.min(parseFloat(raw), 16.0);
    if (!isNaN(speed) && speed > 0) {
      setAndDisplaySpeed(speed);
      elements.customSpeedInput.value = speed.toString();
    }
  });

  elements.customSpeedInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      elements.setCustomSpeedBtn.click();
    }
  });
}

function setAndDisplaySpeed(speed) {
  const clamped = Math.min(speed, 16.0);
  elements.currentSpeed.textContent = clamped.toFixed(2) + "x";
  elements.speedSlider.value = Math.min(clamped, 4);
  highlightPreset(clamped);
  sendToContent("setSpeed", { speed: clamped });
}

function highlightPreset(speed) {
  elements.presetBtns.forEach((btn) => {
    btn.classList.toggle("active", Math.abs(parseFloat(btn.dataset.speed) - speed) < 0.01);
  });
}

// ─── Transcript Fetching & Parsing ──────────────────────────────────────────
async function fetchTranscriptData() {
  showTranscriptLoading();
  const res = await sendToContent("fetchYtData");
  if (res?.success && res.data?.captions) {
    const captionTracks = res.data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (captionTracks && captionTracks.length > 0) {
      state.title = res.data.title || state.title;
      elements.videoTitle.textContent = state.title;
      // Prefer English, fallback to first available
      const track = captionTracks.find((t) => t.languageCode?.startsWith("en")) || captionTracks[0];
      await parseAndDisplayTranscript(track.baseUrl);
      return;
    }
  }
  showTranscriptError("No captions available for this video. Try a video with closed captions enabled.");
}

async function parseAndDisplayTranscript(url) {
  try {
    const response = await fetch(url);
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const textNodes = xmlDoc.querySelectorAll("text");

    const segments = [];
    let fullText = "";
    textNodes.forEach((node) => {
      const start = parseFloat(node.getAttribute("start")) || 0;
      const dur = parseFloat(node.getAttribute("dur")) || 3;
      const rawText = node.textContent || "";
      const cleanText = decodeHTMLEntities(rawText).replace(/\s+/g, " ").trim();
      if (cleanText) {
        segments.push({ start, dur, text: cleanText });
        fullText += cleanText + " ";
      }
    });

    state.transcriptSegments = segments;
    state.transcriptText = fullText.trim();
    renderTranscript(segments);
  } catch (e) {
    showTranscriptError("Failed to parse transcript data.");
  }
}

function renderTranscript(segments) {
  if (!segments || segments.length === 0) {
    showTranscriptError("No transcript text found.");
    return;
  }
  elements.transcriptList.innerHTML = segments
    .map(
      (seg, i) =>
        `<div class="transcript-line" data-index="${i}">
          <span class="timestamp">${formatTimestamp(seg.start)}</span>
          <span class="transcript-text">${escapeHTML(seg.text)}</span>
        </div>`
    )
    .join("");

  // Click to seek
  elements.transcriptList.querySelectorAll(".transcript-line").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.index);
      const seg = segments[idx];
      if (seg) {
        sendToContent("seekTo", { time: seg.start });
      }
    });
  });
}

function showTranscriptLoading() {
  elements.transcriptList.innerHTML = `
    <div class="loading-indicator">
      <div class="spinner"></div>
      <span>Loading transcript...</span>
    </div>`;
}

function showTranscriptError(msg) {
  elements.transcriptList.innerHTML = `<div class="center-placeholder"><p>${escapeHTML(msg)}</p></div>`;
}

// ─── Transcript Search ──────────────────────────────────────────────────────
elements.transcriptSearch.addEventListener("input", () => {
  const query = elements.transcriptSearch.value.toLowerCase().trim();
  const lines = elements.transcriptList.querySelectorAll(".transcript-line");
  let hasVisible = false;

  lines.forEach((line) => {
    const text = line.querySelector(".transcript-text")?.textContent?.toLowerCase() || "";
    if (!query || text.includes(query)) {
      line.style.display = "flex";
      line.classList.toggle("matched", query && text.includes(query));
      hasVisible = true;
    } else {
      line.style.display = "none";
    }
  });

  elements.clearSearchBtn.classList.toggle("hidden", !query);
});

elements.clearSearchBtn.addEventListener("click", () => {
  elements.transcriptSearch.value = "";
  elements.transcriptSearch.dispatchEvent(new Event("input"));
});

// ─── Download Transcript ────────────────────────────────────────────────────
elements.downloadTranscriptBtn.addEventListener("click", () => {
  if (!state.transcriptText) return;
  const content = state.transcriptSegments
    .map((seg) => `[${formatTimestamp(seg.start)}] ${seg.text}`)
    .join("\n");
  const filename = sanitizeFilename(state.title || "transcript") + ".txt";
  downloadFile(content, filename, "text/plain");
});

// ─── AI Summary ──────────────────────────────────────────────────────────────
elements.generateSummaryBtn.addEventListener("click", async () => {
  if (!state.transcriptText) {
    showSummaryError("No transcript loaded. Open a YouTube video with captions first.");
    return;
  }
  if (!state.geminiApiKey) {
    showSummaryError("Set your Gemini API key in Settings first.");
    return;
  }

  showSummaryLoading();
  const prompt = `You are a YouTube video analysis assistant. Analyze the following YouTube video transcript and provide:

1. **SUMMARY**: A concise, engaging 3-5 paragraph summary of the video content.

2. **KEY POINTS**: 5-10 bullet points covering the most important takeaways.

3. **SMART CHAPTERS (Timestamps)**: Generate chapter timestamps and titles for the video based on content transitions. Format each as: [MM:SS] - Chapter Title

Here is the transcript:
${state.transcriptText}

Respond in clear markdown. Be detailed and insightful.`;

  const result = await callGemini(prompt);
  if (result.success) {
    state.summaryGenerated = true;
    renderSummary(result.text);
  } else {
    showSummaryError("Gemini API error: " + (result.error || "Unknown error"));
  }
});

function renderSummary(markdownText) {
  const html = markdownToHTML(markdownText);
  elements.summaryViewer.innerHTML = `
    <div class="summary-card">
      ${html}
    </div>`;
}

function showSummaryLoading() {
  elements.summaryViewer.innerHTML = `
    <div class="loading-indicator">
      <div class="spinner"></div>
      <span>Generating summary with Gemini...</span>
    </div>`;
}

function showSummaryError(msg) {
  elements.summaryViewer.innerHTML = `<div class="center-placeholder"><p>${escapeHTML(msg)}</p></div>`;
}

// ─── AI Chat ─────────────────────────────────────────────────────────────────
elements.sendChatBtn.addEventListener("click", sendChatMessage);
elements.chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

async function sendChatMessage() {
  const msg = elements.chatInput.value.trim();
  if (!msg) return;

  if (!state.transcriptText) {
    appendChatBubble("assistant", "No transcript loaded. Please open a YouTube video with captions first.");
    return;
  }
  if (!state.geminiApiKey) {
    appendChatBubble("assistant", "Set your Gemini API key in Settings first.");
    return;
  }

  appendChatBubble("user", msg);
  elements.chatInput.value = "";
  showChatTyping();

  const systemPrompt = `You are an AI assistant embedded in a YouTube browser extension. You have access to the FULL transcript of the video currently being watched. Answer the user's questions based ONLY on the video transcript content. If the answer isn't in the transcript, say so clearly.

Video Title: ${state.title}

Transcript:
${state.transcriptText}`;

  const result = await callGemini(systemPrompt + "\n\nUser Question: " + msg, true);
  removeChatTyping();

  if (result.success) {
    appendChatBubble("assistant", result.text);
  } else {
    appendChatBubble("assistant", "Error: " + (result.error || "Unknown error"));
  }
}

function appendChatBubble(role, text) {
  const div = document.createElement("div");
  div.className = "chat-bubble " + role;
  div.textContent = text;
  elements.chatMessages.appendChild(div);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function showChatTyping() {
  const div = document.createElement("div");
  div.className = "chat-bubble assistant";
  div.id = "chat-typing";
  div.innerHTML = '<div class="spinner" style="width:16px;height:16px;"></div>';
  elements.chatMessages.appendChild(div);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function removeChatTyping() {
  const typing = document.getElementById("chat-typing");
  if (typing) typing.remove();
}

// ─── Gemini API Integration ──────────────────────────────────────────────────
async function callGemini(prompt, useChat = false) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent?key=${state.geminiApiKey}`;

    const contents = useChat
      ? [
          ...state.chatHistory.map((m) => ({
            role: m.role,
            parts: [{ text: m.text }],
          })),
          { role: "user", parts: [{ text: prompt }] },
        ]
      : [{ role: "user", parts: [{ text: prompt }] }];

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errData?.error?.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (useChat) {
      state.chatHistory.push({ role: "user", text: prompt });
      state.chatHistory.push({ role: "model", text });
    }

    return { success: true, text };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── Tab Navigation ──────────────────────────────────────────────────────────
elements.tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabId = btn.dataset.tab;
    elements.tabBtns.forEach((b) => b.classList.remove("active"));
    elements.tabPanes.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(tabId).classList.add("active");
  });
});

// ─── Settings Panel ─────────────────────────────────────────────────────────
elements.settingsBtn.addEventListener("click", () => {
  elements.settingsPanel.classList.toggle("hidden");
});

elements.toggleKeyVisibility.addEventListener("click", () => {
  const input = elements.inputApiKey;
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  elements.toggleKeyVisibility.textContent = isPassword ? "Hide" : "Show";
});

elements.saveSettingsBtn.addEventListener("click", async () => {
  const key = elements.inputApiKey.value.trim();
  if (!key) {
    showSettingsStatus("Please enter a valid API key.", "error");
    return;
  }
  state.geminiApiKey = key;
  await chrome.storage.local.set({ geminiApiKey: key });
  showSettingsStatus("API key saved successfully!", "success");
});

elements.resetSettingsBtn.addEventListener("click", async () => {
  state.geminiApiKey = DEFAULT_API_KEY;
  elements.inputApiKey.value = DEFAULT_API_KEY;
  await chrome.storage.local.set({ geminiApiKey: DEFAULT_API_KEY });
  showSettingsStatus("Reset to default key.", "success");
});

async function restoreSettings() {
  const result = await chrome.storage.local.get("geminiApiKey");
  state.geminiApiKey = result.geminiApiKey || DEFAULT_API_KEY;
  elements.inputApiKey.value = state.geminiApiKey;
}

function showSettingsStatus(msg, type) {
  elements.settingsStatus.textContent = msg;
  elements.settingsStatus.className = "status-msg " + type;
  setTimeout(() => {
    elements.settingsStatus.textContent = "";
    elements.settingsStatus.className = "status-msg";
  }, 3000);
}

// ─── Utility Functions ──────────────────────────────────────────────────────
function formatTimestamp(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function pad(n) {
  return n.toString().padStart(2, "0");
}

function sanitizeFilename(str) {
  return str.replace(/[^a-zA-Z0-9\s\-_]/g, "").substring(0, 100).trim() || "transcript";
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function decodeHTMLEntities(str) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = str;
  return textarea.value;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function markdownToHTML(md) {
  let html = md
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Headers
    .replace(/^### (.*$)/gm, "<h3 class='summary-title'>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2 class='summary-title'>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1 class='summary-title'>$1</h1>")
    // Bullet points
    .replace(/^\* (.*$)/gm, "<li class='summary-bullet'>$1</li>")
    .replace(/^- (.*$)/gm, "<li class='summary-bullet'>$1</li>")
    // Lines with timestamps like [MM:SS] - for chapters
    .replace(/\[(\d{1,2}:\d{2})\]\s*[-–—]?\s*(.*)/g, "<div class='chapter-item'><span class='chapter-time'>$1</span><span class='chapter-desc'>$2</span></div>")
    // Newlines to breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  return `<p>${html}</p>`;
}

// ─── Periodic Refresh ────────────────────────────────────────────────────────
// Re-check video info every 2 seconds (ultra-light interval)
setInterval(async () => {
  const tab = await getCurrentTab();
  if (tab && tab.url?.includes("youtube.com/watch")) {
    if (tab.id !== state.currentTabId) {
      state.currentTabId = tab.id;
      await updateVideoInfo();
    } else {
      const res = await sendToContent("getPlayState");
      if (res && !res.error) {
        elements.currentSpeed.textContent = parseFloat(res.speed).toFixed(2) + "x";
        elements.speedSlider.value = Math.min(parseFloat(res.speed), 4);
        if (res.title && res.title !== state.title) {
          state.title = res.title;
          elements.videoTitle.textContent = state.title;
        }
      }
    }
  } else {
    elements.videoTitle.textContent = "Open a YouTube video to begin";
    elements.pulseIndicator.className = "pulse-indicator red-pulse";
  }
}, 2000);

// ─── Start ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
