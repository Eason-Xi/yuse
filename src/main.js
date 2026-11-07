// 启动
(async function boot() {
  const cv = document.getElementById('c');
  const quality = {};
  if (Q.keep) quality.keep = 1;
  if (/Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) { quality.dye = 1280; quality.sim = 192; quality.cap = 2.2e6; quality.dpr = 2; }
  if (Q.dye) quality.dye = +Q.dye;
  if (Q.w) { quality.w = +Q.w; quality.h = +Q.h; }
  const ok = E.init(cv, quality);
  if (!ok) { document.getElementById('no').hidden = false; return; }
  // 字体先到位，字才画得出来
  try { await Promise.all(['16px "YS Fang"', '16px "YS Kai"', '16px "YS Brush"'].map(f => document.fonts.load(f, '余色在吗'))); } catch (e) {}

  const toUv = e => [e.clientX / innerWidth, 1 - e.clientY / innerHeight];
  const down = e => {
    const [x, y] = toUv(e);
    Ptr.x = Ptr.px = x; Ptr.y = Ptr.py = y; Ptr.held = true; Ptr.downT = performance.now(); Ptr.downX = x; Ptr.downY = y;
    if (Ptr.onPress) { const f = Ptr.onPress; Ptr.onPress = null; f(); }
  };
  const move = e => { const [x, y] = toUv(e); Ptr.x = x; Ptr.y = y; };
  const up = e => {
    Ptr.held = false;
    const moved = Math.hypot(Ptr.x - Ptr.downX, Ptr.y - Ptr.downY);
    if (performance.now() - Ptr.downT < 260 && moved < .012) {
      if (Ptr.onClick) Ptr.onClick(e.clientX / innerWidth * E.W, e.clientY / innerHeight * E.H);
      skip();
    }
  };
  cv.addEventListener('pointerdown', down);
  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerup', up);
  addEventListener('pointercancel', () => { Ptr.held = false; });
  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); Ptr.held = true; if (Ptr.onPress) { const f = Ptr.onPress; Ptr.onPress = null; f(); } else skip(); }
    if (e.code === 'ArrowRight') skip();
  });
  addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter') Ptr.held = false; });
  // 窗口变了，已经在纸上的字要跟着走
  addEventListener('resize', () => {
    const w0 = E.W, h0 = E.H;
    if (!E.resize(quality)) return;
    const sx = E.W / w0, sy = E.H / h0, k = Math.min(sx, sy);
    for (const s of T.list) {
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      s.w *= k; s.h *= k; s.x = cx * sx - s.w / 2; s.y = cy * sy - s.h / 2;
    }
  });
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}

  // 只重新渲染声音：读回事件表，不再跑画面
  if (Q.replay) {
    const list = await (await fetch('http://127.0.0.1:8732/file?name=events.json')).json();
    window.__y = { A, list };
    await A.renderLog(list, 'http://127.0.0.1:8732/frame?name=audio.wav');
    window.__done = 1; return;
  }
  // 录制模式：固定步长，每隔若干帧把画面送给本地抓帧服务
  if (Q.rec) {
    const every = +(Q.every || 120), batch = +(Q.batch || 6), base = 'http://127.0.0.1:8732/';
    let n = 0, shot = 0;
    const pipeEvery = +(Q.pipe || 0);
    if (pipeEvery) await fetch(base + 'pipe/start?fps=' + (60 / pipeEvery) + '&out=' + (Q.out || 'film.mp4'));
    const tick = async () => {
      for (let i = 0; i < batch; i++) {
        frame(1 / 60); n++;
        if (pipeEvery && n % pipeEvery === 0) {
          const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', +(Q.q || .95)));
          await fetch(base + 'pipe/frame', { method: 'POST', body: blob });
        }
        if (n % every === 0) {
          const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', +(Q.q || .9)));
          await fetch(base + 'frame?name=' + (Q.tag || 'f') + String(shot++).padStart(5, '0') + '.jpg', { method: 'POST', body: blob });
        }
      }
      window.__frames = n;
      E.gl.finish();
      if (window.__finished) {
        if (pipeEvery) await fetch(base + 'pipe/end');
        if (Q.offline) {
          await fetch(base + 'frame?name=events.json', { method: 'POST', body: JSON.stringify(A.evts) });
          await A.renderLog(A.evts, base + 'frame?name=audio.wav');
        }
        window.__done = n;
        await fetch(base + 'log?finished_' + n);
        return;
      }
      setTimeout(tick, 0);
    };
    window.__y = { E, T, A, Tw, Ptr, Clock, L };
    setTimeout(tick, 0);
    main().catch(err => console.error(err));
    return;
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now;
    frame(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.__y = { E, T, A, Tw, Ptr, Clock, L };
  main().catch(err => console.error(err));
})();
