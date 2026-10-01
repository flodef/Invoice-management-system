import { createRoot } from 'react-dom/client';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import './index.css';
import App from './App';
import { registerServiceWorker } from './registerServiceWorker';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Only register in production builds — during dev the precache would serve
// stale assets. Required for PWA installability (Chrome needs an active SW
// with a fetch handler alongside the manifest).
if (import.meta.env.PROD) {
  registerServiceWorker();
}

createRoot(document.getElementById('root')!).render(
  <ConvexAuthProvider client={convex}>
    <App />
  </ConvexAuthProvider>,
);
