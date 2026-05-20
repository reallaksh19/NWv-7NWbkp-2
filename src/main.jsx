import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { registerSW } from './registerSW'
import { runScoringTests } from './utils/testScoring.js';
import { getRuntimeCapabilities } from './runtime/runtimeCapabilities.js';

console.log('[Main] Application starting...');
console.log('[Runtime]', getRuntimeCapabilities());

// Expose scoring test for manual verification
if (typeof window !== 'undefined') {
    window.runScoringTests = runScoringTests;
}

if (import.meta.env.PROD) {
    registerSW();
}

// Initialize Price Alert Web Worker
if (window.Worker) {
    const worker = new Worker(new URL('./priceAlertWorker.js', import.meta.url), { type: 'module' });
    worker.postMessage({ action: 'start', symbols: ['NIFTY', 'SENSEX'], _thresholds: {} });
    worker.onmessage = (e) => {
        console.log('[Main] Worker message:', e.data);
    };
}

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error("Root element not found");

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (e) {
  console.error("Critical Application Failure:", e);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="color: red; padding: 20px; text-align: center;">
        <h1>Application Failed to Start</h1>
        <p>${e.message}</p>
        <pre>${e.stack}</pre>
      </div>
    `;
  }
}
