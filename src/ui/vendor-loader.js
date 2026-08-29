// src/ui/vendor-loader.js - CORS-safe classic <script>/<link> loaders.
// Classic tags are no-cors, so they survive both http:// and file:// origins.
// Used by editor.js (Monaco) and xterm.js (Xterm.js) per Feature 1 / Feature 5.
const cache = new Map();

export function loadScript(src, { globalVar, timeoutMs = 15000 } = {}) {
  if (globalVar && window[globalVar]) return Promise.resolve(window[globalVar]);
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src; el.async = true;
    const to = setTimeout(() => { el.remove(); cache.delete(src);
      reject(new Error(`timeout: ${src}`)); }, timeoutMs);
    el.onload  = () => { clearTimeout(to); resolve(globalVar ? window[globalVar] : true); };
    el.onerror = () => { clearTimeout(to); el.remove(); cache.delete(src);
      reject(new Error(`failed to load ${src}`)); };
    document.head.appendChild(el);
  });
  cache.set(src, p);
  return p;
}

export function loadCSS(href, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if ([...document.querySelectorAll("link")].some(l => l.href === href)) return resolve(true);
    const el = document.createElement("link");
    el.rel = "stylesheet"; el.href = href;
    const to = setTimeout(() => { el.remove(); reject(new Error(`timeout css: ${href}`)); }, timeoutMs);
    el.onload  = () => { clearTimeout(to); resolve(true); };
    el.onerror = () => { clearTimeout(to); el.remove(); reject(new Error(`failed css: ${href}`)); };
    document.head.appendChild(el);
  });
}
