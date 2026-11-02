"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { PlayerState } from "./types";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
};

type SignalPayload =
  | {
      type: "peer-ready";
      from: string;
      micOn: boolean;
    }
  | {
      type: "mic-status";
      from: string;
      micOn: boolean;
      speaking: boolean;
    }
  | {
      type: "offer";
      from: string;
      to: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: "answer";
      from: string;
      to: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: "ice-candidate";
      from: string;
      to: string;
      candidate: RTCIceCandidateInit;
    };

interface UseVoiceChatOptions {
  roomCode: string;
  myPlayerId: string;
  players: PlayerState[];
}

export interface VoiceChatState {
  micEnabled: boolean;
  speakerEnabled: boolean;
  isConnectingMic: boolean;
  micError: string | null;
  /** Map playerId -> apakah mic mereka sedang ON */
  peerMicOn: Record<string, boolean>;
  /** Map playerId -> apakah mereka sedang berbicara */
  peerSpeaking: Record<string, boolean>;
  toggleMic: () => Promise<void>;
  toggleSpeaker: () => void;
}

export function useVoiceChat({
  roomCode,
  myPlayerId,
  players,
}: UseVoiceChatOptions): VoiceChatState {
  const [micEnabled, setMicEnabled] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [isConnectingMic, setIsConnectingMic] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [peerMicOn, setPeerMicOn] = useState<Record<string, boolean>>({});
  const [peerSpeaking, setPeerSpeaking] = useState<Record<string, boolean>>({});

  const channelRef = useRef<ReturnType<
    NonNullable<ReturnType<typeof getSupabaseClient>>["channel"]
  > | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>(
    {}
  );
  const makingOfferRef = useRef<Record<string, boolean>>({});
  const remoteAudioElsRef = useRef<Record<string, HTMLAudioElement>>({});
  const micEnabledRef = useRef(false);
  const speakerEnabledRef = useRef(true);
  const localSpeakingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    speakerEnabledRef.current = speakerEnabled;
    Object.values(remoteAudioElsRef.current).forEach((el) => {
      el.muted = !speakerEnabled;
    });
  }, [speakerEnabled]);

  const sendSignal = useCallback((payload: SignalPayload) => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({
      type: "broadcast",
      event: "voice-signal",
      payload,
    }).catch(() => {
      // ignore broadcast transient errors
    });
  }, []);

  const attachRemoteStream = useCallback(
    (peerId: string, stream: MediaStream) => {
      if (typeof document === "undefined") return;
      let audioEl = remoteAudioElsRef.current[peerId];
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        audioEl.setAttribute("playsinline", "true");
        (audioEl as any).playsInline = true;
        // PENTING: Gunakan position fixed offscreen, BUKAN display: none
        // karena browser mobile/Chromium WebView mematikan decoding audio jika display: none!
        audioEl.style.position = "fixed";
        audioEl.style.left = "-9999px";
        audioEl.style.top = "-9999px";
        audioEl.style.width = "1px";
        audioEl.style.height = "1px";
        audioEl.style.opacity = "0";
        audioEl.style.pointerEvents = "none";
        document.body.appendChild(audioEl);
        remoteAudioElsRef.current[peerId] = audioEl;
      }
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }
      audioEl.muted = !speakerEnabledRef.current;
      audioEl.volume = 1.0;
      if (speakerEnabledRef.current) {
        audioEl.play().catch(() => {
          // Autoplay dicegah browser HP, akan dibuka saat sentuhan layar
        });
      }
    },
    []
  );

  const getOrCreatePeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const existing = pcsRef.current[peerId];
      if (existing && existing.connectionState !== "closed") {
        return existing;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcsRef.current[peerId] = pc;
      pendingCandidatesRef.current[peerId] = [];

      // Pastikan transceiver audio selalu siap menerima suara (Unified Plan)
      const transceivers = pc.getTransceivers();
      const hasAudio = transceivers.some((t) => t.receiver?.track?.kind === "audio");
      if (!hasAudio) {
        if (localStreamRef.current) {
          for (const track of localStreamRef.current.getAudioTracks()) {
            pc.addTrack(track, localStreamRef.current);
          }
        } else {
          try {
            pc.addTransceiver("audio", { direction: "recvonly" });
          } catch {}
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            type: "ice-candidate",
            from: myPlayerId,
            to: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          attachRemoteStream(peerId, remoteStream);
        } else {
          const fallbackStream = new MediaStream([event.track]);
          attachRemoteStream(peerId, fallbackStream);
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          // Bersihkan jika putus total
        }
      };

      return pc;
    },
    [attachRemoteStream, myPlayerId, sendSignal]
  );

  const initiateOfferToPeer = useCallback(
    async (peerId: string) => {
      if (!peerId || peerId === myPlayerId) return;
      const pc = getOrCreatePeerConnection(peerId);

      // Pastikan track lokal sudah terpasang bila mic aktif
      if (localStreamRef.current) {
        const senders = pc.getSenders();
        for (const track of localStreamRef.current.getAudioTracks()) {
          const alreadyAdded = senders.some((s) => s.track?.id === track.id);
          if (!alreadyAdded) {
            const audioSender = senders.find(
              (s) => !s.track || s.track.kind === "audio"
            );
            if (audioSender) {
              await audioSender.replaceTrack(track);
            } else {
              pc.addTrack(track, localStreamRef.current);
            }
          }
        }
      }

      try {
        makingOfferRef.current[peerId] = true;
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });
        if (pc.signalingState !== "stable") return;
        await pc.setLocalDescription(offer);
        if (pc.localDescription) {
          sendSignal({
            type: "offer",
            from: myPlayerId,
            to: peerId,
            sdp: pc.localDescription,
          });
        }
      } catch {
        // ignore offer collision
      } finally {
        makingOfferRef.current[peerId] = false;
      }
    },
    [getOrCreatePeerConnection, myPlayerId, sendSignal]
  );

  // Setup Supabase Realtime Broadcast channel untuk signaling WebRTC
  useEffect(() => {
    if (!roomCode || !myPlayerId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const cleanCode = roomCode.trim().toUpperCase();
    const channel = supabase.channel(`voice-room-${cleanCode}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channelRef.current = channel;

    channel
      .on(
        "broadcast",
        { event: "voice-signal" },
        async ({ payload }: { payload: SignalPayload }) => {
          const data = payload;
          if (!data || !data.from || data.from === myPlayerId) return;

        const peerId = data.from;

        if (data.type === "peer-ready") {
          setPeerMicOn((prev) => ({ ...prev, [peerId]: data.micOn }));
          // Balas status mic kita ke peer yang baru masuk
          sendSignal({
            type: "mic-status",
            from: myPlayerId,
            micOn: micEnabledRef.current,
            speaking: localSpeakingRef.current,
          });
          // Jika mic kita sedang menyala atau kita menjadi inisiator, kirim offer
          if (micEnabledRef.current || myPlayerId < peerId) {
            await initiateOfferToPeer(peerId);
          }
          return;
        }

        if (data.type === "mic-status") {
          setPeerMicOn((prev) => ({ ...prev, [peerId]: data.micOn }));
          setPeerSpeaking((prev) => ({
            ...prev,
            [peerId]: data.micOn ? data.speaking : false,
          }));
          return;
        }

        if ("to" in data && data.to !== myPlayerId) return;

        if (data.type === "offer") {
          const pc = getOrCreatePeerConnection(peerId);
          const isPolite = myPlayerId > peerId;
          const offerCollision =
            makingOfferRef.current[peerId] || pc.signalingState !== "stable";

          if (offerCollision && !isPolite) {
            return;
          }

          try {
            if (offerCollision && isPolite) {
              await pc.setLocalDescription({ type: "rollback" });
            }
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

            // Flush antrean ICE candidate
            const queued = pendingCandidatesRef.current[peerId] || [];
            pendingCandidatesRef.current[peerId] = [];
            for (const cand of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }

            // Pastikan track lokal ikut terpasang bila mic kita aktif
            if (localStreamRef.current) {
              const senders = pc.getSenders();
              for (const track of localStreamRef.current.getAudioTracks()) {
                const alreadyAdded = senders.some(
                  (s) => s.track?.id === track.id
                );
                if (!alreadyAdded) {
                  pc.addTrack(track, localStreamRef.current);
                }
              }
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (pc.localDescription) {
              sendSignal({
                type: "answer",
                from: myPlayerId,
                to: peerId,
                sdp: pc.localDescription,
              });
            }
          } catch {
            // ignore negotiation error
          }
          return;
        }

        if (data.type === "answer") {
          const pc = pcsRef.current[peerId];
          if (!pc) return;
          try {
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(
                new RTCSessionDescription(data.sdp)
              );
              const queued = pendingCandidatesRef.current[peerId] || [];
              pendingCandidatesRef.current[peerId] = [];
              for (const cand of queued) {
                await pc
                  .addIceCandidate(new RTCIceCandidate(cand))
                  .catch(() => {});
              }
            }
          } catch {
            // ignore
          }
          return;
        }

        if (data.type === "ice-candidate") {
          const pc = getOrCreatePeerConnection(peerId);
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc
              .addIceCandidate(new RTCIceCandidate(data.candidate))
              .catch(() => {});
          } else {
            if (!pendingCandidatesRef.current[peerId]) {
              pendingCandidatesRef.current[peerId] = [];
            }
            pendingCandidatesRef.current[peerId].push(data.candidate);
          }
        }
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          sendSignal({
            type: "peer-ready",
            from: myPlayerId,
            micOn: micEnabledRef.current,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [
    getOrCreatePeerConnection,
    initiateOfferToPeer,
    myPlayerId,
    roomCode,
    sendSignal,
  ]);

  // Sinkronisasi otomatis saat ada pemain manusia baru masuk ke daftar pemain meja
  const humanPeerIdsKey = players
    .filter((p) => !p.isBot && p.id !== myPlayerId)
    .map((p) => p.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!humanPeerIdsKey || !myPlayerId) return;
    sendSignal({
      type: "peer-ready",
      from: myPlayerId,
      micOn: micEnabledRef.current,
    });
    if (micEnabledRef.current) {
      const peerIds = humanPeerIdsKey.split(",").filter(Boolean);
      for (const pid of peerIds) {
        if (!pcsRef.current[pid]) {
          initiateOfferToPeer(pid);
        }
      }
    }
  }, [humanPeerIdsKey, initiateOfferToPeer, myPlayerId, sendSignal]);

  // Cleanup saat keluar dari meja / unmount
  useEffect(() => {
    const pcs = pcsRef.current;
    const audioEls = remoteAudioElsRef.current;
    return () => {
      if (analyserIntervalRef.current) {
        clearInterval(analyserIntervalRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      Object.values(pcs).forEach((pc) => {
        try {
          pc.close();
        } catch {
          // ignore
        }
      });
      Object.values(audioEls).forEach((el) => {
        try {
          el.pause();
          el.srcObject = null;
          el.remove();
        } catch {
          // ignore
        }
      });
    };
  }, []);

  // Selalu sinkronkan speakerEnabled ke audio elements dan resume jika aktif
  useEffect(() => {
    speakerEnabledRef.current = speakerEnabled;
    Object.values(remoteAudioElsRef.current).forEach((el) => {
      el.muted = !speakerEnabled;
      if (speakerEnabled && el.srcObject) {
        el.play().catch(() => {});
      }
    });
  }, [speakerEnabled]);

  // Listener global untuk mengatasi Autoplay Policy di browser HP/WebView (Android Chrome/Capacitor)
  // Memastikan audio lawan segera diputar saat pengguna menyentuh layar
  useEffect(() => {
    const unlockAllRemoteAudio = () => {
      if (!speakerEnabledRef.current) return;
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      Object.values(remoteAudioElsRef.current).forEach((el) => {
        if (el.srcObject) {
          el.muted = !speakerEnabledRef.current;
          if (el.paused) {
            el.play().catch(() => {});
          }
        }
      });
    };

    window.addEventListener("touchstart", unlockAllRemoteAudio, { passive: true });
    window.addEventListener("touchend", unlockAllRemoteAudio, { passive: true });
    window.addEventListener("click", unlockAllRemoteAudio, { passive: true });

    return () => {
      window.removeEventListener("touchstart", unlockAllRemoteAudio);
      window.removeEventListener("touchend", unlockAllRemoteAudio);
      window.removeEventListener("click", unlockAllRemoteAudio);
    };
  }, []);

  const setupLocalVoiceDetector = useCallback(
    (stream: MediaStream) => {
      if (typeof window === "undefined") return;
      try {
        if (analyserIntervalRef.current) {
          clearInterval(analyserIntervalRef.current);
        }
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = audioCtxRef.current || new AudioContextClass();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        analyserIntervalRef.current = setInterval(() => {
          if (!micEnabledRef.current) {
            if (localSpeakingRef.current) {
              localSpeakingRef.current = false;
              setPeerSpeaking((prev) => ({ ...prev, [myPlayerId]: false }));
              sendSignal({
                type: "mic-status",
                from: myPlayerId,
                micOn: false,
                speaking: false,
              });
            }
            return;
          }

          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const isSpeakingNow = avg > 16;

          if (isSpeakingNow !== localSpeakingRef.current) {
            localSpeakingRef.current = isSpeakingNow;
            setPeerSpeaking((prev) => ({
              ...prev,
              [myPlayerId]: isSpeakingNow,
            }));
            sendSignal({
              type: "mic-status",
              from: myPlayerId,
              micOn: true,
              speaking: isSpeakingNow,
            });
          }
        }, 180);
      } catch {
        // ignore audio analyser fallback
      }
    },
    [myPlayerId, sendSignal]
  );

  const toggleMic = useCallback(async () => {
    setMicError(null);

    // Pastikan audio element lawan diputar saat pengguna berinteraksi
    Object.values(remoteAudioElsRef.current).forEach((el) => {
      el.play().catch(() => {});
    });

    if (micEnabled) {
      // Matikan Mic (Mute)
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      }
      micEnabledRef.current = false;
      localSpeakingRef.current = false;
      setMicEnabled(false);
      setPeerMicOn((prev) => ({ ...prev, [myPlayerId]: false }));
      setPeerSpeaking((prev) => ({ ...prev, [myPlayerId]: false }));
      sendSignal({
        type: "mic-status",
        from: myPlayerId,
        micOn: false,
        speaking: false,
      });
      return;
    }

    // Nyalakan Mic
    setIsConnectingMic(true);
    try {
      let stream = localStreamRef.current;
      if (!stream || stream.getAudioTracks().every((t) => t.readyState === "ended")) {
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error("Browser ini tidak mendukung akses mikrofon.");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        localStreamRef.current = stream;
        setupLocalVoiceDetector(stream);
      } else {
        stream.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
      }

      micEnabledRef.current = true;
      setMicEnabled(true);
      setPeerMicOn((prev) => ({ ...prev, [myPlayerId]: true }));
      sendSignal({
        type: "mic-status",
        from: myPlayerId,
        micOn: true,
        speaking: false,
      });

      // Kirim offer ke semua pemain manusia lain di meja
      const humanPeers = players.filter(
        (p) => !p.isBot && p.id !== myPlayerId
      );
      for (const peer of humanPeers) {
        await initiateOfferToPeer(peer.id);
      }
    } catch {
      setMicError("Izin mikrofon ditolak atau tidak tersedia.");
    } finally {
      setIsConnectingMic(false);
    }
  }, [
    initiateOfferToPeer,
    micEnabled,
    myPlayerId,
    players,
    sendSignal,
    setupLocalVoiceDetector,
  ]);

  const toggleSpeaker = useCallback(() => {
    setSpeakerEnabled((prev) => {
      const next = !prev;
      speakerEnabledRef.current = next;
      Object.values(remoteAudioElsRef.current).forEach((el) => {
        el.muted = !next;
        if (next && el.srcObject) {
          el.play().catch(() => {});
        }
      });
      return next;
    });
  }, []);

  return {
    micEnabled,
    speakerEnabled,
    isConnectingMic,
    micError,
    peerMicOn,
    peerSpeaking,
    toggleMic,
    toggleSpeaker,
  };
}
