// src/bridge/network.js - HTTP/HTTPS egress bridge per README-1.md:1071 - Phase 6 M6
// Terminology: HTTP/HTTPS egress bridge, not general Internet per README-1.md:1071
// Architecture per README-1.md:1080: guest TCP terminated -> extracts HTTP -> browser fetch() -> response -> guest TCP
// Guest believes normal TCP; guest does NOT call fetch() directly per README-1.md:1123
// Supported: HTTP/HTTPS/browser methods/DNS via bridge per README-1.md:1128
// Unsupported: raw TCP/UDP, ICMP/ping, SSH raw, WebSocket, WebRTC, server relay per README-1.md:1136
// Security: No CORS bypass per README-1.md:1159, OFF by default per README-1.md:1174, no public root/no-password per README-1.md:1185

const SUPPORTED_METHODS = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH", "TRACE"];
const UNSUPPORTED_PROTOCOLS = [
  "raw TCP passthrough per README-1.md:1136",
  "raw UDP per README-1.md:1136",
  "ICMP/ping per README-1.md:1136",
  "arbitrary socket forwarding per README-1.md:1136",
  "SSH as general raw transport per README-1.md:1136",
  "WebSocket relay per README-1.md:1136",
  "WebRTC P2P per README-1.md:1136",
  "server-side network relay per README-1.md:1136"
];

export class NetworkBridge {
  constructor({ enabled = false, statusEl = typeof document !== "undefined" ? document.getElementById("status") : null } = {}) {
    this.enabled = enabled; // OFF by default per README-1.md:1174
    this.statusEl = statusEl;
    console.log(`[network] initialized enabled=${enabled} (default OFF per README-1.md:1174)`);
    this._updateUI();
  }

  _updateUI() {
    // UI must clearly communicate when networking is enabled per README-1.md:1183
    if (this.statusEl) {
      const existing = this.statusEl.textContent || "";
      // Don't overwrite entire status, append network status
      if (this.enabled && !existing.includes("Network: ON")) {
        this.statusEl.textContent = existing + " | Network: ON (HTTP/HTTPS only per README-1.md:1071)";
      } else if (!this.enabled) {
        this.statusEl.textContent = existing.replace(" | Network: ON.*", "");
      }
    }
    if (this.enabled) {
      console.log("[network] enabled - UI must communicate clearly per README-1.md:1183 | HTTP/HTTPS only, CORS applies, no bypass per README-1.md:1153,1159");
    }
  }

