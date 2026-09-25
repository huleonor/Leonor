import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dev bench for the microphone detector: window.__runPitch() in the console.
if (import.meta.env.DEV) {
  (window as unknown as { __runPitch: unknown }).__runPitch = async (tuning?: object) =>
    (await import('./dev/pitchTest')).runPitchTest(tuning);
}
