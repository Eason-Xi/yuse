// 《余色》的声音。没有音频文件，全部实时合成。
// 丹和青各是一根弦，相差纯五度。走远的时候音准慢慢偏，两条音之间出现拍频；修好的时候拍频停下来。
const A = (() => {
  let ctx, master, dry, wet, verb, room, roomG, drone = null, chord = null, tin = null;
  const cache = new Map();
  let on = false, offline = false, stirG = null, stirF = null;
  const roomS = { from: .012, to: .012, t0: 0, t1: 0 }, masterS = { from: .9, to: .9, t0: 0, t1: 0 };
  // 所有渐变都记账，这样实时和离线两种上下文走同一份代码
  function ramp(p, st, to, fade) {
    const n = t0();
    const v = st.t1 > st.t0 ? st.from + (st.to - st.from) * Math.min(1, Math.max(0, (n - st.t0) / (st.t1 - st.t0))) : st.to;
    p.cancelScheduledValues(n); p.setValueAtTime(v, n); p.linearRampToValueAtTime(to, n + fade);
    st.from = v; st.to = to; st.t0 = n; st.t1 = n + fade;
  }
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  // D 宫五声：D E F# A B
  const PENTA = [50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86];
  let detune = 0;

  function ir(sec, decay, dark) {
    const sr = ctx.sampleRate, n = sr * sec | 0, b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n, a = dark * (1 - t) + .035;
        lp += ((Math.random() * 2 - 1) - lp) * a;
        d[i] = lp * Math.pow(1 - t, decay) * (i < 300 ? i / 300 : 1);
      }
    }
    return b;
  }
  function ks(freq) {
    const k = Math.round(freq * 4) / 4;
    if (cache.has(k)) return cache.get(k);
    const sr = ctx.sampleRate, N = Math.max(2, Math.round(sr / k)), dur = 5.2, L = sr * dur | 0;
    const buf = ctx.createBuffer(1, L, sr), d = buf.getChannelData(0), ring = new Float32Array(N);
    let lp = 0;
    for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * .42; ring[i] = lp; }
    const damp = .9965 - Math.min(.004, k / 300000);
    let p = 0, prev = 0;
    for (let i = 0; i < L; i++) {
      const y = ring[p], nx = (y * .56 + prev * .44) * damp;
      prev = y; ring[p] = nx; d[i] = y; p = (p + 1) % N;
    }
    const pack = { buf, rate: k / (sr / N) };
    cache.set(k, pack);
    return pack;
  }
  function noiseBuf(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  let nb;

  function init() {
    if (on) { if (!offline) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (Q.offline) { offline = true; ctx = new OfflineAudioContext(2, 44100 * +(Q.offline), 44100); } else ctx = new AC();
    on = true;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = .006; comp.release.value = .24;
    master = ctx.createGain(); master.gain.value = .9;
    master.connect(comp); comp.connect(ctx.destination);
    dry = ctx.createGain(); dry.gain.value = .8; dry.connect(master);
    verb = ctx.createConvolver(); verb.buffer = ir(5.5, 2.6, .55);
    wet = ctx.createGain(); wet.gain.value = .5; wet.connect(verb); verb.connect(master);
    nb = noiseBuf(4);
    // 房间底噪：很低的褐噪声，让"没有声音"也是一种声音
    room = ctx.createBufferSource(); room.buffer = nb; room.loop = true;
    const lf = ctx.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 240;
    roomG = ctx.createGain(); roomG.gain.value = .012;
    room.connect(lf); lf.connect(roomG); roomG.connect(master); room.start();
    // 手划过水面的声音
    const st = ctx.createBufferSource(); st.buffer = nb; st.loop = true;
    stirF = ctx.createBiquadFilter(); stirF.type = 'bandpass'; stirF.frequency.value = 900; stirF.Q.value = .7;
    stirG = ctx.createGain(); stirG.gain.value = 0;
    st.connect(stirF); stirF.connect(stirG); stirG.connect(dry); const ss = ctx.createGain(); ss.gain.value = .5; stirG.connect(ss); ss.connect(wet); st.start();
  }
  let vtime = 0;
  const t0 = () => offline ? vtime : ctx.currentTime;
  function water(speed) {
    if (!on) return;
    const n = t0(), g = Math.min(.05, speed * 1.5);
    stirG.gain.setTargetAtTime(g, n, .06);
    stirF.frequency.setTargetAtTime(500 + Math.min(1800, speed * 40000), n, .08);
  }
  // 离线渲染完，把声音送给本地服务存成 WAV
  // 成片的声音：录制时只记账，结束后按时间分段把事件喂给离线上下文。
  // 一次性预排几千个节点会让离线渲染慢到不可用，所以每秒暂停一次，只建下一秒要响的节点。
  async function renderLog(list, url) {
    const end = Math.ceil(list[list.length - 1][0]) + 14;
    Q.offline = end; on = false; REAL.init();
    let i = 0;
    const run = until => {
      while (i < list.length && list[i][0] < until) {
        const [t, k, a] = list[i++]; vtime = t;
        if (k === 'init') continue;
        if (k === '__detune') { detune = a[0]; continue; }
        REAL[k](...a);
      }
    };
    run(1);
    for (let s = 1; s < end; s++) ctx.suspend(s).then(() => { run(s + 1); ctx.resume(); });
    return exportWav(url);
  }
  async function exportWav(url) {
    const b = await ctx.startRendering(), n = b.length, L = b.getChannelData(0), R = b.getChannelData(1);
    const buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, 44100, true); v.setUint32(28, 176400, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0, o = 44; i < n; i++, o += 4) { v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    await fetch(url, { method: 'POST', body: new Blob([buf]) });
    return n;
  }
  function out(node, pan = 0, send = .55, g = 1) {
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    const a = ctx.createGain(); a.gain.value = g;
    node.connect(a); a.connect(p); p.connect(dry);
    const s = ctx.createGain(); s.gain.value = send; p.connect(s); s.connect(wet);
    return a;
  }
  function pluck(midi, o = {}) {
    if (!on) return;
    const f = NOTE(midi), k = ks(f);
    const s = ctx.createBufferSource(); s.buffer = k.buf;
    s.playbackRate.value = k.rate * (f / (Math.round(f * 4) / 4)) * Math.pow(2, ((o.cents === undefined ? detune : o.cents)) / 1200);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.tone || 2600; lp.Q.value = .3;
    s.connect(lp);
    out(lp, o.pan || 0, o.send === undefined ? .6 : o.send, (o.g || .5) * 1.5);
    s.start(t0() + (o.at || 0));
  }
  function plink(pan = 0, f = 900, g = .22) {
    if (!on) return;
    const o = ctx.createOscillator(), a = ctx.createGain(), n = t0();
    o.type = 'sine'; o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(f * 2.3, n + .05);
    a.gain.setValueAtTime(0, n); a.gain.linearRampToValueAtTime(g, n + .004); a.gain.exponentialRampToValueAtTime(.0001, n + .16);
    o.connect(a); out(a, pan, .8); o.start(n); o.stop(n + .2);
  }
  // 大的一滴：先是低沉的落水声，再是水面合上的一声
  function drip(pan = 0, g = .5) {
    if (!on) return;
    plink(pan, 420, g * .7);
    const n = t0(), o = ctx.createOscillator(), a = ctx.createGain();
    o.frequency.setValueAtTime(190, n); o.frequency.exponentialRampToValueAtTime(70, n + .26);
    a.gain.setValueAtTime(g * .7, n); a.gain.exponentialRampToValueAtTime(.0001, n + .34);
    o.connect(a); out(a, pan, .5); o.start(n); o.stop(n + .4);
  }
  function noiseHit(o) {
    if (!on) return;
    const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.f || 3000; f.Q.value = o.q || 1;
    const a = ctx.createGain(), n = t0() + (o.at || 0), d = o.d || .03;
    a.gain.setValueAtTime(0, n); a.gain.linearRampToValueAtTime(o.g || .1, n + (o.atk || .002)); a.gain.exponentialRampToValueAtTime(.0001, n + d);
    s.connect(f); f.connect(a); out(a, o.pan || 0, o.send === undefined ? .3 : o.send);
    s.start(n, Math.random() * 3); s.stop(n + d + .05);
  }
  const tick = (pan = 0, g = .08) => noiseHit({ f: 5200 + Math.random() * 3000, q: 3, d: .018 + Math.random() * .03, g, pan, send: .35 });
  const key = (pan = 0) => noiseHit({ f: 1800 + Math.random() * 900, q: 2, d: .03, g: .05, pan, send: .12 });
  const del = (pan = 0) => noiseHit({ f: 700, q: 2, d: .04, g: .05, pan, send: .1 });
  function rip(dur) {
    if (!on) return;
    for (let i = 0; i < dur * 9; i++) noiseHit({ at: i / 9 + Math.random() * .1, f: 900 + Math.random() * 2600, q: .8, d: .05 + Math.random() * .12, g: .022 + Math.random() * .03, pan: (Math.random() - .5) * .6, send: .4 });
  }
  function beat(g = .1) { // 盯着看时的心跳计时
    if (!on) return;
    const n = t0(), o = ctx.createOscillator(), a = ctx.createGain();
    o.frequency.setValueAtTime(62, n); o.frequency.exponentialRampToValueAtTime(40, n + .12);
    a.gain.setValueAtTime(g, n); a.gain.exponentialRampToValueAtTime(.0001, n + .2);
    o.connect(a); out(a, 0, .2); o.start(n); o.stop(n + .25);
  }
  function buzz(times = 3) { // 勿扰模式被穿透的那一下
    if (!on) return;
    for (let i = 0; i < times; i++) {
      const n = t0() + i * .62, o = ctx.createOscillator(), a = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 148; lp.type = 'lowpass'; lp.frequency.value = 420;
      a.gain.setValueAtTime(0, n); a.gain.linearRampToValueAtTime(.2, n + .02); a.gain.setValueAtTime(.2, n + .34); a.gain.linearRampToValueAtTime(0, n + .38);
      o.connect(lp); lp.connect(a); out(a, 0, .1); o.start(n); o.stop(n + .42);
    }
    try { navigator.vibrate && navigator.vibrate([340, 280, 340, 280, 340]); } catch (e) {}
  }
  // 持续音：A 和 E，纯五度；beatHz 把 E 拆成两条，产生拍频
  function droneOn(level = .05, fade = 6) {
    if (!on || drone) return;
    const g = ctx.createGain(); g.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const mk = (f, type, lvl) => { const o = ctx.createOscillator(), a = ctx.createGain(); o.type = type; o.frequency.value = f; a.gain.value = lvl; o.connect(a); a.connect(lp); o.start(); return o; };
    const o1 = mk(110, 'sine', .9), o2 = mk(164.81, 'sine', .55), o3 = mk(164.81, 'sine', .55), o4 = mk(220, 'triangle', .1);
    lp.connect(g); out(g, 0, .7);
    drone = { g, o1, o2, o3, o4, st: { from: 0, to: 0, t0: 0, t1: 0 }, bt: { from: 164.81, to: 164.81, t0: 0, t1: 0 } };
    ramp(g.gain, drone.st, level, fade);
  }
  function droneSet(level, beatHz, fade = 4) {
    if (!drone) return;
    if (level !== null) ramp(drone.g.gain, drone.st, level, fade);
    if (beatHz !== null) ramp(drone.o3.frequency, drone.bt, 164.81 + beatHz, fade);
  }
  function droneCut(fade = .05) {
    if (!drone) return;
    const n = t0(), d = drone; drone = null;
    ramp(d.g.gain, d.st, 0, fade);
    [d.o1, d.o2, d.o3, d.o4].forEach(o => { try { o.stop(n + fade + .2); } catch (e) {} });
  }
  // 单音"幽灵"：余像出现时那条很轻的青音
  function ghost(on_) {
    if (!on) return;
    if (on_ && !tin) {
      const o = ctx.createOscillator(), a = ctx.createGain(), o2 = ctx.createOscillator(), a2 = ctx.createGain();
      o.frequency.value = 659.25; o2.frequency.value = 1318.5; a.gain.value = 0; a2.gain.value = .24;
      o2.connect(a2); a2.connect(a); o.connect(a); out(a, 0, 1);
      o.start(); o2.start();
      tin = { o, o2, a, st: { from: 0, to: 0, t0: 0, t1: 0 } }; ramp(a.gain, tin.st, .022, 2.4);
    } else if (!on_ && tin) {
      const t = tin; tin = null; ramp(t.a.gain, t.st, 0, 5);
      t.o.stop(t0() + 5.4); t.o2.stop(t0() + 5.4);
    }
  }
  // 白：十二条谐音慢慢合起来
  function chordOn(fade = 7, level = .34) {
    if (!on || chord) return;
    const g = ctx.createGain(); g.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = .4;
    const set = [38, 45, 50, 57, 62, 66, 69, 74, 76, 78, 81, 86];
    const os = set.map((m, i) => {
      const o = ctx.createOscillator(), a = ctx.createGain();
      o.type = i < 4 ? 'triangle' : 'sine'; o.frequency.value = NOTE(m); o.detune.value = (Math.random() - .5) * 3;
      a.gain.value = .9 / (1 + i * .42); o.connect(a); a.connect(lp); o.start(); return o;
    });
    const air = ctx.createBufferSource(); air.buffer = nb; air.loop = true;
    const af = ctx.createBiquadFilter(); af.type = 'highpass'; af.frequency.value = 2400;
    const ag = ctx.createGain(); ag.gain.value = .022; air.connect(af); af.connect(ag); ag.connect(g); air.start();
    lp.connect(g); out(g, 0, .9);
    const n = t0();
    chord = { g, os, air, lp, st: { from: 0, to: 0, t0: 0, t1: 0 } };
    ramp(g.gain, chord.st, level, fade);
    lp.frequency.setValueAtTime(500, n); lp.frequency.exponentialRampToValueAtTime(5200, n + fade * 1.2);
  }
  function chordLevel(l, fade = 6) {
    if (!chord) return;
    ramp(chord.g.gain, chord.st, l, fade);
  }
  function setRoom(l, f = 2) { if (on) ramp(roomG.gain, roomS, l, f); }
  function setMaster(l, f = 2) { if (on) ramp(master.gain, masterS, l, f); }
  const voice = who => who === 'dan' ? { base: 57, pan: .42 } : { base: 64, pan: -.42 };
  let sd = 0, sq = 0;
  // 丹是 A，青是 E，每一句话都是一声弦
  function say(who, o = {}) {
    if (who === 'dan') { const m = [57, 59, 62, 57, 64, 62][sd++ % 6]; pluck(m, { g: .42, pan: .4, ...o }); }
    else { const m = [64, 69, 66, 71, 69, 64][sq++ % 6]; pluck(m, { g: .36, pan: -.4, ...o }); }
  }
  // 手在光里划过时弹到的音
  let lastHarp = -1, harpT = 0;
  function harp(x, y, speed) {
    if (!on) return;
    const now = t0() * 1000;
    const i = Math.max(0, Math.min(PENTA.length - 1, Math.round(x * (PENTA.length - 1))));
    if (i !== lastHarp && now - harpT > 70) {
      lastHarp = i; harpT = now;
      pluck(PENTA[i] + 12 * (y > .62 ? 1 : 0), { g: .16 + Math.min(.18, speed * 3), pan: x * 1.4 - .7, send: .95, cents: 0, tone: 3600 });
    }
  }
  const api = {
    init, water, pluck, plink, drip, tick, key, del, rip, beat, buzz, droneOn, droneSet, droneCut, ghost, chordOn, chordLevel, setRoom, setMaster, say, harp, PENTA,
  };
  const REAL = Object.assign({}, api), evts = [];
  if (Q.offline && !Q.replay) for (const k of Object.keys(REAL)) if (typeof REAL[k] === 'function') api[k] = (...a) => { evts.push([+E.time.toFixed(4), k, a]); };
  Object.defineProperty(api, 'detune', { get: () => detune, set: v => { detune = v; if (Q.offline) evts.push([+E.time.toFixed(4), '__detune', [v]]); } });
  Object.defineProperty(api, 'ready', { get: () => on });
  api.evts = evts; api.renderLog = renderLog;
  return api;
})();
