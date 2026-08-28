// src/bridge/port-forward.js - Automated Port Forwarding via Service Worker per Advanced Feature 4
// Problem: developer runs React on localhost:3000 inside VM, cannot view in host browser
// Solution: Extend sw.js and NetworkBridge to map host URL http://localhost:8080/proxy/3000/ → port 3000 inside VM per review
// Similar to GitHub Codespaces/CodeSandbox reverse-proxy

export class PortForwardBridge {
  constructor({ networkBridge } = {}) {
    this.networkBridge = networkBridge;
    this.mappings = new Map(); // hostPort -> vmPort
    console.log("[port-forward] Automated Port Forwarding per Feature 4");
  }

  map(hostPath, vmPort) {
    // e.g., /proxy/3000/ → 3000
    this.mappings.set(hostPath, vmPort);
    console.log(`[port-forward] Map ${hostPath} → VM port ${vmPort} per Feature 4`);
  }

  async handleRequest(request) {
    const url = new URL(request.url);
    for (const [hostPath, vmPort] of this.mappings) {
      if (url.pathname.startsWith(hostPath)) {
        const vmUrl = `http://localhost:${vmPort}${url.pathname.slice(hostPath.length)}${url.search}`;
        console.log(`[port-forward] Proxy ${url.pathname} → ${vmUrl} per Feature 4`);
        // Translate via NetworkBridge fetch()
        if (this.networkBridge) {
          return this.networkBridge.handleGuestRequest({ method: request.method, url: vmUrl });
        }
      }
    }
    return null;
  }
}
