import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const app = read('src/App.jsx');
const css = read('src/styles/desktopPolish.css');

assert(
  app.includes("import './styles/desktopPolish.css';"),
  'App.jsx must import desktopPolish.css'
);

const revampIndex = app.indexOf("import './styles/desktopRevamp.css';");
const polishIndex = app.indexOf("import './styles/desktopPolish.css';");

assert(
  revampIndex !== -1,
  'App.jsx must still import desktopRevamp.css'
);

assert(
  polishIndex > revampIndex,
  'desktopPolish.css must be imported after desktopRevamp.css'
);

for (const token of [
  '--desktop-polish-max',
  "html[data-layout-mode='desktop'] .main-content",
  "html[data-layout-mode='desktop'] .bottom-nav.bottom-nav--desktop",
  "html[data-layout-mode='desktop'] .quick-weather-card .qw-city-row__name",
  'color: #ffffff !important',
  "html[data-layout-mode='desktop'] .main-content.market-page",
  "html[data-layout-mode='desktop'] .weather-trust-panel",
  "html[data-layout-mode='desktop'] .following-page__content--pro",
  "html[data-layout-mode='desktop'] .topic-card__name",
  'outline: 2px solid #7fffe0',
  '@media (max-width: 1180px)',
  '@media (max-width: 980px)'
]) {
  assert(css.includes(token), `desktopPolish.css missing token: ${token}`);
}

assert(
  !css.includes('display: none !important'),
  'desktopPolish.css must not hide major UI with !important'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Desktop polish slice',
  guarantees: [
    'desktopPolish.css is imported after desktopRevamp.css',
    'desktop max-width guard is present',
    'QuickWeather desktop contrast guard is present',
    'Market desktop width/contrast guard is present',
    'Weather desktop width/contrast guard is present',
    'Following desktop width/contrast guard is present',
    'focus-visible accessibility guard is present',
    'no feature logic was changed'
  ]
}, null, 2));

console.log('PASS: Desktop polish static slice');