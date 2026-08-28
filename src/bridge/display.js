// src/bridge/display.js - Canvas2D with dirty-rect, WebGL2 experimental per README-1.md:1190 - Phase 3 M3
// Default Canvas2D (dirty-rect updates per README-1.md:1200), experimental WebGL2 via ?gpu=1 per README-1.md:1212 (not GPU passthrough)
// Resolution 1024x768 target per README-1.md:1242, tier-configurable per README-1.md:1362
// SMP: PWA+COOP/COEP supports SMP, single-file file:// No per README-1.md:803

export class Display {
  constructor({ container = document.getElementById("screen"), useWebGL = false, width = 1024, height = 768 } = {}) {
    this.container = container;
    this.width = width;
    this.height = height;
    this.useWebGL = useWebGL || (typeof location !== "undefined" && new URLSearchParams(location.search).has("gpu"));
    this.ctx = null;
    this.gl = null;
    this.dirtyCount = 0;
    this.frameCount = 0;
    this.backend = "canvas2d";

    if (!this.container) {
      console.warn("[display] No container #screen found - display disabled");
      return;
    }

    // Handle HiDPI scaling
    this._setupCanvas();

    if (this.useWebGL) {
      console.log("[display] WebGL2 experimental via ?gpu=1 per README-1.md:1212 - not GPU passthrough per README-1.md:1217");
      this.gl = this.container.getContext("webgl2", { alpha: false, antialias: false });
      if (this.gl) {
        this.backend = "webgl2";
        console.log("[display] WebGL2 context acquired - fallback to Canvas2D if unavailable");
        this._initWebGL2();
      } else {
        console.warn("[display] WebGL2 not available - fallback to Canvas2D per README-1.md:1190");
        this.backend = "canvas2d";
        this.useWebGL = false;
      }
    }

    if (this.backend === "canvas2d") {
      this.ctx = this.container.getContext("2d", { alpha: false });
      if (!this.ctx) {
        console.error("[display] Canvas2D not available");
        return;
      }
      this.ctx.imageSmoothingEnabled = false;
      console.log("[display] Canvas2D dirty-rect per README-1.md:1200 - ready 1024x768");
    }

    // Performance marks for waterfall per README-1.md:1861
    if (typeof performance !== "undefined" && performance.mark) {
      performance.mark("display-init");
    }
  }

  _setupCanvas() {
    if (!this.container) return;
    // Ensure canvas has correct size attributes vs style
    this.container.width = this.width;
    this.container.height = this.height;
    // HiDPI handling: keep CSS size at 1024x768 but backing store scaled
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    if (dpr !== 1) {
      // Keep CSS size, but if we wanted HiDPI backing, we'd scale here
      // For Phase 3, keep 1:1 for simplicity and to avoid full redraw overhead
      console.log(`[display] devicePixelRatio ${dpr} - keeping 1024x768 backing (no HiDPI scale for dirty-rect efficiency)`);
    }
    // Handle resize - keep target resolution
    if (typeof window !== "undefined") {
      window.addEventListener("resize", () => {
        // Keep 1024x768, don't stretch - center via CSS
      });
    }
  }

  _initWebGL2() {
    if (!this.gl) return;
    const gl = this.gl;
    // Simple WebGL2 setup: create texture for VGA framebuffer
    // Real implementation would use shaders to blit dirty rects
    // Phase 3: minimal setup, fallback to Canvas2D if fails
    try {
      const vs = `attribute vec2 a_pos; varying vec2 v_uv; void main(){ v_uv=(a_pos+1.0)/2.0; gl_Position=vec4(a_pos,0,1); }`;
      const fs = `precision mediump float; uniform sampler2D u_tex; varying vec2 v_uv; void main(){ gl_FragColor=texture2D(u_tex,v_uv); }`;
      // Compile omitted for Phase 3 stub - just log
      console.log("[display] WebGL2 experimental setup (stub) - real shaders will be compiled in full M3");
    } catch (e) {
      console.warn("[display] WebGL2 setup failed, fallback to Canvas2D", e);
      this.backend = "canvas2d";
      this.gl = null;
      this.ctx = this.container.getContext("2d", { alpha: false });
    }
  }

