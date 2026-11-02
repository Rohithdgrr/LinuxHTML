// Lesson checks inspect only a generated file in v86's temporary 9P filesystem.
// Progress is local, optional browser storage; it never grants access to host files.
const lessons = [
  {id:'hello', title:'Say hello to Linux', duration:'3 min', description:'Meet the shell and create your first text file.', task:'Create the file below with the exact text “hello linux” on a line.', hint:'echo prints a line; > sends the output to the named file.', command: p => `echo 'hello linux' > ${p}`, expected:'hello linux\n'},
  {id:'lines', title:'Make a two-line file', duration:'4 min', description:'Use printf to write more precise output.', task:'Create the file below with two lines: one and two, in that order.', hint:'printf understands \\n as a line break. Single quotes keep the pattern together.', command: p => `printf 'one\\ntwo\\n' > ${p}`, expected:'one\ntwo\n'},
  {id:'pipes', title:'Try your first pipe', duration:'5 min', description:'Connect two commands to transform text.', task:'Write LINUX in uppercase, followed by a line break, to the file below.', hint:'The pipe | sends the output of printf into tr, which changes letters to uppercase.', command: p => `printf 'linux\\n' | tr 'a-z' 'A-Z' > ${p}`, expected:'LINUX\n'},
];
const progressKey = 'linuxhtml-lesson-progress-v1';
let completed = {};
try { const value = JSON.parse(localStorage.getItem(progressKey) || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) completed = value; } catch { /* local progress is optional */ }
let selected = lessons[0];
let attempt = newToken();
const $ = id => document.getElementById(id);
function newToken() { return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2,'0')).join(''); }
function path() { return `/mnt/linuxhtml-${selected.id}-${attempt}.txt`; }
function saveProgress() {
  try { localStorage.setItem(progressKey, JSON.stringify(completed)); return true; }
  catch { return false; }
}
function render() {
  const list = $('lesson-list');
  list.replaceChildren();
  lessons.forEach((lesson, index) => {
    const button = document.createElement('button');
    button.className = 'lesson-card' + (lesson.id === selected.id ? ' selected' : '');
    button.setAttribute('aria-pressed', String(lesson.id === selected.id));
    const badge = document.createElement('span'); badge.className = 'lesson-card-number'; badge.textContent = completed[lesson.id] === true ? '✓' : String(index + 1).padStart(2,'0');
    const body = document.createElement('span'); const title = document.createElement('strong'); title.textContent = lesson.title;
    const sub = document.createElement('small'); sub.textContent = `${lesson.duration} · ${completed[lesson.id] === true ? 'Completed' : 'Not started'}`;
    body.append(title, sub); button.append(badge, body);
    button.addEventListener('click', () => { selected = lesson; attempt = newToken(); $('lesson-feedback').textContent = ''; render(); });
    list.append(button);
  });
  $('lesson-progress').textContent = `${lessons.filter(l => completed[l.id] === true).length} / ${lessons.length} complete`;
  $('lesson-number').textContent = `LESSON ${String(lessons.indexOf(selected) + 1).padStart(2,'0')} / 03`;
  $('lesson-title').textContent = selected.title;
  $('lesson-description').textContent = selected.description;
  $('lesson-task').textContent = `${selected.task} ${path()}`;
  $('lesson-command').textContent = selected.command(path());
  $('lesson-hint-text').textContent = selected.hint;
}
$('copy-lesson-command').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(selected.command(path())); $('lesson-feedback').textContent = 'Command copied. Paste it into the Linux terminal.'; }
  catch { $('lesson-feedback').textContent = 'Clipboard unavailable. Select the example command and copy it manually.'; }
});
$('type-lesson').addEventListener('click', () => {
  if (!window.linuxhtmlGuestReady || !window.linuxhtmlVM) { $('lesson-feedback').textContent = 'Start the Linux VM in Terminal and wait for the shell first.'; return; }
  document.querySelector('.dock-button[data-open="terminal"]').click();
  window.linuxhtmlVM.serial0_send(selected.command(path()));
  $('lesson-feedback').textContent = 'Example typed in the terminal. Review it and press Enter to run it.';
});
$('check-lesson').addEventListener('click', async () => {
  const feedback = $('lesson-feedback');
  if (!window.linuxhtmlGuestReady || !window.linuxhtmlVM) { feedback.textContent = 'Start the Linux VM in Terminal and wait for the shell, then run the command.'; return; }
  const lesson = selected, currentAttempt = attempt;
  try {
    const data = await window.linuxhtmlVM.read_file(`/linuxhtml-${lesson.id}-${currentAttempt}.txt`);
    if (selected !== lesson || currentAttempt !== attempt) return;
    if (new TextDecoder().decode(data) !== lesson.expected) { feedback.textContent = 'Not quite yet. Check the file contents and try again. The hint may help.'; return; }
    completed[lesson.id] = true;
    const saved = saveProgress();
    feedback.textContent = saved ? 'Nice work! Exercise complete. Progress saved in this browser.' : 'Nice work! Exercise complete, but progress could not be saved in this browser.';
    render();
  } catch {
    if (selected === lesson && currentAttempt === attempt) feedback.textContent = 'File not found yet. Run the example in the Linux terminal, then check again.';
  }
});
$('reset-lesson').addEventListener('click', () => {
  if (!confirm('Start a new attempt? This clears this lesson’s completion status and chooses a new file. It does not delete previous guest files.')) return;
  delete completed[selected.id];
  const saved = saveProgress(); attempt = newToken();
  $('lesson-feedback').textContent = saved ? 'New attempt ready. Previous guest files were not deleted.' : 'New attempt ready, but progress could not be saved in this browser.';
  render();
});
render();
