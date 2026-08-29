// src/ui/xterm/xterm.js - REAL Xterm.js overlay per Feature 5.
// Pinned version per versions.lock. Loads Xterm via classic UMD <script>/<link>
// (no-cors => works on http:// and file://). Rendered as a block below the canvas,
// not position:absolute (the old stub rendered off-card behind the statusbar).
import { loadScript, loadCSS } from "../vendor-loader.js";

const XTERM_VER = "5.5.0";
const BASE = `https://cdn.jsdelivr.net/npm/@xterm/xterm@${XTERM_VER}`;

export class XtermOverlay {
  constructor({ container = null, enabled = true } = {}) {
    this.container = container; // parent to append the overlay into (must be in normal flow); resolved lazily in init()
    this.enabled = enabled;
    this.term = null;
    console.log(`[xterm] REAL Xterm.js overlay ${this.enabled ? "enabled" : "disabled"} per Feature 5`);
  }

  async init(emulator) {
    if (!this.enabled) {
      console.log("[xterm] disabled (would need ?xterm=1 per original Feature 5)");
      return null;
    }
    await loadCSS(`${BASE}/css/xterm.css`);
    await loadScript(`${BASE}/lib/xterm.js`, { globalVar: "Terminal" }); // UMD build

    // Resolve container lazily: prefer the one passed in, then DOM lookup, then body.
    if (!this.container) {
      this.container = document.getElementById("screen-wrapper") || document.body;
    }

    // Styled wrapper with header bar matching editor panel design
    const wrapOuter = document.createElement("div");
    wrapOuter.id = "xterm-overlay";
    wrapOuter.style.cssText = "display:flex;flex-direction:column;width:100%;max-width:1024px;height:220px;background:#1a1a1a;border:1px solid #333;border-radius:8px;overflow:hidden;margin-top:12px;box-shadow:0 2px 10px rgba(0,0,0,0.25);box-sizing:border-box;";

    // Header bar with toolbar
    const header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:5px 10px;background:#2d2d2d;border-bottom:1px solid #333;font-size:11px;color:#888;font-family:Consolas,monospace;";
    header.innerHTML = `<span style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:10px;height:10px;background:#007acc;border-radius:2px;"></span><span style="text-transform:uppercase;letter-spacing:0.5px;">Terminal</span></span><span style="opacity:0.6;">xterm.js ${"5.5.0"}</span>`;
    wrapOuter.appendChild(header);

    // Terminal container with padding
    const wrap = document.createElement("div");
    wrap.style.cssText = "flex:1;min-height:0;overflow:hidden;background:#0c0c0c;padding:4px 0 0 4px;";
    wrapOuter.appendChild(wrap);

    // Footer with status
    const footer = document.createElement("div");
    footer.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:3px 10px;background:#007acc;font-size:10px;color:rgba(255,255,255,0.85);";
    footer.innerHTML = '<span>bash</span><span>Ready</span>';
    wrapOuter.appendChild(footer);

    this.container.appendChild(wrapOuter);

    this.term = new window.Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.3,
      fontFamily: "Consolas,Monaco,'Courier New',monospace",
      theme: {
        background: "#0c0c0c",
        foreground: "#cccccc",
        cursor: "#ffffff",
        cursorAccent: "#0c0c0c",
        selectionBackground: "#264f78",
      },
      scrollback: 5000,
      allowProposedApi: true,
    });
    this.term.open(wrap); // REAL terminal instance
    this.term.writeln("\x1b[1;32mLinuxHTML\x1b[0m \x1b[90mxterm overlay ready\x1b[0m");
    this.term.writeln("");

    if (emulator?.bus?.register) { // guest PTY via VirtIO-serial
      emulator.bus.register("serial0-output",
        d => this.term.write(new TextDecoder().decode(d)), this);
      this.term.onData(s =>
        emulator.bus.send("serial0-input", new TextEncoder().encode(s)));
    }
    this.term.focus();
    console.log("[xterm] REAL terminal mounted");
    return this.term;
  }
}
