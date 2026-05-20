const fs = require('fs');

// 1. /app/public/sw.js
let sw = fs.readFileSync('/app/public/sw.js', 'utf8');
sw = '/* eslint-env serviceworker */\n' + sw;
sw = sw.replace(/catch \(error\)/g, 'catch (_error)');
fs.writeFileSync('/app/public/sw.js', sw);

// 2. /app/scripts/benchmark_run.js
let benchRun = fs.readFileSync('/app/scripts/benchmark_run.js', 'utf8');
benchRun = benchRun.replace(/global\.fetch = async \(url, options\) => \{/g, 'global.fetch = async (url, _options) => {');
benchRun = benchRun.replace(/const \{ fetchIndices \} = await import\('\.\.\/src\/services\/indianMarketService\.js'\);/g, 'const { _fetchIndices } = await import(\'../src/services/indianMarketService.js\');');
benchRun = benchRun.replace(/const \{ getSettings, saveSettings \}/g, 'const { saveSettings }');
benchRun = benchRun.replace(/const end = performance\.now\(\);\n        \/\/ Log is handled inside fn usually, but if not:\n        \/\/ logResult/g, '// const end = performance.now();\n        // Log is handled inside fn usually, but if not:\n        // logResult');
benchRun = benchRun.replace(/const score = computeImpactScore\(item, 'world', 0\);/g, 'const _score = computeImpactScore(item, \'world\', 0);');
fs.writeFileSync('/app/scripts/benchmark_run.js', benchRun);

// 3. /app/scripts/benchmark_suite.js
let benchSuite = fs.readFileSync('/app/scripts/benchmark_suite.js', 'utf8');
benchSuite = benchSuite.replace(/const \{ extractFutureDate, detectCategory \} = await import\('\.\.\/src\/services\/upAheadService\.js'\);/g, 'const { extractFutureDate } = await import(\'../src/services/upAheadService.js\');');
fs.writeFileSync('/app/scripts/benchmark_suite.js', benchSuite);

// 4. /app/src/App.jsx
let app = fs.readFileSync('/app/src/App.jsx', 'utf8');
app = app.replace(/let timerOut;\n/g, '');
app = app.replace(/timer = setInterval\(\(\) => \{/g, 'const timerOut = setTimeout(() => { timer = setInterval(() => {');
app = app.replace(/\}, 200\);\n    \} else \{/g, '}, 200); }, 0);\n    } else {');
app = app.replace(/return \(\) => clearInterval\(timer\);/g, 'return () => {\n      clearInterval(timer);\n      if (typeof timerOut !== \'undefined\') clearTimeout(timerOut);\n    };');
fs.writeFileSync('/app/src/App.jsx', app);

// 5. /app/src/components/WeatherIcons.jsx
let weatherIcons = fs.readFileSync('/app/src/components/WeatherIcons.jsx', 'utf8');
weatherIcons = weatherIcons.replace(/getIconId,\s*/g, '');
fs.writeFileSync('/app/src/components/WeatherIcons.jsx', weatherIcons);

// 6. Fix AppIcons and Contexts (Fast refresh exports warning)
const contexts = ['/app/src/context/SegmentContext.jsx', '/app/src/context/SettingsContext.jsx', '/app/src/context/TopicContext.jsx', '/app/src/context/WeatherContext.jsx', '/app/src/components/AppIcons.jsx'];
for (const file of contexts) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('eslint-disable react-refresh/only-export-components')) {
        content = '/* eslint-disable react-refresh/only-export-components */\n' + content;
        fs.writeFileSync(file, content);
    }
}

// 7. /app/src/context/TopicContext.jsx missing dep
let topicContext = fs.readFileSync('/app/src/context/TopicContext.jsx', 'utf8');
topicContext = topicContext.replace(/}, \[\]\); \/\/ Load once on mount/g, '}, [refreshTopics]); // Load once on mount');
fs.writeFileSync('/app/src/context/TopicContext.jsx', topicContext);

// 8. /app/src/hooks/useWatchlist.js
let useWatchlist = fs.readFileSync('/app/src/hooks/useWatchlist.js', 'utf8');
useWatchlist = useWatchlist.replace(/import \{ useState, useEffect \} from 'react';/, 'import { useState } from \'react\';');
fs.writeFileSync('/app/src/hooks/useWatchlist.js', useWatchlist);

// 9. /app/src/intelligence/classification.js
let classification = fs.readFileSync('/app/src/intelligence/classification.js', 'utf8');
classification = classification.replace(/const countMatches =/g, '// eslint-disable-next-line no-unused-vars\nconst countMatches =');
fs.writeFileSync('/app/src/intelligence/classification.js', classification);

// 10. /app/src/pages/FollowingPage.jsx
let followingPage = fs.readFileSync('/app/src/pages/FollowingPage.jsx', 'utf8');
followingPage = followingPage.replace(/const \{ topics, refreshTopics \} = useTopics\(\);/g, 'const { topics } = useTopics();');
fs.writeFileSync('/app/src/pages/FollowingPage.jsx', followingPage);

// 11. /app/src/pages/MainPage.jsx
let mainPage = fs.readFileSync('/app/src/pages/MainPage.jsx', 'utf8');
mainPage = mainPage.replace(/const isDesktop = useMediaQuery\(\{\n    query: '\(min-width: 1024px\)'\n  \}\);/g, '');
fs.writeFileSync('/app/src/pages/MainPage.jsx', mainPage);

// 12. /app/src/pages/MyPlannerPage.jsx
let myPlannerPage = fs.readFileSync('/app/src/pages/MyPlannerPage.jsx', 'utf8');
myPlannerPage = myPlannerPage.replace(/import React, \{ useState, useEffect, useRef \} from 'react';/g, 'import React, { useState, useEffect } from \'react\';');
fs.writeFileSync('/app/src/pages/MyPlannerPage.jsx', myPlannerPage);

// 13. /app/src/pages/NewspaperPage.jsx
let newspaperPage = fs.readFileSync('/app/src/pages/NewspaperPage.jsx', 'utf8');
newspaperPage = newspaperPage.replace(/const \{ proxyManager \} = useSettings\(\);/g, 'useSettings();'); // Or completely remove if not needed, we'll replace with useSettings() to keep other effects
fs.writeFileSync('/app/src/pages/NewspaperPage.jsx', newspaperPage);

// 14. /app/src/pages/TechSocialPage.jsx
let techSocialPage = fs.readFileSync('/app/src/pages/TechSocialPage.jsx', 'utf8');
techSocialPage = techSocialPage.replace(/, settings\.freshnessLimitHours\]\);/g, ']);');
fs.writeFileSync('/app/src/pages/TechSocialPage.jsx', techSocialPage);

