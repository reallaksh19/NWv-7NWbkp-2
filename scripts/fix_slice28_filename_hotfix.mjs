import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`patched: ${path}`);
}

function patchFile(path, patcher) {
  const before = read(path);
  const after = patcher(before);
  if (after !== before) write(path, after);
  else console.log(`no change needed: ${path}`);
}

patchFile('src/utils/calendar.js', source => {
  const oldLine =
    "    downloadICS(sanitizeFilename(filename).endsWith('.ics') ? sanitizeFilename(filename) : `${sanitizeFilename(filename)}.ics`, content);";

  const newBlock = `    const rawFilename = String(filename || 'nwv7_planner_selection.ics');
    const hasIcsExtension = rawFilename.toLowerCase().endsWith('.ics');
    const baseName = hasIcsExtension ? rawFilename.slice(0, -4) : rawFilename;
    const safeFilename = \`\${sanitizeFilename(baseName)}.ics\`;

    downloadICS(safeFilename, content);`;

  if (!source.includes(oldLine)) {
    if (source.includes('const rawFilename = String(filename ||')) return source;
    throw new Error('Old filename downloadICS line not found in calendar.js');
  }

  return source.replace(oldLine, newBlock);
});

patchFile('scripts/test_calendar_export_quality_static.mjs', source => {
  let text = source;

  const anchor = "  'PRODID:-//NWv7//Planner Calendar Export//EN',";

  if (!text.includes("'rawFilename'")) {
    text = text.replace(
      anchor,
      `${anchor}
  'rawFilename',
  'hasIcsExtension',
  'baseName',
  'safeFilename',`
    );
  }

  return text;
});

console.log('Slice 28 filename hotfix applied.');
