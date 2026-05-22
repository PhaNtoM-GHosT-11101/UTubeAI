<div align="center">
  <h1>YouTube TurboScribe &amp; AI Studio</h1>
  <p><strong>by Aditya Priyadarshi</strong></p>
  <p>
    <em>Manifest V3 · Zero Dependencies · Ultra-Lightweight (~50 KB)</em><br>
    <em>Gemini AI · Playback Speed · Transcripts · Ad Skipper</em>
  </p>
</div>

---

# YouTube TurboScribe & AI Studio

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-1976D2?style=flat-square)]()
[![JavaScript](https://img.shields.io/badge/JS-Vanilla-F7DF1E?style=flat-square&logo=javascript)]()
[![Gemini API](https://img.shields.io/badge/Gemini-1.5%20Flash-8E75B2?style=flat-square&logo=google)]()
[![Size](https://img.shields.io/badge/Size-~50%20KB-4CAF50?style=flat-square)]()
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)]()

> **A browser extension for YouTube — custom playback speed, downloadable transcripts, Gemini-powered AI summaries, smart chapters, interactive chat, and an auto ad-skipper. Built to be lightweight as fuck.**

---

## Features

### 🎮 Playback Speed (Any Speed You Want)
- Slider from `0.25x` to `4.0x`
- Quick presets: `1x` | `1.5x` | `2x` | `3x`
- Custom input box: enter **any value** up to `16.0x`

### 📝 Transcript Viewer & Downloader
- Automatically fetches captions from YouTube
- Click any timestamped line to **seek** the video to that moment
- Download the full transcript as `.txt`
- Search inside the transcript in real-time

### 🤖 AI Summary (Powered by Gemini)
- One-click generation of structured video summaries
- Auto-generated **Smart Chapters** with timestamps
- Key bullet points extracted from the content
- Powered by **Gemini 1.5 Flash** — fast and capable of handling long transcripts

### 💬 AI Chat with Video
- Ask questions about the video content
- The assistant answers based **only** on the transcript
- Full chat history maintained during the session

### 🛡️ Auto Ad-Skipper
- Automatically clicks skip buttons on video ads
- Closes overlay ads instantly
- **16x bypass** for unskippable bumper ads (mutes + fast-forwards through them)

---

## Installation

### Chrome / Edge / Brave / Opera (Developer Mode)

1. **Download** the extension files or clone this repository:
   ```bash
   git clone https://github.com/AdityaPriyadarshi/youtube-turboscribe.git
   cd youtube-turboscribe
   ```

2. Open your browser and navigate to the extensions page:
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`
   - **Brave:** `brave://extensions`

3. Enable **Developer mode** (toggle in the top right).

4. Click **Load unpacked** and select the project folder.

5. Pin the extension and click the icon to open the **Side Panel**.

> **Firefox users:** The extension works on Firefox with minimal adjustments. See the [Firefox section](#firefox-add-ons-store) below.

---

## Gemini API Key Setup

The extension comes **pre-configured with a working Gemini API key** so you can use it immediately.

To update the key:

1. Open the side panel
2. Click the **gear icon** (⚙️) in the top right
3. Enter your own Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
4. Click **Save Key**

---

## File Structure

```
youtube-turboscribe/
├── manifest.json        # Extension manifest
├── background.js        # Service worker (~1 KB)
├── content.js           # DOM injection & ad skipper (~3 KB)
├── sidepanel.html       # Side panel UI (~4 KB)
├── sidepanel.js         # Gemini API & app logic (~10 KB)
├── styles.css           # Premium dark theme (~5 KB)
├── LICENSE              # MIT License
└── README.md            # You are here
```

**Total bundle size: ~50 KB** — smaller than most images on the web.


---

## How It Works

### Transcript Extraction
Uses `ytInitialPlayerResponse` from YouTube's internal player data to retrieve caption track URLs. The XML caption tracks are fetched and parsed into timestamped segments — no extra network overhead.

### AI Integration
Transcript text is sent to **Gemini 1.5 Flash** via the REST API (`fetch` — no SDK). The model returns structured summaries, chapters, or conversational answers depending on the context.

### Ad Skipping
A lightweight `setInterval` (300ms) checks for ad state changes. Skip buttons are clicked immediately. Unskippable ads are muted and fast-forwarded at 16x speed.

---

## Creator

Built with ❤️ by **Aditya Priyadarshi**

- GitHub: [@AdityaPriyadarshi](https://github.com/AdityaPriyadarshi)

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <sub>Made with ❤️ by Aditya Priyadarshi</sub>
</p>
