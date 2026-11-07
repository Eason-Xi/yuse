// 《余色》剧本与导演
const SPEED = +(Q.speed || 1);
const PACE = .76;              // 所有停顿统一收紧
const FILM = !!Q.film;          // 成片模式：没有手，提示语要换

// ---------- 时钟（跟着画面走：切到别的标签页，故事就停下等你） ----------
const Clock = {
  list: [], skipNow: null,
  step(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i]; w.t -= dt * SPEED;
      if (w.t <= 0) { this.list.splice(i, 1); if (this.skipNow === w) this.skipNow = null; w.res(); }
    }
  },
};
function wait(s, o = {}) {
  return new Promise(res => {
    const w = { t: o.exact ? s : s * PACE, res }; Clock.list.push(w);
    if (!o.noskip) Clock.skipNow = w;
  });
}
function skip() { const w = Clock.skipNow; if (w) w.t = 0; }

// ---------- 指尖 ----------
const Ptr = { x: .5, y: .5, px: .5, py: .5, held: false, mode: 'none', stirred: 0, washed: 0, downT: 0, downX: 0, downY: 0, onPress: null, onClick: null };
let holdTask = null;
function press() { return new Promise(res => { Ptr.onPress = res; if (Q.auto) wait(1.4, { noskip: true }).then(() => { if (Ptr.onPress === res) { Ptr.onPress = null; res(); } }); }); }
function hold(sec, onP) {
  return new Promise(res => {
    let p = 0;
    holdTask = dt => {
      p += (Ptr.held ? dt * SPEED : -dt * 1.5); p = Math.max(0, Math.min(sec, p)); onP(p / sec);
      if (p >= sec) { holdTask = null; res(); }
    };
  });
}

// ---------- 版面 ----------
const L = {
  get u() { return Math.min(E.H, E.W * (E.W < E.H ? 1 : .68)) / 100; },
  get narr() { return this.u * (E.W < E.H ? 3.1 : 2.75); }, get chat() { return this.u * (E.W < E.H ? 3.4 : 3.05); }, get date() { return this.u * (E.W < E.H ? 2.3 : 1.95); },
  get cp() { return this.chat * 2.05; }, get W() { return E.W; }, get H() { return E.H; },
  get wide() { return E.W / E.H > 1.15; },
};
let RS = 1;
const CX = .5, CY = .5;
const len = c => (typeof c === 'string' ? c : c.join('')).length;
const readT = c => 1.3 + len(c) * .17;

function show(cols, o = {}) {
  if (typeof cols === 'string') cols = [cols];
  const sp = T.add(cols, Object.assign({ size: L.narr, x: L.W * (L.wide ? .945 : .95), y: L.H * .13, ink: INK.sumi, font: FONT.fang, ax: 1 }, o));
  sp.rev = 0; Tw.to(sp, 'rev', 1, o.revT || Math.min(2.4, .5 + len(cols) * .05), 'lin');
  return sp;
}
async function hide(sp, d = .8) { if (!sp) return; await Tw.to(sp, 'a', 0, d); T.remove(sp); }
function melt(sp, k = .014, water = 1) { if (!sp) return; if (!E.S.frozen) E.stamp(sp, k, water); Tw.to(sp, 'a', 0, .5).then(() => T.remove(sp)); }
async function N(cols, o = {}) {
  const sp = show(cols, o);
  await wait((o.hold === undefined ? readT(cols) : o.hold));
  if (o.keep) return sp;
  hide(sp, o.out || .9);
  await wait(o.after === undefined ? .35 : o.after);
}
function small(s, o = {}) {
  const sp = T.add([s], Object.assign({ horizontal: true, size: L.date, x: L.W * .5, y: L.H * .05, ink: [0, 0, .85], font: FONT.fang, ay: .5, halo: 1.5, spacing: L.date * .12 }, o));
  sp.rev = 0; Tw.to(sp, 'rev', 1, .6, 'lin');
  return sp;
}
function lat(s) { return small(s, { y: L.H * .945, size: L.date * 1.05, ink: INK.sumi }); }

async function chapter(ch, o = {}) {
  A.pluck(o.note || 45, { g: .5, send: .9, tone: 1400, cents: A.detune });
  const size = L.u * (o.size || 19);
  const sp = T.add([ch], { font: FONT.brush, size, x: L.W * .5, y: L.H * .5, ax: .5, ay: .5, ink: o.ink || INK.sumi, halo: 1.4, lh: size * 1.05 });
  sp.rev = 0; await Tw.to(sp, 'rev', 1, .9, 'out');
  await wait(o.hold || 1.5);
  await hide(sp, .9);
  await wait(.3);
}

// ---------- 对话 ----------
const Chat = {
  n: { dan: 0, qing: 0 }, sp: [],
  max() { return Math.max(2, Math.floor(L.W * (L.wide ? .3 : .44) / L.cp)); },
  say(who, s, o = {}) {
    const m = this.max(), i = this.n[who] % m; this.n[who]++;
    const old = this.sp.find(e => e.who === who && e.slot === i);
    if (old) { this.sp.splice(this.sp.indexOf(old), 1); melt(old.sp); }
    const margin = L.W * (L.wide ? .05 : .08);
    const x = who === 'dan' ? L.W - margin - i * L.cp : margin + i * L.cp;
    const y = L.H * (who === 'dan' ? .12 : .2);
    const maxC = Math.floor(L.H * .68 / (L.chat * 1.24));
    const cols = [];
    for (let k = 0; k < s.length; k += maxC) cols.push(s.slice(k, k + maxC));
    const sp = T.add(cols, { size: L.chat, x, y, ax: .5, font: FONT.kai, ink: who === 'dan' ? INK.dan : INK.qing });
    sp.rev = 0; Tw.to(sp, 'rev', 1, .3 + s.length * .022, 'lin');
    this.sp.push({ who, sp, slot: i });
    if (!o.silent) A.say(who);
    return sp;
  },
  clear(doMelt = true) {
    for (const e of this.sp) { if (doMelt) melt(e.sp); else hide(e.sp); }
    this.sp = []; this.n = { dan: 0, qing: 0 };
  },
};
function msgDrop(who, r = .05) {
  const j = () => (Math.random() - .5) * .012;
  E.drop({ x: CX + j(), y: CY + j(), r: r * RS, ink: who === 'dan' ? [1, 0, 0, 0] : [0, 1, 0, 0], dur: .9 });
  A.plink(who === 'dan' ? .3 : -.3, 800 + Math.random() * 500, .1);
}
function clearDrop(r = .05, dur = 1.6) { E.drop({ x: CX, y: CY, r: r * RS, ink: [0, 0, 0, 0], dur }); }
async function talk(lines, o = {}) {
  for (const [who, s, gap] of lines) {
    Chat.say(who, s); msgDrop(who, o.r === undefined ? .046 : o.r);
    await wait(gap === undefined ? (.75 + s.length * .11) * (o.k || 1) : gap);
  }
}

