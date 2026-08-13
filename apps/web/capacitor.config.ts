import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Packages the static Next.js export into an Android app.
 *
 * `webDir` points at `out/`, which `MOBILE=1 next build` produces. Everything
 * the app renders comes from `lib/mock-data.ts`, so the bundle is fully
 * self-contained: no server, no API, and the app works with the phone offline.
 * When the real API is wired up, this gains a `server.url` (or the fetch layer
 * gains a base URL) and the rest of the setup is unchanged.
 */
const config: CapacitorConfig = {
  appId: 'app.zitto.dragontiger',
  appName: 'Zitto',
  webDir: 'out',

  android: {
    // Matches --surface-bg, so there is no white flash between the splash
    // screen and the first paint.
    backgroundColor: '#0A0A0F',
    // Debug builds only — lets Chrome DevTools attach over USB.
    webContentsDebuggingEnabled: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#0A0A0F',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSplashResourceName: 'splash',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0A0F',
    },
  },
};

export default config;
