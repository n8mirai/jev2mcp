const editor = document.getElementById('prompt-textarea'),
  picker = document.getElementById('picker');
const { catalog } = await fetch('/api/session').then((r) => r.json());
let count = 0;
function example(value) {
  editor.replaceChildren(document.createTextNode(value));
  editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
  editor.focus();
}
document.getElementById('doc-example').onclick = () =>
  example('Find the latest project brief in my Google Drive and summarize it.');
document.getElementById('plain-example').onclick = () =>
  example('Explain why the sky is blue in one sentence.');
document.getElementById('multi-example').onclick = () =>
  example('Find the meeting time in my latest email and check whether my calendar is free then.');
editor.addEventListener('input', () => {
  const query = editor.textContent.match(/^@([^\n]*)/);
  picker.replaceChildren();
  picker.hidden = !query;
  if (!query) return;
  const options = catalog.filter((p) => query[1].toLowerCase().startsWith(p.mention.toLowerCase()));
  for (const p of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.role = 'option';
    b.textContent = p.name;
    b.onclick = () => {
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.startsWith('@' + p.mention)) {
          node.textContent = node.textContent.slice(p.mention.length + 1);
          break;
        }
      }
      const chip = document.createElement('span');
      chip.contentEditable = 'false';
      chip.dataset.mention = p.id;
      chip.textContent = p.name;
      editor.prepend(chip, document.createTextNode(' '));
      picker.hidden = true;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    };
    picker.append(b);
  }
});
document.getElementById('composer').addEventListener('submit', (event) => {
  event.preventDefault();
  count++;
  document.getElementById('count').textContent = count + ' submissions';
  const entry = document.createElement('article');
  entry.className = 'sent';
  const title = document.createElement('b');
  title.textContent = 'Submitted to local test composer';
  const message = document.createElement('pre');
  message.textContent = editor.innerText;
  const info = document.createElement('p');
  info.textContent =
    'Attached native nodes: ' +
    ([...editor.querySelectorAll('[data-mention]')].map((n) => n.textContent).join(', ') || 'none');
  entry.append(title, message, info);
  document.getElementById('transcript').prepend(entry);
  editor.replaceChildren();
});
