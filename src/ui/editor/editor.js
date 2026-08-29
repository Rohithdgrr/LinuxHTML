// src/ui/editor/editor.js - REAL Monaco IDE overlay per Feature 1.
// Pinned version per versions.lock. Loads Monaco via classic AMD loader (no-cors)
// so it works on http:// and file://. Blob-worker trick removes cross-origin worker restriction.
import { loadScript } from "../vendor-loader.js";

const MONACO_VER = "0.44.0";
const CDN = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VER}/min/vs`;

export class Editor {
  constructor({ container = null, storage = null } = {}) {
    this.container = container || document.getElementById("editor-content");
    this.storage = storage; // StorageBridge for /home sync
    this.monaco = null;
    this.editor = null;
    this.currentPath = "/home/user/README.md";
    this._dirty = false;
    this._minimapEnabled = false;
    this._wordWrapEnabled = false;
    console.log("[editor] REAL Monaco IDE overlay per Feature 1 - dockable, synced to /home via Worker");
  }

  async loadMonaco() {
    if (this.monaco) return this.monaco;
    // Cross-origin worker workaround: Monaco workers can't spawn from CDN origin.
    // Blob worker + importScripts() is no-cors, so it works on http:// and file://.
    window.MonacoEnvironment = {
      getWorkerUrl: () => URL.createObjectURL(new Blob([
        `self.MonacoEnvironment={baseUrl:"${CDN}/"};` +
        `importScripts("${CDN}/base/worker/workerMain.js");`
      ], { type: "text/javascript" })),
    };
    await loadScript(`${CDN}/loader.js`); // AMD loader (classic script, no-cors)
    window.require.config({ paths: { vs: CDN } });
    await new Promise((res, rej) =>
      window.require(["vs/editor/editor.main"], res, rej)); // real bundle, real error path
    if (!window.monaco) throw new Error("monaco global missing after editor.main");
    this.monaco = window.monaco;
    console.log("[editor] REAL monaco loaded", this.monaco.version);
    return this.monaco;
  }

  _showLoading(msg) {
    if (!this.container) return;
    this.container.innerHTML = "";
    const loader = document.createElement("div");
    loader.className = "editor-loading";
    loader.style.cssText = "display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#1e1e1e;color:#888;font-size:13px;font-family:Consolas,monospace;";
    loader.innerHTML = `<div class="spinner" style="width:16px;height:16px;border:2px solid #333;border-top-color:#007acc;border-radius:50%;animation:editor-spin 0.8s linear infinite;margin-right:10px;"></div>${msg}`;
    this.container.appendChild(loader);
  }

  _hideLoading() {
    if (!this.container) return;
    const loader = this.container.querySelector(".editor-loading");
    if (loader) loader.remove();
  }

  _showError(msg) {
    if (!this.container) return;
    this.container.innerHTML = "";
    const err = document.createElement("div");
    err.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;background:#1e1e1e;color:#f44;font-size:13px;font-family:Consolas,monospace;padding:20px;text-align:center;";
    err.innerHTML = `<div style="font-size:24px;margin-bottom:10px;">⚠️</div><div style="margin-bottom:8px;">${msg}</div><div style="font-size:11px;color:#888;">Check console for details</div>`;
    this.container.appendChild(err);
  }

  _updateFileInfo() {
    // Update the HTML header elements if they exist (PWA build path)
    const pathEl = document.getElementById("editor-file-path");
    if (pathEl) pathEl.textContent = this.currentPath;
    const dotEl = document.getElementById("editor-dirty-dot");
    if (dotEl) {
      if (this._dirty) dotEl.classList.add("visible");
      else dotEl.classList.remove("visible");
    }
    // Update the footer label to show current language mode
    const modeLabel = document.getElementById("editor-mode-label");
    if (modeLabel && this.editor) {
      const model = this.editor.getModel();
      const lang = model ? model.getLanguageId() : "text";
      modeLabel.innerHTML = `Monaco <span style="opacity:0.6">•</span> ${lang.charAt(0).toUpperCase() + lang.slice(1)}`;
    }
    // Update file explorer active state
    const items = document.querySelectorAll("#editor-explorer .explorer-item");
    items.forEach(item => {
      item.classList.remove("active");
      if (item.textContent.includes(this.currentPath.split("/").pop())) {
        item.classList.add("active");
      }
    });
  }

  _registerToolbarActions() {
    // Toggle minimap
    window._editorToggleMinimap = () => {
      if (!this.editor) return;
      this._minimapEnabled = !this._minimapEnabled;
      this.editor.updateOptions({ minimap: { enabled: this._minimapEnabled } });
      // Update button state
      const btn = document.querySelector("#editor-toolbar button:first-child");
      if (btn) btn.classList.toggle("active", this._minimapEnabled);
    };

    // Toggle word wrap
    window._editorToggleWordWrap = () => {
      if (!this.editor) return;
      this._wordWrapEnabled = !this._wordWrapEnabled;
      this.editor.updateOptions({ wordWrap: this._wordWrapEnabled ? "on" : "off" });
      const btn = document.querySelector("#editor-toolbar button:nth-child(2)");
      if (btn) btn.classList.toggle("active", this._wordWrapEnabled);
    };

    // Format document
    window._editorFormat = async () => {
      if (!this.editor || !this.monaco) return;
      await this.editor.getAction("editor.action.formatDocument")?.run();
    };

    // Command palette
    window._editorCommandPalette = () => {
      if (!this.editor || !this.monaco) return;
      this.editor.trigger("keyboard", "editor.action.quickCommand");
    };

    // Open file from explorer
    window._editorOpenFile = (path) => {
      this.openFile(path);
    };
  }

  async mount() {
    if (!this.container) {
      console.warn("[editor] no container (#editor-content) found");
      return null;
    }
    // Reveal the editor panel (hidden by default in index.html).
    const panel = document.getElementById("editor-panel");
    if (panel) panel.style.display = "flex";

    // Show loading state while Monaco loads from CDN
    this._showLoading("Loading Monaco Editor\u2026");

    try {
      await this.loadMonaco();
    } catch (e) {
      this._showError("Failed to load Monaco Editor");
      console.error("[editor] Monaco load failed:", e);
      return null;
    }
    this._hideLoading();

    this.editor = this.monaco.editor.create(this.container, {
      value: `// ${this.currentPath}\n// Ctrl+S syncs to guest /home via Storage Worker\n`,
      language: "markdown",
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      lineHeight: 20,
      padding: { top: 8, bottom: 8 },
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      renderLineHighlight: "all",
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true },
      scrollBeyondLastLine: false,
      wordWrap: "off",
      tabSize: 2,
      folding: true,
      lineNumbers: "on",
      renderWhitespace: "selection",
      suggest: { showStatusBar: true },
      contextmenu: true,
      mouseWheelZoom: true,
    });

    // Track dirty state
    this.editor.onDidChangeModelContent(() => {
      this._dirty = true;
      this._updateFileInfo();
    });

    // Ctrl+S / Cmd+S to save
    this.editor.addCommand(
      this.monaco.KeyMod.CtrlCmd | this.monaco.KeyCode.KeyS, () => this.save());

    // Ctrl+Shift+F / Cmd+Shift+F to format
    this.editor.addCommand(
      this.monaco.KeyMod.CtrlCmd | this.monaco.KeyMod.Shift | this.monaco.KeyCode.KeyF,
      () => this.editor?.getAction("editor.action.formatDocument")?.run());

    // Register toolbar actions
    this._registerToolbarActions();

    this._updateFileInfo();
    console.log("[editor] REAL editor mounted");
    return this.editor;
  }

  async openFile(path) {
    this.currentPath = path;
    if (this.storage?.readFile) {
      try {
        const data = await this.storage.readFile(path);
        this.editor.setValue(new TextDecoder().decode(data));
      } catch (e) {
        this.editor.setValue(`// Error reading ${path}: ${e.message}`);
        console.error("[editor] read failed:", e);
      }
    } else {
      this.editor.setValue(`// ${path}\n// File not found or storage unavailable\n`);
    }
    this.editor.updateOptions({ readOnly: false });
    this._dirty = false;
    this._updateFileInfo();
    // Auto-detect language from extension
    const ext = path.split(".").pop().toLowerCase();
    const langMap = {
      js: "javascript", ts: "typescript", py: "python", sh: "shell",
      md: "markdown", json: "json", html: "html", css: "css",
      c: "c", cpp: "cpp", h: "c", rs: "rust", go: "go", rb: "ruby",
      java: "java", sql: "sql", yaml: "yaml", yml: "yaml", toml: "toml",
      xml: "xml", txt: "plaintext",
    };
    const model = this.editor.getModel();
    if (model && langMap[ext]) {
      this.monaco.editor.setModelLanguage(model, langMap[ext]);
    }
    this.editor.focus();
  }

  async save() {
    const value = this.editor.getValue();
    if (this.storage?.writeFile) {
      try {
        await this.storage.writeFile(this.currentPath, new TextEncoder().encode(value));
        this._dirty = false;
        this._updateFileInfo();
        // Brief flash feedback on the footer
        const footer = document.querySelector("#editor-panel .editor-footer");
        if (footer) {
          const origHTML = footer.innerHTML;
          footer.innerHTML = '<span class="save-feedback">✓ Saved</span>';
          setTimeout(() => {
            footer.innerHTML = origHTML;
            this._updateFileInfo();
          }, 1200);
        }
        console.log(`[editor] saved ${this.currentPath} via Storage Worker`);
      } catch (e) {
        console.error("[editor] save failed:", e);
      }
    } else {
      console.warn("[editor] storage.writeFile missing - in-memory only");
    }
  }
}
