// 《余色》渲染与模拟核心
const E = (() => {
  const MAXD = 12;
  let gl, cv, vao, P = {};
  let W = 1, H = 1, Af = 1.6, dyeW = 0, dyeH = 0, simW = 0, simH = 0;
  let vel, prs, dvg, crl, dye, paper, crack, tear, dust, textF, scene, stareTex, emptyTex;
  let blooms = [];
  let time = 0;
  const drops = [], strokes = [];
  const S = {
    room: 1, flip: 0, dry: 0, crackT: 0, crackVis: 1, crackGlow: 0, crackBack: 0, gap: 0, tilt: 0, seam: 0, dustA: 0,
    plain: 0, stare: 0, dot: [.5, .5, .006, 0], lens: [.5, .5, .12, 0], exposure: 1, bloom: 0, zoom: 1,
    wet: 1, gain: .72, txGlow: 0, voidA: 0, gran: .34, bead: [0, 0, 0, 0], beadKS: [0, 0, 0], line: [0, 0, 0, 0], brush: [0, 0, .02, 0],
    diff: 0, feather: 0, wetDiff: .5, shear: .0, age: 0, soil: 0, wetDecay: .7, swirl: 0, damp: 1.5, frozen: false, fade: 0,
  };

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s), src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n')); throw new Error('shader'); }
    return s;
  }
  function prog(fs, vs = VS) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, nm); }
    return { p, u };
  }
  function mkTex(w, h, ifmt, fmt, type, filter, wrap = gl.CLAMP_TO_EDGE, data = null) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
    return t;
  }
  function mkFbo(w, h, ifmt, fmt, type, filter) {
    const t = mkTex(w, h, ifmt, fmt, type, filter), f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f, w, h };
  }
  function freeFbo(o) { if (!o) return; gl.deleteTexture(o.t); gl.deleteFramebuffer(o.f); }
  function mkDbl(w, h, a, b, c, d) {
    let A = mkFbo(w, h, a, b, c, d), B = mkFbo(w, h, a, b, c, d);
    return { get read() { return A; }, get write() { return B; }, swap() { const t = A; A = B; B = t; }, w, h };
  }
  const F16 = () => [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT];
  const RG = () => [gl.RG16F, gl.RG, gl.HALF_FLOAT];
  const R1 = () => [gl.R16F, gl.RED, gl.HALF_FLOAT];

  function use(pr) { gl.useProgram(pr.p); return pr.u; }
  function bind(unit, tex, loc) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); }
  function blit(t) {
    if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.f); gl.viewport(0, 0, t.w, t.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function init(canvas, q) {
    cv = canvas;
    gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!q.keep });
    if (!gl) return false;
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return false;
    gl.getExtension('OES_texture_float_linear');
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const k in FS) P[k] = prog(FS[k]);
    P.sprite = prog(FS.sprite, VS_SPRITE);
    P.stamp = prog(FS.stamp, VS_SPRITE);
    emptyTex = mkTex(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST, gl.CLAMP_TO_EDGE, new Uint8Array(4));
    stareTex = emptyTex;
    resize(q);
    Af = Math.min(2.1, Math.max(.46, W / H));
    const maxS = q.dye || 2048;
    if (Af >= 1) { dyeW = maxS; dyeH = Math.round(maxS / Af); } else { dyeH = maxS; dyeW = Math.round(maxS * Af); }
    const sim = q.sim || 256;
    if (Af >= 1) { simH = sim; simW = Math.round(sim * Af); } else { simW = sim; simH = Math.round(sim / Af); }
    vel = mkDbl(simW, simH, ...RG(), gl.LINEAR); prs = mkDbl(simW, simH, ...R1(), gl.NEAREST);
    dvg = mkFbo(simW, simH, ...R1(), gl.NEAREST); crl = mkFbo(simW, simH, ...R1(), gl.NEAREST);
    dye = mkDbl(dyeW, dyeH, ...F16(), gl.LINEAR);
    bake();
    return true;
  }

  function bake() {
    // 纤维：宣纸里长长的檀皮纤维，用 2D 画一遍
    const c = document.createElement('canvas'); c.width = dyeW; c.height = dyeH;
    const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, dyeW, dyeH);
    x.strokeStyle = '#fff'; x.lineCap = 'round';
    const n = Math.round(dyeW * dyeH / 620);
    for (let i = 0; i < n; i++) {
      const px = Math.random() * dyeW, py = Math.random() * dyeH, a = Math.random() * 6.283, L = 14 + Math.random() * Math.random() * 130;
      x.globalAlpha = .05 + Math.random() * .24; x.lineWidth = .5 + Math.random() * .8;
      x.beginPath(); x.moveTo(px, py);
      const bend = (Math.random() - .5) * 1.5;
      x.quadraticCurveTo(px + Math.cos(a + bend) * L * .5, py + Math.sin(a + bend) * L * .5, px + Math.cos(a) * L, py + Math.sin(a) * L);
      x.stroke();
    }
    const fib = mkTex(dyeW, dyeH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, fib); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
    paper = mkFbo(dyeW, dyeH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    let u = use(P.paper); bind(0, fib, u.uFib); gl.uniform1f(u.uA, Af); blit(paper);
    gl.deleteTexture(fib);
    crack = mkFbo(dyeW, dyeH, ...F16(), gl.LINEAR);
    u = use(P.crack); gl.uniform1f(u.uA, Af); blit(crack);
    tear = mkFbo(1024, 1, ...F16(), gl.LINEAR);
    u = use(P.tear); gl.uniform1f(u.uA, Af); blit(tear);
    dust = mkDbl(512, Math.max(8, Math.round(512 / Af)), ...R1(), gl.LINEAR);
    for (const t of [dust.read, dust.write]) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.f); gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.clearColor(0, 0, 0, 0);
  }

  function resize(q = {}) {
    const dpr = Math.min(window.devicePixelRatio || 1, q.dpr || 2);
    let w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (q.w) { w = q.w; h = q.h; }
    const cap = (q.cap || 3.4e6), px = w * h;
    if (px > cap) { const s = Math.sqrt(cap / px); w = Math.round(w * s); h = Math.round(h * s); }
    if (w === W && h === H && cv.width === w) return false;
    W = w; H = h; cv.width = w; cv.height = h;
    freeFbo(textF); freeFbo(scene); blooms.forEach(freeFbo); blooms = [];
    textF = mkFbo(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    scene = mkFbo(W, H, ...F16(), gl.LINEAR);
    let bw = W >> 1, bh = H >> 1;
    for (let i = 0; i < 6; i++) { blooms.push(mkFbo(Math.max(2, bw), Math.max(2, bh), ...F16(), gl.LINEAR)); bw >>= 1; bh >>= 1; }
    return true;
  }

  // 屏幕 uv（y 向上）↔ 颜料场 uv
  function cover() {
    const av = W / H;
    return av > Af ? [1, Af / av] : [av / Af, 1];
  }
  function s2f(sx, sy) { const c = cover(); return [(sx - .5) * c[0] / S.zoom + .5, (sy - .5) * c[1] / S.zoom + .5]; }
  function f2s(fx, fy) { const c = cover(); return [(fx - .5) * S.zoom / c[0] + .5, (fy - .5) * S.zoom / c[1] + .5]; }

  function drop(o) {
    // 面积守恒：半径平方是一滴的"量"
    drops.push({ x: o.x * Af, y: o.y, R2: o.r * o.r, t: 0, dur: o.dur || 1.1, seed: Math.random(), ink: o.ink, last: 0 });
  }
  function stir(x0, y0, x1, y1, k = 1, rad = .0016) {
    const dx = (x1 - x0) * simW * 60 * k, dy = (y1 - y0) * simH * 60 * k;
    splatV(x1, y1, dx, dy, rad);
  }
  function splatV(x, y, dx, dy, rad) {
    const u = use(P.splat); bind(0, vel.read.t, u.uBase);
    gl.uniform2f(u.uPt, x, y); gl.uniform4f(u.uCol, dx, dy, 0, 0); gl.uniform1f(u.uR, rad); gl.uniform1f(u.uA, Af);
    blit(vel.write); vel.swap();
  }
  function splatD(x, y, ink, rad) {
    const u = use(P.splat); bind(0, dye.read.t, u.uBase);
    gl.uniform2f(u.uPt, x, y); gl.uniform4f(u.uCol, ink[0], ink[1], ink[2], ink[3]); gl.uniform1f(u.uR, rad); gl.uniform1f(u.uA, Af);
    blit(dye.write); dye.swap();
  }
  function stroke(fn, dur, k = 1, rad = .0016) { strokes.push({ fn, dur, t: 0, k, rad, last: null }); }

  function simStep(dt) {
    for (const s of strokes) {
      s.t += dt; const u = Math.min(1, s.t / s.dur), p = s.fn(u);
      if (s.last) stir(s.last[0], s.last[1], p[0], p[1], s.k, s.rad);
      s.last = p;
    }
    for (let i = strokes.length - 1; i >= 0; i--) if (strokes[i].t >= strokes[i].dur) strokes.splice(i, 1);
    const T = [1 / simW, 1 / simH];
    let u;
    if (S.swirl) { u = use(P.swirl); bind(0, vel.read.t, u.uVel); gl.uniform1f(u.uK, S.swirl); gl.uniform1f(u.uA, Af); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uTime, time); blit(vel.write); vel.swap(); }
    u = use(P.curl); bind(0, vel.read.t, u.uVel); gl.uniform2f(u.uT, T[0], T[1]); blit(crl);
    u = use(P.vort); bind(0, vel.read.t, u.uVel); bind(1, crl.t, u.uCurl); gl.uniform2f(u.uT, T[0], T[1]); gl.uniform1f(u.uK, 9); gl.uniform1f(u.uDt, dt); blit(vel.write); vel.swap();
    u = use(P.div); bind(0, vel.read.t, u.uVel); gl.uniform2f(u.uT, T[0], T[1]); blit(dvg);
    u = use(P.prs); gl.uniform2f(u.uT, T[0], T[1]); bind(1, dvg.t, u.uDiv);
    for (let i = 0; i < 16; i++) { bind(0, prs.read.t, u.uP); blit(prs.write); prs.swap(); }
    u = use(P.grad); bind(0, prs.read.t, u.uP); bind(1, vel.read.t, u.uVel); gl.uniform2f(u.uT, T[0], T[1]); blit(vel.write); vel.swap();
    u = use(P.advV); bind(0, vel.read.t, u.uVel); gl.uniform2f(u.uT, T[0], T[1]); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uDamp, S.damp); blit(vel.write); vel.swap();
  }

  let feathCount = 0;
  const dArr = new Float32Array(MAXD * 4), cArr = new Float32Array(MAXD * 4);
  function dyeStep(dt) {
    let n = 0;
    for (let i = drops.length - 1; i >= 0 && n < MAXD; i--) {
      const d = drops[i]; d.t += dt;
      const u = Math.min(1, d.t / d.dur), e = 1 - Math.pow(1 - u, 2.6);
      const delta = d.R2 * (e - d.last); d.last = e;
      dArr[n * 4] = d.x; dArr[n * 4 + 1] = d.y; dArr[n * 4 + 2] = delta; dArr[n * 4 + 3] = d.seed;
      cArr.set(d.ink, n * 4); n++;
    }
    for (let i = drops.length - 1; i >= 0; i--) if (drops[i].t >= drops[i].dur) drops.splice(i, 1);
    const u = use(P.dye);
    bind(0, dye.read.t, u.uDye); bind(1, vel.read.t, u.uVel); bind(2, paper.t, u.uPaper);
    gl.uniform2f(u.uT, 1 / dyeW, 1 / dyeH); gl.uniform2f(u.uST, 1 / simW, 1 / simH);
    gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uA, Af); gl.uniform1f(u.uDiff, S.diff); gl.uniform1f(u.uWetDiff, S.wetDiff);
    gl.uniform1f(u.uShear, S.shear); gl.uniform1f(u.uAge, S.age); gl.uniform1f(u.uSoil, S.soil); gl.uniform1f(u.uWetDecay, S.wetDecay);
    feathCount = (feathCount + 1) % 24; gl.uniform1f(u.uFeather, feathCount === 0 ? S.feather : 0);
    gl.uniform1i(u.uN, n); gl.uniform4fv(u.uD, dArr); gl.uniform4fv(u.uC, cArr);
    blit(dye.write); dye.swap();
  }

  function step(dt) {
    time += dt;
    if (S.frozen) return;
    simStep(dt); dyeStep(dt);
  }

  // ----- 文字精灵 -----
  function uploadSprite(sp, canvas) {
    if (!sp.tex) sp.tex = mkTex(canvas.width, canvas.height, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, sp.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }
  function freeSprite(sp) { if (sp.tex) gl.deleteTexture(sp.tex); sp.tex = null; }
  function rectOf(sp) {
    const l = sp.x / W * 2 - 1, t = 1 - sp.y / H * 2, w = sp.w / W * 2, h = sp.h / H * 2;
    return [l, t - h, w, h];
  }
  function drawSprites(list) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, textF.f); gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!list.length) return;
    gl.enable(gl.BLEND); gl.blendEquationSeparate(gl.FUNC_ADD, gl.MAX); gl.blendFunc(gl.ONE, gl.ONE);
    const u = use(P.sprite);
    for (const s of list) {
      if (!s.tex || s.a <= .002) continue;
      bind(0, s.tex, u.uTex);
      const r = rectOf(s); gl.uniform4f(u.uRect, r[0], r[1], r[2], r[3]);
      gl.uniform3f(u.uInk, s.ink[0], s.ink[1], s.ink[2]); gl.uniform1f(u.uAlpha, s.a); gl.uniform1f(u.uRev, s.rev);
      gl.uniform1f(u.uSeed, s.seed); gl.uniform1f(u.uHalo, s.halo); gl.uniform1i(u.uDir, s.dir);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
  }
  // 把字印进水里，它就开始化开
  function stamp(sp, k = .8, water = 1) {
    if (!sp.tex) return;
    const c = cover();
    const sx0 = sp.x / W, sy1 = 1 - sp.y / H, sw = sp.w / W, sh = sp.h / H;
    const a = s2f(sx0, sy1 - sh), b = s2f(sx0 + sw, sy1);
    const x0 = a[0] * 2 - 1, y0 = a[1] * 2 - 1, x1 = b[0] * 2 - 1, y1 = b[1] * 2 - 1;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dye.read.f); gl.viewport(0, 0, dyeW, dyeH);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const u = use(P.stamp); bind(0, sp.tex, u.uTex);
    gl.uniform4f(u.uRect, x0, y0, x1 - x0, y1 - y0);
    gl.uniform4f(u.uInk, sp.ink[0], sp.ink[1], sp.ink[2], water); gl.uniform1f(u.uK, k);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
  }
  function setStare(canvas) {
    if (stareTex !== emptyTex) gl.deleteTexture(stareTex);
    stareTex = mkTex(canvas.width, canvas.height, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }
  function wipe(x, y, rad = .006, k = .16) {
    const u = use(P.wipe); bind(0, dust.read.t, u.uD);
    gl.uniform3f(u.uB, x, y, rad); gl.uniform1f(u.uA, Af); gl.uniform1f(u.uK, k);
    blit(dust.write); dust.swap();
  }

  function render(sprites) {
    drawSprites(sprites);
    const c = cover();
    let u = use(P.comp);
    bind(0, dye.read.t, u.uDye); bind(1, paper.t, u.uPaper); bind(2, crack.t, u.uCrack); bind(3, textF.t, u.uText);
    bind(4, dust.read.t, u.uDust); bind(5, tear.t, u.uTear);
    gl.uniform2f(u.uCover, c[0], c[1]); gl.uniform2f(u.uT, 1 / dyeW, 1 / dyeH); gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uAf, Af); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uRoom, S.room); gl.uniform1f(u.uFlip, S.flip);
    gl.uniform1f(u.uDry, S.dry); gl.uniform1f(u.uCrackT, S.crackT); gl.uniform1f(u.uCrackVis, S.crackVis); gl.uniform1f(u.uCrackGlow, S.crackGlow);
    gl.uniform1f(u.uGap, S.gap); gl.uniform1f(u.uTilt, S.tilt); gl.uniform1f(u.uSeam, S.seam); gl.uniform1f(u.uDustA, S.dustA);
    gl.uniform1f(u.uVoid, S.voidA); gl.uniform1f(u.uGain, S.gain); gl.uniform1f(u.uZoom, S.zoom); gl.uniform1f(u.uWet, S.wet);
    gl.uniform1f(u.uTxGlow, S.txGlow); gl.uniform1f(u.uPlain, S.plain); gl.uniform1f(u.uGran, S.gran); gl.uniform1f(u.uCrackBack, S.crackBack);
    gl.uniform4fv(u.uBead, S.bead); gl.uniform3fv(u.uBeadKS, S.beadKS); gl.uniform4fv(u.uLine, S.line);
    gl.uniform4fv(u.uBrush, S.brush); gl.uniform4fv(u.uLens, S.lens);
    blit(scene);
    let bloomTex = emptyTex;
    if (S.bloom > .001) {
      u = use(P.bright); bind(0, scene.t, u.uS); gl.uniform2f(u.uT, 1 / W, 1 / H); blit(blooms[0]);
      u = use(P.down);
      for (let i = 1; i < blooms.length; i++) { bind(0, blooms[i - 1].t, u.uS); gl.uniform2f(u.uT, 1 / blooms[i - 1].w, 1 / blooms[i - 1].h); blit(blooms[i]); }
      u = use(P.up); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = blooms.length - 1; i > 0; i--) { bind(0, blooms[i].t, u.uS); gl.uniform2f(u.uT, 1 / blooms[i].w, 1 / blooms[i].h); gl.uniform1f(u.uK, .92); blit(blooms[i - 1]); }
      gl.disable(gl.BLEND);
      bloomTex = blooms[0].t;
    }
    u = use(P.final);
    bind(0, scene.t, u.uS); bind(1, bloomTex, u.uB); bind(2, stareTex, u.uStare);
    gl.uniform1f(u.uBloom, S.bloom); gl.uniform1f(u.uStareA, S.stare); gl.uniform1f(u.uExp, S.exposure); gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uFade, S.fade); gl.uniform4fv(u.uDot, S.dot); gl.uniform1f(u.uAsp, W / H);
    blit(null);
  }

  return {
    S, init, resize, step, render, drop, stir, splatD, stroke, stamp, wipe, uploadSprite, freeSprite, setStare, s2f, f2s,
    get W() { return W; }, get H() { return H; }, get Af() { return Af; }, get time() { return time; },
    get gl() { return gl; }, get drops() { return drops; },
    // 调试：不经过时间，直接跑完若干步
    fast(n, dt = 1 / 60) { for (let i = 0; i < n; i++) { time += dt; dyeStep(dt); } },
  };
})();
