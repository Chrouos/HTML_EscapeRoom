const fs = require('fs');

function replaceExact(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing patch anchor in ${path}`);
  if (source.indexOf(before, first + 1) >= 0) throw new Error(`Ambiguous patch anchor in ${path}`);
  fs.writeFileSync(path, source.slice(0, first) + after + source.slice(first + before.length));
}

const jsPath = 'public/js/workstation.js';
const readerBefore = [
  "      const content = document.createElement('pre');",
  "      content.dataset.workstationEntryContent = '';",
  "      content.textContent = typeof opened.content === 'string' ? opened.content",
  "        : typeof opened.text === 'string' ? opened.text : '';",
  "      documentPanel.append(documentTitle, content);"
].join('\n');

const readerAfter = [
  "      const content = document.createElement('pre');",
  "      content.dataset.workstationEntryContent = '';",
  "      content.textContent = typeof opened.content === 'string' ? opened.content",
  "        : typeof opened.text === 'string' ? opened.text : '';",
  "      documentPanel.append(documentTitle);",
  "      if (opened.imageUrl) {",
  "        const figure = document.createElement('figure');",
  "        figure.className = `workstation-document-media is-${opened.imageRole === 'atmosphere' ? 'atmosphere' : 'clue'}`;",
  "        figure.dataset.workstationDocumentMedia = '';",
  "        const image = document.createElement('img');",
  "        image.src = opened.imageUrl;",
  "        image.alt = typeof opened.imageAlt === 'string' ? opened.imageAlt : '';",
  "        image.loading = 'lazy';",
  "        image.decoding = 'async';",
  "        image.addEventListener('error', () => figure.remove());",
  "        figure.append(image);",
  "        if (typeof opened.imageCaption === 'string' && opened.imageCaption.trim()) {",
  "          const caption = document.createElement('figcaption');",
  "          caption.textContent = opened.imageCaption;",
  "          figure.append(caption);",
  "        }",
  "        documentPanel.append(figure);",
  "      }",
  "      documentPanel.append(content);"
].join('\n');
replaceExact(jsPath, readerBefore, readerAfter);

replaceExact(
  jsPath,
  "    const suggestionCommands = ['HELP', 'SEARCH <node>', 'SCAN <filename>', 'UNZIP <filename>', 'HINT', 'SEND <text>'];",
  "    const suggestionCommands = ['HELP', 'SEARCH <node>', 'SCAN <filename>', 'UNZIP <filename>', 'UNLOCK <filename>', 'DELETE <filename>', 'ADD <filename>', 'RESTORE <filename>', 'HINT', 'SEND <text>'];"
);

const cssPath = 'public/css/workstation.css';
const css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.workstation-document-media {')) {
  fs.appendFileSync(cssPath, [
    '',
    '.workstation-document-media {',
    '  margin: 0;',
    '  padding: 12px 14px 0;',
    '}',
    '',
    '.workstation-document-media img {',
    '  display: block;',
    '  width: min(100%, 560px);',
    '  max-height: 260px;',
    '  object-fit: cover;',
    '  border: 1px solid #315b57;',
    '  filter: saturate(.72) contrast(1.05);',
    '  opacity: .9;',
    '}',
    '',
    '.workstation-document-media.is-atmosphere img {',
    '  max-height: 190px;',
    '  opacity: .72;',
    '}',
    '',
    '.workstation-document-media figcaption {',
    '  max-width: 560px;',
    '  padding-top: 6px;',
    '  color: #789a98;',
    '  font: 10px/1.55 var(--mono);',
    '}',
    ''
  ].join('\n'));
}

console.log('Reader media and Terminal suggestions patch applied.');
