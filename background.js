// YouTube TurboScribe & AI Studio - Background Service Worker
// Created by Aditya Priyadarshi

// Enable opening the side panel when clicking the extension icon
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Error setting side panel behavior:", error));
});
