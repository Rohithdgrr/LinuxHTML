const launcher = document.querySelector('#launcher');
const launcherToggle = document.querySelector('#launcher-toggle');
const layer = document.querySelector('.window-layer');
const desktop = document.querySelector('#desktop');
const windows = [...document.querySelectorAll('.app-window')];
let z = 10;
function setLauncher(open) {
  launcher.hidden = !open;
  launcherToggle.setAttribute('aria-expanded', String(open));
  launcherToggle.setAttribute('aria-label', open ? 'Close app launcher' : 'Open app launcher');
}
function markOpen(name, open) {
  document.querySelectorAll(`.dock-button[data-open="${name}"]`).forEach(el => el.classList.toggle('is-open', open));
}
function openWindow(name) {
  const win = windows.find(item => item.dataset.window === name);
  if (!win) return;
  setLauncher(false);
  win.hidden = false;
  // A hidden window may have been positioned on a larger viewport.
  if (win.style.left && !win.classList.contains('maximized')) {
    const g = geometry(win); setGeometry(win, g.x, g.y, g.width, g.height);
  }
  win.style.zIndex = ++z;
  markOpen(name, true);
  win.querySelector('[data-close]')?.focus({ preventScroll: true });
}
function hideWindow(win) {
  win.hidden = true;
  markOpen(win.dataset.window, false);
  document.querySelector(`.dock-button[data-open="${win.dataset.window}"]`)?.focus({ preventScroll: true });
}
function maximize(win) {
  const button = win.querySelector('[data-maximize]');
  if (win.classList.contains('maximized')) {
    win.classList.remove('maximized');
    button.setAttribute('aria-label', `Maximize ${win.getAttribute('aria-label')}`);
    button.title = 'Maximize';
    button.textContent = '□';
  } else {
    win.classList.add('maximized');
    button.setAttribute('aria-label', `Restore ${win.getAttribute('aria-label')}`);
    button.title = 'Restore';
    button.textContent = '❐';
  }
}
function setGeometry(win, x, y, width, height) {
  const bounds = layer.getBoundingClientRect();
  const minW = Math.min(300, bounds.width - 20), minH = Math.min(190, bounds.height - 20);
  width = Math.max(minW, Math.min(width, bounds.width - 20));
  height = Math.max(minH, Math.min(height, bounds.height - 10));
  x = Math.max(10, Math.min(x, bounds.width - width - 10));
  y = Math.max(0, Math.min(y, bounds.height - height));
  Object.assign(win.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`, transform: 'none' });
}
function geometry(win) {
  const rect = win.getBoundingClientRect(), bounds = layer.getBoundingClientRect();
  return {x: rect.left - bounds.left, y: rect.top - bounds.top, width: rect.width, height: rect.height};
}
function pointerGeometry(win, handle, mode) {
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button') && mode === 'move' || win.classList.contains('maximized')) return;
    const start = geometry(win), px = event.clientX, py = event.clientY;
    setGeometry(win, start.x, start.y, start.width, start.height);
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
    const move = e => {
      const dx = e.clientX - px, dy = e.clientY - py;
      if (mode === 'move') setGeometry(win, start.x + dx, start.y + dy, start.width, start.height);
      else setGeometry(win, start.x, start.y, start.width + dx, start.height + dy);
    };
    const end = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
}
// Add the same controls to every window; hiding a terminal does not stop the VM.
for (const win of windows) {
  const name = win.getAttribute('aria-label');
  const titlebar = win.querySelector('.window-titlebar');
  titlebar.tabIndex = 0;
  titlebar.setAttribute('aria-label', `${name} title bar. Use arrow keys to move this window.`);
  const controls = win.querySelector('.window-controls');
  const minimize = document.createElement('button');
  minimize.setAttribute('aria-label', `Minimize ${name}`); minimize.title = 'Minimize'; minimize.textContent = '−'; minimize.dataset.minimize = '';
  const max = document.createElement('button');
  max.setAttribute('aria-label', `Maximize ${name}`); max.title = 'Maximize'; max.textContent = '□'; max.dataset.maximize = '';
  controls.prepend(minimize, max);
  const resize = document.createElement('button');
  resize.className = 'resize-handle'; resize.setAttribute('aria-label', `Resize ${name}. Use arrow keys.`); resize.title = 'Resize window';
  win.append(resize);
  pointerGeometry(win, titlebar, 'move');
  pointerGeometry(win, resize, 'resize');
  titlebar.addEventListener('keydown', event => {
    if (event.target !== titlebar || win.classList.contains('maximized')) return;
    const steps = {ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20]};
    if (!steps[event.key]) return;
    event.preventDefault(); const g = geometry(win), [dx, dy] = steps[event.key]; setGeometry(win, g.x + dx, g.y + dy, g.width, g.height);
  });
  resize.addEventListener('keydown', event => {
    if (win.classList.contains('maximized')) return;
    const steps = {ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20]};
    if (!steps[event.key]) return;
    event.preventDefault(); const g = geometry(win), [dx, dy] = steps[event.key]; setGeometry(win, g.x, g.y, g.width + dx, g.height + dy);
  });
  win.addEventListener('pointerdown', () => { win.style.zIndex = ++z; });
  win.addEventListener('focusin', () => { win.style.zIndex = ++z; });
}
document.addEventListener('click', event => {
  const opener = event.target.closest('[data-open]');
  if (opener) openWindow(opener.dataset.open);
  const closer = event.target.closest('[data-close], [data-minimize]');
  if (closer) hideWindow(closer.closest('.app-window'));
  const max = event.target.closest('[data-maximize]');
  if (max) maximize(max.closest('.app-window'));
});
launcherToggle.addEventListener('click', () => setLauncher(launcher.hidden));
document.querySelector('#close-launcher').addEventListener('click', () => { setLauncher(false); launcherToggle.focus(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !launcher.hidden) { setLauncher(false); launcherToggle.focus(); } });
const choices = [...document.querySelectorAll('.theme-choice[data-theme]')];
function applyTheme(theme) {
  if (!['aurora', 'night'].includes(theme)) theme = 'aurora';
  desktop.dataset.theme = theme;
  choices.forEach(choice => { const active = choice.dataset.theme === theme; choice.classList.toggle('active', active); choice.setAttribute('aria-pressed', String(active)); });
}
try { applyTheme(localStorage.getItem('linuxhtml-theme') || 'aurora'); } catch { applyTheme('aurora'); }
choices.forEach(button => button.addEventListener('click', () => {
  applyTheme(button.dataset.theme);
  try { localStorage.setItem('linuxhtml-theme', button.dataset.theme); document.querySelector('#theme-status').textContent = 'Appearance saved in this browser.'; }
  catch { document.querySelector('#theme-status').textContent = 'Appearance changed for this session; browser storage is unavailable.'; }
}));
// Keep windows reachable if the viewport is resized or the device rotates.
window.addEventListener('resize', () => {
  for (const win of windows) if (!win.hidden && !win.classList.contains('maximized') && win.style.left) {
    const g = geometry(win); setGeometry(win, g.x, g.y, g.width, g.height);
  }
});
function updateClock() {
  document.querySelector('#clock').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date());
}
updateClock(); setInterval(updateClock, 30000);
