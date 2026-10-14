import { StrictMode } from 'react';
import { MotionConfig } from 'motion/react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);

// Dev bench for the microphone detector: window.__runPitch() in the console.
if (import.meta.env.DEV) {
  (window as unknown as { __runPitch: unknown }).__runPitch = async (tuning?: object) =>
    (await import('./dev/pitchTest')).runPitchTest(tuning);
}

// The prediction model's report card: window.__predict() in the console.
if (import.meta.env.DEV) {
  (window as unknown as { __predict: unknown }).__predict = async () => {
    const { calibration } = await import('./lib/predict');
    const c = calibration();
    console.table(c.buckets);
    return c;
  };
}
