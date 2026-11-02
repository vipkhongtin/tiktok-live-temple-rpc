/**
 * Ultra-Low-CPU 2.5D Sacred Temple Canvas Particle & Anti-Static Motion Engine v2.5
 * Tối ưu hóa chống TikTok quét "Ảnh Tĩnh / Static Upper Region" & Treo máy 24/7:
 * - Giới hạn 30 FPS ổn định (mượt trên OBS, vượt qua ngưỡng temporal entropy > 15 FPS của TikTok)
 * - 6 Lớp hiệu ứng động vùng trên (Upper Sanctuary Dynamic Layers y = 0..950):
 *   1. Mây Ngũ Sắc Tường Vân trôi ngang qua Hào Quang & hai cột đèn lồng (Auspicious Clouds)
 *   2. Vòng xoáy Mandala Chữ Vạn (卍) & Hoa Sen Vàng xoay chuyển quanh Đức Phật (Orbital Dharma Glyphs)
 *   3. Ngọn lửa ấm lung linh tại 8 vị trí Đèn Lồng Cung Đình & Đèn Lưu Ly hai bên rìa màn hình (Candle Flicker)
 *   4. Bạch Hào Tướng Quang (Urna Light) giữa trán Đức Phật & Đài Sen trên tay tỏa sáng nhịp thở
 *   5. Khói Tâm Hương bay cao lên tận đỉnh Chánh Điện (y = 895 -> y = 70), quyện quanh tượng Phật
 *   6. Hoa Sen rơi dày hơn từ mép trên (y = 0) + Bụi vàng tập trung vùng trên
 * - Pre-render toàn bộ Sprite ra Offscreen Canvas 1 lần duy nhất (0% CPU gradient overhead)
 */
class TempleParticleEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.width = 1080;
    this.height = 1920;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.smokeParticles = [];
    this.lotusPetals = [];
    this.goldSparks = [];
    this.soundWaves = [];
    this.floatingTexts = [];
    this.burstParticles = [];
    this.auspiciousClouds = [];
    this.orbitalGlyphs = [];

    // 8 tọa độ đèn lồng & đèn sen lưu ly khớp chính xác trên ảnh nền amitabha_stage.png
    this.lanternGlowNodes = [
      // 2 Đèn lồng cung đình lớn góc trên cùng hai bên (khu vực dễ bị TikTok soi ảnh tĩnh nhất)
      { x: 48, y: 170, baseR: 115, speed: 2.3, phase: 0.2, intensity: 0.72 },
      { x: 1032, y: 170, baseR: 115, speed: 2.5, phase: 1.7, intensity: 0.72 },
      // 2 Đèn lồng tường giữa hai bên câu đối/tranh khắc gỗ
      { x: 52, y: 505, baseR: 85, speed: 3.1, phase: 3.1, intensity: 0.65 },
      { x: 1028, y: 505, baseR: 85, speed: 2.9, phase: 4.4, intensity: 0.65 },
      // 2 Đèn đồng hai bên bàn thờ trên
      { x: 64, y: 860, baseR: 88, speed: 2.7, phase: 0.9, intensity: 0.68 },
      { x: 1016, y: 860, baseR: 88, speed: 2.8, phase: 2.6, intensity: 0.68 },
      // 2 Đài hoa sen vàng phát sáng hai bên bàn thờ
      { x: 145, y: 945, baseR: 92, speed: 2.1, phase: 1.4, intensity: 0.75 },
      { x: 935, y: 945, baseR: 92, speed: 2.2, phase: 3.8, intensity: 0.75 }
    ];

    this.incenseTips = [];
    this.smokeDensity = 1.0;
    this.time = 0;
    this.lastFrameTime = 0;
    this.frameInterval = 1000 / 30;

    this.buildOffscreenSprites();
    this.initAmbientParticles();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  buildOffscreenSprites() {
    // 1. Pre-render Smoke Puff Sprite (64x64)
    this.smokeSprite = document.createElement('canvas');
    this.smokeSprite.width = 64;
    this.smokeSprite.height = 64;
    const sctx = this.smokeSprite.getContext('2d');
    const sgrad = sctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    sgrad.addColorStop(0, 'rgba(255, 246, 218, 0.88)');
    sgrad.addColorStop(0.5, 'rgba(238, 222, 185, 0.42)');
    sgrad.addColorStop(1, 'rgba(220, 200, 160, 0)');
    sctx.fillStyle = sgrad;
    sctx.beginPath();
    sctx.arc(32, 32, 30, 0, Math.PI * 2);
    sctx.fill();

    // 2. Pre-render Gold Spark Sprite (20x20)
    this.sparkSprite = document.createElement('canvas');
    this.sparkSprite.width = 20;
    this.sparkSprite.height = 20;
    const gctx = this.sparkSprite.getContext('2d');
    const ggrad = gctx.createRadialGradient(10, 10, 1, 10, 10, 9);
    ggrad.addColorStop(0, 'rgba(255, 250, 210, 1)');
    ggrad.addColorStop(0.45, 'rgba(255, 215, 90, 0.72)');
    ggrad.addColorStop(1, 'rgba(255, 185, 40, 0)');
    gctx.fillStyle = ggrad;
    gctx.beginPath();
    gctx.arc(10, 10, 9, 0, Math.PI * 2);
    gctx.fill();

    // 3. Pre-render Warm Candle/Lantern Glow Sprite (128x128)
    this.lanternGlowSprite = document.createElement('canvas');
    this.lanternGlowSprite.width = 128;
    this.lanternGlowSprite.height = 128;
    const lctx = this.lanternGlowSprite.getContext('2d');
    const lgrad = lctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    lgrad.addColorStop(0, 'rgba(255, 248, 205, 0.95)');
    lgrad.addColorStop(0.35, 'rgba(255, 198, 75, 0.52)');
    lgrad.addColorStop(0.7, 'rgba(255, 140, 25, 0.18)');
    lgrad.addColorStop(1, 'rgba(255, 120, 10, 0)');
    lctx.fillStyle = lgrad;
    lctx.beginPath();
    lctx.arc(64, 64, 62, 0, Math.PI * 2);
    lctx.fill();

    // 4. Pre-render Auspicious Golden Cloud Sprite (220x90) - Mây Tường Vân vùng trên
    this.cloudSprite = document.createElement('canvas');
    this.cloudSprite.width = 220;
    this.cloudSprite.height = 90;
    const cctx = this.cloudSprite.getContext('2d');
    const puffs = [
      { x: 65, y: 50, r: 36 },
      { x: 110, y: 40, r: 42 },
      { x: 155, y: 52, r: 34 },
      { x: 88, y: 58, r: 30 },
      { x: 132, y: 58, r: 30 }
    ];
    puffs.forEach((pf) => {
      const cg = cctx.createRadialGradient(pf.x, pf.y, 2, pf.x, pf.y, pf.r);
      cg.addColorStop(0, 'rgba(255, 236, 175, 0.34)');
      cg.addColorStop(0.55, 'rgba(244, 193, 80, 0.14)');
      cg.addColorStop(1, 'rgba(244, 193, 80, 0)');
      cctx.fillStyle = cg;
      cctx.beginPath();
      cctx.arc(pf.x, pf.y, pf.r, 0, Math.PI * 2);
      cctx.fill();
    });

    // 5. Pre-render Dharma Swastika (卍) & Sacred Star Glyph Sprites (36x36)
    this.swastikaSprite = this.createGlyphSprite('卍', '#ffe89e');
    this.omLotusSprite = this.createGlyphSprite('☸', '#ffd54f');

    // 6. Pre-render Pink & Gold Lotus Petal Sprites (28x28)
    this.pinkPetalSprite = this.createPetalSprite('rgba(248, 165, 194, 0.88)');
    this.goldPetalSprite = this.createPetalSprite('rgba(255, 218, 110, 0.88)');
  }

  createGlyphSprite(char, color) {
    const c = document.createElement('canvas');
    c.width = 40;
    c.height = 40;
    const gctx = c.getContext('2d');
    const bg = gctx.createRadialGradient(20, 20, 1, 20, 20, 18);
    bg.addColorStop(0, 'rgba(255, 240, 170, 0.65)');
    bg.addColorStop(1, 'rgba(255, 190, 50, 0)');
    gctx.fillStyle = bg;
    gctx.beginPath();
    gctx.arc(20, 20, 18, 0, Math.PI * 2);
    gctx.fill();

    gctx.font = '900 20px "Noto Serif", sans-serif';
    gctx.textAlign = 'center';
    gctx.textBaseline = 'middle';
    gctx.fillStyle = color;
    gctx.fillText(char, 20, 21);
    return c;
  }

  createPetalSprite(fillStyle) {
    const c = document.createElement('canvas');
    c.width = 28;
    c.height = 28;
    const pctx = c.getContext('2d');
    const sz = 11;
    pctx.translate(14, 14);
    pctx.beginPath();
    pctx.moveTo(0, -sz);
    pctx.bezierCurveTo(sz * 0.85, -sz * 0.4, sz * 0.75, sz * 0.75, 0, sz);
    pctx.bezierCurveTo(-sz * 0.75, sz * 0.75, -sz * 0.85, -sz * 0.4, 0, -sz);
    pctx.fillStyle = fillStyle;
    pctx.fill();
    return c;
  }

  initAmbientParticles() {
    // 1. 38 Hạt linh khí vàng (Ưu tiên 65% ở nửa trên màn hình y = 0..950)
    for (let i = 0; i < 38; i++) {
      const focusUpper = i < 25;
      this.goldSparks.push({
        x: Math.random() * this.width,
        y: focusUpper ? Math.random() * 950 : Math.random() * this.height,
        size: 10 + Math.random() * 11,
        vy: -(0.75 + Math.random() * 1.35),
        vx: (Math.random() - 0.5) * 0.65,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.45 + Math.random() * 0.5,
        focusUpper
      });
    }

    // 2. 18 Cánh hoa sen rơi liên tục từ đỉnh màn hình xuống
    for (let i = 0; i < 18; i++) {
      this.lotusPetals.push(this.createLotusPetal(true));
    }

    // 3. 7 Đám mây Tường Vân ngũ sắc trôi lững lờ ở vùng trên (y = 80..680)
    for (let i = 0; i < 7; i++) {
      this.auspiciousClouds.push({
        x: (i / 7) * (this.width + 300) - 150,
        y: 95 + (i % 4) * 145 + Math.random() * 35,
        scaleX: 1.1 + (i % 3) * 0.35,
        scaleY: 0.85 + (i % 2) * 0.25,
        vx: (i % 2 === 0 ? 1 : -1) * (0.45 + (i % 3) * 0.18),
        alpha: 0.42 + (i % 3) * 0.12,
        phase: i * 1.1
      });
    }

    // 4. 10 Pháp luân Chữ Vạn (卍) xoay quanh vòng Hào Quang Đức Phật A Di Đà (x=540, y=265)
    for (let i = 0; i < 10; i++) {
      this.orbitalGlyphs.push({
        angle: (Math.PI * 2 * i) / 10,
        radiusX: i % 2 === 0 ? 315 : 235,
        radiusY: i % 2 === 0 ? 275 : 210,
        speed: i % 2 === 0 ? 0.0065 : -0.0085,
        isSwastika: i % 2 === 0,
        phase: i * 0.7
      });
    }
  }

  createLotusPetal(randomY = false) {
    return {
      x: Math.random() * this.width,
      y: randomY ? Math.random() * 1200 : -30 - Math.random() * 90,
      scale: 0.75 + Math.random() * 0.6,
      vy: 1.35 + Math.random() * 1.65,
      vx: (Math.random() - 0.5) * 1.05,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.045,
      swayPhase: Math.random() * Math.PI * 2,
      gold: Math.random() > 0.5
    };
  }

  setIncenseTips(tips) {
    this.incenseTips = Array.isArray(tips) ? tips : [];
  }

  spawnSmokeFromTips() {
    if (!this.incenseTips.length || this.smokeParticles.length >= 34) return;
    if (Math.random() > 0.62 * this.smokeDensity) return;

    const tip = this.incenseTips[Math.floor(Math.random() * this.incenseTips.length)];
    // Khói bay cao từ lư hương (y=895) lên tận đỉnh hào quang Phật (y=75)
    this.smokeParticles.push({
      x: tip.x + (Math.random() - 0.5) * 8,
      y: tip.y,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -(2.8 + Math.random() * 1.3),
      radius: 9 + Math.random() * 5,
      maxRadius: 42 + Math.random() * 22,
      alpha: 0.28 + Math.random() * 0.12,
      age: 0,
      maxAge: 165 + Math.random() * 55,
      seed: Math.random() * 50
    });
  }

  spawnIncenseBurst(x = 540, y = 890) {
    for (let i = 0; i < 20; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = 2.8 + Math.random() * 5.2;
      this.burstParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2.5 + Math.random() * 3.0,
        alpha: 1,
        decay: 0.032 + Math.random() * 0.02,
        color: i % 2 === 0 ? '#ffdf85' : '#ff9e44'
      });
    }
  }

  spawnBellWave(x = 540, y = 420, count = 2) {
    for (let i = 0; i < Math.min(count, 3); i++) {
      this.soundWaves.push({
        x,
        y,
        radius: 34 + i * 26,
        maxRadius: 480 + i * 60,
        alpha: 0.75 - i * 0.16,
        lineWidth: 3.2 - i * 0.6
      });
    }
  }

  spawnFloatingMerit(text = '+1 Công Đức', x = 540, y = 940, color = '#ffe082') {
    if (this.floatingTexts.length > 8) this.floatingTexts.shift();
    this.floatingTexts.push({
      text,
      x: x + (Math.random() - 0.5) * 36,
      y,
      vy: -3.2,
      alpha: 1.0,
      color
    });
  }

  spawnGrandCeremonyRain() {
    for (let i = 0; i < 20; i++) {
      this.lotusPetals.push(this.createLotusPetal(false));
    }
    for (let i = 0; i < 36; i++) {
      const angle = (Math.PI * 2 * i) / 36;
      const speed = 3.5 + Math.random() * 7.5;
      this.burstParticles.push({
        x: 540,
        y: 380,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 3.5,
        alpha: 1,
        decay: 0.022 + Math.random() * 0.015,
        color: i % 3 === 0 ? '#fff3b0' : i % 3 === 1 ? '#ffb703' : '#ff7aa2'
      });
    }
  }

  animate(timestamp) {
    requestAnimationFrame(this.animate);

    if (document.hidden) return;
    if (timestamp - this.lastFrameTime < this.frameInterval) return;
    this.lastFrameTime = timestamp;

    this.time += 0.04;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // ========================================================================
    // LỚP 1: MÂY TƯỜNG VÂN NGŨ SẮC TRÔI NGANG VÙNG TRÊN (y = 80..680)
    // ========================================================================
    for (let i = 0; i < this.auspiciousClouds.length; i++) {
      const cl = this.auspiciousClouds[i];
      cl.x += cl.vx;
      const bobY = Math.sin(this.time * 0.8 + cl.phase) * 8;
      if (cl.vx > 0 && cl.x > this.width + 180) cl.x = -220;
      if (cl.vx < 0 && cl.x < -220) cl.x = this.width + 180;

      const w = 220 * cl.scaleX;
      const h = 90 * cl.scaleY;
      ctx.globalAlpha = cl.alpha * (0.75 + 0.25 * Math.sin(this.time + cl.phase));
      ctx.drawImage(this.cloudSprite, cl.x - w * 0.5, cl.y + bobY - h * 0.5, w, h);
    }

    // ========================================================================
    // LỚP 2: ÁNH LỬA ĐÈN LỒNG CUNG ĐÌNH & ĐÀI SEN LƯU Ly LUNG LINH (8 ĐIỂM)
    // ========================================================================
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.lanternGlowNodes.length; i++) {
      const node = this.lanternGlowNodes[i];
      const pulse =
        0.72 +
        0.28 * Math.sin(this.time * node.speed + node.phase) +
        0.12 * Math.cos(this.time * (node.speed * 1.7) + node.phase);
      const r = node.baseR * (0.88 + 0.22 * pulse);
      ctx.globalAlpha = Math.min(1, node.intensity * pulse);
      ctx.drawImage(this.lanternGlowSprite, node.x - r, node.y - r, r * 2, r * 2);
    }

    // Bạch Hào Tướng Quang (Urna giữa trán Đức Phật x=499, y=205) & Hào quang Ngực Chữ Vạn (x=499, y=382)
    const urnaPulse = 0.65 + 0.35 * Math.sin(this.time * 2.2);
    ctx.globalAlpha = 0.55 * urnaPulse;
    ctx.drawImage(this.sparkSprite, 499 - 22, 205 - 22, 44, 44);
    ctx.globalAlpha = 0.48 * (0.7 + 0.3 * Math.cos(this.time * 1.8));
    ctx.drawImage(this.lanternGlowSprite, 499 - 65, 382 - 65, 130, 130);

    // ========================================================================
    // LỚP 3: VÒNG XOÁY PHÁP LUÂN CHỮ VẠN (卍) QUANH HÀO QUANG ĐỨC PHẬT
    // ========================================================================
    for (let i = 0; i < this.orbitalGlyphs.length; i++) {
      const gl = this.orbitalGlyphs[i];
      gl.angle += gl.speed;
      const gx = 540 + Math.cos(gl.angle) * gl.radiusX;
      const gy = 275 + Math.sin(gl.angle) * gl.radiusY;
      // Chỉ vẽ khi nằm ở nửa trên từ vai Phật trở lên để tạo chiều sâu vòng hào quang
      if (gy < 540) {
        const scale = 0.85 + 0.25 * Math.sin(this.time * 2 + gl.phase);
        const sz = 36 * scale;
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.time * 1.6 + gl.phase);
        ctx.drawImage(
          gl.isSwastika ? this.swastikaSprite : this.omLotusSprite,
          gx - sz * 0.5,
          gy - sz * 0.5,
          sz,
          sz
        );
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // ========================================================================
    // LỚP 4: HẠT LINH KHÍ VÀNG BAY LÊN TOÀN MÀN HÌNH (TẬP TRUNG VÙNG TRÊN)
    // ========================================================================
    for (let i = 0; i < this.goldSparks.length; i++) {
      const sp = this.goldSparks[i];
      sp.y += sp.vy;
      sp.x += sp.vx + Math.sin(this.time + sp.phase) * 0.55;
      if (sp.y < -20) {
        sp.y = sp.focusUpper ? 920 + Math.random() * 120 : this.height + 15;
        sp.x = Math.random() * this.width;
      }
      ctx.globalAlpha = sp.alpha * (0.55 + 0.45 * Math.sin(this.time * 2.2 + sp.phase));
      ctx.drawImage(this.sparkSprite, sp.x - sp.size * 0.5, sp.y - sp.size * 0.5, sp.size, sp.size);
    }

    // ========================================================================
    // LỚP 5: KHÓI TÂM HƯƠNG UỐN LƯỢN LÊN TẬN ĐỈNH CHÁNH ĐIỆN (y = 895 -> 75)
    // ========================================================================
    this.spawnSmokeFromTips();
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.age += 1;
      if (p.age >= p.maxAge || p.y < 75) {
        this.smokeParticles.splice(i, 1);
        continue;
      }
      const progress = p.age / p.maxAge;
      const curl = Math.sin(this.time * 1.6 + p.seed + p.y * 0.012) * 0.85;
      p.x += p.vx + curl * (0.35 + progress * 0.85);
      p.y += p.vy;

      const r = p.radius + (p.maxRadius - p.radius) * progress;
      const fade = Math.sin(progress * Math.PI) * p.alpha * (1 - progress * 0.5);
      ctx.globalAlpha = Math.max(0, fade);
      ctx.drawImage(this.smokeSprite, p.x - r, p.y - r, r * 2, r * 2);
    }

    // ========================================================================
    // LỚP 6: CÁNH HOA SEN RƠI TỪ ĐỈNH MÀN HÌNH XUỐNG
    // ========================================================================
    ctx.globalAlpha = 1;
    for (let i = this.lotusPetals.length - 1; i >= 0; i--) {
      const petal = this.lotusPetals[i];
      petal.y += petal.vy;
      petal.x += petal.vx + Math.sin(this.time + petal.swayPhase) * 0.85;
      petal.rot += petal.vrot;

      if (petal.y > this.height + 35) {
        if (this.lotusPetals.length > 18) {
          this.lotusPetals.splice(i, 1);
          continue;
        } else {
          Object.assign(petal, this.createLotusPetal(false));
        }
      }

      ctx.save();
      ctx.translate(petal.x, petal.y);
      ctx.rotate(petal.rot);
      const sz = 28 * petal.scale;
      ctx.drawImage(
        petal.gold ? this.goldPetalSprite : this.pinkPetalSprite,
        -sz * 0.5,
        -sz * 0.5,
        sz,
        sz
      );
      ctx.restore();
    }

    // 7. Sóng âm Đại Hồng Chung
    for (let i = this.soundWaves.length - 1; i >= 0; i--) {
      const w = this.soundWaves[i];
      w.radius += 10.5;
      w.alpha *= 0.94;
      if (w.radius >= w.maxRadius || w.alpha < 0.03) {
        this.soundWaves.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = w.alpha;
      ctx.strokeStyle = '#ffd666';
      ctx.lineWidth = w.lineWidth;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 8. Hạt pháo hoa sen
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const b = this.burstParticles[i];
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.08;
      b.alpha -= b.decay;
      if (b.alpha <= 0) {
        this.burstParticles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, b.alpha);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. Chữ +Công Đức bay lên
    if (this.floatingTexts.length > 0) {
      ctx.font = '800 27px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15, 4, 2, 0.9)';
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y += ft.vy;
        ft.alpha -= 0.032;
        if (ft.alpha <= 0) {
          this.floatingTexts.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
      }
    }

    ctx.globalAlpha = 1;
  }
}

window.TempleParticleEngine = TempleParticleEngine;
