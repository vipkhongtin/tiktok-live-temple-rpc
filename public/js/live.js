/**
 * Live 9:16 Client Controller v2.0 — Chánh Điện Đức Phật A Di Đà & Đạo Tràng Phật Tử Quỳ Lễ
 * - Smart Ritual Queue & VIP Priority Fast-Track: Chống giật/reset nhân vật khi đông người bình luận,
 *   ưu tiên Quà tặng (Gift) lên Chánh Điện trước.
 * - Hiển thị 6 Đệm Quỳ VIP + Danh hiệu Tu Tập + 40 Phật Tử Đạo Tràng
 * - Hiển thị Thanh Tích Tụ Hào Quang Cộng Đồng (Mở Đại Lễ Pháp Vũ Cam Lồ x2 Công Đức)
 * - Hiển thị Mâm Lễ Vật thực tế trên Bàn Thờ & độ sáng Hào Quang
 * - Đa tầng Giọng đọc (ZeroTTS / Cloud Vietnamese TTS / Web Speech API)
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('obs') === '1') {
    document.body.classList.add('obs-mode');
  }

  // 1. Tự động co giãn khung 1080x1920 vừa khít Stage Wrapper (Cả chiều ngang lẫn chiều dọc)
  const stageWrapper = document.getElementById('stageWrapper');
  const stage9x16 = document.getElementById('stage9x16');

  function fitStage() {
    if (!stageWrapper || !stage9x16) return;
    const rect = stageWrapper.getBoundingClientRect();
    const w = rect.width || (window.innerHeight * 0.96 * 9) / 16;
    const h = rect.height || window.innerHeight * 0.96;
    const scaleX = w / 1080;
    const scaleY = h / 1920;
    const scale = Math.max(0.15, Math.min(scaleX, scaleY) || scaleX || 0.45);
    stage9x16.style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', fitStage);
  window.addEventListener('load', fitStage);
  requestAnimationFrame(fitStage);
  fitStage();

  // 2. Khởi tạo Particle Engine & Audio Engine
  const canvas = document.getElementById('templeCanvas');
  const particles = new window.TempleParticleEngine(canvas);
  const audio = new window.TempleAudioEngine();

  // Hiển thị sóng âm trên thanh trạng thái & hộp phản hồi TTS trong Quick Dock
  const ttsVoicePill = document.getElementById('ttsVoicePill');
  const ttsStatusLabel = document.getElementById('ttsStatusLabel');
  const ttsFeedbackDot = document.getElementById('ttsFeedbackDot');
  const ttsFeedbackText = document.getElementById('ttsFeedbackText');
  const btnTestTtsVoice = document.getElementById('btnTestTtsVoice');

  const VOICE_NAMES = {
    hoaimy: 'Nữ Hoài My (Edge Neural)',
    namminh: 'Nam Minh (Edge Neural)',
    maichi: 'Nữ Mai Chi (ZeroTTS)',
    google_vi: 'Chị Google (Cloud)'
  };

  let dockToastTimer = null;
  function showDockToast(message, type = 'ok') {
    const toast = document.getElementById('dockToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('toast-warn', 'toast-err');
    if (type === 'warn') toast.classList.add('toast-warn');
    if (type === 'err') toast.classList.add('toast-err');
    clearTimeout(dockToastTimer);
    dockToastTimer = setTimeout(() => {
      toast.classList.remove('toast-warn', 'toast-err');
    }, 5000);
  }

  function flashButton(btn, tempText = null) {
    if (!btn) return;
    btn.classList.add('btn-flash-ok');
    const origText = btn.dataset.origText || btn.textContent;
    if (tempText) {
      btn.dataset.origText = origText;
      btn.textContent = tempText;
    }
    setTimeout(() => {
      btn.classList.remove('btn-flash-ok');
      if (tempText && btn.dataset.origText) {
        btn.textContent = btn.dataset.origText;
      }
    }, 900);
  }

  audio.onTtsStateChange = (st) => {
    const vName = VOICE_NAMES[st.voice || audio.ttsVoice] || st.voice || 'AI';
    if (ttsVoicePill) {
      ttsVoicePill.classList.toggle('speaking', Boolean(st.speaking || st.synthesizing));
    }
    if (ttsStatusLabel) {
      ttsStatusLabel.textContent = st.synthesizing
        ? `⏳ Đang tạo giọng (${vName.split(' ')[0]})...`
        : st.speaking
        ? '🎙️ Đang đọc lời khấn...'
        : 'Giọng đọc AI';
    }
    if (ttsFeedbackDot && ttsFeedbackText) {
      ttsFeedbackDot.className = 'status-dot ' + (st.synthesizing ? 'busy' : st.speaking ? 'live' : 'ready');
      if (st.synthesizing) {
        ttsFeedbackText.textContent = `⏳ Đã nhận lệnh! Đang tạo giọng ${vName}...`;
      } else if (st.speaking) {
        ttsFeedbackText.textContent = `🔊 Đang phát giọng ${vName} (${st.engine || 'Neural'})`;
      } else {
        ttsFeedbackText.textContent = `✅ Đã đọc xong • Giọng hiện tại: ${vName}`;
      }
    }
    if (btnTestTtsVoice) {
      if (st.synthesizing) {
        btnTestTtsVoice.textContent = '⏳ Đang tạo...';
      } else if (st.speaking) {
        btnTestTtsVoice.textContent = '🔊 Đang đọc...';
      } else {
        btnTestTtsVoice.textContent = '🔊 Nghe Thử';
      }
    }
  };

  audio.onYouTubeStateChange = (yt) => {
    const ytStatus = document.getElementById('ytStatusText');
    const ytWrap = document.getElementById('ytMiniPlayerWrap');
    if (ytStatus && yt.message) {
      ytStatus.textContent = yt.message;
    }
    if (ytWrap) {
      ytWrap.classList.toggle('active', yt.status === 'loading' || yt.status === 'playing' || yt.status === 'paused');
    }
    if (yt.status === 'playing') {
      showDockToast(yt.message, 'ok');
    } else if (yt.status === 'error') {
      showDockToast(yt.message, 'warn');
    }
  };

  function unlockAudioOnce() {
    audio.ensureContext();
    const btnUnlock = document.getElementById('btnUnlockAudio');
    if (btnUnlock) {
      btnUnlock.textContent = '✅ Âm Thanh Chùa Đã Sẵn Sàng';
      btnUnlock.classList.remove('gold');
      btnUnlock.classList.add('active-toggle');
    }
  }
  window.addEventListener('pointerdown', unlockAudioOnce, { once: true });
  document.getElementById('btnUnlockAudio')?.addEventListener('click', unlockAudioOnce);

  // 3. Vẽ các nén nhang đang cháy trong Lư Hương Đỉnh Đồng (x=540, y=895)
  const incenseHolder = document.getElementById('incenseSticksHolder');
  let renderedStickCount = 0;

  function renderIncenseSticks(count) {
    const target = Math.max(3, Math.min(27, Number(count) || 9));
    if (target === renderedStickCount && incenseHolder.children.length > 0) return;
    renderedStickCount = target;
    incenseHolder.innerHTML = '';

    const tips = [];
    for (let i = 0; i < target; i++) {
      const stick = document.createElement('div');
      stick.className = 'incense-stick';

      const spread = target === 1 ? 0 : (i / (target - 1) - 0.5) * 2;
      const leftPx = 65 + spread * 28 + Math.sin(i * 2.1) * 2;
      const angleDeg = spread * 12 + Math.cos(i * 1.5) * 1.5;
      const heightPx = 76 + (i % 3) * 6;

      stick.style.left = `${leftPx}px`;
      stick.style.height = `${heightPx}px`;
      stick.style.transform = `rotate(${angleDeg}deg)`;

      const ember = document.createElement('div');
      ember.className = 'incense-ember';
      ember.style.animationDelay = `${(i * 0.15) % 1.1}s`;
      stick.appendChild(ember);
      incenseHolder.appendChild(stick);

      const rad = (angleDeg * Math.PI) / 180;
      const tipX = 540 + (leftPx - 65) + Math.sin(rad) * heightPx;
      const tipY = 895 - Math.cos(rad) * heightPx;
      tips.push({ x: tipX, y: tipY });
    }
    particles.setIncenseTips(tips);
  }

  // 4. Dựng Hàng 6 Đệm Quỳ VIP (Top 6 Thí Chủ đặt chuẩn tâm 6 đệm gấm đỏ trên bục gỗ y=1182)
  const VIP_CUSHION_COORDS = [
    { x: 132, y: 1182, rank: 1 },
    { x: 256, y: 1182, rank: 2 },
    { x: 380, y: 1182, rank: 3 },
    { x: 700, y: 1182, rank: 4 },
    { x: 824, y: 1182, rank: 5 },
    { x: 948, y: 1182, rank: 6 }
  ];

  const ROBE_PALETTES = ['robe-lam', 'robe-nau', 'robe-vang', 'robe-lien', 'robe-ngoc'];

  function getDeterministicRobeClass(seedStr, fallbackIdx = 0) {
    if (!seedStr) return ROBE_PALETTES[fallbackIdx % ROBE_PALETTES.length];
    let h = 0;
    const s = String(seedStr);
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return ROBE_PALETTES[h % ROBE_PALETTES.length];
  }

  function renderVipCushions(leaderboard = []) {
    const layer = document.getElementById('vipCushionsLayer');
    if (!layer) return;

    layer.innerHTML = VIP_CUSHION_COORDS.map((slot, idx) => {
      const dev = leaderboard[idx];
      if (!dev) return '';
      // Top 1-2 mặc Áo Vàng Hộ Pháp, các vị trí VIP khác đa dạng sắc phục trang nghiêm
      const robeClass = idx < 2 ? 'robe-vang' : getDeterministicRobeClass(dev.name, idx);
      const auraHtml = idx < 3 ? '<div class="devotee-aura-halo"></div>' : '';
      return `
        <div class="vip-devotee-slot ${robeClass}" style="left: ${slot.x}px; top: ${slot.y}px; z-index: ${14 + idx};">
          ${auraHtml}
          <img src="/assets/devotee.png" alt="VIP Devotee" class="devotee-sprite" style="animation-delay: ${(idx * 0.4).toFixed(1)}s;" />
          <div class="vip-rank-pill">
            <span class="vip-rank-num">${slot.rank}</span>
            <span class="vip-rank-name">${escapeHtml(shortenName(dev.name, 11))}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 5. Dựng Đạo Tràng Phật Tử Quỳ Lễ Hai Bên Thảm Đỏ (4 Hàng x 3 Cột mỗi bên = 24 chỗ ngồi chuẩn luật Xa-Gần)
  const congregationHall = document.getElementById('congregationHall');
  const HALL_SEAT_COORDS = [];

  (function buildHallGrid() {
    const rows = 4;
    const colsPerSide = 3;
    for (let r = 0; r < rows; r++) {
      // Phối cảnh bậc hai (quadratic depth): Hàng xa khít hơn, hàng gần camera giãn rộng hơn
      const tRow = r / (rows - 1);
      const depthCurve = Math.pow(tRow, 1.15);
      const y = Math.round(1292 + depthCurve * 348); // 1292 (xa) -> 1640 (gần)
      // Quy luật Xa-Gần: Hàng trên cùng (xa) nhỏ 0.64 -> Hàng dưới cùng (gần camera) lớn 1.06
      const scale = +(0.64 + depthCurve * 0.42).toFixed(2);

      // Mép thảm đỏ trong ảnh nền mở rộng theo góc phối cảnh từ y=1292 xuống y=1640:
      // Cánh trái sàn gạch: nằm từ mép tường tới cách mép thảm đỏ 42px (tuyệt đối không đè lên viền vàng thảm đỏ)
      const carpetLeftEdge = 365 - tRow * 165;
      const leftInnerX = Math.round(carpetLeftEdge - 42);
      const leftOuterX = Math.round(68 - tRow * 24);
      // Stagger nhẹ theo hàng để các hàng sau không che thẳng đầu hàng trước
      const staggerOffset = (r % 2 === 0 ? 1 : -1) * 8;

      for (let c = 0; c < colsPerSide; c++) {
        const tCol = c / (colsPerSide - 1);
        const x = Math.round(leftOuterX + tCol * (leftInnerX - leftOuterX) + staggerOffset);
        HALL_SEAT_COORDS.push({ side: 'L', row: r, col: c, x, y, scale });
      }

      // Cánh phải sàn gạch: đối xứng qua tâm x=540
      const carpetRightEdge = 715 + tRow * 165;
      const rightInnerX = Math.round(carpetRightEdge + 42);
      const rightOuterX = Math.round(1012 + tRow * 24);

      for (let c = 0; c < colsPerSide; c++) {
        const tCol = c / (colsPerSide - 1);
        const x = Math.round(rightInnerX + tCol * (rightOuterX - rightInnerX) - staggerOffset);
        HALL_SEAT_COORDS.push({ side: 'R', row: r, col: c, x, y, scale });
      }
    }
  })();

  let lastRenderedLeaderboardJson = '';

  function renderCongregationHall(leaderboard = []) {
    if (!congregationHall) return;
    const hallViewers = leaderboard.slice(6);
    const sig = JSON.stringify(hallViewers.map((d) => `${d.name}:${d.merit}`));
    if (sig === lastRenderedLeaderboardJson && congregationHall.children.length > 0) return;
    lastRenderedLeaderboardJson = sig;

    // Ưu tiên gắn thẻ tên vào các ghế cạnh thảm đỏ trước rồi lan ra ngoài
    const labeledSeatIndices = [
      2, 3, 8, 9, 14, 15, 20, 21,
      1, 4, 7, 10, 13, 16, 19, 22,
      0, 5, 6, 11, 12, 17, 18, 23
    ];
    const seatViewerMap = new Map();
    hallViewers.forEach((viewer, idx) => {
      if (idx < labeledSeatIndices.length) {
        seatViewerMap.set(labeledSeatIndices[idx], viewer);
      }
    });

    congregationHall.innerHTML = HALL_SEAT_COORDS.map((seat, idx) => {
      const viewer = seatViewerMap.get(idx);
      const robeClass = viewer
        ? getDeterministicRobeClass(viewer.name, idx)
        : ROBE_PALETTES[(idx * 3 + seat.row) % ROBE_PALETTES.length];
      const breatheDur = (3.2 + ((idx * 7) % 11) * 0.12).toFixed(2);

      const badgeHtml = viewer
        ? `
          <div class="seat-badge">
            <span class="seat-avatar">${
              viewer.avatar
                ? `<img src="${escapeHtml(viewer.avatar)}" alt="" />`
                : escapeHtml(String(viewer.name || 'P').charAt(0).toUpperCase())
            }</span>
            <span class="seat-username">${escapeHtml(shortenName(viewer.name, 10))}</span>
          </div>
        `
        : '';

      return `
        <div
          class="hall-seat ${robeClass}"
          data-seat-idx="${idx}"
          style="left: ${seat.x}px; top: ${seat.y}px; z-index: ${20 + seat.row * 2}; transform: translate(-50%, -100%) scale(${seat.scale}); transform-origin: bottom center;"
        >
          <div class="devotee-sprite-wrap">
            <img
              src="/assets/devotee.png"
              alt="Phật tử"
              class="devotee-sprite"
              style="animation-delay: ${((idx * 0.31) % 3.5).toFixed(2)}s; animation-duration: ${breatheDur}s;"
            />
          </div>
          ${badgeHtml}
        </div>
      `;
    }).join('');
  }

  const SPRITE_FRAMES = {
    walk1: '/assets/devotee_walk.png',
    walk2: '/assets/devotee_walk_2.png',
    kneelDown: '/assets/devotee_kneel_down.png',
    kneel: '/assets/devotee.png',
    forehead: '/assets/devotee_bow.png',
    bowMid: '/assets/devotee_bow_mid.png',
    prostrate: '/assets/devotee_prostrate.png',
    prostrateDeep: '/assets/devotee_prostrate_deep.png'
  };
  Object.values(SPRITE_FRAMES).forEach((url) => {
    const img = new Image();
    img.src = url;
  });

  function pulseHallBowing() {
    if (!congregationHall) return;
    const seats = congregationHall.querySelectorAll('.hall-seat');
    seats.forEach((el, i) => {
      if (i % 3 !== 0) return;
      const img = el.querySelector('.devotee-sprite');
      if (!img) return;
      const delay = (i % 4) * 75;
      setTimeout(() => { img.src = SPRITE_FRAMES.forehead; }, delay);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, delay + 140);
      setTimeout(() => { img.src = SPRITE_FRAMES.prostrateDeep; }, delay + 300);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, delay + 620);
      setTimeout(() => { img.src = SPRITE_FRAMES.kneel; }, delay + 780);
    });
  }

  // Nhịp vái lạy tự nhiên định kỳ của Đạo Tràng (Mỗi 4.5s có 2-3 Phật tử ngẫu nhiên thành tâm vái Phật)
  setInterval(() => {
    if (document.hidden || !congregationHall) return;
    const seats = congregationHall.querySelectorAll('.hall-seat');
    if (!seats.length) return;
    const count = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < count; k++) {
      const randIdx = Math.floor(Math.random() * seats.length);
      const img = seats[randIdx]?.querySelector('.devotee-sprite');
      if (!img) continue;
      const offset = k * 280;
      setTimeout(() => { img.src = SPRITE_FRAMES.forehead; }, offset);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, offset + 220);
      setTimeout(() => { img.src = SPRITE_FRAMES.prostrate; }, offset + 440);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, offset + 850);
      setTimeout(() => { img.src = SPRITE_FRAMES.kneel; }, offset + 1080);
    }
  }, 4500);

  let prostrationTimers = [];
  function clearProstrationTimers() {
    while (prostrationTimers.length > 0) {
      clearTimeout(prostrationTimers.pop());
    }
  }

  function setCentralPose(poseKey) {
    const stack = document.getElementById('centralSpriteStack');
    if (!stack) return;
    const frames = stack.querySelectorAll('.pose-frame');
    frames.forEach((img) => {
      img.classList.toggle('active', img.getAttribute('data-pose') === poseKey);
    });
  }

  function schedulePose(ms, poseKey) {
    prostrationTimers.push(
      setTimeout(() => {
        setCentralPose(poseKey);
      }, ms)
    );
  }

  function playThreeBowsSequence(startDelayMs = 0) {
    schedulePose(startDelayMs, 'kneelDown');
    schedulePose(startDelayMs + 160, 'kneel');

    const bowOffsets = [startDelayMs + 320, startDelayMs + 1820, startDelayMs + 3320];
    bowOffsets.forEach((t0) => {
      schedulePose(t0, 'forehead');
      schedulePose(t0 + 170, 'bowMid');
      schedulePose(t0 + 330, 'prostrate');
      schedulePose(t0 + 490, 'prostrateDeep');
      schedulePose(t0 + 860, 'prostrate');
      schedulePose(t0 + 1020, 'bowMid');
      schedulePose(t0 + 1180, 'kneel');
    });

    schedulePose(startDelayMs + 4800, 'forehead');
    schedulePose(startDelayMs + 5350, 'kneel');
  }

  function animateWalkerOnCarpet(user, avatar, actionLabel, wish) {
    const centralEl = document.getElementById('centralWorshipper');
    if (!centralEl) return;

    clearProstrationTimers();
    updateCentralWorshipper(user, avatar, actionLabel, wish, false);

    centralEl.classList.remove('walking-up');
    void centralEl.offsetWidth;
    centralEl.classList.add('walking-up');

    setCentralPose('walk1');
    for (let step = 1; step <= 9; step++) {
      schedulePose(step * 195, step % 2 === 0 ? 'walk1' : 'walk2');
    }

    prostrationTimers.push(
      setTimeout(() => {
        centralEl.classList.remove('walking-up');
      }, 1950)
    );
    playThreeBowsSequence(1950);
  }

  function updateCentralWorshipper(user, avatar, actionLabel, wish, doThreeBows = true) {
    const nameEl = document.getElementById('centralName');
    const actEl = document.getElementById('centralAction');
    const wishEl = document.getElementById('centralWishBubble');
    const avatarEl = document.getElementById('centralAvatar');
    const beam = document.getElementById('sacredLightBeam');

    if (nameEl) nameEl.textContent = user || 'Thí Chủ Hữu Duyên';
    if (actEl) actEl.textContent = actionLabel || '✨ Dâng hương cầu an';
    if (wishEl) wishEl.textContent = `“${wish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường'}”`;

    if (avatarEl) {
      if (avatar) {
        avatarEl.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" />`;
      } else {
        avatarEl.textContent = String(user || '🙏').trim().charAt(0).toUpperCase();
      }
    }

    const centralEl = document.getElementById('centralWorshipper');
    if (centralEl) {
      ROBE_PALETTES.forEach((cls) => centralEl.classList.remove(cls));
      const pickedRobe = getDeterministicRobeClass(user || 'MinhTam', 2);
      centralEl.classList.add(pickedRobe);
    }

    if (doThreeBows) {
      clearProstrationTimers();
      if (centralEl) centralEl.classList.remove('walking-up');
      playThreeBowsSequence(0);
    }
    if (beam) {
      beam.classList.add('intense');
      setTimeout(() => beam.classList.remove('intense'), 4500);
    }

    const haloSys = document.getElementById('buddhaHaloSystem');
    const lotusHand = document.getElementById('lotusHandHalo');
    if (haloSys) {
      haloSys.classList.add('flare');
      setTimeout(() => haloSys.classList.remove('flare'), 3600);
    }
    if (lotusHand) {
      lotusHand.classList.add('flare');
      setTimeout(() => lotusHand.classList.remove('flare'), 3600);
    }
    particles.spawnBellWave(540, 260, 2);

    const hudName = document.getElementById('devoteeNameLine');
    const hudAct = document.getElementById('devoteeActionTag');
    if (hudName) hudName.textContent = user || 'Thí Chủ';
    if (hudAct) hudAct.textContent = actionLabel || 'Dâng hương';
  }

  // 6. Cập nhật toàn bộ giao diện theo State từ Server
  let hasInitializedRealLeader = false;
  let autoSimState = false;
  let currentTikTokState = { connected: false, connecting: false, username: 'zenfacts_vn', viewerCount: 0 };

  function renderLiveHeaderPill() {
    const liveDot = document.getElementById('liveDot');
    const liveText = document.getElementById('liveStatusText');
    const ttStatusDot = document.getElementById('tiktokStatusDot');
    const ttStatusDetail = document.getElementById('tiktokStatusDetail');
    const btnConn = document.getElementById('btnConnectTikTok');

    if (liveDot && liveText) {
      if (currentTikTokState.connected) {
        liveDot.classList.add('connected');
        liveText.textContent = `LIVE @${currentTikTokState.username} • ${currentTikTokState.viewerCount || 0} mắt`;
      } else if (currentTikTokState.connecting) {
        liveDot.classList.remove('connected');
        liveText.textContent = `Đang kết nối @${currentTikTokState.username}...`;
      } else {
        liveDot.classList.remove('connected');
        liveText.textContent = autoSimState
          ? 'CHÙA LINH ỨNG • TỰ ĐỘNG GIẢ LẬP ĐÔNG NGƯỜI'
          : 'CHÙA LINH ỨNG • ĐỨC PHẬT A DI ĐÀ';
      }
    }

    if (ttStatusDot && ttStatusDetail) {
      if (currentTikTokState.connected) {
        ttStatusDot.className = 'status-dot live';
        ttStatusDetail.textContent = `🟢 ĐÃ KẾT NỐI LIVE @${currentTikTokState.username} • ${currentTikTokState.viewerCount || 0} người xem (Room: ${currentTikTokState.roomId || 'Active'})`;
        if (btnConn) btnConn.textContent = '✅ Đã Nối';
      } else if (currentTikTokState.connecting) {
        ttStatusDot.className = 'status-dot busy';
        ttStatusDetail.textContent = `⏳ Đang kết nối tới phòng TikTok Live @${currentTikTokState.username}...`;
        if (btnConn) btnConn.textContent = '⏳ Đang nối...';
      } else {
        ttStatusDot.className = 'status-dot offline';
        if (currentTikTokState.lastError) {
          ttStatusDetail.textContent = `🔴 Chưa kết nối: ${currentTikTokState.lastError}`;
        } else {
          ttStatusDetail.textContent = autoSimState
            ? '🤖 Đang chạy Giả lập tự động (TikTok Live: Đang ngắt)'
            : '🔴 Đang ngắt kết nối — Nhập @username đang phát Live và bấm Kết Nối';
        }
        if (btnConn) btnConn.textContent = '🔌 Kết Nối';
      }
    }
  }

  function updateUIState(st) {
    if (!st) return;

    document.getElementById('statIncense').textContent = Number(st.totalIncense || 0).toLocaleString('vi-VN');
    document.getElementById('statMerit').textContent = Number(st.totalMerit || 0).toLocaleString('vi-VN');
    document.getElementById('statWoodenFish').textContent = Number(st.woodenFishHits || 0).toLocaleString('vi-VN');

    renderIncenseSticks(st.activeIncenseSticks || 9);

    // Hiển thị số lượng lễ vật trên bàn thờ
    if (st.offerings) {
      const elLotus = document.getElementById('offCountLotus');
      const elLamp = document.getElementById('offCountLamp');
      const elFruit = document.getElementById('offCountFruit');
      const elDragon = document.getElementById('offCountDragon');
      if (elLotus) elLotus.textContent = Number(st.offerings.lotus || 0).toLocaleString('vi-VN');
      if (elLamp) elLamp.textContent = Number(st.offerings.lamp || 0).toLocaleString('vi-VN');
      if (elFruit) elFruit.textContent = Number(st.offerings.fruit || 0).toLocaleString('vi-VN');
      if (elDragon) elDragon.textContent = Number(st.offerings.dragon || 0).toLocaleString('vi-VN');
    }

    // Cập nhật độ sáng Hào Quang theo năng lượng Công Đức
    const haloSys = document.getElementById('buddhaHaloSystem');
    if (haloSys && typeof st.haloIntensity === 'number' && !haloSys.classList.contains('flare')) {
      haloSys.style.opacity = String(Math.max(0.55, Math.min(1.0, st.haloIntensity)));
    }

    // Cập nhật Thanh Tích Tụ Hào Quang Cộng Đồng (Community Goal Bar)
    if (st.communityGoal) {
      const goalBar = document.getElementById('communityGoalBar');
      const goalTitle = document.getElementById('goalTitleText');
      const goalNum = document.getElementById('goalProgressText');
      const goalFill = document.getElementById('goalFillBar');

      if (goalBar) {
        goalBar.classList.toggle('bonus-active', Boolean(st.communityGoal.bonusActive));
      }
      if (goalTitle) {
        goalTitle.textContent = st.communityGoal.bonusActive
          ? `🔥 ĐẠI LỄ PHÁP VŨ CAM LỒ: ĐANG NHÂN ĐÔI CÔNG ĐỨC (x2)!`
          : `✨ Tích Tụ Hào Quang Cấp ${st.communityGoal.level} • Mở Đại Lễ Pháp Vũ Cam Lồ`;
      }
      if (goalNum) {
        goalNum.textContent = st.communityGoal.bonusActive
          ? `Còn ${st.communityGoal.bonusRemainingSec}s`
          : `${Number(st.communityGoal.current).toLocaleString('vi-VN')} / ${Number(st.communityGoal.target).toLocaleString('vi-VN')} CĐ`;
      }
      if (goalFill) {
        goalFill.style.width = st.communityGoal.bonusActive ? '100%' : `${st.communityGoal.percent}%`;
      }
    }

    const lb = Array.isArray(st.leaderboard) ? st.leaderboard : [];
    renderVipCushions(lb);
    renderCongregationHall(lb);

    if (!hasInitializedRealLeader && lb.length > 0) {
      hasInitializedRealLeader = true;
      const topDev = lb[0];
      updateCentralWorshipper(
        topDev.name,
        topDev.avatar,
        `✨ ${topDev.title || 'Thí Chủ'} • ${Number(topDev.merit).toLocaleString('vi-VN')} CĐ`,
        topDev.lastWish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường',
        false
      );
    }

    // Cập nhật Bảng TẤM LÒNG THÀNH ở góc dưới phải (Top 4)
    const lbList = document.getElementById('leaderboardList');
    if (lbList) {
      lbList.innerHTML = lb
        .slice(0, 4)
        .map(
          (item) => `
          <div class="leader-item" title="${escapeHtml(item.title || '')}">
            <span class="leader-rank">${item.rank}</span>
            <span class="leader-name">${escapeHtml(shortenName(item.name, 14))}</span>
            <span class="leader-merit">${Number(item.merit).toLocaleString('vi-VN')}</span>
          </div>
        `
        )
        .join('');
    }

    // Trạng thái kết nối TikTok Live
    if (st.tiktok) {
      currentTikTokState = { ...currentTikTokState, ...st.tiktok };
    }
    if (st.settings) {
      autoSimState = Boolean(st.settings.autoSim);
      const btnAutoSim = document.getElementById('btnToggleAutoSim');
      if (btnAutoSim) {
        btnAutoSim.textContent = autoSimState
          ? '🤖 Tự động Giả lập Người Xem: ĐANG BẬT'
          : '🤖 Tự động Giả lập Người Xem: TẮT';
        btnAutoSim.classList.toggle('active-toggle', autoSimState);
      }

      if (typeof st.settings.ttsEnabled === 'boolean') {
        audio.ttsEnabled = st.settings.ttsEnabled;
        const btnTts = document.getElementById('btnToggleTts');
        if (btnTts) {
          btnTts.textContent = `🎙️ Giọng Đọc: ${audio.ttsEnabled ? 'BẬT' : 'TẮT'}`;
          btnTts.classList.toggle('active-toggle', audio.ttsEnabled);
        }
      }

      if (typeof st.settings.bgMusicEnabled === 'boolean') {
        audio.bgMusicEnabled = st.settings.bgMusicEnabled;
        const btnMus = document.getElementById('btnToggleMusic');
        if (btnMus) {
          btnMus.textContent = `🎵 Nhạc Nền: ${audio.bgMusicEnabled ? 'BẬT' : 'TẮT'}`;
          btnMus.classList.toggle('active-toggle', audio.bgMusicEnabled);
        }
      }

      if (typeof st.settings.musicVolume === 'number') {
        audio.setMusicVolume(st.settings.musicVolume);
        const sMus = document.getElementById('sliderMusicVol');
        const vMus = document.getElementById('valMusicVol');
        const pct = Math.round(st.settings.musicVolume * 100);
        if (sMus) sMus.value = String(pct);
        if (vMus) vMus.textContent = `${pct}%`;
      }
      if (typeof st.settings.ttsVolume === 'number') {
        audio.setTtsVolume(st.settings.ttsVolume);
        const sTts = document.getElementById('sliderTtsVol');
        const vTts = document.getElementById('valTtsVol');
        const pct = Math.round(st.settings.ttsVolume * 100);
        if (sTts) sTts.value = String(pct);
        if (vTts) vTts.textContent = `${pct}%`;
      }
      if (st.settings.ttsVoice) {
        audio.ttsVoice = st.settings.ttsVoice;
        const selVoice = document.getElementById('selectTtsVoice');
        if (selVoice) selVoice.value = st.settings.ttsVoice;
      }
      if (st.settings.bgMusicMode) {
        audio.setMusicMode(st.settings.bgMusicMode, st.settings.youtubeUrl ?? null);
        const selMusic = document.getElementById('selectMusicMode');
        if (selMusic) selMusic.value = st.settings.bgMusicMode;
      }
      if (typeof st.settings.youtubeUrl === 'string' && st.settings.youtubeUrl) {
        const inpYt = document.getElementById('inputYouTubeUrl');
        if (inpYt && !inpYt.value) inpYt.value = st.settings.youtubeUrl;
      }
      if (typeof st.settings.autoSimIntervalMs === 'number') {
        const selSimSpeed = document.getElementById('selectSimSpeed');
        if (selSimSpeed) selSimSpeed.value = String(st.settings.autoSimIntervalMs);
      }
      if (typeof st.settings.smokeDensity === 'number') {
        particles.smokeDensity = st.settings.smokeDensity;
        const selSmoke = document.getElementById('selectSmokeDensity');
        if (selSmoke) selSmoke.value = String(st.settings.smokeDensity);
      }
    }
    renderLiveHeaderPill();

    const feed = document.getElementById('eventFeed');
    if (feed && Array.isArray(st.recentEvents)) {
      feed.innerHTML = st.recentEvents
        .slice(0, 8)
        .map((ev) => `<div class="event-feed-item">${formatEventSummary(ev)}</div>`)
        .join('');
    }
  }

  function formatEventSummary(ev) {
    switch (ev.type) {
      case 'burnIncense':
        return `🔥 <strong>${escapeHtml(ev.user)}</strong> dâng ${ev.count} nén nhang (+${ev.merit} CĐ)`;
      case 'strikeWoodenFish':
        return `🪵 <strong>${escapeHtml(ev.user)}</strong> gõ mõ ${ev.count} nhịp (+${ev.merit} CĐ)`;
      case 'ringBell':
        return `🔔 <strong>${escapeHtml(ev.user)}</strong> thỉnh Đại Hồng Chung (+${ev.merit} CĐ)`;
      case 'sendPrayer':
        return `🏮 <strong>${escapeHtml(ev.user)}</strong> cầu phúc: “${escapeHtml(ev.wish)}”`;
      case 'offerGift':
      case 'grandCeremony':
        return `🌸 <strong>${escapeHtml(ev.user)}</strong> dâng <em>${escapeHtml(ev.giftName)}</em> (+${ev.merit} CĐ)`;
      case 'drawFortune':
        return `🎋 <strong>${escapeHtml(ev.user)}</strong> gieo được Quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`;
      default:
        return `✨ <strong>${escapeHtml(ev.user || 'Thí chủ')}</strong> tương tác`;
    }
  }

  // ==========================================================================
  // 7. SMART RITUAL QUEUE & PRIORITY FAST-TRACK (CHỐNG GIẬT ANIMATION KHI ĐÔNG NGƯỜI)
  // ==========================================================================
  let fortuneTimer = null;
  let grandTimer = null;
  let stageBusyUntil = 0;
  let stageQueueTimer = null;
  const stageRitualQueue = [];
  const seenEventIds = new Set();

  function enqueueStageRitual(ev) {
    if (!ev) return;
    if (ev.id) {
      if (seenEventIds.has(ev.id)) return;
      seenEventIds.add(ev.id);
      if (seenEventIds.size > 200) {
        const first = seenEventIds.values().next().value;
        seenEventIds.delete(first);
      }
    }

    // Gõ mõ (Like) phát hiệu ứng tức thì, không chiếm Chánh Điện trung tâm
    if (ev.type === 'strikeWoodenFish') {
      audio.playWoodenFish();
      pulseHallBowing();
      particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 890, 935, '#ffd54f');
      if (ev.triggeredCommunityGoal) {
        triggerCommunityMilestoneCelebration();
      }
      return;
    }

    // Nếu vừa kích hoạt cột mốc 1,000 Điểm Công Đức cộng đồng -> Mưa Hoa Sen Pháp Vũ Cam Lồ
    if (ev.triggeredCommunityGoal) {
      triggerCommunityMilestoneCelebration();
    }

    // NẾU LÀ LỆNH BẤM TRỰC TIẾP TỪ BẢNG ĐIỀU KHIỂN (ev.manual === true):
    // Thực thi NGAY LẬP TỨC (0ms delay), không bắt người điều khiển phải chờ hàng đợi!
    if (ev.manual) {
      clearTimeout(stageQueueTimer);
      const durationMs = executeCenterStageRitual(ev);
      stageBusyUntil = Date.now() + Math.min(2200, durationMs);
      stageQueueTimer = setTimeout(processStageQueue, durationMs);
      return;
    }

    // Nếu phòng quá đông (hàng đợi > 5 người) và sự kiện chỉ là bình luận thường ->
    // Hiển thị ngay Đèn Hoa Đăng & Pháo Hoa Sen để người xem thấy tên mình tức khắc mà không làm nghẽn Chánh Điện!
    if (stageRitualQueue.length >= 5 && (ev.priority || 2) <= 2 && ev.type !== 'drawFortune') {
      audio.playIncenseChime();
      spawnSkyLantern(ev.user, ev.wish || 'Thành tâm kính lễ Đức Phật A Di Đà');
      particles.spawnIncenseBurst(540, 895);
      particles.spawnFloatingMerit(`+${ev.merit} CĐ • ${ev.user}`, 540, 860, '#ffe082');
      return;
    }

    stageRitualQueue.push(ev);
    // Sắp xếp ưu tiên: Quà tặng lớn (priority 5) > Quà tặng (4) > Xin xăm (3) > Bình luận (2)
    stageRitualQueue.sort((a, b) => (b.priority || 2) - (a.priority || 2));
    processStageQueue();
  }

  function processStageQueue() {
    if (stageRitualQueue.length === 0) return;
    const now = Date.now();

    // Nếu có Đại Lễ / Quà tặng lớn (priority >= 4), cho phép rút ngắn thời gian chờ để vinh danh VIP ngay
    const topPriority = stageRitualQueue[0]?.priority || 2;
    if (now < stageBusyUntil && topPriority < 4) {
      clearTimeout(stageQueueTimer);
      stageQueueTimer = setTimeout(processStageQueue, stageBusyUntil - now + 50);
      return;
    }

    const ev = stageRitualQueue.shift();
    const durationMs = executeCenterStageRitual(ev);
    stageBusyUntil = Date.now() + durationMs;

    clearTimeout(stageQueueTimer);
    stageQueueTimer = setTimeout(processStageQueue, durationMs);
  }

  function triggerCommunityMilestoneCelebration() {
    audio.playTempleBell(1.15);
    particles.spawnGrandCeremonyRain();
    pulseHallBowing();
    showGrandCeremonyBanner('Đạo Tràng Chùa Linh Ứng', 'ĐẠI LỄ PHÁP VŨ CAM LỒ (NHÂN ĐÔI CÔNG ĐỨC)', 1000);
  }

  function executeCenterStageRitual(ev) {
    if (ev.ttsText && ev.type !== 'drawFortune') {
      audio.enqueueTts(ev.ttsText, { voice: ev.ttsVoice || 'maichi' });
    }

    switch (ev.type) {
      case 'burnIncense': {
        audio.playIncenseChime();
        particles.spawnIncenseBurst(540, 895);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 860, '#ffe082');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🔥 Dâng ${ev.count} nén hương (+${ev.merit} CĐ)`, ev.wish);
        return 4600;
      }

      case 'ringBell': {
        audio.playTempleBell(1.0);
        pulseHallBowing();
        particles.spawnBellWave(540, 510, 4);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 190, 935, '#fff3b0');
        updateCentralWorshipper(ev.user, ev.avatar, `🔔 Thỉnh Đại Hồng Chung (+${ev.merit} CĐ)`, ev.wish);
        return 3800;
      }

      case 'sendPrayer': {
        audio.playIncenseChime();
        spawnSkyLantern(ev.user, ev.wish);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 920, '#ffb74d');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🏮 Cầu phúc (+${ev.merit} CĐ)`, ev.wish);
        return 4600;
      }

      case 'offerGift': {
        audio.playIncenseChime();
        audio.playTempleBell(0.85);
        particles.spawnIncenseBurst(540, 895);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 840, '#fff3b0');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🌸 Dâng ${ev.giftName} (+${ev.merit} CĐ)`, ev.wish);
        return 5200;
      }

      case 'grandCeremony': {
        audio.playTempleBell(1.2);
        setTimeout(() => audio.playTempleBell(1.1), 900);
        particles.spawnGrandCeremonyRain();
        pulseHallBowing();
        showGrandCeremonyBanner(ev.user, ev.giftName, ev.merit);
        animateWalkerOnCarpet(ev.user, ev.avatar, `🐉 ${ev.giftName} (+${ev.merit} CĐ)`, ev.wish);
        return 6200;
      }

      case 'drawFortune': {
        audio.playFortuneShake();
        updateCentralWorshipper(
          ev.user,
          ev.avatar,
          `🎋 Đang xin xăm (${ev.fortune?.topicLabel || 'Cầu an'})...`,
          `Thí chủ ${ev.user} đang thành tâm xin quẻ...`,
          false
        );
        audio.enqueueTts(ev.ttsText || '', {
          voice: ev.ttsVoice || 'maichi',
          onStart: () => {
            audio.playIncenseChime();
            showFortuneModal(ev.user, ev.fortune);
            updateCentralWorshipper(
              ev.user,
              ev.avatar,
              `🎋 Quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`,
              ev.fortune?.customAdvice || ev.fortune?.meaning || '',
              true
            );
          },
          onEnd: () => {
            clearTimeout(fortuneTimer);
            fortuneTimer = setTimeout(() => {
              document.getElementById('fortuneModal')?.classList.remove('visible');
            }, 2200);
          }
        });
        return 6000;
      }
      default:
        return 3000;
    }
  }

  function spawnSkyLantern(user, wish) {
    const layer = document.getElementById('skyLanternsLayer');
    if (!layer) return;
    const lantern = document.createElement('div');
    lantern.className = 'sky-lantern';
    const leftPos = 80 + Math.floor(Math.random() * 640);
    lantern.style.left = `${leftPos}px`;
    lantern.innerHTML = `
      <div class="sky-lantern-user">🙏 ${escapeHtml(user)}</div>
      <div class="sky-lantern-wish">“${escapeHtml(wish)}”</div>
    `;
    layer.appendChild(lantern);
    setTimeout(() => {
      lantern.remove();
    }, 10600);
  }

  function showFortuneModal(user, fortune) {
    if (!fortune) return;
    const modal = document.getElementById('fortuneModal');
    const topicSuffix = fortune.topicLabel ? ` • ${fortune.topicLabel.toUpperCase()}` : '';
    document.getElementById('fortuneRankBadge').textContent = `${fortune.rank.toUpperCase()}${topicSuffix}`;
    document.getElementById('fortuneTitle').textContent = `Quẻ Số ${fortune.number} — ${fortune.title}`;
    document.getElementById('fortuneDevotee').textContent = `Thí chủ cầu quẻ: ${user}`;
    document.getElementById('fortunePoem').textContent = fortune.poem;
    document.getElementById('fortuneMeaning').textContent = `Lời bàn (${fortune.topicLabel || 'Tổng quát'}): ${fortune.customAdvice || fortune.meaning}`;

    modal.classList.add('visible');
    clearTimeout(fortuneTimer);
    fortuneTimer = setTimeout(() => {
      modal.classList.remove('visible');
    }, 15000);
  }

  document.getElementById('fortuneModal')?.addEventListener('click', () => {
    document.getElementById('fortuneModal').classList.remove('visible');
  });

  function showGrandCeremonyBanner(user, giftName, merit) {
    const banner = document.getElementById('grandCeremonyBanner');
    document.getElementById('grandTitle').textContent = `🐉 ${giftName.toUpperCase()} 🐉`;
    document.getElementById('grandSub').textContent = `Đại Thí Chủ ${user} • Công Đức Vô Lượng (+${merit} CĐ)`;
    banner.classList.add('visible');
    clearTimeout(grandTimer);
    grandTimer = setTimeout(() => {
      banner.classList.remove('visible');
    }, 6800);
  }

  // 8. Kết nối JSON-RPC 2.0 WebSocket & Gửi Lệnh RPC
  let ws = null;
  let rpcId = 1;

  function connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === 'temple.state') {
          updateUIState(msg.params);
        } else if (msg.method === 'temple.event') {
          if (msg.params?.state) updateUIState(msg.params.state);
          if (msg.params?.event) enqueueStageRitual(msg.params.event);
        } else if (msg.method === 'temple.viewerCount') {
          if (msg.params?.viewerCount != null) {
            currentTikTokState.viewerCount = msg.params.viewerCount;
            renderLiveHeaderPill();
          }
        } else if (msg.method === 'tts.play') {
          if (msg.params?.url || msg.params?.text) {
            audio.enqueueTts(msg.params.text || 'Nam mô A Di Đà Phật', {
              voice: msg.params.voice || 'maichi',
              url: msg.params.url || null
            });
          }
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 2000);
    };
  }
  connectWebSocket();

  async function callRpc(method, params = {}, triggerBtn = null) {
    unlockAudioOnce();
    if (triggerBtn) {
      flashButton(triggerBtn);
    }
    const payload = {
      jsonrpc: '2.0',
      id: rpcId++,
      method,
      params: { ...params, manual: true }
    };
    try {
      const res = await fetch('/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.error) {
        showDockToast(`⚠️ ${data.error.message}`, 'err');
        return data;
      }
      if (data?.result?.state) updateUIState(data.result.state);
      if (data?.result?.event) enqueueStageRitual(data.result.event);
      return data;
    } catch (err) {
      showDockToast(`❌ Lỗi kết nối Server: ${err.message}`, 'err');
      return { error: { message: err.message } };
    }
  }

  function getFormInput() {
    const user = document.getElementById('inputDevoteeName')?.value.trim() || 'Quỳnh_Finn';
    const wish =
      document.getElementById('inputDevoteeWish')?.value.trim() ||
      'Cầu cho gia đình bình an, tài lộc hanh thông';
    return { user, wish };
  }

  // Gắn sự kiện tương tác trực tiếp trên màn hình 9:16 & Thanh HUD dưới đáy
  document.getElementById('incenseBurnerZone')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    showDockToast(`🔥 ${user} đang dâng 3 nén hương thơm...`);
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('cardIncense')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    showDockToast(`🔥 ${user} đang dâng 3 nén hương thơm...`);
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('cardBlessing')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    showDockToast(`🏮 ${user} vừa thả Đèn Hoa Đăng cầu an!`);
    callRpc('temple.sendPrayer', { user, wish });
  });

  document.getElementById('cardLotus')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    showDockToast(`🌸 ${user} vừa dâng Đài Hoa Sen Vàng!`);
    callRpc('temple.offerGift', {
      user,
      giftType: 'lotus',
      coins: 20,
      giftName: 'Đài Hoa Sen Vàng',
      wish
    });
  });

  document.getElementById('woodenFishStation')?.addEventListener('click', () => {
    const { user } = getFormInput();
    showDockToast(`🪵 ${user} gõ mõ tích Công Đức!`);
    callRpc('temple.strikeWoodenFish', { user, count: 1 });
  });

  document.getElementById('bellStation')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    showDockToast(`🔔 ${user} thỉnh Đại Hồng Chung!`);
    callRpc('temple.ringBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('fortuneCylinder')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    showDockToast(`🎋 ${user} đang gieo quẻ Linh Xăm Chùa Linh Ứng...`);
    callRpc('temple.drawFortune', { user, topic: wish });
  });

  // Các nút trên Quick RPC Dock bên phải
  document.getElementById('btnRpcIncense')?.addEventListener('click', (e) => {
    const { user, wish } = getFormInput();
    showDockToast(`🔥 Đã kích hoạt: ${user} thắp 3 nén hương!`);
    callRpc('temple.burnIncense', { user, count: 3, wish }, e.currentTarget);
  });

  document.getElementById('btnRpcLantern')?.addEventListener('click', (e) => {
    const { user, wish } = getFormInput();
    showDockToast(`🏮 Đã kích hoạt: ${user} thả Đèn Hoa Đăng!`);
    callRpc('temple.sendPrayer', { user, wish }, e.currentTarget);
  });

  document.getElementById('btnRpcWoodenFish')?.addEventListener('click', (e) => {
    const { user } = getFormInput();
    showDockToast(`🪵 Đã kích hoạt: ${user} gõ mõ +5 Công Đức!`);
    callRpc('temple.strikeWoodenFish', { user, count: 5 }, e.currentTarget);
  });

  document.getElementById('btnRpcBell')?.addEventListener('click', (e) => {
    const { user, wish } = getFormInput();
    showDockToast(`🔔 Đã kích hoạt: ${user} thỉnh Đại Hồng Chung!`);
    callRpc('temple.ringBell', { user, count: 1, wish, readTts: true }, e.currentTarget);
  });

  document.getElementById('btnRpcFortune')?.addEventListener('click', (e) => {
    const { user, wish } = getFormInput();
    showDockToast(`🎋 Đã kích hoạt: ${user} xin xăm / gieo quẻ!`);
    callRpc('temple.drawFortune', { user, topic: wish }, e.currentTarget);
  });

  document.getElementById('btnRpcGiftLotus')?.addEventListener('click', (e) => {
    const { user, wish } = getFormInput();
    showDockToast(`🌸 Đã kích hoạt: ${user} dâng Hoa Sen Vàng!`);
    callRpc(
      'temple.offerGift',
      {
        user,
        giftType: 'lotus',
        coins: 20,
        giftName: 'Đài Hoa Sen Vàng',
        wish
      },
      e.currentTarget
    );
  });

  document.getElementById('btnRpcGrandCeremony')?.addEventListener('click', (e) => {
    const { user, wish } = getFormInput();
    showDockToast(`🐉 Đã kích hoạt: Đại Lễ Kim Long Chầu Phật!`);
    callRpc(
      'temple.grandCeremony',
      {
        user,
        coins: 299,
        giftName: 'Đại Lễ Kim Long Chầu Phật',
        wish
      },
      e.currentTarget
    );
  });

  document.getElementById('btnConnectTikTok')?.addEventListener('click', async (e) => {
    const username = document.getElementById('inputTikTokUser')?.value.trim();
    if (!username) {
      showDockToast('⚠️ Vui lòng nhập @username hoặc link TikTok Live!', 'warn');
      return;
    }
    const btn = e.currentTarget;
    btn.textContent = '⏳ Đang nối...';
    showDockToast(`📡 Đang kết nối tới phòng TikTok Live ${username}...`, 'warn');
    const data = await callRpc('live.connect', { username });
    if (data && !data.error) {
      showDockToast(`🟢 Đã kết nối thành công phòng Live @${data.result?.username || username}!`, 'ok');
    }
    renderLiveHeaderPill();
  });

  document.getElementById('btnDisconnectTikTok')?.addEventListener('click', async (e) => {
    flashButton(e.currentTarget);
    await callRpc('live.disconnect', {});
    showDockToast('🔴 Đã ngắt kết nối phòng TikTok Live.', 'warn');
    renderLiveHeaderPill();
  });

  document.getElementById('btnToggleAutoSim')?.addEventListener('click', (e) => {
    autoSimState = !autoSimState;
    showDockToast(
      autoSimState
        ? '🤖 Đã BẬT chế độ Tự động Giả lập Người Xem!'
        : '🤖 Đã TẮT chế độ Tự động Giả lập Người Xem!'
    );
    callRpc('live.setAutoSim', { enabled: autoSimState }, e.currentTarget);
  });

  document.getElementById('btnToggleTts')?.addEventListener('click', (e) => {
    audio.ttsEnabled = !audio.ttsEnabled;
    const btn = e.currentTarget;
    btn.textContent = `🎙️ Giọng Đọc: ${audio.ttsEnabled ? 'BẬT' : 'TẮT'}`;
    btn.classList.toggle('active-toggle', audio.ttsEnabled);
    showDockToast(`🎙️ Đã ${audio.ttsEnabled ? 'BẬT' : 'TẮT'} Giọng Đọc AI!`);
    callRpc('temple.updateSettings', { ttsEnabled: audio.ttsEnabled });
  });

  document.getElementById('btnToggleMusic')?.addEventListener('click', (e) => {
    audio.bgMusicEnabled = !audio.bgMusicEnabled;
    if (audio.bgMusicEnabled) {
      audio.ensureContext();
      audio.startZenAmbience();
    } else {
      audio.stopZenAmbience();
    }
    const btn = e.currentTarget;
    btn.textContent = `🎵 Nhạc Nền: ${audio.bgMusicEnabled ? 'BẬT' : 'TẮT'}`;
    btn.classList.toggle('active-toggle', audio.bgMusicEnabled);
    showDockToast(`🎵 Đã ${audio.bgMusicEnabled ? 'BẬT' : 'TẮT'} Nhạc Nền Chùa!`);
    callRpc('temple.updateSettings', { bgMusicEnabled: audio.bgMusicEnabled });
  });

  // Sự kiện chọn Giọng đọc AI, Nhạc nền, YouTube, Tốc độ giả lập, Khói hương
  document.getElementById('selectTtsVoice')?.addEventListener('change', (e) => {
    const voice = e.target.value;
    audio.ttsVoice = voice;
    try {
      localStorage.setItem('temple_tts_voice', voice);
    } catch (_) {}
    const vName = VOICE_NAMES[voice] || voice;
    showDockToast(`🎙️ Đã đổi giọng đọc sang: ${vName}`);
    if (ttsFeedbackText) {
      ttsFeedbackText.textContent = `Đã chọn giọng: ${vName} — Bấm "🔊 Nghe Thử" để kiểm tra`;
    }
    callRpc('temple.updateSettings', { ttsVoice: voice });
  });

  document.getElementById('btnTestTtsVoice')?.addEventListener('click', (e) => {
    unlockAudioOnce();
    const btn = e.currentTarget;
    const voice = document.getElementById('selectTtsVoice')?.value || audio.ttsVoice || 'hoaimy';
    const vName = VOICE_NAMES[voice] || voice;
    const { user, wish } = getFormInput();
    flashButton(btn);
    showDockToast(`🎙️ Đã nhận lệnh! Đang tạo giọng thử (${vName})...`);
    audio.enqueueTts(
      `Nam Mô A Di Đà Phật. Chùa Linh Ứng xin chứng giám lời cầu nguyện của thí chủ ${user}: ${wish}.`,
      { voice, force: true }
    );
  });

  document.getElementById('selectMusicMode')?.addEventListener('change', (e) => {
    const mode = e.target.value;
    unlockAudioOnce();
    if (mode === 'youtube') {
      const ytUrl = document.getElementById('inputYouTubeUrl')?.value.trim();
      if (ytUrl) {
        audio.playYouTubeLink(ytUrl);
        callRpc('temple.updateSettings', { bgMusicMode: 'youtube', youtubeUrl: ytUrl });
      } else {
        showDockToast('💡 Hãy dán link YouTube vào ô bên dưới rồi bấm "▶️ Phát"!', 'warn');
        document.getElementById('inputYouTubeUrl')?.focus();
      }
      return;
    }
    audio.setMusicMode(mode);
    showDockToast(`🎵 Đã chuyển chế độ nhạc nền sang: ${e.target.options[e.target.selectedIndex]?.text || mode}`);
    callRpc('temple.updateSettings', { bgMusicMode: mode });
  });

  document.getElementById('btnPlayYouTube')?.addEventListener('click', (e) => {
    unlockAudioOnce();
    const ytUrl = document.getElementById('inputYouTubeUrl')?.value.trim();
    if (!ytUrl) {
      showDockToast('⚠️ Vui lòng dán link YouTube cần phát vào ô nhập!', 'warn');
      document.getElementById('inputYouTubeUrl')?.focus();
      return;
    }
    flashButton(e.currentTarget);
    const res = audio.playYouTubeLink(ytUrl);
    if (res.ok) {
      const selMusic = document.getElementById('selectMusicMode');
      if (selMusic) selMusic.value = 'youtube';
      callRpc('temple.updateSettings', { bgMusicMode: 'youtube', youtubeUrl: ytUrl });
    }
  });

  document.getElementById('btnStopYouTube')?.addEventListener('click', (e) => {
    flashButton(e.currentTarget);
    audio.setMusicMode('singing_bowl');
    const selMusic = document.getElementById('selectMusicMode');
    if (selMusic) selMusic.value = 'singing_bowl';
    const ytWrap = document.getElementById('ytMiniPlayerWrap');
    if (ytWrap) ytWrap.classList.remove('active');
    const ytStatus = document.getElementById('ytStatusText');
    if (ytStatus) ytStatus.textContent = '⏹️ Đã dừng YouTube — Đang phát Chuông Xoay Tây Tạng';
    showDockToast('⏹️ Đã dừng nhạc YouTube, chuyển sang Chuông Xoay Tây Tạng.');
    callRpc('temple.updateSettings', { bgMusicMode: 'singing_bowl' });
  });

  document.getElementById('selectSimSpeed')?.addEventListener('change', (e) => {
    const ms = Number(e.target.value) || 9500;
    showDockToast(`⏱️ Đã cập nhật nhịp độ giả lập: ${(ms / 1000).toFixed(1)} giây/lượt`);
    callRpc('temple.updateSettings', { autoSimIntervalMs: ms });
  });

  document.getElementById('selectSmokeDensity')?.addEventListener('change', (e) => {
    const density = Number(e.target.value) || 1.0;
    particles.smokeDensity = density;
    showDockToast(`💨 Đã cập nhật mật độ khói hương: ${Math.round(density * 100)}%`);
    callRpc('temple.updateSettings', { smokeDensity: density });
  });

  // Khởi tạo và gắn sự kiện thanh trượt chỉnh âm lượng Nhạc nền & Giọng đọc
  const sliderMusicVol = document.getElementById('sliderMusicVol');
  const valMusicVol = document.getElementById('valMusicVol');
  if (sliderMusicVol && valMusicVol) {
    const initMusPct = Math.round(audio.bgBaseVolume * 100);
    sliderMusicVol.value = String(initMusPct);
    valMusicVol.textContent = `${initMusPct}%`;
    sliderMusicVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valMusicVol.textContent = `${pct}%`;
      audio.ensureContext();
      audio.setMusicVolume(pct / 100);
    });
    sliderMusicVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('temple.updateSettings', { musicVolume: +(pct / 100).toFixed(2) });
    });
  }

  const sliderTtsVol = document.getElementById('sliderTtsVol');
  const valTtsVol = document.getElementById('valTtsVol');
  if (sliderTtsVol && valTtsVol) {
    const initTtsPct = Math.round(audio.ttsVolume * 100);
    sliderTtsVol.value = String(initTtsPct);
    valTtsVol.textContent = `${initTtsPct}%`;
    sliderTtsVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valTtsVol.textContent = `${pct}%`;
      audio.setTtsVolume(pct / 100);
    });
    sliderTtsVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('temple.updateSettings', { ttsVolume: +(pct / 100).toFixed(2) });
    });
  }

  function shortenName(name, maxLen = 13) {
    const str = String(name || '');
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
