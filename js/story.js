// ═══════════════════════════════════════════════════════════════
//  STORY — campaign opening sequence
// ═══════════════════════════════════════════════════════════════

// Player portraits — before and after
const portraitImg = new Image();
let portraitReady = false;
portraitImg.onload  = () => { portraitReady = true; };
portraitImg.onerror = () => { console.warn('navy portrait failed to load'); };
portraitImg.src = 'assets/mitchell.png';

const portraitCivImg = new Image();
let portraitCivReady = false;
portraitCivImg.onload  = () => { portraitCivReady = true; };
portraitCivImg.onerror = () => { console.warn('contractor portrait failed to load'); };
portraitCivImg.src = 'assets/mitchell_contractor.png';

// ── CAST ──────────────────────────────────────────────────────
const CAST = {
  mitchell:  { img: null, src: 'assets/mitchell.png',
               name: 'COMMANDER C. MITCHELL', role: 'United States Navy' },
  mitchellCiv:{img: null, src: 'assets/mitchell_contractor.png',
               name: 'MITCHELL', role: 'Contractor · Spearpoint Global Solutions' },
  williams:  { img: null, src: 'assets/adm_williams.png',
               name: 'ADMIRAL H. WILLIAMS', role: 'United States Navy' },
  reyne:     { img: null, src: 'assets/reyne.png',
               name: 'CALLUM REYNE', role: 'Chairman · Spearpoint Global Solutions' },
  eva:       { img: null, src: 'assets/spearpoint_logo.png', logo: true,
               name: 'EVA', role: 'Spearpoint Operations' }
};
for (const k of Object.keys(CAST)) {
  const c = CAST[k];
  c.ready = false;                 // set BEFORE src, or a cached
  const im = new Image();          // image's onload is clobbered
  c.img = im;
  im.onload  = () => { c.ready = true; };
  im.onerror = () => { c.ready = false; console.warn('portrait missing:', c.src); };
  im.src = c.src;
}

// Each beat is a full screen. Advance with click / space / enter.
const INTRO_BEATS = [
  {
    kind: 'text',
    over: 'black',
    lines: [
      { t: 'You were going to be the best of them.', size: 34, col: '#e9f4ff' },
      { t: 'Everyone said so. Including you.', size: 16, col: 'rgba(160,200,235,0.6)', gap: 26 }
    ],
    hold: 2.2
  },
  {
    kind: 'portraitReveal',
    name: 'COMMANDER C. MITCHELL',
    role: 'United States Navy',
    caption: 'Official portrait — taken three weeks before the hearing.'
  },
  {
    kind: 'portrait',
    who: 'williams',
    speaker: 'ADMIRAL H. WILLIAMS',
    role: 'Commander, Naval Surface Forces Atlantic',
    lines: [
      'You had a station. You left it.',
      'A civilian vessel was in distress and you went. I have read your report ' +
      'and I do not doubt a word of it. Eleven people are alive because of what you did.'
    ]
  },
  {
    kind: 'portrait',
    speaker: 'ADMIRAL H. WILLIAMS',
    role: 'Commander, Naval Surface Forces Atlantic',
    lines: [
      'And while you were gone, the gap you left was the gap they came through.',
      'That is not a punishment I am inventing to teach you something. ' +
      'It is what happened. The rule exists because of exactly this.'
    ]
  },
  {
    kind: 'portrait',
    speaker: 'ADMIRAL H. WILLIAMS',
    role: 'Commander, Naval Surface Forces Atlantic',
    lines: [
      'If I put you back on a bridge tomorrow, you would do it again.',
      'Wouldn\'t you.'
    ],
    beatAfter: 1.4
  },
  {
    kind: 'choice',
    prompt: 'Mitchell answers.',
    options: [
      { t: '"Yes, sir. Every time."', flag: 'defiant',
        after: 'You do not look away when you say it.' },
      { t: '"...Yes."', flag: 'quiet',
        after: 'Quieter. But you do not take it back.' }
    ]
  },
  {
    kind: 'portrait',
    speaker: 'ADMIRAL H. WILLIAMS',
    role: 'Commander, Naval Surface Forces Atlantic',
    lines: [
      'Then we understand each other.',
      'You are relieved. For what it is worth — and it is worth nothing here — ' +
      'I would have wanted you to come for me too.'
    ]
  },
  {
    kind: 'text',
    over: 'black',
    lines: [
      { t: 'ELEVEN WEEKS LATER', size: 15, col: 'rgba(140,190,230,0.55)', track: 6 }
    ],
    hold: 1.8
  },
  {
    kind: 'matchCut',
    name: 'MITCHELL',
    role: 'Contractor',
    caption: 'Same hands. Same table. Different flag.'
  },
  {
    kind: 'message',
    from: 'SPEARPOINT GLOBAL SOLUTIONS',
    handler: true,
    lines: [
      'Your record was reviewed. Your discharge was noted.',
      'Neither disqualifies you.',
      '',
      'Spearpoint operates the first privately held guided-missile destroyer ' +
      'in service. She is configured for humanitarian response and armed ' +
      'sufficiently to protect what she is escorting.',
      '',
      'The role is command. The terms are attached.',
      '',
      '— addressed to C. MITCHELL, formerly USN'
    ]
  },
  {
    kind: 'hero',
    title: 'DDG-144',
    sub: 'ARLEIGH BURKE CLASS  ·  FLIGHT IIA',
    lines: [
      '9,217 tons.  96 vertical launch cells.  Two aircraft.',
      'Built for a navy that no longer wants Commander Mitchell.',
      'Now she is his.'
    ]
  },
  {
    kind: 'message',
    from: 'EVA  ·  SPEARPOINT OPERATIONS',
    handler: true,
    civ: true,
    lines: [
      'I am EVA. I will be your point of contact.',
      '',
      'Shakedown tasking. Atlantic test range, Cape Canaveral.',
      'Target drones on a cruise-missile profile.',
      '',
      'Prove the ship works. Then we will find you something that matters.'
    ]
  }
];

