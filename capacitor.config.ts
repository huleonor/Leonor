import type { CapacitorConfig } from '@capacitor/cli';

// The iPhone app loads the live site, so a Vercel deploy updates the phone without a new .ipa.
// LIVE_URL=http://<mac-ip>:5173 points it at the Mac's dev server instead; LOCAL=1 ships only the bundled copy.
const url = process.env.LOCAL === '1' ? undefined : process.env.LIVE_URL ?? 'https://hugos-piano.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.hugoleonor.hugospiano',
  appName: "Hugo's Piano",
  webDir: 'dist',
  server: url ? {
    url,
    cleartext: url.startsWith('http://'),
    // No connection: fall back to the copy bundled inside the app.
    errorPath: 'index.html',
  } : undefined,
  // Keep the app inspectable from Safari on the Mac and its logs visible in the device console,
  // so input problems on the phone can be traced.
  loggingBehavior: 'production',
  ios: {
    webContentsDebuggingEnabled: true,
    contentInset: 'never',
    // Let Web Audio keep playing with the silent switch on, like a music app.
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
