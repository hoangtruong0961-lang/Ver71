import { Buffer } from 'buffer';
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './src/context/ThemeContext';
import './src/services/log/logService'; // Initialize log capturing
import './src/services/api/tavoApi'; // Initialize Tavo API
import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return;

    // Keep Netlify-hosted clients updated without waiting for a hard refresh.
    setInterval(() => {
      if (registration.installing) return;
      registration.update().catch((error) => {
        console.warn(`Unable to update service worker ${swUrl}`, error);
      });
    }, 60 * 60 * 1000);
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);