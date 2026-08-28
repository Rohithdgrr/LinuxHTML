// src/bridge/websocket.js - WebSocket relay stub for Phase 9 Post-v1 per README-1.md:2524, FUTURE-SCOPE.MD:3
// Currently unsupported in v1 per README-1.md:1146 - this is Phase 9 Post-v1 behind flag
// Implements guest TCP ws:// → browser WebSocket per FUTURE-SCOPE.MD:3 - not raw TCP per README-1.md:1136
// Requires explicit enable with ?websocket=1 flag, not enabled by default
// Security: subject to browser CORS-like checks, no bypass per README-1.md:1159

export class WebSocketBridge {
  constructor({ enabled = false } = {}) {
    this.enabled = enabled || (typeof location !== "undefined" && new URLSearchParams(location.search).has("websocket"));
    this.sockets = new Map(); // id -> WebSocket
    this.nextId = 1;
    if (this.enabled) console.log("[websocket] WebSocket relay enabled via ?websocket=1 per FUTURE-SCOPE.MD:3 Phase 9");
    else console.log("[websocket] WebSocket relay disabled (v1 default per README-1.md:1146) - enable via ?websocket=1");
  }

  enable() {
    this.enabled = true;
    console.log("[websocket] enabled per FUTURE-SCOPE.MD:3");
  }

  disable() {
    this.enabled = false;
    for (const ws of this.sockets.values()) try { ws.close(); } catch(e) {}
    this.sockets.clear();
    console.log("[websocket] disabled");
  }

  // Check if URL is WebSocket
  isWebSocketUrl(url) {
    return url.startsWith("ws://") || url.startsWith("wss://");
  }

  // Simulated egress: guest wants ws:// → browser WebSocket per FUTURE-SCOPE.MD:3
  async connect(url, protocols = []) {
    if (!this.enabled) throw new Error("WebSocket relay disabled - enable via ?websocket=1 per FUTURE-SCOPE.MD:3 Phase 9 (v1 per README-1.md:1146 unsupported)");
    if (!this.isWebSocketUrl(url)) throw new Error(`Not a WebSocket URL: ${url} per FUTURE-SCOPE.MD:3`);
    console.log(`[websocket] connect ${url} via browser WebSocket per FUTURE-SCOPE.MD:3`);
    // In real implementation, would create browser WebSocket and bridge to guest TCP
    // For Phase 9 stub, simulate with mock
    const id = this.nextId++;
    // Mock WebSocket object for testing
    const mockWs = {
      id, url, protocols,
      readyState: 1, // OPEN
      send: (data) => console.log(`[websocket] send ${id} ${data.length || data}`),
      close: () => console.log(`[websocket] close ${id}`),
    };
    this.sockets.set(id, mockWs);
    return { id, url, status: "connected", backend: "websocket" };
  }

  async send(id, data) {
    if (!this.enabled) throw new Error("WebSocket disabled");
    const ws = this.sockets.get(id);
    if (!ws) throw new Error(`WebSocket ${id} not found`);
    ws.send(data);
    return { sent: data.length || data.byteLength || 0 };
  }

  async close(id) {
    const ws = this.sockets.get(id);
    if (ws) {
      ws.close();
      this.sockets.delete(id);
    }
    return { closed: true };
  }

  getStatus() {
    return {
      enabled: this.enabled,
      count: this.sockets.size,
      note: "Phase 9 Post-v1 WebSocket relay per FUTURE-SCOPE.MD:3 - behind flag, v1 per README-1.md:1146 unsupported"
    };
  }
}

// Export for testing
console.log("[websocket] Phase 9 WebSocket relay stub ready per FUTURE-SCOPE.MD:3");
