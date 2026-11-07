// 文字层：所有字都是竖排的题跋，画进纸里，而不是浮在网页上
const FONT = {
  fang: '"YS Fang","Songti SC","STSong","Noto Serif CJK SC",serif',
  kai: '"YS Kai","Kaiti SC","STKaiti","KaiTi",serif',
  brush: '"YS Brush","Kaiti SC","STKaiti",serif',
};
const INK = { dan: [1, 0, 0], qing: [0, 1, 0], sumi: [0, 0, 1], grey: [0, 0, .55] };

const T = (() => {
  const list = [];
  const tw = [];
  const isRot = c => '…—～《》「」“”（）()-'.includes(c);
  const isCorner = c => '，。、'.includes(c);

  function tokens(s) {
    const out = []; let i = 0;
    while (i < s.length) {
      const m = /^[0-9A-Za-z.,:%¥+\/]+/.exec(s.slice(i));
      if (m) { out.push(m[0]); i += m[0].length; } else { out.push(s[i]); i++; }
    }
    return out;
  }
  function colH(s, size, lh) {
    let n = 0;
    for (const t of tokens(s)) {
      if (t === ' ') n += .5;
      else if (t.length > 2 && /^[0-9A-Za-z]/.test(t)) n += t.length * .56 + .1;
      else n += 1;
    }
    return n * lh;
  }
  function drawCol(x, s, cx, y, size, lh) {
    let cy = y + lh * .5;
    for (const t of tokens(s)) {
      if (t === ' ') { cy += lh * .5; continue; }
      if (t.length > 2 && /^[0-9A-Za-z¥]/.test(t)) {
        const L = t.length * .56 * lh; cy += L * .5 - lh * .5;
        x.save(); x.translate(cx, cy); x.rotate(Math.PI / 2); x.fillText(t, 0, 0); x.restore();
        cy += L * .5 + lh * .5 + lh * .1 - lh * .0; continue;
      }
      if (t.length === 2) { x.save(); x.translate(cx, cy); x.scale(.82, 1); x.fillText(t, 0, 0); x.restore(); cy += lh; continue; }
      if (isCorner(t)) x.fillText(t, cx + size * .54, cy - size * .46);
      else if (isRot(t)) { x.save(); x.translate(cx, cy); x.rotate(Math.PI / 2); x.fillText(t, 0, 0); x.restore(); }
      else x.fillText(t, cx, cy);
      cy += lh;
    }
  }

  // 生成字形图：R 通道是晕开的光晕（让颜料退让），G 通道是字本身
  function raster(cols, o) {
    const size = o.size, lh = o.lh || size * 1.24, gap = o.gap || size * 1.9, pad = Math.ceil(size * 1.1);
    const font = `${o.weight || 400} ${size}px ${o.font || FONT.fang}`;
    const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: false });
    let w, h;
    if (o.horizontal) {
      x.font = font;
      if (o.spacing) { x.letterSpacing = o.spacing + 'px'; }
      w = Math.max(...cols.map(s => x.measureText(s).width)) + pad * 2;
      h = cols.length * lh + pad * 2;
    } else {
      w = (cols.length - 1) * gap + size * 1.2 + pad * 2;
      h = Math.max(...cols.map(s => colH(s, size, lh)), lh) + pad * 2;
    }
    if (o.minH) h = Math.max(h, o.minH);
    c.width = Math.ceil(w); c.height = Math.ceil(h);
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    x.font = font; x.textAlign = o.horizontal ? (o.align || 'center') : 'center'; x.textBaseline = 'middle';
    if (o.spacing) x.letterSpacing = o.spacing + 'px';
    const paint = (off) => {
      if (o.horizontal) cols.forEach((s, i) => {
        const px = o.align === 'left' ? pad : (o.align === 'right' ? c.width - pad : c.width / 2);
        x.fillText(s, px + off, pad + lh * (i + .5));
      });
      else cols.forEach((s, i) => drawCol(x, s, c.width - pad - size * .6 - i * gap + off, pad, size, lh));
    };
    // 光晕：把字画到画布外，只留阴影
    const big = 8000;
    x.shadowColor = '#f00'; x.shadowBlur = Math.min(size * .9, o.haloPx || 46); x.shadowOffsetX = big; x.fillStyle = '#f00';
    paint(-big); paint(-big); paint(-big);
    x.shadowBlur = 0; x.shadowOffsetX = 0; x.shadowColor = 'transparent';
    x.globalCompositeOperation = 'lighter'; x.fillStyle = '#0f0';
    paint(0);
    if (o.bold) { x.strokeStyle = '#0f0'; x.lineWidth = o.bold; x.lineJoin = 'round'; if (o.horizontal) cols.forEach((s, i) => x.strokeText(s, c.width / 2, pad + lh * (i + .5))); }
    x.globalCompositeOperation = 'source-over';
    return { c, w: c.width, h: c.height, pad };
  }

  function add(cols, o = {}) {
    if (typeof cols === 'string') cols = [cols];
    const r = raster(cols, o);
    const sp = {
      cols, o, tex: null, w: r.w, h: r.h, x: 0, y: 0, ink: o.ink || INK.sumi, a: 1, rev: 0, seed: Math.random() * 90,
      halo: o.halo === undefined ? 1 : o.halo, dir: o.horizontal ? 2 : (o.dir || 0), pad: r.pad,
    };
    E.uploadSprite(sp, r.c);
    const ax = o.ax === undefined ? (o.horizontal ? .5 : 1) : o.ax, ay = o.ay === undefined ? 0 : o.ay;
    sp.x = (o.x || 0) - r.w * ax + (o.horizontal ? 0 : (ax === 1 ? r.pad : (ax === 0 ? -r.pad : 0)));
    sp.y = (o.y || 0) - r.h * ay - (ay === 0 ? r.pad : (ay === 1 ? -r.pad : 0));
    list.push(sp);
    return sp;
  }
  function set(sp, cols) {
    if (typeof cols === 'string') cols = [cols];
    const o = Object.assign({}, sp.o);
    const r = raster(cols.length ? cols : [' '], o);
    const cx = sp.x + sp.w, cy = sp.y;
    if (r.w !== sp.w || r.h !== sp.h) { E.freeSprite(sp); }
    const ax = o.ax === undefined ? (o.horizontal ? .5 : 1) : o.ax;
    sp.x = sp.x + sp.w * ax - r.w * ax;
    sp.w = r.w; sp.h = r.h; sp.cols = cols;
    E.uploadSprite(sp, r.c);
  }
  function remove(sp) {
    const i = list.indexOf(sp); if (i >= 0) list.splice(i, 1);
    E.freeSprite(sp);
  }
  function clear() { while (list.length) remove(list[0]); }

  return { list, add, set, remove, clear, raster };
})();

// 补间
const Tw = (() => {
  const a = [];
  const ease = {
    lin: t => t, out: t => 1 - Math.pow(1 - t, 3), in: t => t * t * t,
    io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, sine: t => .5 - .5 * Math.cos(Math.PI * t),
  };
  function to(obj, key, val, dur, e = 'sine') {
    for (let i = a.length - 1; i >= 0; i--) if (a[i].obj === obj && a[i].key === key) { a[i].res && a[i].res(); a.splice(i, 1); }
    return new Promise(res => {
      if (dur <= 0) { obj[key] = val; res(); return; }
      a.push({ obj, key, from: obj[key], val, dur, t: 0, e: ease[e], res });
    });
  }
  function step(dt) {
    for (let i = a.length - 1; i >= 0; i--) {
      const w = a[i]; w.t += dt; const u = Math.min(1, w.t / w.dur);
      w.obj[w.key] = w.from + (w.val - w.from) * w.e(u);
      if (u >= 1) { a.splice(i, 1); w.res && w.res(); }
    }
  }
  return { to, step };
})();
