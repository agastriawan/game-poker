import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pokerbarudak.app",
  appName: "Poker Barudak",
  webDir: "public",
  server: {
    // Mengarahkan ke server produksi Vercel agar semua fitur Realtime, 3D GLB, WebRTC Voice, dan Update Instan berjalan mulus
    url: "https://poker-barudak.vercel.app",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#090612",
    appendUserAgent: "PokerBarudakApp",
  },
  plugins: {
    ScreenOrientation: {},
  },
};

export default config;

