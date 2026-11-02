"use client";

/**
 * Audio Engine untuk Backsound Kasino (BGM) & Efek Suara (SFX)
 * - BGM menggunakan file audio MP3 (businessstar-poker-player-392184.mp3)
 * - SFX menggunakan Web Audio API Synthesizer dengan latensi 0ms.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmEnabled: boolean = true;
  private sfxEnabled: boolean = true;
  private bgmAudio: HTMLAudioElement | null = null;
  private hasInteractionListener: boolean = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isBgmActive(): boolean {
    return this.bgmEnabled;
  }

  public isSfxActive(): boolean {
    return this.sfxEnabled;
  }

  public toggleBgm(): boolean {
    this.bgmEnabled = !this.bgmEnabled;
    if (this.bgmEnabled) {
      this.startBgm();
    } else {
      this.stopBgm();
    }
    return this.bgmEnabled;
  }

  public toggleSfx(): boolean {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }

  private initBgmAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!this.bgmAudio) {
      const audio = new Audio("/audio/bgm-poker.mp3");
      audio.loop = true;
      audio.volume = 0.35;
      audio.preload = "auto";
      this.bgmAudio = audio;
    }
    return this.bgmAudio;
  }

  /**
   * Memulai Backsound Musik Poker (businessstar-poker-player-392184.mp3)
   */
  public startBgm(): void {
    if (!this.bgmEnabled || typeof window === "undefined") return;

    const audio = this.initBgmAudio();
    if (!audio) return;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Jika autoplay diblokir oleh browser sebelum ada interaksi pengguna
        if (!this.hasInteractionListener) {
          this.hasInteractionListener = true;
          const resumeAudio = () => {
            if (this.bgmEnabled && this.bgmAudio) {
              this.bgmAudio.play().catch(() => {});
            }
            window.removeEventListener("click", resumeAudio);
            window.removeEventListener("touchstart", resumeAudio);
            window.removeEventListener("keydown", resumeAudio);
            this.hasInteractionListener = false;
          };
          window.addEventListener("click", resumeAudio, { once: true });
          window.addEventListener("touchstart", resumeAudio, { once: true });
          window.addEventListener("keydown", resumeAudio, { once: true });
        }
      });
    }
  }

  public stopBgm(): void {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }
  }

  /**
   * SFX: Klik / Pilih Kartu
   */
  public playCardClick(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(1120, now + 0.06);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * SFX: Banting Kartu ke Meja
   */
  public playCardSlam(isBigCombo = false): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Suara hentakan kartu di karpet meja
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isBigCombo ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(isBigCombo ? 240 : 180, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.16);

    gain.gain.setValueAtTime(isBigCombo ? 0.22 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);

    // Jika kombinasi besar (Full House / Seri Sejenis), tambahkan efek kilau akor
    if (isBigCombo) {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const cOsc = ctx.createOscillator();
        const cGain = ctx.createGain();
        cOsc.type = "triangle";
        cOsc.frequency.setValueAtTime(freq, now + i * 0.04);

        cGain.gain.setValueAtTime(0.08, now + i * 0.04);
        cGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.25);

        cOsc.connect(cGain);
        cGain.connect(ctx.destination);
        cOsc.start(now + i * 0.04);
        cOsc.stop(now + i * 0.04 + 0.26);
      });
    }
  }

  /**
   * SFX: Lewat / Pass Giliran
   */
  public playPassSound(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.14);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * SFX: Emot Ngejek / Taunt Sound
   */
  public playTauntSound(tauntId: string): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (tauntId === "laugh" || tauntId === "trash") {
      // Suara tawa mengejek "Ha-ha-ha!"
      const pitches = [587.33, 523.25, 493.88, 440.0];
      pitches.forEach((p, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(p, now + idx * 0.09);
        osc.frequency.exponentialRampToValueAtTime(p * 0.8, now + idx * 0.09 + 0.07);

        gain.gain.setValueAtTime(0.09, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.085);
      });
    } else if (tauntId === "bomb_warn" || tauntId === "fire") {
      // Suara sirine tantangan
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.15);
      osc.frequency.linearRampToValueAtTime(440, now + 0.3);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.33);
    } else {
      // Pop ceria dua nada
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(783.99, now + 0.08);

      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    }
  }

  /**
   * SFX: Ledakan BOM Poker!
   */
  public playBombExplosion(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Sub-bass dentuman ledakan
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sawtooth";
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.65);

    subGain.gain.setValueAtTime(0.35, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.72);

    // 2. White noise gemuruh ledakan
    const duration = 0.65;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.25));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.3, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  }

  /**
   * SFX: Fanfare Kemenangan Ronde
   */
  public playWinFanfare(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.12, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + idx * 0.09 + (idx === 3 ? 0.5 : 0.2)
      );

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + (idx === 3 ? 0.52 : 0.22));
    });
  }
}

export const soundEngine = new SoundEngine();

