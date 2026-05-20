const fs = require('fs');
const archiver = require('archiver');

const output = fs.createWriteStream('insight_module_with_UI.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => console.log(archive.pointer() + ' total bytes'));
archive.pipe(output);

archive.directory('src/insight/', 'insight');
archive.directory('src/adapters/', 'adapters');
archive.file('src/pages/InsightPage.jsx', { name: 'InsightPage.jsx' });
archive.file('src/styles/InsightPage.css', { name: 'InsightPage.css' });
archive.file('src/App.jsx', { name: 'App.jsx' });

archive.finalize();
