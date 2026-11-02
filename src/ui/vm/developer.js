// Shell-only starters; do not claim language runtimes that the current guest lacks.
const templates = {
  hello: {name:'hello.sh', content:"#!/bin/sh\n# Your first shell script\necho 'Hello from LinuxHTML!'\n"},
  system: {name:'system.sh', content:"#!/bin/sh\n# A little snapshot of this Linux guest\necho 'Hello from your Linux guest'\necho 'Current directory:'\npwd\necho 'Kernel information:'\nuname -a\n"},
};
let selected = 'hello';
const status = document.querySelector('#dev-status');
function render() {
  const template = templates[selected];
  document.querySelector('#dev-preview-title').textContent = template.name;
  document.querySelector('#dev-preview-code').textContent = template.content;
  document.querySelectorAll('.dev-template').forEach(button => {
    const active = button.dataset.template === selected;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
document.querySelectorAll('.dev-template').forEach(button => button.addEventListener('click', () => {
  selected = button.dataset.template;
  status.textContent = '';
  render();
}));
document.querySelector('#dev-open-template').addEventListener('click', () => {
  const event = new CustomEvent('workspace:template', {cancelable:true, detail: templates[selected]});
  if (!window.dispatchEvent(event)) { status.textContent = 'Current editor content was kept.'; return; }
  document.querySelector('.dock-button[data-open="workspace"]').click();
  status.textContent = 'Template opened in the editor. Save locally before closing or reloading.';
});
render();
