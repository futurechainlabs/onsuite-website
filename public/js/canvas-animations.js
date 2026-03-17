/**
 * OnSuite Canvas Animations
 * Ported from v6-final.html with site palette and Plus Jakarta Sans font.
 * 5 canvases: cHero, cConnect, cOptima, cTrace, cValue
 */
(function () {
  'use strict';

  /* ─── PALETTE (mapped from site CSS custom properties) ─── */
  var C = {
    navy:   '#000032',   // --navy-800
    blue:   '#0089CF',   // --blue-500
    pink:   '#ff3b78',   // --coral-500
    cyan:   '#04bf8a',   // --success
    purple: '#413C85',
    white:  '#ffffff',
    text:   '#677294'
  };

  var FONT = "'Plus Jakarta Sans', sans-serif";

  /* ─── SHARED UTIL: rounded rect ─── */
  function rr(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  /* ─── IntersectionObserver helper ─── */
  var visibleMap = {};

  function observeCanvas(id) {
    var el = document.getElementById(id);
    if (!el) return;
    visibleMap[id] = false;
    if (!('IntersectionObserver' in window)) {
      visibleMap[id] = true;
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visibleMap[id] = e.isIntersecting;
      });
    }, { threshold: 0.05 });
    obs.observe(el);
  }

  function isVisible(id) {
    return visibleMap[id] === true;
  }

  /* ═══════════════════════════════════════════════════════════
     1. HERO OEE DASHBOARD  (cHero)
     ═══════════════════════════════════════════════════════════ */
  function initHero() {
    var c = document.getElementById('cHero');
    if (!c) return;
    var ctx = c.getContext('2d');
    observeCanvas('cHero');

    var t = 0;
    var lines = [
      { l: 'HAT-01', base: 0.87, col: C.blue,    hist: [] },
      { l: 'HAT-02', base: 0.74, col: C.pink,    hist: [] },
      { l: 'HAT-03', base: 0.91, col: C.cyan,    hist: [] },
      { l: 'HAT-04', base: 0.64, col: '#BAB5DF', hist: [] }
    ];
    lines.forEach(function (m) {
      for (var i = 0; i < 38; i++) m.hist.push(m.base + (Math.random() - 0.5) * 0.1);
    });

    function stateColor(v) {
      return v > 0.82 ? C.cyan : v > 0.70 ? '#FFB547' : C.pink;
    }

    function draw() {
      requestAnimationFrame(draw);
      if (!isVisible('cHero')) return;

      t += 0.018;
      var W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.navy;
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      for (var y = 0; y < H; y += 42) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y);
        ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1; ctx.stroke();
      }

      // Column headers
      var headers = ['MAKINE', 'OEE', 'DURUM', 'GECMIS (38 olcum)', 'GUNCEL'];
      var xs = [18, 152, 210, 285, 510];
      headers.forEach(function (h, i) {
        ctx.font = 'bold 9.5px ' + FONT;
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        ctx.fillText(h, xs[i], 16);
      });

      lines.forEach(function (m, i) {
        var y = 38 + i * 72;
        var now = Math.max(0.44, Math.min(0.97, m.base + Math.sin(t * 0.7 + i) * 0.04 + (Math.random() - 0.5) * 0.006));
        m.hist.shift();
        m.hist.push(now);
        var cur = m.hist[m.hist.length - 1];
        var col = stateColor(cur);

        // Alternating row bg
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,.015)';
          ctx.fillRect(0, y - 16, W, 52);
        }

        // Machine name
        ctx.font = '600 12px ' + FONT;
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.fillText(m.l, 18, y + 5);

        // Mini gauge
        var gx = 172, gy = y + 2, gr = 16;
        ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 4; ctx.stroke();

        ctx.beginPath(); ctx.arc(gx, gy, gr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cur);
        ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();

        ctx.font = 'bold 9px ' + FONT;
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText((cur * 100).toFixed(0) + '%', gx, gy + 3);
        ctx.textAlign = 'left';

        // Status dot
        ctx.beginPath(); ctx.arc(220, y + 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();
        ctx.font = '11px ' + FONT; ctx.fillStyle = col;
        ctx.fillText(cur > 0.82 ? 'Normal' : cur > 0.70 ? 'Dikkat' : 'Durus', 230, y + 6);

        // Sparkline
        var sw = 160, sx = 285;
        ctx.beginPath();
        m.hist.forEach(function (v, j) {
          var px = sx + j * (sw / 37);
          var py = y + 23 - v * 30;
          j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.strokeStyle = m.col + 'aa'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.lineTo(sx + sw, y + 23);
        ctx.lineTo(sx, y + 23);
        ctx.closePath();
        ctx.fillStyle = m.col + '1a'; ctx.fill();

        // Current value
        ctx.font = 'bold 13px ' + FONT;
        ctx.fillStyle = col; ctx.textAlign = 'right';
        ctx.fillText((cur * 100).toFixed(1) + '%', 560, y + 7);
        ctx.textAlign = 'left';
      });

      // Bottom average bar
      var avg = lines.reduce(function (s, m) { return s + m.hist[m.hist.length - 1]; }, 0) / lines.length;
      ctx.fillStyle = 'rgba(0,137,207,.08)';
      ctx.fillRect(0, H - 4, W, 4);
      ctx.fillStyle = C.blue;
      ctx.fillRect(0, H - 4, W * avg, 4);

      // Update external element
      var heroEl = document.getElementById('heroOEE');
      if (heroEl) heroEl.textContent = '%' + (avg * 100).toFixed(1);
    }
    draw();
  }

  /* ═══════════════════════════════════════════════════════════
     2. CONNECT PLC STREAM  (cConnect)
     ═══════════════════════════════════════════════════════════ */
  function initConnect() {
    var c = document.getElementById('cConnect');
    if (!c) return;
    var ctx = c.getContext('2d');
    observeCanvas('cConnect');

    var t = 0;
    var devs = [
      { l: 'Siemens S7-1500', sub: 'rpm', vf: function () { return Math.floor(1450 + Math.sin(t * 0.8) * 75); }, col: C.blue,    y: 60 },
      { l: 'Beckhoff CX9020', sub: '\u00B0C', vf: function () { return (62 + Math.sin(t * 0.5) * 7).toFixed(1); },  col: C.cyan,    y: 140 },
      { l: 'Allen Bradley',   sub: 'bar', vf: function () { return (3.2 + Math.sin(t * 0.6) * 0.38).toFixed(2); }, col: '#FFB547', y: 220 },
      { l: 'Modbus RTU',      sub: 'A',   vf: function () { return (12.4 + Math.sin(t * 0.9) * 0.7).toFixed(1); }, col: '#BAB5DF', y: 300 }
    ];
    var pkts = [];
    var ptimer = 0;

    function draw() {
      requestAnimationFrame(draw);
      if (!isVisible('cConnect')) return;

      var W = c.width, H = c.height;
      t += 0.025;
      ptimer++;

      if (ptimer % 16 === 0) {
        var d = devs[Math.floor(Math.random() * devs.length)];
        pkts.push({ x: 198, y: d.y, tx: 390, sp: 3 + Math.random() * 2, col: d.col, lbl: d.vf() + d.sub });
      }

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.navy;
      ctx.fillRect(0, 0, W, H);

      // Vertical grid
      for (var x = 0; x < W; x += 44) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H);
        ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.lineWidth = 1; ctx.stroke();
      }

      // Hub box
      var hx = 432, hy = 162, hw = 92, hh = 72;
      ctx.fillStyle = 'rgba(0,137,207,.1)';
      ctx.strokeStyle = 'rgba(0,137,207,.32)';
      ctx.lineWidth = 1.5;
      rr(ctx, hx - hw / 2, hy - hh / 2, hw, hh, 10, true, true);

      ctx.font = 'bold 11px ' + FONT;
      ctx.fillStyle = C.blue; ctx.textAlign = 'center';
      ctx.fillText('OnSuite', hx, hy - 8);
      ctx.fillText('Connect', hx, hy + 8);
      ctx.font = '9px ' + FONT;
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillText('Hub', hx, hy + 22);
      ctx.textAlign = 'left';

      // Output arrow
      ctx.beginPath(); ctx.moveTo(hx + hw / 2, hy); ctx.lineTo(528, hy);
      ctx.strokeStyle = 'rgba(0,137,207,.3)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = 'bold 9px ' + FONT;
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.fillText('ERP/Cloud', 500, hy - 7);
      ctx.font = '8.5px ' + FONT;
      ctx.fillStyle = 'rgba(0,137,207,.5)';
      ctx.fillText('REST\u00B7OPC', 500, hy + 8);

      // Device cards and dashed lines
      devs.forEach(function (d, di) {
        // Dashed line to hub
        ctx.beginPath(); ctx.moveTo(198, d.y); ctx.lineTo(hx - hw / 2, hy);
        ctx.strokeStyle = d.col + '28'; ctx.lineWidth = 1;
        ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);

        var pulse = 0.75 + 0.25 * Math.sin(t * 2 + di);
        ctx.shadowColor = d.col; ctx.shadowBlur = 8 * pulse;

        // Device card
        ctx.fillStyle = 'rgba(255,255,255,.025)';
        ctx.strokeStyle = d.col + '50'; ctx.lineWidth = 1;
        rr(ctx, 10, d.y - 18, 182, 36, 7, true, true);
        ctx.shadowBlur = 0;

        ctx.font = '600 11px ' + FONT;
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillText(d.l, 20, d.y - 3);
        ctx.font = '12px ' + FONT;
        ctx.fillStyle = d.col;
        ctx.fillText(d.vf() + ' ' + d.sub, 20, d.y + 13);

        // Status dot
        ctx.beginPath(); ctx.arc(178, d.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = d.col; ctx.fill();
      });

      // Moving packets
      for (var i = pkts.length - 1; i >= 0; i--) {
        var p = pkts[i];
        p.x += p.sp;
        if (p.x > p.tx) { pkts.splice(i, 1); continue; }
        ctx.fillStyle = p.col + 'cc';
        ctx.strokeStyle = p.col + '88'; ctx.lineWidth = 1;
        rr(ctx, p.x - 22, p.y - 8, 48, 16, 3, true, true);
        ctx.font = 'bold 8px ' + FONT;
        ctx.fillStyle = C.navy; ctx.textAlign = 'center';
        ctx.fillText(p.lbl, p.x + 2, p.y + 3);
        ctx.textAlign = 'left';
      }
    }
    draw();
  }

  /* ═══════════════════════════════════════════════════════════
     3. OPTIMA WATERFALL  (cOptima)
     ═══════════════════════════════════════════════════════════ */
  function initOptima() {
    var c = document.getElementById('cOptima');
    if (!c) return;
    var ctx = c.getContext('2d');
    observeCanvas('cOptima');

    var t = 0, ab = 0;
    var losses = [
      { l: 'Planli Dur.',  pct: 0.05,  col: C.purple,  blink: false },
      { l: 'Ariza',        pct: 0.04,  col: C.pink,    blink: true },
      { l: 'Setup',        pct: 0.03,  col: '#FFB547', blink: false },
      { l: 'Hiz Kaybi',    pct: 0.025, col: '#FFC107', blink: false },
      { l: 'Fire/Red',     pct: 0.025, col: '#AB47BC', blink: false }
    ];

    function draw() {
      requestAnimationFrame(draw);
      if (!isVisible('cOptima')) return;

      var W = c.width, H = c.height;
      t += 0.02;
      ab += 0.07;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.navy;
      ctx.fillRect(0, 0, W, H);

      // Grid
      for (var y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y);
        ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1; ctx.stroke();
      }

      // Title
      ctx.font = 'bold 11px ' + FONT;
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillText('OEE KAYIP SELALESI  \u2014  HAT-02', 16, 18);

      var bw = 54, gap = 9, sx = 26, by = 265, th = 190;
      var cum = 0;

      // Teorik bar
      ctx.fillStyle = 'rgba(0,137,207,.12)';
      ctx.strokeStyle = 'rgba(0,137,207,.3)'; ctx.lineWidth = 1;
      ctx.fillRect(sx, by - th, bw, th);
      ctx.strokeRect(sx, by - th, bw, th);

      ctx.font = '600 9.5px ' + FONT;
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.textAlign = 'center';
      ctx.fillText('Teorik', sx + bw / 2, by + 12);
      ctx.fillText('100%', sx + bw / 2, by - th - 4);
      ctx.textAlign = 'left';

      // Loss bars
      losses.forEach(function (l, i) {
        var bx = sx + (bw + gap) * (i + 1);
        var lh = l.pct * th * 8;
        var bl = l.blink ? (0.7 + 0.3 * Math.sin(ab)) : 1;
        var stackY = by - th * (1 - cum);

        ctx.fillStyle = l.col + Math.floor(bl * 180).toString(16).padStart(2, '0');
        ctx.strokeStyle = l.col; ctx.lineWidth = 1;
        ctx.fillRect(bx, stackY, bw, lh);
        ctx.strokeRect(bx, stackY, bw, lh);

        ctx.font = 'bold 8.5px ' + FONT;
        ctx.fillStyle = l.col; ctx.textAlign = 'center';
        ctx.fillText(l.l, bx + bw / 2, by + 12);
        ctx.fillText('-' + (l.pct * 100).toFixed(1) + '%', bx + bw / 2, stackY - 4);
        ctx.textAlign = 'left';

        cum += l.pct;
      });

      // Final OEE bar
      var finalOee = 1 - cum + Math.sin(t * 0.4) * 0.008;
      var fx = sx + (bw + gap) * 6;
      var g = ctx.createLinearGradient(fx, by - finalOee * th, fx, by);
      g.addColorStop(0, C.cyan);
      g.addColorStop(1, '#1aaa14');
      ctx.fillStyle = g;
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
      ctx.fillRect(fx, by - finalOee * th, bw, finalOee * th);
      ctx.strokeRect(fx, by - finalOee * th, bw, finalOee * th);

      ctx.font = 'bold 10px ' + FONT;
      ctx.fillStyle = C.cyan; ctx.textAlign = 'center';
      ctx.fillText('OEE', fx + bw / 2, by + 12);
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillText((finalOee * 100).toFixed(1) + '%', fx + bw / 2, by - finalOee * th - 5);
      ctx.textAlign = 'left';

      // Blinking alert
      if (Math.sin(ab) > 0.3) {
        ctx.fillStyle = 'rgba(255,59,120,.13)';
        ctx.strokeStyle = 'rgba(255,59,120,.42)'; ctx.lineWidth = 1;
        rr(ctx, 318, 12, 192, 24, 6, true, true);
        ctx.font = 'bold 10px ' + FONT;
        ctx.fillStyle = C.pink;
        ctx.fillText('\u26A0  Planlanmamis Durus: HAT-02', 328, 26);
      }

      // Legend
      losses.forEach(function (l, i) {
        ctx.fillStyle = l.col;
        ctx.fillRect(26 + i * 96, 294, 8, 8);
        ctx.font = '8.5px ' + FONT;
        ctx.fillStyle = 'rgba(255,255,255,.33)';
        ctx.fillText(l.l, 38 + i * 96, 302);
      });
    }
    draw();
  }

  /* ═══════════════════════════════════════════════════════════
     4. TRACE LOT FLOW  (cTrace)
     ═══════════════════════════════════════════════════════════ */
  function initTrace() {
    var c = document.getElementById('cTrace');
    if (!c) return;
    var ctx = c.getContext('2d');
    observeCanvas('cTrace');

    var t = 0, active = 0, stTimer = 0;
    var steps = [
      { l: 'Ham Madde', s: 'LOT-2026-0314', ic: '\uD83D\uDCE6', col: '#BAB5DF', x: 60 },
      { l: 'Kesim',     s: 'OP-001',         ic: '\u2699\uFE0F', col: C.blue,    x: 165 },
      { l: 'Isleme',    s: 'OP-002',         ic: '\uD83D\uDD27', col: C.purple,  x: 270 },
      { l: 'Kalite',    s: 'QC Pass',        ic: '\u2705',       col: C.cyan,    x: 375 },
      { l: 'Sevkiyat',  s: 'PKG-814',        ic: '\uD83D\uDCE6', col: '#FFB547', x: 480 }
    ];
    var parts = [];

    function draw() {
      requestAnimationFrame(draw);
      if (!isVisible('cTrace')) return;

      var W = c.width, H = c.height;
      t += 0.02;
      stTimer++;

      if (stTimer % 75 === 0) {
        active = (active + 1) % steps.length;
        if (active > 0) {
          parts.push({
            x: steps[active - 1].x + 38,
            y: 162,
            tx: steps[active].x - 18,
            sp: 2.5,
            col: steps[active - 1].col
          });
        }
      }

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.navy;
      ctx.fillRect(0, 0, W, H);

      // Grid
      for (var y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y);
        ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.lineWidth = 1; ctx.stroke();
      }

      // Title
      ctx.font = 'bold 11px ' + FONT;
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillText('TRACE  \u2014  Lot Akis Izlenebilirligi', 16, 18);

      // Connection lines between steps
      steps.forEach(function (s, i) {
        if (i < steps.length - 1) {
          ctx.beginPath();
          ctx.moveTo(s.x + 38, 162);
          ctx.lineTo(steps[i + 1].x - 18, 162);
          ctx.strokeStyle = i < active ? 'rgba(0,137,207,.4)' : 'rgba(255,255,255,.08)';
          ctx.lineWidth = 2;
          if (i === active) ctx.setLineDash([5, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Step boxes
      steps.forEach(function (s, i) {
        var isA = i === active;
        var isDone = i < active;

        if (isA) { ctx.shadowColor = s.col; ctx.shadowBlur = 16; }

        ctx.fillStyle = isDone ? s.col + '1e' : isA ? s.col + '26' : 'rgba(255,255,255,.025)';
        ctx.strokeStyle = isDone ? s.col + '55' : isA ? s.col : 'rgba(255,255,255,.08)';
        ctx.lineWidth = isA ? 2 : 1;
        rr(ctx, s.x - 38, 134, 76, 56, 9, true, true);
        ctx.shadowBlur = 0;

        // Icon
        ctx.font = '18px serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.ic, s.x, 158);

        // Label
        ctx.font = (isA ? '600 ' : '') + '10px ' + FONT;
        ctx.fillStyle = isDone ? s.col : isA ? '#fff' : 'rgba(255,255,255,.45)';
        ctx.fillText(s.l, s.x, 172);

        // Sub label
        ctx.font = '8.5px ' + FONT;
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        ctx.fillText(s.s, s.x, 184);
        ctx.textAlign = 'left';

        // Step number circle
        ctx.beginPath(); ctx.arc(s.x, 130, 9, 0, Math.PI * 2);
        ctx.fillStyle = isDone ? s.col : isA ? s.col : 'rgba(255,255,255,.08)';
        ctx.fill();

        ctx.font = 'bold 9px ' + FONT;
        ctx.fillStyle = (isDone || isA) ? C.navy : 'rgba(255,255,255,.35)';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), s.x, 134);
        ctx.textAlign = 'left';
      });

      // Animated dots
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.x += p.sp;
        if (p.x >= p.tx) { parts.splice(i, 1); continue; }
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = p.col;
        ctx.shadowColor = p.col; ctx.shadowBlur = 8;
        ctx.fill(); ctx.shadowBlur = 0;
      }

      // Detail panel
      ctx.fillStyle = 'rgba(255,255,255,.025)';
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
      ctx.fillRect(16, 224, 508, 74);
      ctx.strokeRect(16, 224, 508, 74);

      ctx.font = 'bold 10.5px ' + FONT;
      ctx.fillStyle = C.blue;
      ctx.fillText('AKTIF LOT', 28, 242);

      var info = [
        ['Lot No',    'LOT-2026-0314'],
        ['Parca',     'P-8814-CNC'],
        ['Miktar',    '240 adet'],
        ['Operator',  'M. Yilmaz'],
        ['Makine',    'CNC-07']
      ];
      info.forEach(function (it, i) {
        ctx.font = '9px ' + FONT;
        ctx.fillStyle = 'rgba(255,255,255,.3)';
        ctx.fillText(it[0], 28 + i * 94, 260);
        ctx.font = 'bold 10px ' + FONT;
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.fillText(it[1], 28 + i * 94, 276);
      });

      // Progress bar
      var prog = active / 4;
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      rr(ctx, 28, 288, 480, 6, 3, true, false);
      var pg = ctx.createLinearGradient(28, 0, 28 + 480 * prog, 0);
      pg.addColorStop(0, C.blue);
      pg.addColorStop(1, C.pink);
      ctx.fillStyle = pg;
      rr(ctx, 28, 288, Math.max(6, 480 * prog), 6, 3, true, false);

      ctx.font = '9px ' + FONT;
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.fillText('Akis: %' + (prog * 100).toFixed(0) + ' tamamlandi', 28, 302);
    }
    draw();
  }

  /* ═══════════════════════════════════════════════════════════
     5. VALUE KPI BARS  (cValue)
     ═══════════════════════════════════════════════════════════ */
  function initValue() {
    var c = document.getElementById('cValue');
    if (!c) return;
    var ctx = c.getContext('2d');
    observeCanvas('cValue');

    var t = 0;
    var allData = [
      {
        title: 'Uretim KPI', rows: [
          { l: 'OEE Iyilestirme',    v: 0.78, col: C.blue,    u: '+12\u201318 puan' },
          { l: 'Durus Gorunurlugu',   v: 0.95, col: C.cyan,    u: '%95' },
          { l: 'Raporlama Suresi',    v: 0.80, col: '#FFB547', u: '-%80' },
          { l: 'Plan Sapmasi',        v: 0.65, col: C.purple,  u: '-%65' }
        ]
      },
      {
        title: 'Kalite KPI', rows: [
          { l: 'Fire Azaltma',     v: 0.60, col: C.cyan,    u: '-%60' },
          { l: 'Erken Hata',       v: 0.92, col: C.blue,    u: '%92' },
          { l: 'Izlenebilirlik',   v: 1.00, col: C.purple,  u: '%100' },
          { l: 'Musteri Sikayeti', v: 0.45, col: '#FFB547', u: '-%45' }
        ]
      },
      {
        title: 'Enerji KPI', rows: [
          { l: 'Enerji Tasarrufu', v: 0.18, col: C.cyan,    u: '-%18' },
          { l: 'CO\u2082 Azaltma', v: 0.22, col: C.blue,    u: '-%22' },
          { l: 'Rapor Otomasyon',  v: 0.90, col: C.purple,  u: '%90' },
          { l: 'ISO 50001 Uyum',   v: 0.85, col: '#FFB547', u: '%85' }
        ]
      },
      {
        title: 'Entegrasyon KPI', rows: [
          { l: 'ERP Senkron',       v: 0.99, col: C.blue,   u: '%99.x' },
          { l: 'Entegrasyon Hizi',  v: 0.75, col: C.cyan,   u: '\u00D73' },
          { l: 'Manuel Giris',      v: 0.80, col: C.pink,   u: '-%80' },
          { l: 'Veri Dogrulugu',    v: 0.97, col: C.purple,  u: '%97' }
        ]
      }
    ];

    var ai = 0;
    var curV = allData[0].rows.map(function () { return 0; });
    var tgtV = allData[0].rows.map(function (r) { return r.v; });

    function setTab(i) {
      ai = i;
      tgtV = allData[i].rows.map(function (r) { return r.v; });
      curV = curV.map(function () { return 0; });

      // Update page-side tab UI if present
      var tabs = document.querySelectorAll('.vt');
      if (tabs.length) {
        tabs.forEach(function (el) { el.classList.remove('on'); });
        tabs.forEach(function (el) {
          if (String(el.dataset.i) === String(i)) el.classList.add('on');
        });
      }

      // Update value points if container exists
      var pts = document.getElementById('vPts');
      if (pts) {
        var allPts = [
          [{ ic: '\uD83D\uDCC9', h: 'Durus nedenlerinde tam gorunurluk', p: 'Otomatik kayit, siniflandirma ve sorumlu atama.' }, { ic: '\uD83D\uDCC8', h: 'OEE bazli performans takibi', p: 'Hat, vardiya ve ekipman bazinda anlik analiz.' }, { ic: '\uD83E\uDD16', h: 'AI ile durus tahmini', p: 'On-premise LLM ile ariza oncesi uyari.' }, { ic: '\uD83D\uDCCB', h: 'Aksiyon ve iyilestirme takibi', p: 'Sorumlu atama, kapanma ve etkinlik olcumu.' }],
          [{ ic: '\uD83D\uDD0D', h: 'Otomatik kalite gozlemi', p: 'Jidoka ve kontrol listeleri ile sifir kacak hedefi.' }, { ic: '\uD83D\uDCE6', h: 'Lot bazli tam izlenebilirlik', p: 'Ham maddeden sevkiyata LOT/SN takibi.' }, { ic: '\uD83D\uDEA6', h: 'Anlik kalite alarmi', p: 'Limit disi olcumde aninda alarm ve durdurma.' }, { ic: '\uD83D\uDCCA', h: 'Otomatik kalite raporlari', p: 'Musteri ve donem bazli raporlama.' }],
          [{ ic: '\u26A1', h: 'Makine bazli enerji izleme', p: 'Hat ve makine bazinda kWh takibi.' }, { ic: '\uD83C\uDF3F', h: 'Karbon ayak izi', p: 'ISO 50001 ve AB CBAM uyumlu raporlama.' }, { ic: '\uD83D\uDCC9', h: 'Kayip enerji tespiti', p: 'Bosta calisan makineleri tespit et.' }, { ic: '\uD83D\uDCCB', h: 'ESG raporlamasi', p: 'Surdurulebilirlik raporu otomasyonu.' }],
          [{ ic: '\uD83D\uDD17', h: 'ERP cift yonlu senkron', p: 'SAP, Logo, Netsis ile anlik alisveris.' }, { ic: '\uD83D\uDE80', h: 'Hizli entegrasyon', p: '2\u20134 haftada hazir konnektorler.' }, { ic: '\uD83D\uDD12', h: 'Guvenli veri transferi', p: 'On-premise veya sifreli API.' }, { ic: '\uD83D\uDCE1', h: 'Coklu sistem yonetimi', p: 'ERP, MES, SCADA ve IoT tek noktadan.' }]
        ];
        pts.innerHTML = allPts[i].map(function (d) {
          return '<div class="vp anim in"><div class="vp-ic">' + d.ic + '</div><div><h4>' + d.h + '</h4><p>' + d.p + '</p></div></div>';
        }).join('');
      }
    }

    // Bind tab click listeners
    document.querySelectorAll('.vt').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('.vt').forEach(function (v) { v.classList.remove('on'); });
        el.classList.add('on');
        setTab(+el.dataset.i);
      });
    });

    // Expose global tab switch function
    window.setValueTab = function (index) {
      if (index >= 0 && index < allData.length) setTab(index);
    };

    // Init first tab
    setTab(0);

    function draw() {
      requestAnimationFrame(draw);
      if (!isVisible('cValue')) return;

      var W = c.width, H = c.height;
      t += 0.02;

      // Smooth interpolation
      curV = curV.map(function (v, i) { return v + (tgtV[i] - v) * 0.04; });

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.navy;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = 'bold 11px ' + FONT;
      ctx.fillStyle = 'rgba(255,255,255,.38)';
      ctx.fillText(allData[ai].title + ' \u2014 OnSuite', 16, 22);

      // KPI rows
      allData[ai].rows.forEach(function (r, i) {
        var y = 46 + i * 72;
        var pct = curV[i];

        // Alternating row bg
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,.016)';
          ctx.fillRect(0, y - 10, W, 52);
        }

        // Label
        ctx.font = '600 12.5px ' + FONT;
        ctx.fillStyle = 'rgba(255,255,255,.72)';
        ctx.fillText(r.l, 16, y + 7);

        // Track bg
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        rr(ctx, 16, y + 14, 344, 8, 4, true, false);

        // Gradient bar
        var gl = ctx.createLinearGradient(16, 0, 16 + 344 * pct, 0);
        gl.addColorStop(0, r.col + '88');
        gl.addColorStop(1, r.col);
        ctx.fillStyle = gl;
        rr(ctx, 16, y + 14, 344 * pct, 8, 4, true, false);

        // Glowing dot at end
        ctx.shadowColor = r.col; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(16 + 344 * pct, y + 18, 4, 0, Math.PI * 2);
        ctx.fillStyle = r.col; ctx.fill();
        ctx.shadowBlur = 0;

        // Value text
        ctx.font = 'bold 12px ' + FONT;
        ctx.fillStyle = r.col; ctx.textAlign = 'right';
        ctx.fillText(r.u, 484, y + 8);
        ctx.textAlign = 'left';
      });
    }
    draw();
  }

  /* ─── INIT ON DOM READY ─── */
  function init() {
    initHero();
    initConnect();
    initOptima();
    initTrace();
    initValue();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
