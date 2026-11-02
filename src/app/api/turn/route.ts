import { NextResponse } from "next/server";

// Fallback kredensial TURN resmi Metered jika API eksternal lambat
const FALLBACK_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.relay.metered.ca:80" },
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "13bcc5733007d4b9af2373e3",
    credential: "odcU0RpbnfVtTki2",
  },
  {
    urls: "turn:global.relay.metered.ca:80?transport=tcp",
    username: "13bcc5733007d4b9af2373e3",
    credential: "odcU0RpbnfVtTki2",
  },
  {
    urls: "turn:global.relay.metered.ca:443",
    username: "13bcc5733007d4b9af2373e3",
    credential: "odcU0RpbnfVtTki2",
  },
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "13bcc5733007d4b9af2373e3",
    credential: "odcU0RpbnfVtTki2",
  },
];

let cachedServers: any = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 1000 * 60 * 30; // 30 menit

export async function GET() {
  const now = Date.now();
  if (cachedServers && now - lastFetchTime < CACHE_DURATION_MS) {
    return NextResponse.json(cachedServers);
  }

  const domain = process.env.METERED_DOMAIN || "pokerbarudak.metered.live";
  const secretKey =
    process.env.METERED_SECRET_KEY ||
    "b9wc497UHvkloYIzAlxWjIc5_kTYDExCS5f8bnoS_Z_YFmPz";

  try {
    const credRes = await fetch(
      `https://${domain}/api/v1/turn/credential?secretKey=${secretKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );

    if (!credRes.ok) {
      throw new Error(`Metered POST error: ${credRes.status}`);
    }

    const credData = await credRes.json();
    const apiKey = credData.apiKey;

    const serversRes = await fetch(
      `https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`,
      { cache: "no-store" }
    );

    if (!serversRes.ok) {
      throw new Error(`Metered GET error: ${serversRes.status}`);
    }

    const iceServers = await serversRes.json();
    const combined = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      ...iceServers,
    ];

    cachedServers = combined;
    lastFetchTime = now;
    return NextResponse.json(combined);
  } catch (error) {
    console.warn("Using fallback Metered TURN configuration:", error);
    return NextResponse.json(FALLBACK_ICE_SERVERS);
  }
}