// ── STATE ─────────────────────────────────────────────────────
class IntroSequence {
  constructor() {
    this.i = 0;
    this.t = 0;
    this.charT = 0;
    this.flags = {};
    this.done = false;
    this.choiceSel = 0;
  }
  get beat() { return INTRO_BEATS[this.i]; }

  update(dt) {
    this.t += dt;
    this.charT += dt * 46;   // typewriter speed
  }

  // How many characters of the current beat's text are revealed
  revealed() { return Math.floor(this.charT); }

  fullyTyped() {
    const b = this.beat;
    if (!b) return true;
    const total = this.beatCharCount(b);
    return this.revealed() >= total;
  }

  beatCharCount(b) {
    if (b.kind === 'text') return b.lines.reduce((s, l) => s + l.t.length, 0);
    if (b.kind === 'portrait' || b.kind === 'message' || b.kind === 'hero')
      return (b.lines || []).reduce((s, l) => s + l.length, 0);
    if (b.kind === 'portraitReveal' || b.kind === 'matchCut') return 0;
    return 0;
  }

  // Beats with no text still need a moment to land
  canAdvance() {
    const b = this.beat;
    if (!b) return true;
    if (b.kind === 'portraitReveal') return this.t > 1.6;
    if (b.kind === 'matchCut') return this.t > 4.6;
    return this.fullyTyped();
  }

  advance() {
    const b = this.beat;
    if (!b) { this.done = true; return; }
    // Timed beats: a press during the hold skips the hold rather
    // than being swallowed, so fast input never feels dead.
    if ((b.kind === 'portraitReveal' || b.kind === 'matchCut') && !this.canAdvance()) {
      this.t = 99;
      return;
    }
    if (!this.fullyTyped()) {
      // First press completes the typing
      this.charT = this.beatCharCount(b) + 10;
      return;
    }
    if (b.kind === 'choice') {
      b.options[this.choiceSel] && (this.flags[b.options[this.choiceSel].flag] = true);
    }
    this.i++;
    this.t = 0;
    this.charT = 0;
    this.choiceSel = 0;
    if (this.i >= INTRO_BEATS.length) this.done = true;
  }

  moveChoice(d) {
    const b = this.beat;
    if (b && b.kind === 'choice') {
      this.choiceSel = (this.choiceSel + d + b.options.length) % b.options.length;
    }
  }
}

