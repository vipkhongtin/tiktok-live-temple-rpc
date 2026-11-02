/**
 * TempleAudioEngine v2.0
 * - Nhạc nền: Phát file "/assets/bg_chant.m4a" nếu có, hoặc tự động kích hoạt
 *   Bộ tổng hợp Chuông Xoay Tây Tạng & Chuông Gió Thiền Định đa tầng (Tibetan Singing Bowl Drone + Wind Chimes)
 *   êm dịu, không gây lỗi 404 console.
 * - Tự động hạ nhỏ âm lượng nhạc nền (Auto-Ducking) khi đọc lời khấn.
 * - Đa tầng Giọng đọc (Multi-Tier TTS):
 *   1. ZeroTTS (Python AI) / 2. Cloud Vietnamese TTS MP3 / 3. Web Speech API (`vi-VN`) fallback.
 */
class TempleAudioEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.sfxEnabled = true;
    this.bgMusicEnabled = true;
    this.bgMusicMode = localStorage.getItem('temple_music_mode') || 'auto';
    this.ttsEnabled = true;
    this.ttsVoice = localStorage.getItem('temple_tts_voice') || 'hoaimy';

    const savedMusicVol = parseFloat(localStorage.getItem('temple_music_vol'));
    const savedTtsVol = parseFloat(localStorage.getItem('temple_tts_vol'));
    this.bgBaseVolume = Number.isFinite(savedMusicVol) ? Math.max(0, Math.min(1, savedMusicVol)) : 0.65;
    this.ttsVolume = Number.isFinite(savedTtsVol) ? Math.max(0, Math.min(1, savedTtsVol)) : 0.95;

    this.useSynthMusicFallback = true;
    this.bgFileChecked = false;
    this.synthBgTimer = null;
    this.droneNodes = null;
    this.bgAudio = null;

    this.youtubeUrl = localStorage.getItem('temple_youtube_url') || '';
    this.youtubeVideoId = '';
    this.ytPlayer = null;
    this.ytReady = false;
    this.ytApiLoading = false;
    this.onYouTubeStateChange = null;

    this.ttsQueue = [];
    this.ttsPlaying = false;
    this.currentAudio = null;
    this.onTtsStateChange = null;

    this.probeBgMusicFile();
  }

  static extractYouTubeId(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
    const patterns = [
      /[?&]v=([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (const re of patterns) {
      const m = raw.match(re);
      if (m && m[1]) return m[1];
    }
    return '';
  }

  async probeBgMusicFile() {
    try {
      const res = await fetch('/assets/bg_chant.m4a', { method: 'HEAD' });
      if (res.status === 200) {
        this.bgAudio = new Audio('/assets/bg_chant.m4a');
        this.bgAudio.loop = true;
        this.bgAudio.preload = 'auto';
        this.bgAudio.volume = this.bgBaseVolume;
        this.useSynthMusicFallback = false;
        if (this.unlocked && this.bgMusicEnabled) {
          this.stopZenAmbience();
          this.startZenAmbience();
        }
      }
    } catch (_) {
      this.useSynthMusicFallback = true;
    } finally {
      this.bgFileChecked = true;
    }
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
    if (this.bgMusicEnabled) {
      this.startZenAmbience();
    }
    return this.ctx;
  }

  // --------------------------------------------------------------------------
  // 1. NHẠC NỀN THIỀN ĐỊNH (M4A HOẶC TIBETAN SINGING BOWL + WIND CHIMES SYNTH)
  // --------------------------------------------------------------------------
  getDuckedVolume() {
    return Math.max(0.08, +(this.bgBaseVolume * 0.35).toFixed(2));
  }

  setMusicVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.bgBaseVolume = v;
    try {
      localStorage.setItem('temple_music_vol', String(v));
    } catch (_) {}
    const activeVol = this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume;
    if (this.bgAudio && !this.useSynthMusicFallback) {
      this.bgAudio.volume = activeVol;
    }
    if (this.droneNodes && this.ctx) {
      this.droneNodes.masterGain.gain.setTargetAtTime(activeVol * 0.14, this.ctx.currentTime, 0.25);
    }
    if (this.ytPlayer && this.ytReady && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(Math.round(activeVol * 100));
      } catch (_) {}
    }
  }

  setTtsVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.ttsVolume = v;
    try {
      localStorage.setItem('temple_tts_vol', String(v));
    } catch (_) {}
    if (this.currentAudio) {
      this.currentAudio.volume = this.ttsVolume;
    }
  }

  setMusicMode(mode, youtubeUrlOverride = null) {
    const valid = ['auto', 'chant_m4a', 'singing_bowl', 'zen_flute', 'temple_chant', 'youtube'];
    const nextMode = valid.includes(mode) ? mode : 'auto';
    if (youtubeUrlOverride !== null) {
      this.youtubeUrl = String(youtubeUrlOverride || '').trim();
      try {
        localStorage.setItem('temple_youtube_url', this.youtubeUrl);
      } catch (_) {}
    }
    const changed = this.bgMusicMode !== nextMode || youtubeUrlOverride !== null;
    this.bgMusicMode = nextMode;
    try {
      localStorage.setItem('temple_music_mode', nextMode);
    } catch (_) {}
    if (changed && this.bgMusicEnabled) {
      this.stopZenAmbience({ keepYouTube: nextMode === 'youtube' });
      this.startZenAmbience();
    }
  }

  playYouTubeLink(url) {
    const videoId = TempleAudioEngine.extractYouTubeId(url);
    if (!videoId) {
      if (this.onYouTubeStateChange) {
        this.onYouTubeStateChange({
          status: 'error',
          videoId: '',
          message: '❌ Link YouTube không hợp lệ! Vui lòng dán link youtube.com/watch?v=... hoặc youtu.be/...'
        });
      }
      return { ok: false, error: 'Invalid YouTube URL' };
    }
    this.youtubeUrl = String(url).trim();
    this.youtubeVideoId = videoId;
    this.bgMusicEnabled = true;
    this.bgMusicMode = 'youtube';
    try {
      localStorage.setItem('temple_youtube_url', this.youtubeUrl);
      localStorage.setItem('temple_music_mode', 'youtube');
    } catch (_) {}

    this.stopZenAmbience({ keepYouTube: true });
    this.startYouTubePlayer(videoId);
    return { ok: true, videoId };
  }

  startYouTubePlayer(videoId) {
    const targetId = videoId || TempleAudioEngine.extractYouTubeId(this.youtubeUrl);
    if (!targetId) {
      this.startDefaultZenSynthLoop('singing_bowl');
      return;
    }
    this.youtubeVideoId = targetId;

    if (this.onYouTubeStateChange) {
      this.onYouTubeStateChange({
        status: 'loading',
        videoId: targetId,
        message: `⏳ Đang kết nối và phát nhạc YouTube (ID: ${targetId})...`
      });
    }

    const initOrLoadPlayer = () => {
      if (this.ytPlayer && this.ytReady && typeof this.ytPlayer.loadVideoById === 'function') {
        try {
          this.ytPlayer.loadVideoById({ videoId: targetId, startSeconds: 0 });
          const vol = this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume;
          this.ytPlayer.setVolume(Math.round(vol * 100));
          this.ytPlayer.playVideo();
          return;
        } catch (_) {}
      }

      let mountEl = document.getElementById('ytPlayerMount');
      if (!mountEl) {
        mountEl = document.createElement('div');
        mountEl.id = 'ytPlayerMount';
        document.body.appendChild(mountEl);
      }

      this.ytReady = false;
      this.ytPlayer = new window.YT.Player('ytPlayerMount', {
        height: '140',
        width: '100%',
        videoId: targetId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          loop: 1,
          playlist: targetId,
          rel: 0,
          modestbranding: 1,
          playsinline: 1
        },
        events: {
          onReady: (ev) => {
            this.ytReady = true;
            const vol = this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume;
            try {
              ev.target.unMute();
              ev.target.setVolume(Math.round(vol * 100));
              if (this.bgMusicEnabled && this.bgMusicMode === 'youtube') {
                ev.target.playVideo();
              }
            } catch (_) {}
          },
          onStateChange: (ev) => {
            if (!window.YT) return;
            if (ev.data === window.YT.PlayerState.PLAYING) {
              let title = '';
              try {
                title = ev.target.getVideoData()?.title || '';
              } catch (_) {}
              if (this.onYouTubeStateChange) {
                this.onYouTubeStateChange({
                  status: 'playing',
                  videoId: this.youtubeVideoId,
                  title,
                  message: `🟢 Đang phát YouTube: ${title || this.youtubeVideoId} (Tự động lặp 24/7)`
                });
              }
            } else if (ev.data === window.YT.PlayerState.ENDED) {
              try {
                ev.target.seekTo(0);
                ev.target.playVideo();
              } catch (_) {}
            } else if (ev.data === window.YT.PlayerState.PAUSED) {
              if (this.onYouTubeStateChange) {
                this.onYouTubeStateChange({
                  status: 'paused',
                  videoId: this.youtubeVideoId,
                  message: `⏸️ Đã tạm dừng nhạc YouTube (${this.youtubeVideoId})`
                });
              }
            }
          },
          onError: (ev) => {
            const code = ev?.data;
            const msg =
              code === 101 || code === 150
                ? '⚠️ Video YouTube này bị chủ kênh chặn nhúng trên web ngoài. Hãy thử link YouTube khác (đã tự chuyển sang Chuông Xoay).'
                : `⚠️ Không phát được video YouTube (Mã lỗi: ${code}). Đã chuyển sang Chuông Xoay dự phòng.`;
            if (this.onYouTubeStateChange) {
              this.onYouTubeStateChange({
                status: 'error',
                videoId: this.youtubeVideoId,
                message: msg
              });
            }
            this.startDefaultZenSynthLoop('singing_bowl');
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initOrLoadPlayer();
      return;
    }

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') prevReady();
      initOrLoadPlayer();
    };

    if (!this.ytApiLoading) {
      this.ytApiLoading = true;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }

  startZenAmbience() {
    if (!this.bgMusicEnabled) return;
    const mode = this.bgMusicMode || 'auto';

    if (mode === 'youtube') {
      const vid = TempleAudioEngine.extractYouTubeId(this.youtubeUrl);
      if (vid) {
        this.startYouTubePlayer(vid);
        return;
      }
    }

    const wantM4a = mode === 'auto' || mode === 'chant_m4a';

    if (!wantM4a || this.useSynthMusicFallback || !this.bgAudio) {
      this.startDefaultZenSynthLoop(mode === 'auto' || mode === 'chant_m4a' || mode === 'youtube' ? 'singing_bowl' : mode);
      return;
    }
    try {
      this.bgAudio.volume = this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume;
      if (this.bgAudio.paused) {
        const p = this.bgAudio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            this.useSynthMusicFallback = true;
            this.startDefaultZenSynthLoop('singing_bowl');
          });
        }
      }
    } catch (_) {
      this.useSynthMusicFallback = true;
      this.startDefaultZenSynthLoop('singing_bowl');
    }
  }

  startDefaultZenSynthLoop(synthStyle = 'singing_bowl') {
    if (!this.bgMusicEnabled) return;
    const ctx = this.ctx;
    if (!ctx) return;

    // Khởi tạo lớp nền Drone theo phong cách nhạc thiền đã chọn
    if (!this.droneNodes) {
      try {
        const masterGain = ctx.createGain();
        const activeVol = this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume;
        masterGain.gain.setValueAtTime(activeVol * 0.14, ctx.currentTime);
        masterGain.connect(ctx.destination);

        const freqs =
          synthStyle === 'zen_flute'
            ? [144, 216, 288, 432]
            : synthStyle === 'temple_chant'
            ? [96, 144, 192, 288]
            : [108, 162, 216, 324];
        const amps = [0.45, 0.25, 0.18, 0.08];
        const oscs = freqs.map((f, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = synthStyle === 'zen_flute' && i >= 2 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(f, ctx.currentTime);
          g.gain.setValueAtTime(amps[i], ctx.currentTime);
          osc.connect(g);
          g.connect(masterGain);
          osc.start();
          return { osc, g };
        });

        this.droneNodes = { masterGain, oscs };
      } catch (_) {}
    }

    if (this.synthBgTimer) return;

    const CHORD_SETS = {
      singing_bowl: [
        [216, 324, 432],
        [288, 432, 576],
        [243, 364.5, 486],
        [324, 486, 648]
      ],
      zen_flute: [
        [288, 384, 432, 576],
        [324, 432, 486, 648],
        [256, 384, 512, 648],
        [288, 432, 576, 768]
      ],
      temple_chant: [
        [162, 243, 324],
        [192, 288, 384],
        [144, 216, 288],
        [216, 324, 432]
      ]
    };
    const activeChords = CHORD_SETS[synthStyle] || CHORD_SETS.singing_bowl;
    let step = 0;

    const playZenMotif = () => {
      if (!this.bgMusicEnabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const chord = activeChords[step % activeChords.length];
        step++;
        const vol = (this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume) * 0.12;
        if (vol <= 0.002) return;

        // Nếu chế độ Tụng Kinh Gõ Mõ (temple_chant): điểm nhịp mõ gỗ nhẹ nhàng và chuông chùa định kỳ
        if (synthStyle === 'temple_chant') {
          this.playWoodenFish(0.92);
          setTimeout(() => {
            if (this.bgMusicEnabled) this.playWoodenFish(0.96);
          }, 1200);
          setTimeout(() => {
            if (this.bgMusicEnabled) this.playWoodenFish(0.92);
          }, 2400);
          setTimeout(() => {
            if (this.bgMusicEnabled) this.playWoodenFish(0.95);
          }, 3600);
        }

        const spacing = synthStyle === 'zen_flute' ? 0.48 : 0.35;
        const noteDur = synthStyle === 'zen_flute' ? 3.8 : 4.4;

        chord.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = synthStyle === 'zen_flute' ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * spacing);

          const notePeak = (vol / (idx + 1)) * (synthStyle === 'zen_flute' ? 0.78 : 1.0);
          gain.gain.setValueAtTime(0.0001, now + idx * spacing);
          gain.gain.linearRampToValueAtTime(notePeak, now + idx * spacing + 0.45);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * spacing + noteDur);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
          };
          osc.start(now + idx * spacing);
          osc.stop(now + idx * spacing + noteDur + 0.1);
        });
      } catch (_) {}
    };

    playZenMotif();
    this.synthBgTimer = setInterval(playZenMotif, 4800);
  }

  stopZenAmbience(opts = {}) {
    try {
      if (this.bgAudio) this.bgAudio.pause();
    } catch (_) {}
    if (!opts.keepYouTube && this.ytPlayer && this.ytReady && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.ytPlayer.pauseVideo();
      } catch (_) {}
    }
    if (this.synthBgTimer) {
      clearInterval(this.synthBgTimer);
      this.synthBgTimer = null;
    }
    if (this.droneNodes) {
      try {
        this.droneNodes.oscs.forEach(({ osc, g }) => {
          osc.stop();
          osc.disconnect();
          g.disconnect();
        });
        this.droneNodes.masterGain.disconnect();
      } catch (_) {}
      this.droneNodes = null;
    }
  }

  setBgDucking(ducked) {
    if (!this.bgMusicEnabled) return;
    const targetVol = ducked ? this.getDuckedVolume() : this.bgBaseVolume;
    try {
      if (!this.useSynthMusicFallback && this.bgAudio) {
        this.bgAudio.volume = targetVol;
      }
      if (this.droneNodes && this.ctx) {
        this.droneNodes.masterGain.gain.setTargetAtTime(targetVol * 0.14, this.ctx.currentTime, 0.2);
      }
      if (this.ytPlayer && this.ytReady && typeof this.ytPlayer.setVolume === 'function') {
        this.ytPlayer.setVolume(Math.round(targetVol * 100));
      }
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 2. TIẾNG MÕ GỖ TỤNG KINH (WOODEN FISH PERCUSSION SYNTH)
  // --------------------------------------------------------------------------
  playWoodenFish(pitchMultiplier = 1.0) {
    if (!this.sfxEnabled || !this.unlocked || !this.ctx) return;
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const baseFreq = 620 * pitchMultiplier * (0.98 + Math.random() * 0.04);
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq * 1.4, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.018);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.82, now + 0.14);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq * 1.15, now);
      filter.Q.setValueAtTime(4.0, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc1.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.onended = () => {
        osc1.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      osc1.start(now);
      osc1.stop(now + 0.16);
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 3. TIẾNG ĐẠI HỒNG CHUNG (TEMPLE BRONZE BELL)
  // --------------------------------------------------------------------------
  playTempleBell(intensity = 1.0) {
    if (!this.sfxEnabled || !this.unlocked || !this.ctx) return;
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;

      const base = 174;
      const partials = [
        { ratio: 0.5, amp: 0.22, decay: 4.2 },
        { ratio: 1.0, amp: 0.35, decay: 3.6 },
        { ratio: 1.506, amp: 0.16, decay: 2.4 },
        { ratio: 2.0, amp: 0.18, decay: 1.9 }
      ];

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * Math.min(1.0, intensity), now);
      master.connect(ctx.destination);

      partials.forEach((p, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base * p.ratio, now);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(p.amp, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

        osc.connect(g);
        g.connect(master);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
          if (idx === 0) master.disconnect();
        };
        osc.start(now);
        osc.stop(now + p.decay + 0.05);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 4. TIẾNG LẮC ỐNG XĂM TRE (FORTUNE STICK SHAKER)
  // --------------------------------------------------------------------------
  playFortuneShake() {
    if (!this.sfxEnabled) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.playWoodenFish(1.32 + (i % 2) * 0.16);
      }, i * 120);
    }
  }

  // --------------------------------------------------------------------------
  // 5. TIẾNG CHUÔNG NGỌC DÂNG LỄ / THẮP HƯƠNG (SINGING CHIME)
  // --------------------------------------------------------------------------
  playIncenseChime() {
    if (!this.sfxEnabled || !this.unlocked || !this.ctx) return;
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const notes = [528, 660];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.1 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 1.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 1.15);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 6. MULTI-TIER TTS QUEUE & PREFETCHER (ZEROTTS -> CLOUD TTS -> WEB SPEECH API)
  // --------------------------------------------------------------------------
  enqueueTts(text, options = {}) {
    const onStart = typeof options.onStart === 'function' ? options.onStart : null;
    const onEnd = typeof options.onEnd === 'function' ? options.onEnd : null;

    const forcePlay = Boolean(options.force);
    if (!this.ttsEnabled && !forcePlay) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 4200);
      return;
    }
    const clean = String(text || '').trim();
    if (!clean) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 4200);
      return;
    }

    if (forcePlay && this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio = null;
      } catch (_) {}
      this.ttsQueue.length = 0;
      this.ttsPlaying = false;
    } else if (this.ttsQueue.length >= 6) {
      const dropped = this.ttsQueue.shift();
      if (dropped?.onStart) dropped.onStart();
      if (dropped?.onEnd) dropped.onEnd();
    }

    const item = {
      id: `tts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      voice: (options.voice || this.ttsVoice || 'hoaimy').toLowerCase(),
      url: options.url || null,
      onStart,
      onEnd,
      fetchPromise: null
    };

    if (!item.url) {
      if (!this.ttsPlaying && this.onTtsStateChange) {
        this.onTtsStateChange({
          speaking: false,
          synthesizing: true,
          voice: item.voice,
          text: item.text
        });
      }
      item.fetchPromise = this.fetchZeroTtsAudio(item.text, item.voice);
    }

    this.ttsQueue.push(item);
    this.processTtsQueue();
  }

  async fetchZeroTtsAudio(text, voice = 'maichi') {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice })
      });
      const data = await res.json();
      if (data && data.ok && data.url) {
        return data;
      }
      return { ok: false, error: data?.error || 'TTS unavailable', useBrowserSpeech: true };
    } catch (err) {
      return { ok: false, error: err.message, useBrowserSpeech: true };
    }
  }

  speakWithBrowserWebSpeech(text) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        setTimeout(resolve, 3500);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'vi-VN';
        utter.rate = 1.0;
        utter.volume = this.ttsVolume;
        const voices = window.speechSynthesis.getVoices() || [];
        const viVoice = voices.find((v) => v.lang && v.lang.toLowerCase().includes('vi'));
        if (viVoice) utter.voice = viVoice;

        const safetyTimer = setTimeout(resolve, 9000);
        utter.onend = () => {
          clearTimeout(safetyTimer);
          resolve();
        };
        utter.onerror = () => {
          clearTimeout(safetyTimer);
          resolve();
        };
        window.speechSynthesis.speak(utter);
      } catch (_) {
        setTimeout(resolve, 3500);
      }
    });
  }

  async processTtsQueue() {
    if (this.ttsPlaying || this.ttsQueue.length === 0) return;
    this.ttsPlaying = true;
    const item = this.ttsQueue.shift();

    try {
      let audioUrl = item.url;
      let engineName = 'Edge-Neural AI';
      let synthSec = 0;

      if (!audioUrl && item.fetchPromise) {
        if (this.onTtsStateChange) {
          this.onTtsStateChange({
            speaking: false,
            synthesizing: true,
            voice: item.voice,
            text: item.text
          });
        }
        const res = await item.fetchPromise;
        if (res && res.ok && res.url) {
          audioUrl = res.url;
          engineName = res.engine || 'Edge-Neural AI';
          synthSec = res.synthSec || 0;
        } else {
          engineName = 'Web Speech API (Dự phòng)';
        }
      }

      this.setBgDucking(true);
      if (this.onTtsStateChange) {
        this.onTtsStateChange({
          speaking: true,
          synthesizing: false,
          voice: item.voice,
          engine: engineName,
          synthSec,
          text: item.text
        });
      }
      if (item.onStart) item.onStart({ engine: engineName, voice: item.voice, synthSec, url: audioUrl });

      if (audioUrl) {
        await this.playWavUrl(audioUrl);
      } else {
        await this.speakWithBrowserWebSpeech(item.text);
      }

      if (item.onEnd) item.onEnd({ ok: true, engine: engineName, voice: item.voice });
    } catch (err) {
      console.warn('[TTS Playback Warning]', err);
      if (item.onStart) item.onStart({ error: err.message });
      if (item.onEnd) item.onEnd({ ok: false, error: err.message });
    } finally {
      this.ttsPlaying = false;
      if (this.ttsQueue.length === 0) {
        this.setBgDucking(false);
        if (this.onTtsStateChange) {
          this.onTtsStateChange({
            speaking: false,
            synthesizing: false,
            voice: item.voice,
            text: ''
          });
        }
      } else {
        setTimeout(() => this.processTtsQueue(), 180);
      }
    }
  }

  playWavUrl(url) {
    return new Promise((resolve) => {
      try {
        const audio = new Audio(url);
        this.currentAudio = audio;
        audio.volume = this.ttsVolume;
        audio.onended = () => {
          this.currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          this.currentAudio = null;
          resolve();
        };
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            this.currentAudio = null;
            resolve();
          });
        }
      } catch (_) {
        resolve();
      }
    });
  }
}

window.TempleAudioEngine = TempleAudioEngine;
