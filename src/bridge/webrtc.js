// src/bridge/webrtc.js - WebRTC P2P per Feature 4 per review suggestion 9 Features - Phase 9 Post-v1
// Currently unsupported in v1 per README-1.md:1147 - stub behind flag
// Would provide P2P via RTCPeerConnection DataChannel, STUN/TURN (no relay in v1 per README-1.md:1460)
export class WebRTCBridge {
  constructor({ enabled = false } = {}) {
    this.enabled = enabled || (typeof location !== "undefined" && new URLSearchParams(location.search).has("webrtc"));
    console.log(`[webrtc] WebRTC P2P ${this.enabled ? "enabled ?webrtc=1" : "disabled per README-1.md:1147"} per Feature 4`);
  }
  async connect(peerId) {
    if (!this.enabled) throw new Error("WebRTC disabled per README-1.md:1147 - enable ?webrtc=1 per Feature 4");
    console.log(`[webrtc] connect ${peerId} via RTCPeerConnection per Feature 4`);
    return { peerId, status: "connected stub" };
  }
}