// ── RENDER ────────────────────────────────────────────────────
function drawIntro(ctx, W, H, intro, btns) {
  const U = uiScale(W, H);
  const b = intro.beat;
  btns.length = 0;
  if (!b) return;

  // Backdrop
  if (b.kind === 'hero') {
    drawHero(ctx, W, H, intro.t * 0.4);
  } else {
    ctx.fillStyle = '#03070e';
    ctx.fillRect(0, 0, W, H);
    // Faint moving grain so black screens are not dead
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = scanPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const cx = W / 2;
  let reveal = intro.revealed();

  const typed = (str) => {
    if (reveal <= 0) return '';
    const out = str.slice(0, reveal);
    reveal -= str.length;
    return out;
  };

  // ── TEXT CARD ──
  if (b.kind === 'text') {
    let y = H * 0.44;
    ctx.textAlign = 'center';
    for (const l of b.lines) {
      y += (l.gap || 0) * U;
      ctx.fillStyle = l.col || '#e9f4ff';
      ctx.font = `${l.size * U}px monospace`;
      if (l.track) setLS(ctx, `${l.track * U}px`);
      ctx.fillText(typed(l.t), cx, y);
      setLS(ctx, '0px');
      y += (l.size + 16) * U;
    }
  }

  // ── PORTRAIT (speaker) ──
  if (b.kind === 'portrait') {
    // Portrait frame — placeholder silhouette until you supply art
    const pw = 300 * U, ph = 380 * U;
    const px = W * 0.13, py = H * 0.5 - ph / 2;
    ctx.fillStyle = 'rgba(10,20,34,0.9)';
    ctx.fillRect(px, py, pw, ph);
    if (b.who && CAST[b.who]) drawCastPortrait(ctx, CAST[b.who], px, py, pw, ph, U, intro.t);
    else drawPortrait(ctx, px, py, pw, ph, U, intro.t, b.civ ? 'contractor' : 'navy');
    ctx.strokeStyle = 'rgba(80,140,190,0.35)';
    ctx.lineWidth = 1.5 * U;
    ctx.strokeRect(px, py, pw, ph);
    // Corner ticks
    ctx.strokeStyle = 'rgba(120,190,240,0.5)';
    ctx.lineWidth = 2 * U;
    const tk = 16 * U;
    [[px,py,1,1],[px+pw,py,-1,1],[px,py+ph,1,-1],[px+pw,py+ph,-1,-1]].forEach(([x,y,sx,sy])=>{
      ctx.beginPath();
      ctx.moveTo(x, y + sy*tk); ctx.lineTo(x, y); ctx.lineTo(x + sx*tk, y);
      ctx.stroke();
    });

    // Speaker block
    const tx = px + pw + 46 * U;
    let y = py + 42 * U;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4da6ff';
    ctx.font = `bold ${13 * U}px monospace`;
    setLS(ctx, `${2.5 * U}px`);
    ctx.fillText(b.speaker, tx, y);
    setLS(ctx, '0px');
    y += 20 * U;
    ctx.fillStyle = 'rgba(140,185,220,0.5)';
    ctx.font = `${10.5 * U}px monospace`;
    ctx.fillText(b.role, tx, y);
    y += 14 * U;
    ctx.strokeStyle = 'rgba(80,140,190,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx, y); ctx.lineTo(W - W*0.12, y); ctx.stroke();
    y += 40 * U;

    ctx.fillStyle = 'rgba(215,235,250,0.9)';
    ctx.font = `${17 * U}px monospace`;
    const maxW = W - W*0.12 - tx;
    for (const line of b.lines) {
      const shown = typed(line);
      y = wrapText(ctx, shown, tx, y, maxW, 26 * U);
      y += 18 * U;
      if (reveal <= 0) break;
    }
  }

  // ── PORTRAIT REVEAL ──
  if (b.kind === 'portraitReveal') {
    const ph = H * 0.74, pw = ph * 0.75;
    const px = cx - pw / 2, py = H * 0.10;
    // Glow behind
    const gl = ctx.createRadialGradient(cx, py + ph * 0.4, 0, cx, py + ph * 0.4, pw * 1.1);
    gl.addColorStop(0, 'rgba(40,90,150,0.30)');
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);

    drawPortrait(ctx, px, py, pw, ph, U, intro.t, b.civ ? 'contractor' : 'navy');
    ctx.strokeStyle = b.civ ? 'rgba(210,170,90,0.45)' : 'rgba(120,180,225,0.4)';
    ctx.lineWidth = 2 * U;
    ctx.strokeRect(px, py, pw, ph);
    // Corner ticks
    ctx.strokeStyle = b.civ ? 'rgba(230,190,110,0.7)' : 'rgba(140,200,245,0.65)';
    ctx.lineWidth = 2.5 * U;
    const tk = 26 * U;
    [[px,py,1,1],[px+pw,py,-1,1],[px,py+ph,1,-1],[px+pw,py+ph,-1,-1]].forEach(([x,y,sx,sy])=>{
      ctx.beginPath();
      ctx.moveTo(x, y + sy*tk); ctx.lineTo(x, y); ctx.lineTo(x + sx*tk, y);
      ctx.stroke();
    });

    // Nameplate under the portrait
    let ny = py + ph + 40 * U;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9f4ff';
    ctx.font = `bold ${26 * U}px monospace`;
    setLS(ctx, `${3 * U}px`);
    ctx.fillText(b.name, cx, ny);
    setLS(ctx, '0px');
    ny += 24 * U;
    ctx.fillStyle = b.civ ? 'rgba(215,180,110,0.6)' : 'rgba(140,190,225,0.55)';
    ctx.font = `${12 * U}px monospace`;
    setLS(ctx, `${2 * U}px`);
    ctx.fillText(b.role, cx, ny);
    setLS(ctx, '0px');
    if (b.caption) {
      ny += 26 * U;
      ctx.fillStyle = 'rgba(110,150,185,0.4)';
      ctx.font = `italic ${11 * U}px monospace`;
      ctx.fillText(b.caption, cx, ny);
    }
    ctx.textAlign = 'left';
  }

  // ── MATCH CUT — the same man, changed ──
  if (b.kind === 'matchCut') {
    // Hold on the officer, then dissolve into the contractor.
    const HOLD = 1.5, FADE = 2.6;
    const blend = Math.max(0, Math.min(1, (intro.t - HOLD) / FADE));
    const eased = blend * blend * (3 - 2 * blend);   // smoothstep

    const ph = H * 0.74, pw = ph * 0.75;
    const px = cx - pw / 2, py = H * 0.10;

    // Backdrop shifts blue -> amber as he changes
    const gl = ctx.createRadialGradient(cx, py + ph * 0.4, 0, cx, py + ph * 0.4, pw * 1.2);
    const r = Math.round(40 + eased * 70), g2 = Math.round(90 - eased * 30), bl2 = Math.round(150 - eased * 105);
    gl.addColorStop(0, `rgba(${r},${g2},${bl2},0.32)`);
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);

    drawPortrait(ctx, px, py, pw, ph, U, intro.t, eased);

    const edgeCol = `rgba(${Math.round(120+eased*110)},${Math.round(180-eased*10)},${Math.round(225-eased*115)},0.5)`;
    ctx.strokeStyle = edgeCol;
    ctx.lineWidth = 2 * U;
    ctx.strokeRect(px, py, pw, ph);
    ctx.lineWidth = 2.5 * U;
    const tk = 26 * U;
    [[px,py,1,1],[px+pw,py,-1,1],[px,py+ph,1,-1],[px+pw,py+ph,-1,-1]].forEach(([x,y,sx,sy])=>{
      ctx.beginPath();
      ctx.moveTo(x, y + sy*tk); ctx.lineTo(x, y); ctx.lineTo(x + sx*tk, y);
      ctx.stroke();
    });

    // Nameplate crossfades too
    let ny = py + ph + 40 * U;
    ctx.textAlign = 'center';
    ctx.font = `bold ${26 * U}px monospace`;
    setLS(ctx, `${3 * U}px`);
    ctx.globalAlpha = 1 - eased;
    ctx.fillStyle = '#e9f4ff';
    ctx.fillText('COMMANDER C. MITCHELL', cx, ny);
    ctx.globalAlpha = eased;
    ctx.fillStyle = '#f0dfae';
    ctx.fillText('MITCHELL', cx, ny);
    ctx.globalAlpha = 1;
    setLS(ctx, '0px');

    ny += 24 * U;
    ctx.font = `${12 * U}px monospace`;
    setLS(ctx, `${2 * U}px`);
    ctx.globalAlpha = 1 - eased;
    ctx.fillStyle = 'rgba(140,190,225,0.55)';
    ctx.fillText('United States Navy', cx, ny);
    ctx.globalAlpha = eased;
    ctx.fillStyle = 'rgba(215,180,110,0.7)';
    ctx.fillText('Contractor  ·  Spearpoint Global Solutions', cx, ny);
    ctx.globalAlpha = 1;
    setLS(ctx, '0px');

    if (b.caption && eased > 0.75) {
      ny += 28 * U;
      ctx.globalAlpha = (eased - 0.75) / 0.25;
      ctx.fillStyle = 'rgba(200,175,130,0.55)';
      ctx.font = `italic ${12 * U}px monospace`;
      ctx.fillText(b.caption, cx, ny);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  // ── MESSAGE (text-only handler) ──
  if (b.kind === 'message') {
    let bw = W * 0.56, bx = cx - bw / 2;
    let y = H * 0.28;

    // Spearpoint transmissions carry the company mark
    if (b.handler && CAST.eva.ready) {
      const lw = H * 0.30, lh = lw * (CAST.eva.img.height / CAST.eva.img.width);
      const lxp = W * 0.11;
      drawCastPortrait(ctx, CAST.eva, lxp, H * 0.28, lw, lh, U, intro.t);
      ctx.strokeStyle = 'rgba(200,168,96,0.35)';
      ctx.lineWidth = 1.5 * U;
      ctx.strokeRect(lxp, H * 0.28, lw, lh);
      bx = lxp + lw + 50 * U;
      bw = W - bx - W * 0.10;
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = b.handler ? 'rgba(120,190,240,0.55)' : 'rgba(140,185,220,0.45)';
    ctx.font = `bold ${10 * U}px monospace`;
    setLS(ctx, `${2.5 * U}px`);
    ctx.fillText(b.handler ? '◆ INCOMING TRANSMISSION' : '◆ MESSAGE', bx, y);
    setLS(ctx, '0px');
    y += 18 * U;
    ctx.fillStyle = '#4da6ff';
    ctx.font = `bold ${14 * U}px monospace`;
    ctx.fillText(b.from, bx, y);
    y += 16 * U;
    ctx.strokeStyle = 'rgba(80,140,190,0.28)';
    ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y); ctx.stroke();
    y += 36 * U;
    ctx.fillStyle = 'rgba(210,232,248,0.88)';
    ctx.font = `${15 * U}px monospace`;
    for (const line of b.lines) {
      if (line === '') { y += 14 * U; continue; }
      const shown = typed(line);
      y = wrapText(ctx, shown, bx, y, bw, 24 * U);
      if (reveal <= 0) break;
    }
  }

  // ── HERO REVEAL ──
  if (b.kind === 'hero') {
    const bx = W * 0.09;
    let y = H * 0.58;
    ctx.textAlign = 'left';
    ctx.save();
    ctx.shadowColor = 'rgba(90,180,255,0.5)';
    ctx.shadowBlur = 30 * U;
    ctx.fillStyle = '#e9f4ff';
    ctx.font = `bold ${62 * U}px monospace`;
    ctx.fillText(b.title, bx, y);
    ctx.restore();
    y += 26 * U;
    ctx.fillStyle = 'rgba(130,190,230,0.6)';
    ctx.font = `${12 * U}px monospace`;
    setLS(ctx, `${4 * U}px`);
    ctx.fillText(b.sub, bx, y);
    setLS(ctx, '0px');
    y += 40 * U;
    ctx.fillStyle = 'rgba(205,228,246,0.82)';
    ctx.font = `${15 * U}px monospace`;
    for (const line of b.lines) {
      const shown = typed(line);
      ctx.fillText(shown, bx, y);
      y += 24 * U;
      if (reveal <= 0) break;
    }
  }

  // ── CHOICE ──
  if (b.kind === 'choice') {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(140,185,220,0.5)';
    ctx.font = `${13 * U}px monospace`;
    ctx.fillText(b.prompt, cx, H * 0.40);
    let y = H * 0.48;
    b.options.forEach((o, i) => {
      const on = intro.choiceSel === i;
      const bw = W * 0.42, bx = cx - bw / 2, bh = 54 * U;
      if (on) {
        ctx.fillStyle = 'rgba(74,166,255,0.10)';
        ctx.fillRect(bx, y, bw, bh);
        ctx.fillStyle = '#4da6ff';
        ctx.fillRect(bx, y, 3 * U, bh);
      }
      ctx.fillStyle = on ? '#e9f4ff' : 'rgba(150,190,225,0.5)';
      ctx.font = `${on ? 'bold ' : ''}${19 * U}px monospace`;
      ctx.fillText(o.t, cx, y + 35 * U);
      btns.push({ x: bx, y, w: bw, h: bh, choice: i });
      y += bh + 14 * U;
    });
    const sel = b.options[intro.choiceSel];
    if (sel && sel.after) {
      ctx.fillStyle = 'rgba(130,175,210,0.45)';
      ctx.font = `italic ${12 * U}px monospace`;
      ctx.fillText(sel.after, cx, y + 22 * U);
    }
  }

  // Continue hint
  if (intro.canAdvance() && b.kind !== 'choice') {
    const bl = 0.4 + Math.sin(intro.t * 4) * 0.4;
    ctx.textAlign = 'right';
    ctx.fillStyle = `rgba(150,200,235,${bl})`;
    ctx.font = `${11 * U}px monospace`;
    ctx.fillText('CONTINUE  ▸', W - 60 * U, H - 48 * U);
  }
  // Skip
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(100,140,175,0.28)';
  ctx.font = `${10 * U}px monospace`;
  ctx.fillText('ESC — SKIP', 60 * U, H - 48 * U);

  // Progress pips
  const pw2 = 6 * U, gap = 10 * U;
  const totalW = INTRO_BEATS.length * gap;
  let px2 = cx - totalW / 2;
  for (let i = 0; i < INTRO_BEATS.length; i++) {
    ctx.fillStyle = i <= intro.i ? 'rgba(120,190,240,0.6)' : 'rgba(90,130,165,0.2)';
    ctx.fillRect(px2, H - 42 * U, pw2, 2 * U);
    px2 += gap;
  }
  ctx.textAlign = 'left';
}

// Real portrait, cover-fit into the frame with a slow drift.
// Draw any cast member. A logo entry renders centred on dark
// rather than cover-filled, because EVA has no face.
function drawCastPortrait(ctx, c, x, y, w, h, U, t) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();

  if (!c.ready) {
    ctx.fillStyle = 'rgba(10,20,34,0.9)';
    ctx.fillRect(x, y, w, h);
    drawOfficerSilhouette(ctx, x, y, w, h, U);
    ctx.restore();
    return;
  }

  if (c.logo) {
    // Company mark on black — the handler's "portrait"
    const g = ctx.createRadialGradient(x + w/2, y + h*0.42, 0,
                                       x + w/2, y + h*0.42, w * 0.9);
    g.addColorStop(0, 'rgba(30,26,16,1)');
    g.addColorStop(1, 'rgba(6,6,8,1)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    const iw = c.img.width, ih = c.img.height;
    const sc = Math.min(w / iw, h / ih) * (0.62 + Math.sin(t * 0.5) * 0.008);
    const dw = iw * sc, dh = ih * sc;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(c.img, x + (w - dw) / 2, y + (h - dh) * 0.40, dw, dh);
    ctx.globalAlpha = 1;
    // Scanning line — makes it feel like a terminal, not a picture
    const sy = y + ((t * 0.16) % 1) * h;
    ctx.fillStyle = 'rgba(210,180,110,0.05)';
    ctx.fillRect(x, sy, w, 2 * U);
  } else {
    const iw = c.img.width, ih = c.img.height;
    const zoom = 1.03 + Math.sin(t * 0.22) * 0.012;
    const sc = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * sc, dh = ih * sc;
    ctx.drawImage(c.img, x + (w - dw) / 2, y + (h - dh) * 0.28, dw, dh);
    ctx.fillStyle = 'rgba(10,26,46,0.20)';
    ctx.fillRect(x, y, w, h);
  }

  const bg = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
  bg.addColorStop(0, 'rgba(3,9,18,0)');
  bg.addColorStop(1, 'rgba(3,9,18,0.72)');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = scanPattern(ctx);
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// mode: 'navy' | 'contractor' | number 0..1 to crossfade between them
function drawPortrait(ctx, x, y, w, h, U, t, mode) {
  const wantCiv = mode === 'contractor';
  const blend = (typeof mode === 'number') ? mode : null;

  const readyN = portraitReady, readyC = portraitCivReady;
  if (!readyN && !readyC) { drawOfficerSilhouette(ctx, x, y, w, h, U); return; }

  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();

  const place = (img) => {
    const iw = img.width, ih = img.height;
    const zoom = 1.03 + Math.sin(t * 0.22) * 0.012;
    const sc = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * sc, dh = ih * sc;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * 0.28, dw, dh);
  };

  if (blend !== null && readyN && readyC) {
    // Both portraits share framing exactly, so a straight
    // crossfade reads as the same man changing rather than a
    // cut between two photographs.
    place(portraitImg);
    ctx.globalAlpha = Math.max(0, Math.min(1, blend));
    place(portraitCivImg);
    ctx.globalAlpha = 1;
  } else if (wantCiv && readyC) {
    place(portraitCivImg);
  } else if (readyN) {
    place(portraitImg);
  } else {
    place(portraitCivImg);
  }

  // Grade — warmer and dimmer for the contractor
  ctx.fillStyle = (wantCiv || (blend !== null && blend > 0.5))
    ? 'rgba(30,20,12,0.22)' : 'rgba(10,26,46,0.20)';
  ctx.fillRect(x, y, w, h);
  // Bottom scrim
  const g = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
  g.addColorStop(0, 'rgba(3,9,18,0)');
  g.addColorStop(1, 'rgba(3,9,18,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
  // Vignette
  const vg = ctx.createRadialGradient(x + w/2, y + h*0.42, Math.min(w,h)*0.22,
                                      x + w/2, y + h*0.42, Math.max(w,h)*0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(x, y, w, h);
  // Scanlines
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = scanPattern(ctx);
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Fallback silhouette if the portrait is missing
function drawOfficerSilhouette(ctx, x, y, w, h, U) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(30,55,85,0.55)');
  g.addColorStop(1, 'rgba(8,16,28,0.9)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);

  const cx = x + w / 2, base = y + h;
  // Shoulders
  ctx.fillStyle = 'rgba(22,38,58,0.95)';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.42, base);
  ctx.quadraticCurveTo(cx - w * 0.40, base - h * 0.30, cx - w * 0.17, base - h * 0.36);
  ctx.lineTo(cx + w * 0.17, base - h * 0.36);
  ctx.quadraticCurveTo(cx + w * 0.40, base - h * 0.30, cx + w * 0.42, base);
  ctx.closePath(); ctx.fill();
  // Head
  ctx.fillStyle = 'rgba(30,50,74,0.95)';
  ctx.beginPath();
  ctx.ellipse(cx, base - h * 0.47, w * 0.135, h * 0.115, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cap
  ctx.fillStyle = 'rgba(16,28,44,0.98)';
  ctx.beginPath();
  ctx.ellipse(cx, base - h * 0.555, w * 0.165, h * 0.052, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(cx - w * 0.165, base - h * 0.558, w * 0.33, h * 0.022);
  // Cap brim
  ctx.fillStyle = 'rgba(10,18,30,1)';
  ctx.beginPath();
  ctx.ellipse(cx, base - h * 0.534, w * 0.185, h * 0.017, 0, 0, Math.PI);
  ctx.fill();
  // Rank tabs
  ctx.fillStyle = 'rgba(180,150,60,0.5)';
  ctx.fillRect(cx - w * 0.33, base - h * 0.30, w * 0.10, h * 0.012);
  ctx.fillRect(cx + w * 0.23, base - h * 0.30, w * 0.10, h * 0.012);
  ctx.fillStyle = 'rgba(180,150,60,0.35)';
  ctx.fillRect(cx - w * 0.33, base - h * 0.275, w * 0.10, h * 0.010);
  ctx.fillRect(cx + w * 0.23, base - h * 0.275, w * 0.10, h * 0.010);

  ctx.fillStyle = 'rgba(120,170,210,0.18)';
  ctx.font = `${9 * U}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('[ PORTRAIT ]', cx, y + h - 14 * U);
  ctx.textAlign = 'left';
  ctx.restore();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { INTRO_BEATS, IntroSequence };
}
