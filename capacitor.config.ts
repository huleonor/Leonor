import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hugoleonor.hugospiano',
  appName: "Hugo's Piano",
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    // Let Web Audio keep playing with the silent switch on, like a music app.
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
