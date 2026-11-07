// 本地抓帧服务：存单帧用来检查；pipe 模式把画面直接送进 ffmpeg 编码
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const dir = process.argv[2] || '/tmp/yuse-cap';
fs.mkdirSync(dir, { recursive: true });
let ff = null, count = 0;
http.createServer((q, r) => {
  r.setHeader('Access-Control-Allow-Origin', '*');
  r.setHeader('Access-Control-Allow-Headers', '*');
  if (q.method === 'OPTIONS') { r.end(); return; }
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/log') { console.log(decodeURIComponent(u.search.slice(1))); r.end('ok'); return; }
  if (u.pathname === '/pipe/start') {
    const out = path.join(dir, path.basename(u.searchParams.get('out') || 'film.mp4'));
    ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', u.searchParams.get('fps') || '30', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    count = 0; console.log('pipe start', out); r.end('ok'); return;
  }
  if (u.pathname === '/pipe/frame') {
    const chunks = [];
    q.on('data', c => chunks.push(c));
    q.on('end', () => { const b = Buffer.concat(chunks); count++; if (count % 900 === 0) console.log('frames', count); if (ff.stdin.write(b)) r.end('ok'); else ff.stdin.once('drain', () => r.end('ok')); });
    return;
  }
  if (u.pathname === '/pipe/end') { ff.stdin.end(); ff.on('close', c => { console.log('pipe closed', c, count); }); r.end('ok'); return; }
  const name = path.basename(u.searchParams.get('name') || 'x.jpg');
  if (u.pathname === '/file') { fs.createReadStream(path.join(dir, name)).pipe(r); return; }
  const out = fs.createWriteStream(path.join(dir, name));
  q.pipe(out); out.on('finish', () => r.end('ok'));
}).listen(8732, '127.0.0.1', () => console.log('capture ->', dir));
