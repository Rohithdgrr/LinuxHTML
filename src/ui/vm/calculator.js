// A deliberately small arithmetic parser; no eval, Function, or guest execution.
export function calculate(input) {
  if (typeof input !== 'string' || input.length > 256) throw new Error('Expression is too long.');
  const source = input.replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/[−]/g, '-');
  let pos = 0, tokens = 0, depth = 0;
  const spaces = () => { while (/\s/.test(source[pos] || '') && pos < source.length) pos++; };
  function atom() {
    spaces(); if (++tokens > 256) throw new Error('Expression is too complex.');
    if (++depth > 32) throw new Error('Too many nested operations.');
    try {
      if (source[pos] === '+' || source[pos] === '-') { const op = source[pos++]; const value = atom(); return op === '-' ? -value : value; }
      if (source[pos] === '(') {
        pos++; const value = sum(); spaces();
        if (source[pos] !== ')') throw new Error('Missing closing parenthesis.');
        pos++; return value;
      }
      const number = source.slice(pos).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!number) throw new Error('Enter a valid number or expression.');
      pos += number[0].length;
      const value = Number(number[0]);
      if (!Number.isFinite(value)) throw new Error('Number is too large.');
      return value;
    } finally { depth--; }
  }
  function product() {
    let value = atom();
    while (true) {
      spaces(); const op = source[pos];
      if (op !== '*' && op !== '/') return value;
      pos++; const next = atom();
      if (op === '/' && next === 0) throw new Error('Cannot divide by zero.');
      value = op === '*' ? value * next : value / next;
      if (!Number.isFinite(value)) throw new Error('Result is too large.');
    }
  }
  function sum() {
    let value = product();
    while (true) {
      spaces(); const op = source[pos];
      if (op !== '+' && op !== '-') return value;
      pos++; const next = product(); value = op === '+' ? value + next : value - next;
      if (!Number.isFinite(value)) throw new Error('Result is too large.');
    }
  }
  if (!source.trim()) throw new Error('Enter an expression first.');
  const result = sum(); spaces();
  if (pos !== source.length) throw new Error('Unexpected character or operator.');
  return Object.is(result, -0) ? 0 : result;
}
const input = document.querySelector('#calc-expression');
const result = document.querySelector('#calc-result');
const message = document.querySelector('#calc-message');
let lastResult = null;
function clearMessage() { message.textContent = 'Supports +, −, ×, ÷ and parentheses. Calculations stay on this device.'; }
function run() {
  try {
    const value = calculate(input.value);
    lastResult = String(Number(value.toPrecision(12)));
    result.textContent = lastResult;
    message.textContent = 'Calculated locally. Results use floating-point arithmetic.';
  } catch (e) { lastResult = null; result.textContent = '—'; message.textContent = e.message; }
}
function insert(value) {
  const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? input.value.length;
  if (input.value.length - (end - start) + value.length > 256) { message.textContent = 'Expression is too long.'; return; }
  input.setRangeText(value, start, end, 'end'); lastResult = null; result.textContent = '—'; input.focus(); clearMessage();
}
function backspace() {
  const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? input.value.length;
  if (start !== end) input.setRangeText('', start, end, 'end');
  else if (start > 0) input.setRangeText('', start - 1, end, 'end');
  lastResult = null; result.textContent = '—'; input.focus(); clearMessage();
}
document.querySelector('.calculator-keypad').addEventListener('click', event => {
  const button = event.target.closest('[data-calc]'); if (!button) return;
  const action = button.dataset.calc;
  if (action === 'equals') run();
  else if (action === 'clear') { input.value = ''; result.textContent = '0'; lastResult = null; clearMessage(); input.focus(); }
  else if (action === 'back') backspace();
  else insert(action);
});
input.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); run(); } else if (event.key === 'Escape') { input.value = ''; result.textContent = '0'; lastResult = null; clearMessage(); } });
input.addEventListener('input', () => { lastResult = null; result.textContent = '—'; clearMessage(); });
document.querySelector('#calc-copy').addEventListener('click', async () => {
  if (lastResult === null) { message.textContent = 'Calculate a result before copying.'; return; }
  try { await navigator.clipboard.writeText(lastResult); message.textContent = 'Result copied to the clipboard.'; }
  catch { message.textContent = 'Clipboard access unavailable. Select the result to copy it manually.'; }
});
