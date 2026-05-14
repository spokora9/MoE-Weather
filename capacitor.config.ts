import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moeweather.app',
  appName: 'MoE Weather',
  webDir: 'public',

  // Server configuration for development
  server: {
    // For production, the app loads from local files
    // For development, you can use your Vercel URL:
    // url: 'https://your-vercel-app.vercel.app',
    cleartext: true, // Allow HTTP for development
    androidScheme: 'https',
  },

  // Android-specific configuration
  android: {
    // Support older Android versions (Android 6.0+, API 23+)
    minWebViewVersion: 60,
    allowMixedContent: true,
    backgroundColor: '#f0f4f8',

    // Build configuration
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      signingType: 'apksigner',
    },
  },

  // iOS-specific configuration
  ios: {
    backgroundColor: '#f0f4f8',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'MoE Weather',
  },

  // Plugins configuration
  plugins: {
    // Splash screen
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#3b82f6',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },

    // Status bar
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#3b82f6',
    },

    // Keyboard
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
