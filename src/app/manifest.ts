import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Poker Barudak",
    short_name: "PokerBarudak",
    description:
      "Game kartu online multiplayer tongkrongan dengan karakter 3D dan WebRTC voice chat.",
    start_url: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#090612",
    theme_color: "#090612",
    icons: [
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