  // Called by v86 on frame update - must NOT redraw entire frame if small region changed per README-1.md:1202
  // v86 calls: on_screen_update(data, x, y, w, h) where data is ImageData or Uint8Array
  updateDirtyRect(x, y, w, h, data) {
    this.dirtyCount++;
    this.frameCount++;
    // Performance: only update changed rect
    if (this.backend === "canvas2d" && this.ctx) {
      try {
        if (data instanceof ImageData) {
          this.ctx.putImageData(data, x, y);
        } else if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
          // Convert Uint8Array RGBA to ImageData
          const imageData = new ImageData(new Uint8ClampedArray(data), w, h);
          this.ctx.putImageData(imageData, x, y);
        } else if (Array.isArray(data) && data.length === w*h*4) {
          const imageData = new ImageData(new Uint8ClampedArray(data), w, h);
          this.ctx.putImageData(imageData, x, y);
        } else {
          // Fallback: fill rect for testing
          this.ctx.fillStyle = "#00ff00";
          this.ctx.fillRect(x, y, w, h);
        }
        // Log only first few to avoid spam, then every 100
        if (this.dirtyCount <= 5 || this.dirtyCount % 100 === 0) {
          console.log(`[display] dirty rect ${x},${y} ${w}x${h} backend=${this.backend} count=${this.dirtyCount} (per README-1.md:1202 no full redraw)`);
        }
      } catch (e) {
        console.error("[display] dirty rect update failed", e);
      }
    } else if (this.backend === "webgl2" && this.gl) {
      // WebGL2 stub: would upload texture subimage
      if (this.dirtyCount <= 5) console.log(`[display] WebGL2 dirty rect ${x},${y} ${w}x${h} (stub)`);
    }

    // Benchmark: mark frame
    if (typeof performance !== "undefined" && performance.mark && this.frameCount === 1) {
      performance.mark("display-first-frame");
      performance.measure("display-first-frame", "v86-init", "display-first-frame");
    }
  }

  // v86 integration helper: set emulator callbacks
  attachToEmulator(emulator) {
    if (!emulator) {
      console.warn("[display] No emulator to attach");
      return;
    }
    // v86 API: emulator.add_listener("screen-update", (data,x,y,w,h) => ...)
    // Different v86 versions use bus or on_screen_update
    if (typeof emulator.add_listener === "function") {
      emulator.add_listener("screen-update", (data) => {
        // data is ImageData-like
        this.updateDirtyRect(data.x || 0, data.y || 0, data.width || this.width, data.height || this.height, data.data || data);
      });
      console.log("[display] Attached via emulator.add_listener screen-update");
    } else if (emulator.bus) {
      emulator.bus.register("screen-update", (data) => this.updateDirtyRect(data.x, data.y, data.w, data.h, data.data), this);
      console.log("[display] Attached via emulator.bus screen-update");
    } else {
      // Fallback for testing: expose updateDirtyRect globally
      if (typeof window !== "undefined") window.linuxhtmlDisplay = this;
      console.log("[display] Attached via window.linuxhtmlDisplay fallback (test mode)");
    }
    console.log("[display] Attached to emulator - terminal should be visible per README-1.md:2373");
  }

  setResolution(w = 1024, h = 768) {
    console.log(`[display] resolution ${w}x${h} per README-1.md:1242 (tier-configurable per README-1.md:1362)`);
    this.width = w;
    this.height = h;
    if (this.container) {
      this.container.width = w;
      this.container.height = h;
      // Keep CSS size via style if needed
      this.container.style.width = w + "px";
      this.container.style.height = h + "px";
    }
    // Re-init contexts if needed
    if (this.backend === "canvas2d" && this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  // Test helper: render test pattern to verify dirty-rect works without v86
  renderTestPattern() {
    if (!this.ctx) return;
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = "#0f0";
    this.ctx.font = "14px monospace";
    this.ctx.fillText("LinuxHTML Phase 3 - Canvas2D dirty-rect test per README-1.md:1200", 10, 20);
    this.ctx.fillText("1024x768 terminal should be visible per README-1.md:2373", 10, 40);
    // Draw dirty rect test
    this.updateDirtyRect(10, 50, 100, 20, null);
    console.log("[display] Test pattern rendered");
  }

  getStats() {
    return { backend: this.backend, dirtyCount: this.dirtyCount, frameCount: this.frameCount, width: this.width, height: this.height };
  }
}