  enable() {
    this.enabled = true;
    console.log("[network] enabled - UI must communicate clearly per README-1.md:1183");
    this._updateUI();
    // Real: start VirtIO-net handler, SLIRP-style translation per README-1.md:1098
    if (typeof document !== "undefined") {
      // Show visible indicator per README-1.md:1183
      let indicator = document.getElementById("network-indicator");
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.id = "network-indicator";
        indicator.style.cssText = "position:fixed;top:8px;right:8px;background:#ffaa00;color:#000;padding:4px 8px;border-radius:4px;font-size:11px;z-index:1000";
        document.body.appendChild(indicator);
      }
      indicator.textContent = "Network: ON (HTTP/HTTPS egress only)";
      indicator.title = "Networking is ON - only HTTP/HTTPS via bridge, CORS applies, no raw TCP/UDP per README-1.md:1136";
    }
  }

  disable() {
    this.enabled = false;
    console.log("[network] disabled (default OFF per README-1.md:1174)");
    this._updateUI();
    if (typeof document !== "undefined") {
      const ind = document.getElementById("network-indicator");
      if (ind) ind.remove();
    }
  }

  isSupportedMethod(method) {
    // Browser-compatible request methods supported by the bridge per README-1.md:1128
    return SUPPORTED_METHODS.includes(method.toUpperCase());
  }

  isSupportedUrl(url) {
    // Only HTTP/HTTPS per README-1.md:1128, others must fail cleanly per README-1.md:1687
    return url.startsWith("http://") || url.startsWith("https://");
  }

  // Simulated egress: terminates guest TCP session, extracts HTTP request, issues fetch per README-1.md:1098
  async handleGuestRequest({ method = "GET", url, headers = {}, body = null }) {
    if (!this.enabled) throw new Error("Network disabled (default OFF per README-1.md:1174) - enable via UI per README-1.md:1183");
    // Validate method
    if (!this.isSupportedMethod(method)) {
      throw new Error(`Unsupported method ${method} (only ${SUPPORTED_METHODS.join(",")} per README-1.md:1128)`);
    }
    // Validate URL - only HTTP/HTTPS, others must fail cleanly per README-1.md:1136, README-1.md:1687
    if (!this.isSupportedUrl(url)) {
      // Provide explicit unsupported list for visibility per README-1.md:1687
      const unsupported = UNSUPPORTED_PROTOCOLS.join(", ");
      throw new Error(`Unsupported protocol (only HTTP/HTTPS per README-1.md:1136): ${url} | Unsupported: ${unsupported} | Must fail cleanly per README-1.md:1687, not silent success`);
    }
    console.log(`[network] egress ${method} ${url} via fetch() per README-1.md:1098 | Guest believes normal TCP per README-1.md:1123`);
    // Real: browser fetch() is subject to CORS per README-1.md:1153, no bypass per README-1.md:1159
    try {
      const res = await fetch(url, { method, headers, body });
      // DNS handled by bridge resolver per README-1.md:1166, deterministic failure via catch
      console.log(`[network] fetch success ${res.status} per README-1.md:1153 CORS applies`);
      return {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: await res.arrayBuffer(),
      };
    } catch (e) {
      // CORS failure is expected visible per README-1.md:1636, 2455, not silent
      // Check if CORS-related
      const isCors = e.message.includes("CORS") || e.message.includes("Failed to fetch") || e.name === "TypeError";
      if (isCors) {
        console.error(`[network] fetch failed CORS/network per README-1.md:1153 - visible failure per README-1.md:2455: ${e.message}`);
        // Re-throw with explicit CORS note
        throw new Error(`CORS/network failure per README-1.md:1153, no bypass per README-1.md:1159: ${e.message}`);
      }
      console.error(`[network] fetch failed per README-1.md:1153: ${e.message}`);
      throw e;
    }
  }

  // DNS via bridge resolver per README-1.md:1166 - not raw UDP/53 per README-1.md:1169
  async resolve(hostname) {
    console.log(`[network] DNS resolve ${hostname} via bridge resolver (not raw UDP/53 per README-1.md:1169)`);
    // Deterministic failure path if resolution unavailable per README-1.md:1170
    if (!hostname || typeof hostname !== "string" || hostname.trim() === "") {
      throw new Error("DNS resolution unavailable - deterministic failure per README-1.md:1170");
    }
    // Simulate DNS: if hostname contains invalid chars, fail deterministically
    if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
      throw new Error(`DNS resolution failed for ${hostname} per README-1.md:1170`);
    }
    // In real bridge, would use browser's DNS via fetch or DoH, not raw UDP/53
    // For Phase 6 simulation, just return hostname as resolved (browser will handle DNS via fetch)
    console.log(`[network] DNS resolved ${hostname} via bridge per README-1.md:1166`);
    return hostname;
  }

  // Helper to check if protocol is unsupported (for explicit clean failure per README-1.md:1687)
  isUnsupportedProtocol(url) {
    // Check for known unsupported patterns
    if (url.startsWith("tcp://") || url.startsWith("udp://") || url.startsWith("icmp://") || url.startsWith("ssh://") || url.startsWith("ws://") || url.startsWith("wss://") || url.startsWith("webrtc://") || url.startsWith("ping://")) {
      return true;
    }
    // Also check for raw IP without http
    if (/^\d+\.\d+\.\d+\.\d+:/.test(url)) return true;
    return false;
  }

  getStatus() {
    return {
      enabled: this.enabled,
      supported: SUPPORTED_METHODS,
      unsupported: UNSUPPORTED_PROTOCOLS,
      corsBypass: false, // No CORS bypass per README-1.md:1159
      relayServer: false, // No relay server in v1 per README-1.md:1460
    };
  }
}

// Phase 9 Post-v1: WebSocket relay per FUTURE-SCOPE.MD:3 is behind flag ?websocket=1, not enabled by default
// Import would be: import { WebSocketBridge } from "./websocket.js";
// This keeps v1 per README-1.md:1146 unsupported, Phase 9 enables via flag

// Security: No CORS bypass per README-1.md:1159, no public network-enabled build with root/no-password per README-1.md:1185
// Must ensure no CORS bypass implementation is accepted per README-1.md:2218:7
console.log("[network] HTTP/HTTPS egress bridge ready - OFF by default per README-1.md:1174, no CORS bypass per README-1.md:1159, no relay per README-1.md:1460");
console.log("[network] Phase 9 WebSocket relay available via ?websocket=1 per FUTURE-SCOPE.MD:3 (v1 per README-1.md:1146 unsupported)");