// ---------- 序 ----------
async function gate() {
  const S = E.S; const Af = E.Af;
  Ptr.mode = 'none';
  S.bead = [CX * Af, CY, .03 * RS, 1];
  S.beadKS = [.064, 15.7, 40.7];
  const size = L.u * 9.5;
  const title = T.add(['余色'], { font: FONT.brush, size, x: L.W * .5 + L.u * (L.wide ? 25 : 20), y: L.H * .5, ax: .5, ay: .5, ink: INK.sumi, lh: size * 1.1, halo: 0 });
  const sub = T.add(FILM ? ['请戴上耳机', '把灯调暗'] : ['大约十二分钟', '戴上耳机，把灯调暗'], { font: FONT.fang, size: L.date * 1.02, x: L.W * .5 + L.u * (L.wide ? 15.5 : 10), y: L.H * .5, ax: .5, ay: .5, ink: INK.grey, gap: L.date * 2, halo: 0 });
  title.rev = sub.rev = 0;
  await Tw.to(title, 'rev', 1, 1.6, 'lin'); Tw.to(sub, 'rev', 1, 1, 'lin');
  const hint = FILM ? null : small('按一下，让它落到纸上', { y: L.H * .5 + L.u * (L.wide ? 13 : 30) });
  // 水珠轻轻呼吸
  let br = true; (async () => { while (br) { await Tw.to(S.bead, 2, .03 * RS * 1.05, 1.6); if (!br) break; await Tw.to(S.bead, 2, .03 * RS, 1.6); } })();
  if (FILM) await wait(4, { noskip: true }); else await press();
  br = false;
  A.init(); goFull();
  hide(hint, .3); hide(sub, .5); hide(title, 1.2);
  Tw.to(S.bead, 2, 0, .16, 'in').then(() => { S.bead[3] = 0; });
  await wait(.14, { noskip: true });
  E.drop({ x: CX, y: CY, r: .1 * RS, ink: [1, 0, 0, 0], dur: 1.8 });
  A.drip(0, .7); A.pluck(57, { g: .5, send: .9 });
  A.droneOn(.035, 10);
}
function goFull() { try { const el = document.documentElement; if (!Q.nofs && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) {} }

// ---------- 调 ----------
async function ch1() {
  const S = E.S;
  Ptr.mode = 'stir'; S.wet = 1; S.damp = 2;
  await wait(2.6);
  let a = show('红的叫丹。', { ink: INK.dan, x: L.W * .5 + L.u * 22, y: L.H * .42, size: L.chat, font: FONT.kai, ax: .5 });
  await wait(2);
  E.drop({ x: CX, y: CY, r: .085 * RS, ink: [0, 1, 0, 0], dur: 1.8 }); A.drip(-.3, .55); A.pluck(64, { g: .45, send: .9, pan: -.3 });
  await wait(1.2);
  let b = show('蓝的叫青。', { ink: INK.qing, x: L.W * .5 - L.u * 22, y: L.H * .42, size: L.chat, font: FONT.kai, ax: .5 });
  await wait(2.6);
  melt(a); melt(b);
  await wait(.6);
  await chapter('调', { note: 50 });
  let d = small('二〇〇八年九月　高一　画室');
  await talk([['dan', '同学 你的群青借我挤一点'], ['qing', '挤吧'], ['dan', '你这管都扁成纸了'], ['qing', '穷'], ['dan', '哈哈哈哈哈哈哈哈哈']]);
  await wait(.9);
  Chat.clear(); hide(d); clearDrop(.045);
  await wait(.8);
  if (!FILM) { const hint = small('手指按住，拨一拨水面', { y: L.H * .945 }); await wait(3.6); hide(hint); }
  else { setHand(t => [.5 + .15 * Math.sin(t * .9), .5 + .22 * Math.sin(t * 1.3)], 3.4); await wait(3.6); }
  d = small('二〇〇八年十月八日　夜里十一点四十一');
  await talk([['dan', '你今天说的那个'], ['dan', '盯着红色看三十秒再看白墙'], ['dan', '我试了'], ['dan', '卧槽'], ['dan', '真有个绿的'], ['qing', '青的'], ['dan', '？', 1.1], ['qing', '红的余色是青 不是绿'], ['dan', '你好装'], ['qing', '嗯', 2.2]], { r: .04 });
  Chat.clear(); hide(d); clearDrop(.05);
  await wait(1);
  d = small('二〇〇九年十一月二日　凌晨一点四十');
  await talk([['dan', '在吗', 1.1], ['qing', '在', 1.3], ['dan', '没事 就问问', 1.5], ['qing', '神经', 1.2]], { r: .04 });
  let l = lat('回复用时 4 秒');
  await wait(2.6);
  Chat.clear(); hide(d); hide(l); clearDrop(.04);
  await wait(.8);
  d = small('二〇一〇年十二月十九日　艺考集训　凌晨两点十一');
  await talk([['qing', '在吗', 1.1], ['dan', '在', 1.3], ['qing', '我想回家', 1.5], ['dan', '下楼', 1], ['dan', '我在你宿舍门口了', 1.6]], { r: .04 });
  l = lat('回复用时 3 秒');
  await wait(2.6);
  Chat.clear(); hide(d); hide(l);
  await wait(.6);
  await N(['后来这成了规矩。', '不管几点，“在吗”后面只跟一个“在”。']);
  await burst();
}

const FRAG = ['吃了吗', '你看这个', '哈哈哈哈', '他就是个傻子', '借我两百', '我失恋了', '来我这', '几点的车', '你又熬夜', '给你寄了东西', '这家店绝了', '别理他', '下周去找你', '你听这首', '我想辞职', '哭了', '在画吗', '晚安', '起床', '在吗', '在', '笑死', '等我', '发我', '你在哪', '我也是', '想你了傻子', '在吗', '在'];
async function burst() {
  const d = small('二〇一三年　一个在北京　一个在杭州');
  await wait(1.6);
  const n = 92;
  const phrase = [62, 64, 66, 69, 71, 74, 76, 78, 81, 78, 76, 74, 71, 69, 66, 69, 71, 74];
  for (let i = 0; i < n; i++) {
    const who = (i + (Math.random() < .25 ? 1 : 0)) % 2 ? 'dan' : 'qing';
    const r = (.042 + Math.random() * .03) * (i % 3 === 2 ? .6 : 1);
    if (i % 3 === 2) E.drop({ x: CX + (Math.random() - .5) * .02, y: CY + (Math.random() - .5) * .02, r: r * RS, ink: [0, 0, 0, 0], dur: .8 });
    else { E.drop({ x: CX + (Math.random() - .5) * .02, y: CY + (Math.random() - .5) * .02, r: r * RS, ink: who === 'dan' ? [1, 0, 0, 0] : [0, 1, 0, 0], dur: .8 }); }
    A.pluck(phrase[i % phrase.length] - (i > n * .7 ? 0 : 0), { g: .13 + .15 * Math.min(1, i / 50), pan: who === 'dan' ? .45 : -.45, send: .75, tone: 3200 });
    if (i % 2 === 0) {
      const left = who === 'qing';
      const s = FRAG[(i / 2) % FRAG.length | 0];
      const x = L.W * (left ? .03 + Math.random() * .2 : .77 + Math.random() * .2), y = L.H * (.1 + Math.random() * .62);
      const sp = T.add([s], { size: L.chat * .78, x, y, ax: .5, font: FONT.kai, ink: who === 'dan' ? INK.dan : INK.qing });
      sp.rev = 1; (async () => { await wait(.85, { noskip: true }); melt(sp, .008, 1); })();
    }
    await wait(Math.max(.075, .17 - i * .0012), { noskip: true });
  }
  hide(d);
  A.pluck(50, { g: .6, send: 1, tone: 1500 });
  await wait(1.4);
  // 一只看不见的手沿半径划过水面，年轮被拉成虹膜的纹理
  const spokes = 12;
  for (let k = 0; k < spokes; k++) {
    const a = (k + .5) / spokes * 6.283 + .2, out = k % 2 === 0;
    const r0 = (out ? .2 : .6) * RS, r1 = (out ? .6 : .2) * RS;
    E.stroke(u => { const r = r0 + (r1 - r0) * u; return [.5 + r * Math.cos(a) / E.Af, .5 + r * Math.sin(a)]; }, 1.2, .3, .0005);
    A.pluck(A.PENTA[(k * 3) % 12 + 3], { g: .13, send: .9, pan: Math.cos(a) * .6, tone: 3000 });
    await wait(.26, { noskip: true });
  }
  await N(['那一年，两个人发了', '四万一千二百零六条消息。'], { hold: 5.5 });
  await wait(1.4);
}

// ---------- 渝 ----------
async function ch2() {
  const S = E.S;
  A.droneSet(.04, .35, 8);
  await chapter('渝', { note: 45 });
  Tw.to(S, 'feather', .0019, 30); Tw.to(S, 'age', .016, 26); S.soil = .5; S.shear = 0;
  await N(['丹青初则炳，久则渝。', '　　　　　　　　扬雄《法言》'], { hold: 4.6 });
  await N(['丹青刚画上去最亮，放久了会变。', '朱砂见光，慢慢发黑，不用谁去碰它。'], {});
  A.detune = -9;
  let d = small('二〇一六年六月　丹上班了');
  await talk([['qing', '这周末我去北京 见一面？'], ['dan', '这周上线 下次一定！！'], ['qing', '好', 2.4]], { r: .03 });
  Chat.clear(); hide(d); clearDrop(.075, 2.4);
  await wait(1.2);
  A.detune = -16; A.droneSet(null, .8, 6);
  d = small('二〇一七年九月三日　晚上十点十五');
  await talk([['dan', '在吗', 2.2]], { r: .028 });
  await wait(1.6);
  await talk([['qing', '在 咋了', 1.6], ['dan', '没事了 已经解决了', 1.6]], { r: .028 });
  let l = lat('回复用时 2 小时 11 分');
  await wait(3);
  Chat.clear(); hide(d); hide(l); clearDrop(.085, 2.6);
  await wait(1);
  A.detune = -24;
  d = small('二〇一九年五月十八日　青的第一次个展');
  await talk([['qing', '今天开展 你到哪了', 2.4]], { r: .024 });
  await wait(1.4);
  await talk([['dan', '对不起对不起 临时要上线'], ['dan', '转账 ¥200', 2]], { r: .024 });
  l = lat('二十四小时未收款，已退还');
  await wait(3.2);
  Chat.clear(); hide(d); hide(l); clearDrop(.09, 2.8);
  await wait(1);
  A.detune = -34; A.droneSet(.05, 1.4, 6);
  d = small('二〇二〇年一月二十四日　除夕');
  await talk([['dan', '新年快乐！愿您在新的一年里身体健康万事如意阖家幸福！', 3.6], ['qing', '谢谢 同乐', 2]], { r: .022 });
  Chat.clear(); hide(d);
  await N(['这一年，两个人发了六十三条消息。'], {});
  // 让你亲手试一次
  Ptr.stirred = 0;
  Tw.to(S, 'age', .026, 12); S.soil = 1.4;
  setHand(t => [.5 + .36 / E.Af * Math.cos(t * .9), .5 + .36 * Math.sin(t * .9)], 7);
  await N(FILM ? ['搅一搅，', '能搅回去吗。'] : ['你可以搅一搅，', '试试能不能搅回去。'], { hold: 8, after: .2 });
  const did = FILM || Ptr.stirred > .9;
  if (did) await N(['越搅越脏。', '解释也是这样，解释一次，脏一层。'], {});
  else await N(['你什么也没做。', '它也在变。'], {});
  await N(['黑只长在两个颜色重叠过的地方。'], {});
  clearDrop(.1, 3);
  await wait(1);
}

// ---------- 那一夜 ----------
const hhmm = m => `${String(m / 60 | 0).padStart(2, '0')}:${String(m % 60 | 0).padStart(2, '0')}`;
async function nightScene() {
  const S = E.S;
  Tw.to(S, 'age', .018, 6);
  Ptr.weak = .22;
  A.droneSet(.03, 2.2, 8);
  Tw.to(S, 'txGlow', .95, 5);
  await Tw.to(S, 'room', .04, 6);
  const d = small('二〇二一年三月九日　星期二', { ink: INK.sumi });
  await wait(1.8);
  const clock = T.add(['03:12'], { horizontal: true, size: L.u * 4.1, x: L.W * .5, y: L.H * .115, ay: .5, font: FONT.fang, ink: INK.grey, halo: 0, spacing: L.u * .3 });
  clock.rev = 0; Tw.to(clock, 'rev', 1, .6, 'lin');
  await wait(2.2);
  const m = T.add(['在吗'], { font: FONT.kai, size: L.u * 5.4, x: L.W * .5, y: L.H * .5, ax: .5, ay: .5, ink: INK.qing });
  m.rev = 0; Tw.to(m, 'rev', 1, .9, 'lin'); A.pluck(64, { g: .5, send: 1, pan: -.1, cents: 0 });
  await wait(4.4, { noskip: true });
  await N(['丹的手机在床头。', '勿扰模式。'], { hold: 4.2, ink: INK.sumi });
  await wait(1.2, { noskip: true });
  // 窗外慢慢亮起来
  Tw.to(S, 'room', 1, 9, 'sine'); Tw.to(S, 'txGlow', 0, 8.5);
  const st = { m: 192 };
  await new Promise(res => {
    Tw.to(st, 'm', 580, 9, 'sine').then(res);
    (async () => { let last = 0; while (st.m < 579.5) { await wait(.12, { noskip: true }); const s = hhmm(st.m); if (s !== last) { T.set(clock, s); last = s; } } })();
  });
  T.set(clock, '09:40');
  await wait(1);
  hide(d);
  Chat.say('dan', '刚看到 咋了');
  await wait(3);
  T.set(clock, '10:02');
  await wait(1.4);
  const fin = Chat.say('qing', '没事', { silent: true });
  // 这两个字落下去的时候，所有声音都停了
  A.droneCut(.04); A.setRoom(.006, .1); A.plink(-.3, 560, .05);
  Ptr.mode = 'none'; S.brush[3] = 0;
  await wait(4.5, { noskip: true });
  const l = lat('回复用时 6 小时 28 分');
  await wait(4, { noskip: true });
  hide(clock); hide(m, 3); hide(l);
  Chat.clear(false);
}

// ---------- 干 ----------
async function ch3() {
  const S = E.S;
  Ptr.mode = 'none';
  Tw.to(S, 'dry', 1, 5); await Tw.to(S, 'wet', 0, 4);
  S.frozen = true;
  await chapter('干', { note: 38, hold: 1.4 });
  Tw.to(S, 'crackT', 1.12, 17, 'lin');
  cracking = true;
  await N(['没有吵架。'], { hold: 3.2 });
  await N(['没有人说过一句重话。'], { hold: 3.4 });
  await N(['水就这样干了。'], { hold: 4.2 });
  await wait(2);
  await N(['两个月后，丹在别人的朋友圈里看到：', '那天夜里，青的父亲走了。'], { hold: 6.4 });
  await wait(1.4);
  await N(['丹打开对话框。'], { hold: 2.8 });
  await N(['第一天没说，第二天要解释的就多一天。', '第三天，多两天。'], { hold: 6 });
  cracking = false;
  Tw.to(S, 'seam', 1, 3);
  await wait(3.2);
  A.rip(5);
  Tw.to(S, 'tilt', .03, 20, 'sine');
  await Tw.to(S, 'gap', .15 * E.Af, 7, 'io');
}

// ---------- 余 ----------
function gapBounds() {
  const g = E.S.gap;
  const c = .5;
  const l = E.f2s(c - g / E.Af, .5)[0] * L.W, r = E.f2s(c + g / E.Af, .5)[0] * L.W;
  return [l, r];
}
async function typeDraft(side, s, o = {}) {
  const [l, r] = gapBounds();
  const x = side === 'dan' ? r - L.chat * (o.col || 1.6) : l + L.chat * (o.col || 1.6);
  const sp = T.add([' '], { size: L.chat * .95, x, y: L.H * .2, ax: .5, font: FONT.kai, ink: side === 'dan' ? INK.dan : INK.qing, halo: 0, minH: L.H * .62 });
  sp.rev = 1;
  const pan = side === 'dan' ? .35 : -.35, chars = [...s];
  for (let i = 1; i <= chars.length; i++) { T.set(sp, chars.slice(0, i).join('') + '｜'); A.key(pan); await wait(.1 + Math.random() * .1, { noskip: true }); }
  await wait(o.linger || 1.1, { noskip: true });
  for (let i = chars.length - 1; i >= 0; i--) { T.set(sp, chars.slice(0, i).join('') + '｜'); A.del(pan); await wait(.045, { noskip: true }); }
  await wait(.3, { noskip: true });
  T.remove(sp);
}
const DRAFT_D = ['听说叔叔的事了 我才知道', '那天我手机静音了', '你为什么不告诉我', '对不起', '你还好吗', '我不知道该说什么', '在吗'];
const DRAFT_Q = ['你是不是根本没看', '我爸走了', '我不怪你', '我怪你', '算了', '你现在挺好的吧', '在吗'];
const SNOW = [...DRAFT_D, ...DRAFT_Q, '生日快乐', '最近好吗', '看到这个想到你', '哈哈好久不见', '你是不是换手机了', '那年你说的那家店关了', '我路过杭州了', '我梦见你了', '其实你也可以告诉我的', '我去看了你的展', '你瘦了', '算了算了', '不发了', '我们怎么了', '要不算了', '我也不好过', '你还恨我吗', '想你了', '当我没说', '对不起', '对不起', '在吗', '在吗', '你在吗'];

async function ch4() {
  const S = E.S;
  A.setRoom(.01, 3);
  Tw.to(S, 'room', .62, 8);
  Tw.to(S, 'txGlow', .3, 4);
  await chapter('余', { note: 33, hold: 1.4, ink: INK.sumi, size: 15 });
  const st = { d: 1 };
  const counter = T.add(['第 1 天'], { horizontal: true, size: L.date * 1.1, x: L.W * .5, y: L.H * .08, ay: .5, font: FONT.fang, ink: INK.sumi, halo: 0, spacing: L.date * .1 });
  counter.rev = 1;
  let running = true;
  (async () => { let last = 1; while (running) { await wait(.09, { noskip: true }); const v = st.d | 0; if (v !== last) { T.set(counter, `第 ${v} 天`); last = v; } } })();
  Tw.to(st, 'd', 500, 22, 'lin');
  A.pluck(69, { g: .2, send: 1, cents: -30 });
  const a = (async () => { for (let i = 0; i < 4; i++) { await typeDraft('dan', DRAFT_D[i], {}); await wait(.7 + Math.random() * 1.1, { noskip: true }); } })();
  const b = (async () => { await wait(1.8, { noskip: true }); for (let i = 0; i < 4; i++) { await typeDraft('qing', DRAFT_Q[i], {}); await wait(.7 + Math.random() * 1.1, { noskip: true }); } })();
  await Promise.all([a, b]);
  Tw.to(st, 'd', 710, 1.5, 'lin');
  await wait(1.6, { noskip: true });
  running = false;
  T.set(counter, '二〇二三年二月十七日 01:47');
  await wait(2.2);
  const [l, r] = gapBounds();
  const mid = (l + r) / 2;
  await N(['两边同时打开了对话框。'], { x: mid, ax: .5, y: L.H * .2, hold: 3.2 });
  const ta = T.add(['对方正在输入…'], { size: L.chat * .78, x: r - L.chat * 1.6, y: L.H * .2, ax: .5, font: FONT.kai, ink: INK.dan, halo: 0 });
  const tb = T.add(['对方正在输入…'], { size: L.chat * .78, x: l + L.chat * 1.6, y: L.H * .2, ax: .5, font: FONT.kai, ink: INK.qing, halo: 0 });
  ta.rev = tb.rev = 1;
  let pulse = true;
  (async () => { let k = 0; while (pulse) { const v = .55 + .45 * Math.sin(k); ta.a = tb.a = v; k += .2; await wait(.05, { noskip: true }); } })();
  await wait(1.6);
  await N(['两边都看见了这行字。', '两边都停下来，等对方说完。'], { x: mid + L.narr, ax: .5, y: L.H * .28, hold: 6.2 });
  await wait(2.4, { noskip: true });
  await N(['四十一秒。'], { x: mid, ax: .5, y: L.H * .4, hold: 2.8 });
  pulse = false; ta.a = tb.a = 0; T.remove(ta); T.remove(tb);
  await wait(2.2, { noskip: true });
  await N(['没有人说完。'], { x: mid, ax: .5, y: L.H * .4, hold: 3 });
  hide(counter);
  await wait(.8);
  // 雪
  snowing = true;
  await N(['三年里，丹删掉了二百一十一句话。', '青删掉了三百零六句。'], { x: mid + L.narr, ax: .5, y: L.H * .22, hold: 6.2 });
  await N(['这五百一十七句话，', '没有一句到过对面。'], { x: mid + L.narr, ax: .5, y: L.H * .22, hold: 6 });
  Tw.to(S, 'dustA', 1, 14);
  await wait(6);
  snowing = false;
}
// 落下来的草稿
let snowing = false, cracking = false, snowT = 0;
const flakes = [];
function snowStep(dt) {
  if (snowing) {
    snowT -= dt * SPEED;
    if (snowT <= 0) {
      snowT = .14 + Math.random() * .16;
      const [l, r] = gapBounds(); const s = SNOW[Math.random() * SNOW.length | 0];
      const sc = .46 + Math.random() * .36, x = l + (r - l) * Math.random();
      const who = Math.random() < .5;
      const sp = T.add([s], { size: L.chat * sc, x, y: -L.H * .1, ax: .5, ay: 0, font: FONT.kai, ink: who ? INK.dan : INK.qing, halo: 0 });
      sp.rev = 1; sp.a = .25 + sc * .8; flakes.push({ sp, v: L.H * (.045 + sc * .07), w: Math.random() * 6, a0: sp.a });
    }
  }
  for (let i = flakes.length - 1; i >= 0; i--) {
    const f = flakes[i]; f.sp.y += f.v * dt; f.w += dt; f.sp.x += Math.sin(f.w * .7) * L.u * .1;
    if (f.dead) { f.sp.a *= .95; if (f.sp.a < .01) { T.remove(f.sp); flakes.splice(i, 1); } continue; }
    if (f.sp.y > L.H * .5) f.sp.a = f.a0 * Math.max(0, 1 - (f.sp.y - L.H * .5) / (L.H * .48));
    if (f.sp.y > L.H * 1.02) { T.remove(f.sp); flakes.splice(i, 1); }
  }
}

function stareCanvas() {
  const c = document.createElement('canvas'); c.width = L.W; c.height = L.H;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  const size = Math.min(L.H * .72, L.W * .78);
  x.font = `${size}px ${FONT.brush}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineJoin = 'round'; x.lineWidth = size * .018;
  x.fillText('在', c.width / 2, c.height / 2 + size * .02); x.strokeText('在', c.width / 2, c.height / 2 + size * .02);
  return c;
}
async function stare() {
  const S = E.S;
  E.setStare(stareCanvas());
  S.txGlow = 0; S.wet = 0;
  const s0 = small('盯住字中间的黑点。', { y: L.H * .05, size: L.date * 1.15, ink: INK.sumi, halo: 0 });
  const s1 = small('二十秒，尽量别眨眼，头别动。', { y: L.H * .95, size: L.date * 1.15, ink: INK.sumi, halo: 0 });
  S.dot = [.5, .5, .0062, 0];
  await Tw.to(S, 'stare', 1, 1.2);
  S.dot[3] = 1;
  await wait(3.4, { noskip: true });
  hide(s0, 1); hide(s1, 1);
  const secs = Q.stare ? +Q.stare : 20;
  for (let i = 0; i < secs; i++) { A.beat(.11 + i * .004); await wait(1, { noskip: true, exact: true }); }
  // 字消失。屏幕上只剩白纸。
  await Tw.to(S, 'stare', 0, .1, 'lin');
  A.ghost(true);
  await wait(4.2, { noskip: true });
  const a = small('屏幕上什么也没有。', { y: L.H * .945, size: L.date * 1.3, ink: INK.sumi, halo: 0 });
  await wait(4.4, { noskip: true });
  hide(a, .6);
  await wait(.6, { noskip: true });
  const b = small('这个青色的字，在你的眼睛里。', { y: L.H * .945, size: L.date * 1.3, ink: INK.sumi, halo: 0 });
  await wait(4.6, { noskip: true });
  hide(b, .6);
  await wait(.5, { noskip: true });
  const c = small('看着黑点，跟它走。', { y: L.H * .945, size: L.date * 1.3, ink: INK.sumi, halo: 0 });
  // 余像贴在视网膜上，眼睛走到哪，它跟到哪
  const P = { x: .5 };
  const run = async (to, d) => { const p = Tw.to(P, 'x', to, d, 'sine'); let on = true; p.then(() => on = false); while (on) { S.dot[0] = P.x; await wait(.016, { noskip: true }); } };
  await run(.28, 3); await run(.72, 4.6); await run(.5, 3);
  hide(c, .6);
  Tw.to(S.dot, 3, 0, 1);
  A.ghost(false);
  await wait(1.6, { noskip: true });
}
async function ch4b() {
  const S = E.S;
  flakes.forEach(f => { f.dead = true; });
  await Tw.to(S, 'plain', 1, 3.4);
  S.room = 1; S.txGlow = 0; S.dustA = 0; S.wet = 0;
  await wait(.4);
  const [mx] = [L.W * .5];
  await N(['十五岁那年，青教过丹一件事。', '现在你来。'], { x: mx + L.narr * 1.1, ax: .5, y: L.H * .3, hold: 4.8 });
  for (let k = 0; k < 2; k++) {
    await stare();
    if (k === 1 || FILM) break;
    const r = small('没看到？按这里，再来一次', { y: L.H * .945, size: L.date * 1.1 });
    let again = false;
    Ptr.onClick = (px, py) => { if (Math.abs(py - L.H * .945) < L.u * 5 && Math.abs(px - L.W * .5) < L.u * 22) { again = true; Clock.list.forEach(w => { if (w.tag === 'r') w.t = 0; }); } };
    await new Promise(res => { const w = { t: 4.6, res, tag: 'r' }; Clock.list.push(w); });
    Ptr.onClick = null; hide(r, .4);
    if (!again) break;
    await wait(.6);
  }
  await wait(.8);
  const x = L.W * .5 + L.narr * 1.2, y = L.H * .3, o = { x, ax: .5, y };
  await N(['盯着红色太久，眼睛对红色就钝了。'], o);
  await N(['这时候再看白，白里的红像被抽走了一块。'], o);
  await N(['抽走了红的白，就是青。'], { ...o, hold: 3.6 });
  await wait(.8);
  const q1 = show('青，是白光里少了丹。', { ...o, x: L.W * .5 + L.narr * 1.1, font: FONT.kai, size: L.chat, ink: INK.qing });
  await wait(3.8);
  const q2 = show('丹，是白光里少了青。', { ...o, x: L.W * .5 - L.narr * 1.1, font: FONT.kai, size: L.chat, ink: INK.dan });
  await wait(4.4);
  hide(q1); hide(q2);
  await wait(1);
  await N(['所以一个人走了以后，', '白墙也不是原来的白了。'], { ...o, hold: 5.6 });
  await wait(1.2);
  await N(['留在眼睛里的这个颜色，叫余色。'], { ...o, hold: 3.8, after: .1 });
  const size = L.u * 15;
  const yu = T.add(['余'], { font: FONT.brush, size, x: L.W * .5, y: L.H * .39, ax: .5, ay: .5, ink: INK.sumi, lh: size * 1.05 });
  const se = T.add(['色'], { font: FONT.brush, size, x: L.W * .5, y: L.H * .62, ax: .5, ay: .5, ink: INK.sumi, lh: size * 1.05 });
  yu.rev = se.rev = 0; A.pluck(50, { g: .5, send: 1, cents: 0, tone: 1500 });
  Tw.to(yu, 'rev', 1, .9, 'out'); await Tw.to(se, 'rev', 1, 1.1, 'out');
  await wait(3);
  const n1 = small('它在教科书里还有一个名字', { y: L.H * .9, size: L.date * 1.25, ink: INK.sumi });
  await wait(3.4);
  // 余 → 补
  const bu = T.add(['补'], { font: FONT.brush, size, x: L.W * .5, y: L.H * .39, ax: .5, ay: .5, ink: INK.dan, lh: size * 1.05 });
  bu.rev = 0; A.pluck(57, { g: .55, send: 1, cents: 0, tone: 1800 }); A.pluck(64, { g: .4, send: 1, cents: 0, at: .22 });
  hide(yu, 1.6); Tw.to(bu, 'rev', 1, 1.8, 'lin');
  await wait(3.2);
  hide(n1);
  await wait(.8);
  const n2 = small('留下来的颜色，就是补得上的颜色。', { y: L.H * .9, size: L.date * 1.4, ink: INK.sumi });
  await wait(6);
  hide(n2); hide(bu, 1.2); hide(se, 1.2);
  await wait(1.6);
}

// ---------- 洗 ----------
async function ch5() {
  const S = E.S;
  const o = { x: L.W * .5 + L.narr * 1.2, ax: .5, y: L.H * .28 };
  await N(['怎么补，裱画师傅有四个字：'], { ...o, hold: 3.4 });
  const big = ['洗', '揭', '补', '全'].map((c, i) => {
    const sp = T.add([c], { font: FONT.brush, size: L.u * 8, x: L.W * .5 + (1.5 - i) * L.u * 13, y: L.H * .5, ax: .5, ay: .5, ink: INK.sumi, lh: L.u * 8.4 });
    sp.rev = 0; return sp;
  });
  for (const [i, b] of big.entries()) { Tw.to(b, 'rev', 1, .6, 'out'); A.pluck([45, 50, 52, 57][i], { g: .4, send: .9, cents: 0, tone: 1600 }); await wait(.7, { noskip: true }); }
  await wait(2.6);
  big.forEach(b => hide(b, 1));
  await wait(1.2);
  S.dustA = 1; S.gap = Math.max(S.gap, .15 * E.Af); S.tilt = .03; S.seam = 1; S.dry = 1; S.crackT = 1.12; S.frozen = true;
  Tw.to(S, 'room', .78, 5);
  await Tw.to(S, 'plain', 0, 5);
  A.droneOn(.02, 8); A.droneSet(null, .6, 1);
  await chapter('洗', { note: 45, size: 15, hold: 1 });
  const [l, r] = gapBounds(); const mid = (l + r) / 2;
  const t1 = show(['先别修。', '把这些年落上去的灰洗掉。'], { x: mid + L.narr, ax: .5, y: L.H * .24, ink: INK.sumi });
  await wait(4.6);
  hide(t1);
  Ptr.mode = 'wash'; Ptr.washed = 0;
  setHand(t => { const left = Math.sin(t * .55) > 0; return [(left ? .15 : .85) + .13 * Math.sin(t * 2.1), .5 + .44 * Math.sin(t * .83)]; }, 11);
  const t2 = FILM ? null : show('用手擦一擦纸面。', { x: mid, ax: .5, y: L.H * .3 });
  const start = E.time;
  while (Ptr.washed < 7.5 && E.time - start < (FILM ? 9 : 22)) await wait(.2, { noskip: true });
  hide(t2);
  Tw.to(S, 'dustA', 0, 6);
  Ptr.mode = 'none'; S.brush[3] = 0;
  await N(['灰是替对方想好的台词，', '是替自己备好的理由。'], { x: mid + L.narr, ax: .5, y: L.H * .24, hold: 5.2 });
  await N(['洗掉它，才看得见', '到底是哪里破了。'], { x: mid + L.narr, ax: .5, y: L.H * .24, hold: 4.4 });
  await wait(.8);
}

// ---------- 揭 ----------
async function ch6() {
  const S = E.S;
  A.droneSet(.025, .2, 8); A.detune = 0;
  await chapter('揭', { note: 50, size: 15, hold: 1 });
  const [l, r] = gapBounds(); const mid = (l + r) / 2;
  const o = { x: mid + L.narr, ax: .5, y: L.H * .2 };
  await N(['贴着画心最近的那层纸，叫命纸。', '把它揭下来，是最险的一步。'], { ...o, hold: 6 });
  await N(['这里的命纸，就是那一夜。'], { ...o, x: mid, hold: 3.4 });
  await wait(.6);
  const d = small('二〇二四年四月四日　清明', { ink: INK.sumi, y: L.H * .07 });
  await wait(1.2);
  await N(['丹打开对话框，翻到三年前的最后一句。'], { ...o, x: mid, hold: 4 });
  const old = T.add(['在吗'], { font: FONT.kai, size: L.chat * 1.2, x: l + (r - l) * .22, y: L.H * .46, ax: .5, ay: .5, ink: INK.qing, halo: 0 });
  old.rev = 0; Tw.to(old, 'rev', 1, .7, 'lin'); A.pluck(64, { g: .4, send: 1, pan: -.3, cents: 0 });
  await wait(2);
  const rep = T.add(['在'], { font: FONT.kai, size: L.chat * 1.2, x: l + (r - l) * .78, y: L.H * .46, ax: .5, ay: .5, ink: INK.dan, halo: 0 });
  rep.rev = 0;
  const h = FILM ? null : small('按住不放', { y: L.H * .9, size: L.date * 1.2, ink: INK.sumi, halo: 0 });
  await hold(FILM ? 2.4 : 4, p => { rep.rev = p; });
  hide(h, .4);
  A.pluck(57, { g: .55, send: 1, pan: .3, cents: 0 });
  // 一条线穿过三年
  const pr = E.s2f(rep.x / L.W + rep.w / L.W * .5, .5), pl = E.s2f(old.x / L.W + old.w / L.W * .5, .5);
  const xr = pr[0] * E.Af, xl = pl[0] * E.Af, y = E.s2f(.5, 1 - (L.H * .46) / L.H)[1];
  S.line = [xr, xr, y, 1];
  await new Promise(res => { Tw.to(S.line, 0, xl, 4.2, 'io').then(res); });
  A.pluck(64, { g: .45, send: 1, pan: -.3, cents: 0 });
  await Tw.to(S.line, 3, 0, 1.6);
  const la = lat('回复用时 一千一百二十二天');
  await wait(4.2, { noskip: true });
  hide(rep); hide(old);
  hide(la);
  const lq = await N(['这一半，是丹能做的。', '另一半不是。'], { ...o, x: mid + L.narr, y: L.H * .3, hold: 5.2 });
  await wait(2.4, { noskip: true });
  // 等
  const ty = T.add(['对方正在输入…'], { size: L.chat * .8, x: l + (r - l) * .16, y: L.H * .2, ax: .5, font: FONT.kai, ink: INK.qing, halo: 0 });
  ty.rev = 1; ty.a = 0;
  await Tw.to(ty, 'a', 1, .25); await wait(2.6, { noskip: true }); await Tw.to(ty, 'a', 0, .15);
  await wait(3.8, { noskip: true });
  await Tw.to(ty, 'a', 1, .25); await wait(3.4, { noskip: true }); await Tw.to(ty, 'a', 0, .15);
  T.remove(ty);
  await wait(1.2, { noskip: true });
  hide(d);
  // 信：一列一列从右往左写过去
  const gapC = L.chat * 2.25;
  const put = (who, s, i) => {
    const sp = T.add([s], { size: L.chat, x: r - (r - l) * .14 - i * gapC, y: L.H * (who === 'dan' ? .16 : .2), ax: .5, font: FONT.kai, ink: who === 'dan' ? INK.dan : INK.qing, halo: .6 });
    sp.rev = 0; Tw.to(sp, 'rev', 1, .3 + s.length * .05, 'lin'); A.say(who, { cents: 0, g: .3 });
    return sp;
  };
  let sps = [];
  sps.push(put('qing', '你知道那天晚上我在哪吗', 0)); await wait(3.6);
  sps.push(put('dan', '不知道', 1)); await wait(1.6);
  sps.push(put('dan', '你告诉我', 2)); await wait(3);
  sps.forEach(s => hide(s, 1)); await wait(1.3); sps = [];
  const letter = [['医院', 2], ['我爸两点四十走的', 2.6], ['楼梯间 手机还剩百分之九的电', 3.4], ['通讯录我翻了一遍', 2.8], ['翻到你 就没再往下翻了', 4.4], ['我发了那两个字', 2.6], ['然后看着屏幕 一直到天亮', 4.6]];
  for (let i = 0; i < letter.length; i++) { sps.push(put('qing', letter[i][0], i)); await wait(letter[i][1]); }
  await wait(3);
  sps.forEach(s => hide(s, 1.2)); await wait(1.8); sps = [];
  sps.push(put('qing', '你第二天回我 刚看到 咋了', 0)); await wait(3.6);
  sps.push(put('qing', '我不知道怎么说了', 1)); await wait(2.8);
  sps.push(put('qing', '就说没事', 2)); await wait(4.4);
  sps.forEach(s => hide(s, 1.2)); await wait(2);
  // 这一次，删对了
  await typeDraft('dan', '那天我手机静音了', { col: 8, linger: 2.4 });
  await wait(.6, { noskip: true });
  await N(['这句话是真的。'], { x: mid, ax: .5, y: L.H * .3, hold: 2.8 });
  await N(['丹还是删了。'], { x: mid, ax: .5, y: L.H * .3, hold: 3.2 });
  await wait(.6);
  sps = [];
  sps.push(put('dan', '那天晚上我没在', 1)); await wait(3.2);
  sps.push(put('dan', '对不起', 2)); await wait(4.6);
  const ty2 = T.add(['对方正在输入…'], { size: L.chat * .8, x: l + (r - l) * .16, y: L.H * .2, ax: .5, font: FONT.kai, ink: INK.qing, halo: 0 });
  ty2.rev = 1; ty2.a = 0; await Tw.to(ty2, 'a', 1, .25);
  await wait(4.4, { noskip: true }); await Tw.to(ty2, 'a', 0, .15); T.remove(ty2);
  await wait(.8, { noskip: true });
  sps.push(put('qing', '嗯', 4));
  await wait(5.5);
  sps.forEach(s => hide(s, 1.4));
  await wait(2);
}

// ---------- 补 ----------
async function ch7() {
  const S = E.S;
  await chapter('补', { note: 45, size: 15, hold: 1 });
  const [l, r] = gapBounds(); const mid = (l + r) / 2;
  const o = { x: mid + L.narr, ax: .5, y: L.H * .2 };
  Tw.to(S, 'tilt', 0, 19, 'sine');
  Tw.to(S, 'gap', 0, 19, 'io');
  Tw.to(S, 'room', .34, 17);
  Tw.to(S, 'txGlow', 1, 10);
  await N(['补洞的纸要和原来的一样。', '补在背面，正面看不见。'], { ...o, hold: 6 });
  await wait(.8);
  await N(['那天晚上之后，丹打开手机设置。'], { ...o, x: mid, hold: 3.6 });
  const s1 = show('勿扰模式', { x: mid + L.narr * 2.4, ax: .5, y: L.H * .3, font: FONT.kai, size: L.chat * .9 });
  await wait(1.5);
  const s2 = show('例外联系人', { x: mid, ax: .5, y: L.H * .3, font: FONT.kai, size: L.chat * .9 });
  await wait(1.5);
  const s3 = show('添加：青', { x: mid - L.narr * 2.4, ax: .5, y: L.H * .3, font: FONT.kai, size: L.chat * .9, ink: INK.qing });
  A.plink(0, 900, .12);
  await wait(3.8);
  hide(s1); hide(s2); hide(s3);
  await wait(1.2);
  await N(['这件事，丹没有告诉青。'], { ...o, x: mid, y: L.H * .3, hold: 5 });
  await wait(1.4);
  await Tw.to(S, 'crackBack', .55, 5);
}

// ---------- 全 ----------
async function ch8() {
  const S = E.S;
  S.gap = 0; S.tilt = 0;
  A.droneSet(.012, 0, 5);
  Tw.to(S, 'crackBack', .12, 6);
  Tw.to(S, 'txGlow', 1, 3);
  await Tw.to(S, 'room', .03, 7);
  const d = small('二〇二五年三月九日　星期日', { ink: INK.sumi, y: L.H * .05 });
  await wait(1.6);
  const clock = T.add(['03:12'], { horizontal: true, size: L.u * 4.1, x: L.W * .5, y: L.H * .115, ay: .5, font: FONT.fang, ink: INK.grey, halo: 0, spacing: L.u * .3 });
  clock.rev = 0; await Tw.to(clock, 'rev', 1, .6, 'lin');
  await wait(3.4, { noskip: true });
  const m = T.add(['在吗'], { font: FONT.kai, size: L.u * 5, x: L.W * .5 - L.u * 7, y: L.H * .5, ax: .5, ay: .5, ink: INK.qing });
  m.rev = 0; Tw.to(m, 'rev', 1, .8, 'lin');
  A.pluck(64, { g: .5, send: 1, pan: -.1, cents: 0 });
  await wait(1.1, { noskip: true });
  A.buzz(4);
  await wait(1.2, { noskip: true });
  Ptr.mode = 'none';
  if (FILM) await wait(3, { noskip: true, exact: true });
  else {
    const h = small('按下去', { y: L.H * .9, size: L.date * 1.2, ink: INK.sumi, halo: 0 });
    let pul = true;
    (async () => { let k = 0; while (pul) { h.a = .55 + .45 * Math.sin(k); k += .13; await wait(.03, { noskip: true }); } })();
    await press();
    pul = false; T.remove(h);
  }
  const a = T.add(['在'], { font: FONT.kai, size: L.u * 5, x: L.W * .5 + L.u * 7, y: L.H * .5, ax: .5, ay: .5, ink: INK.dan });
  a.rev = 0; Tw.to(a, 'rev', 1, .22, 'lin');
  A.pluck(57, { g: .7, send: 1, cents: 0, pan: .1 });
  const l = lat('回复用时 4 秒');
  await wait(2.6, { noskip: true });
  // 翻转
  A.chordOn(9, .2);
  S.frozen = false; S.diff = 0; S.age = 0; S.soil = 0; S.shear = 0; S.wetDiff = .02; S.wetDecay = .4; S.damp = .55;
  Tw.to(S, 'dry', 0, 4); Tw.to(S, 'gain', .64, 6); Tw.to(S, 'bloom', .7, 6);
  Tw.to(S, 'crackBack', 1.4, 2.4);
  await Tw.to(S, 'flip', 1, 7, 'io');
  Tw.to(S, 'crackBack', 0, 5); Tw.to(S, 'crackVis', 0, 6); Tw.to(S, 'seam', 0, 6);
  S.swirl = 1.4;
  A.droneCut(3);
  hide(a, 2); hide(m, 2); hide(l, 2); hide(clock, 2); hide(d, 2);
  // 一串弦从高处落下来
  [86, 83, 81, 78, 76, 74, 71, 69, 66, 64, 62, 57].forEach((n, i) => A.pluck(n, { g: .24, send: 1, cents: 0, at: i * .17 + Math.random() * .03, pan: (i % 2 ? .4 : -.4), tone: 4200 }));
  await wait(4.6);
  await chapter('全', { note: 38, size: 15, hold: 1, ink: [.4, .4, .9] });
  const o = { x: L.W * .945, y: L.H * .13, ink: [.3, .3, .85] };
  await N(['同样两个颜色。'], { ...o, hold: 3.2 });
  await N(['颜料是红的，因为它把别的光都吞了。', '两种颜料混在一起，光被吞尽，黑。'], { ...o, hold: 7 });
  await N(['光是红的，因为它给出红。', '两束光混在一起，什么都有了，白。'], { ...o, hold: 7 });
  await wait(.6);
  await N(['刚才最黑的地方，现在最亮。'], { ...o, hold: 4.4 });
  await N(['那是两个人重叠得最多的地方。'], { ...o, hold: 5.4 });
  await wait(.8);
  Ptr.mode = 'light';
  setHand(t => [.5 + .36 / E.Af * Math.cos(t * .7), .5 + .36 * Math.sin(t * .7)], 8);
  await N(['同样的手势。', '再搅一搅。'], { ...o, hold: 10 });
  await N(['断了的笔画接上就好，不添新的。', '修复这一行有条规矩：', '一米八外看不出，十五厘米内看得出。'], { ...o, hold: 7.6 });
  Ptr.mode = 'lens';
  setHand(t => [.5 + .03 * Math.sin(t * .5), .5 + .3 * Math.sin(t * .42)], 9);
  S.lens = [.5, .5, .15, 0]; Tw.to(S.lens, 3, 1, 1);
  S.swirl = .8;
  await N(FILM ? ['凑近看。'] : ['把手放到画上，凑近看。'], { ...o, hold: 9 });
  await N(['那条缝留着。'], { ...o, hold: 4 });
  await Tw.to(S.lens, 3, 0, 1.4);
  Ptr.mode = 'light'; S.swirl = 1.2;
  await wait(.8);
  await N(['两个人没有回到十五岁。', '这是第二段了。'], { ...o, hold: 6.4 });
  await wait(1.6);
}

// ---------- 终 ----------
async function ending() {
  const S = E.S;
  Ptr.mode = 'none'; S.brush[3] = 0;
  A.chordLevel(.09, 9);
  Tw.to(S, 'voidA', .82, 9); Tw.to(S, 'bloom', .4, 9);
  await wait(6, { noskip: true });
  const c = { x: L.W * .5 + L.narr * .1, ax: .5, y: L.H * .24, ink: [.2, .2, .8], size: L.narr * 1.15 };
  await N(['刚才有一个名字，', '从你脑子里闪过去了。'], { ...c, x: L.W * .5 + L.narr * 1.2, hold: 6.6 });
  await wait(1);
  await N(['这一页不知道是谁，', '什么也不记录。'], { ...c, x: L.W * .5 + L.narr * 1.2, hold: 5 });
  await wait(1);
  await N(['有些纸补不回来。', '你能做的，只有你这一半。'], { ...c, x: L.W * .5 + L.narr * 1.2, hold: 6 });
  await wait(1.4);
  await N(['两个字就够了。'], { ...c, hold: 3.6 });
  await wait(.6);
  const size = L.u * 8;
  const z = T.add(['在吗'], { font: FONT.kai, size, x: L.W * .5, y: L.H * .43, ax: .5, ay: .5, ink: [.7, .7, 1], lh: size * 1.25, halo: 0 });
  z.rev = 0; await Tw.to(z, 'rev', 1, 1.6, 'lin');
  A.pluck(64, { g: .36, send: 1, cents: 0 });
  await wait(1.2);
  if (FILM) { await wait(7, { noskip: true }); await hide(z, 2.4); await colophon(); return; }
  const btn = document.getElementById('cta'); btn.hidden = false;
  requestAnimationFrame(() => btn.classList.add('on'));
  await new Promise(res => {
    btn.onclick = () => {
      const ok = () => { btn.textContent = '已复制'; btn.disabled = true; res(); };
      try { navigator.clipboard.writeText('在吗').then(ok, () => { btn.textContent = '在吗'; res(); }); } catch (e) { btn.textContent = '在吗'; res(); }
    };
    wait(38, { noskip: true }).then(res);
  });
  A.pluck(57, { g: .3, send: 1, cents: 0 });
  await wait(2.4, { noskip: true });
  btn.classList.remove('on');
  await hide(z, 2.4);
  btn.hidden = true;
  await colophon();
}
async function colophon() {
  const S = E.S;
  A.chordLevel(.05, 8);
  const lines = [
    '丹青初则炳，久则渝。　扬雄《法言·君子》',
    '风雨急而不辍其音，霜雪零而不渝其色。　刘孝标《广绝交论》',
    '洗、揭、补、全，是中国书画修复的四道工序。',
    '远看一致，近看有别，是文物修复的可识别原则。',
    '余色即补色。红与青相加成白，相混成黑。',
    ...(FILM ? ['纸上的颜料按 Kubelka–Munk 模型计算，全片没有一帧手绘。'] : ['纸上的颜料按 Kubelka–Munk 模型实时计算，', '这张画是你的手搅出来的，世上只此一张。']),
  ];
  const sp = T.add(lines, { font: FONT.fang, size: L.date * (L.wide ? 1.05 : .9), x: L.W * .5, y: L.H * .5, ax: .5, ay: .5, ink: [.1, .1, .62], gap: L.date * 2.5, halo: 0 });
  sp.rev = 0; sp.dir = 1; await Tw.to(sp, 'rev', 1, 5, 'lin');
  await wait(7);
  await hide(sp, 1.6);
  await wait(.8);
  const e1 = T.add(['丹和青是虚构的。'], { font: FONT.kai, size: L.chat * 1.05, x: L.W * .5 + L.chat * 1.15, y: L.H * .5, ax: .5, ay: .5, ink: [.5, .5, 1], halo: 0 });
  e1.rev = 0; await Tw.to(e1, 'rev', 1, 1.2, 'lin');
  await wait(2.8, { noskip: true });
  const e2 = T.add(['你想到的那个人不是。'], { font: FONT.kai, size: L.chat * 1.05, x: L.W * .5 - L.chat * 1.15, y: L.H * .5, ax: .5, ay: .5, ink: [.5, .5, 1], halo: 0 });
  e2.rev = 0; await Tw.to(e2, 'rev', 1, 1.3, 'lin');
  await wait(7, { noskip: true });
  A.setMaster(0, 7);
  Tw.to(S, 'voidA', 1, 6);
  hide(e1, 5); await hide(e2, 5);
  await wait(3, { noskip: true });
  if (Q.rec) { window.__finished = true; return; }
  const again = small('按一下，从头再来', { size: L.date, y: L.H * .5, ink: [.1, .1, .5], halo: 0 });
  await press();
  location.reload();
}

// ---------- 调试跳转 ----------
function seedRings(n = 66) {
  const ink = i => [[1, 0, 0, 0], [0, 0, 0, 0], [0, 1, 0, 0]][i % 3];
  for (let i = 0; i < n; i++) { E.drop({ x: CX + (Math.random() - .5) * .02, y: CY + (Math.random() - .5) * .02, r: (.05 + Math.random() * .03) * RS * (i % 3 === 1 ? .6 : 1), ink: ink(i), dur: .22 }); E.fast(14); }
}
function seedHollow() { for (let i = 0; i < 4; i++) { E.drop({ x: CX, y: CY, r: .085 * RS, ink: [0, 0, 0, 0], dur: .3 }); E.fast(20); } }
function seedAged() { const S = E.S; S.feather = .4; S.diff = .002; S.age = 1.05; S.wetDiff = 0; E.fast(110); S.feather = 0; S.diff = 0; S.age = 0; S.wetDiff = .5; }

async function main() {
  const S = E.S;
  RS = Math.sqrt(E.Af / 1.6);
  const ch = Q.ch;
  if (!ch) {
    await gate(); await ch1(); await ch2(); await nightScene(); await ch3(); await ch4(); await ch4b(); await ch5(); await ch6(); await ch7(); await ch8(); await ending();
    return;
  }
  A.init();
  const dryState = () => { S.dry = 1; S.wet = 0; S.frozen = true; S.crackT = 1.12; S.seam = 1; };
  const order = ['burst', 'yu', 'night', 'dry', 'gap', 'stare', 'wash', 'jie', 'bu', 'quan', 'end'];
  const at = order.indexOf(ch);
  Ptr.mode = 'stir';
  if (at >= 1) seedRings();
  if (at >= 2) { seedHollow(); seedAged(); }
  if (at >= 4) { dryState(); S.gap = .15 * E.Af; S.tilt = .03; S.room = .62; S.txGlow = .3; }
  if (at >= 5) { S.dustA = 1; }
  if (at >= 6) { S.plain = 1; S.room = 1; S.txGlow = 0; S.dustA = 0; }
  if (at >= 7) { S.plain = 0; S.room = .78; S.dustA = 0; }
  if (at >= 9) { S.gap = 0; S.tilt = 0; S.room = .34; S.crackBack = .55; S.txGlow = 1; }
  if (at >= 10) { S.flip = 1; S.gain = .64; S.bloom = .7; S.dry = 0; S.frozen = false; S.swirl = 1.2; S.crackVis = 0; S.seam = 0; S.crackBack = 0; S.damp = .55; S.wetDiff = .02; }
  const seq = [ch1b, ch2, nightScene, ch3, ch4, ch4b, ch5, ch6, ch7, ch8, ending].slice(at < 0 ? 0 : at);
  if (Q.hold) return; // 只摆场景，不往下走
  for (const f of seq) await f();
}
async function ch1b() { seedRings(30); await burst(); }

// ---------- 帧循环 ----------
let waterTick = 0;
function pointerStep(dt) {
  const S = E.S, m = Ptr.mode;
  const dx = Ptr.x - Ptr.px, dy = Ptr.y - Ptr.py, sp = Math.hypot(dx, dy);
  const f = E.s2f(Ptr.x, Ptr.y), fp = E.s2f(Ptr.px, Ptr.py);
  const target = (m === 'none' || m === 'lens' || FILM) ? 0 : .8;
  S.brush[3] += (target - S.brush[3]) * Math.min(1, dt * 6);
  S.brush[0] = f[0] * E.Af; S.brush[1] = f[1]; S.brush[2] = m === 'wash' ? .05 : .018;
  if (sp > 0 && !S.frozen) {
    if (m === 'stir') { const wk = Ptr.weak || 1; if (Ptr.held) { E.stir(fp[0], fp[1], f[0], f[1], .62 * wk, .0014); Ptr.stirred += sp; } else { E.stir(fp[0], fp[1], f[0], f[1], .24 * wk, .0009); Ptr.stirred += sp * .5; } }
    if (m === 'light') {
      E.stir(fp[0], fp[1], f[0], f[1], FILM ? .3 : .42, .0009);
      const w = Math.min(1, sp * 40);
      E.splatD(f[0], f[1], f[0] > .5 ? [.11 * w, 0, 0, 0] : [0, .11 * w, 0, 0], .00016);
      A.harp(Ptr.x, Ptr.y, sp);
    }
  }
  if (m === 'wash' && sp > 0) {
    const g = S.gap, th = S.tilt, px = f[0] * E.Af, py = f[1];
    const left = px < .5 * E.Af;
    const qx = left ? px + g + th * (py - .5) : px - g - th * (py - .5);
    E.wipe(qx / E.Af, py, .0075, .22);
    Ptr.washed += sp * 3;
    if (Math.random() < .3) A.plink((Ptr.x - .5) * 1.2, 1300 + Math.random() * 900, .03);
  }
  waterTick = (waterTick + 1) % (FILM ? 10 : 4); if (waterTick === 0) A.water(!S.frozen && (m === 'stir' || m === 'light') || m === 'wash' ? sp : 0);
  if (m === 'lens') { S.lens[0] += (f[0] - S.lens[0]) * .2; S.lens[1] += (f[1] - S.lens[1]) * .2; }
  Ptr.px = Ptr.x; Ptr.py = Ptr.y;
}
// 自动模式下的手：沿一条慢慢漂移的曲线划过纸面
let autoT = 0, handFn = null;
function setHand(fn, sec) { if (!FILM) return; handFn = fn; if (sec) wait(sec, { noskip: true, exact: true }).then(() => { if (handFn === fn) handFn = null; }); }
function autoHand(dt) {
  autoT += dt;
  if (FILM) {
    Ptr.held = !!holdTask;
    if (handFn) { const p = handFn(autoT); Ptr.x = p[0]; Ptr.y = p[1]; Ptr.held = true; }
    return;
  }
  const m = Ptr.mode, on = m === 'stir' || m === 'light' || m === 'wash' || m === 'lens';
  const burstOn = Math.sin(autoT * .31) > .55;
  Ptr.held = !!holdTask || (on && burstOn);
  if (on && burstOn) { Ptr.x = .5 + .34 * Math.sin(autoT * .47) * Math.cos(autoT * .13); Ptr.y = .5 + .38 * Math.sin(autoT * .61 + 1.1); }
}
function frame(dt) {
  if (Q.auto) autoHand(dt);
  Clock.step(dt); Tw.step(dt * SPEED); if (holdTask) holdTask(dt);
  pointerStep(dt); snowStep(dt);
  if (cracking && Math.random() < .28) { A.tick((Math.random() - .5) * 1.4, .02 + Math.random() * .07); }
  E.step(dt);
  E.render(T.list);
}
