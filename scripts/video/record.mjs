/**
 * Last Bite walkthrough video recorder.
 *
 * Drives the running app with Playwright, captures frames via the Chrome
 * DevTools screencast, generates the voice-over with Kokoro TTS, and muxes
 * everything into an MP4 with ffmpeg. No captions are burned in or attached.
 *
 * Usage:
 *   npm run dev                       # app on http://localhost:3000
 *   node scripts/video/record.mjs customer|restaurant [--url http://localhost:3000]
 *
 * Requires: playwright (Chromium), ffmpeg (FFMPEG env or on PATH),
 * and a Python with kokoro-onnx + soundfile (TTS_PYTHON env), plus the
 * Kokoro model files (KOKORO_MODEL / KOKORO_VOICES env). See README.md.
 */

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES } from './scenes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const which = process.argv[2];
if (!SCENES[which]) {
  console.error(`Usage: node scripts/video/record.mjs <${Object.keys(SCENES).join('|')}> [--url URL]`);
  process.exit(1);
}
const urlArg = process.argv.indexOf('--url');
const BASE = urlArg > -1 ? process.argv[urlArg + 1] : 'http://localhost:3000';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const TTS_PYTHON = process.env.TTS_PYTHON || 'python3';
const VOICE = process.env.VOICE || 'af_heart';
const WIDTH = 1280;
const HEIGHT = 720;
const SCALE = 1.5; // 1920x1080 output

const work = path.join(process.env.VIDEO_WORK_DIR || path.join(root, '.video-work'), which);
const framesDir = path.join(work, 'frames');
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

// ---------------------------------------------------------------- voice-over
function synthesize(scenes) {
  const lines = scenes.map((s, i) => ({ text: s.say, out: path.join(work, `vo-${i}.wav`) }));
  fs.writeFileSync(path.join(work, 'lines.json'), JSON.stringify(lines));
  const out = execFileSync(TTS_PYTHON, [path.join(here, 'tts.py'), path.join(work, 'lines.json'), VOICE], {
    encoding: 'utf8',
    env: process.env,
  });
  return JSON.parse(out.trim().split('\n').pop()); // [{ out, seconds }]
}

// ------------------------------------------------------------ on-screen cursor
const OVERLAY = `
(() => {
  if (window.__lb) return;
  const css = document.createElement('style');
  css.textContent = \`
    #lb-cursor { position: fixed; z-index: 2147483647; left: 0; top: 0; width: 26px; height: 26px;
      margin: -4px 0 0 -4px; pointer-events: none; transition: transform .7s cubic-bezier(.45,.05,.25,1);
      filter: drop-shadow(0 3px 6px rgba(0,0,0,.6)); }
    .lb-ripple { position: fixed; z-index: 2147483646; width: 16px; height: 16px; margin: -8px 0 0 -8px;
      border-radius: 50%; border: 3px solid #ff6b00; pointer-events: none; animation: lbRipple .6s ease-out forwards; }
    @keyframes lbRipple { to { transform: scale(4); opacity: 0 } }
    .lb-ring { position: fixed; z-index: 2147483645; pointer-events: none; border-radius: 18px;
      border: 3px solid #ff6b00; box-shadow: 0 0 0 9999px rgba(18,19,22,.45), 0 0 24px 4px rgba(255,107,0,.55);
      animation: lbRing 1.4s ease-in-out infinite; transition: opacity .35s; }
    @keyframes lbRing { 50% { box-shadow: 0 0 0 9999px rgba(18,19,22,.45), 0 0 36px 10px rgba(255,107,0,.35) } }
  \`;
  document.head.appendChild(css);
  const c = document.createElement('div');
  c.id = 'lb-cursor';
  c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l16 9-7 1.6L9.6 20z" fill="#fff" stroke="#121316" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
  window.__lb = {
    move(x, y, ms = 700) { c.style.transitionDuration = ms + 'ms'; c.style.transform = \`translate(\${x}px, \${y}px)\`; },
    ripple(x, y) { const r = document.createElement('div'); r.className = 'lb-ripple';
      r.style.left = x + 'px'; r.style.top = y + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 700); },
    ring(x, y, w, h) { this.unring(); const r = document.createElement('div'); r.className = 'lb-ring';
      r.style.left = (x - 8) + 'px'; r.style.top = (y - 8) + 'px'; r.style.width = (w + 16) + 'px'; r.style.height = (h + 16) + 'px';
      document.body.appendChild(r); },
    unring() { document.querySelectorAll('.lb-ring').forEach((r) => { r.style.opacity = 0; setTimeout(() => r.remove(), 350); }); },
  };
  window.__lb.move(innerWidth * 0.62, innerHeight * 0.7);
})();
`;

function makeDriver(page) {
  const sleep = (ms) => page.waitForTimeout(ms);
  const ensureOverlay = () => page.evaluate(OVERLAY);
  async function box(target) {
    const loc = typeof target === 'string' ? page.locator(target).first() : target.first();
    // Measure directly: highlights should not wait for animations to settle
    const b = await loc.evaluate((el) => {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    return { loc, b };
  }
  return {
    page,
    sleep,
    ensureOverlay,
    async goto(url, { cursor = true } = {}) {
      await page.goto(url.startsWith('http') ? url : BASE + url, { waitUntil: 'load' });
      if (cursor) await ensureOverlay();
    },
    async point(target) {
      await ensureOverlay();
      const { b } = await box(target);
      await page.evaluate(([x, y]) => window.__lb.move(x, y), [b.x + b.width / 2, b.y + b.height / 2]);
      await sleep(750);
    },
    async click(target, pause = 450, travel = 700) {
      await ensureOverlay();
      const { loc, b } = await box(target);
      const x = b.x + b.width / 2;
      const y = b.y + b.height / 2;
      await page.evaluate(([x, y, ms]) => window.__lb.move(x, y, ms), [x, y, travel]);
      await sleep(travel + 50);
      await page.evaluate(([x, y]) => window.__lb.ripple(x, y), [x, y]);
      await loc.click();
      await sleep(pause);
    },
    async ring(target, hold = 0) {
      await ensureOverlay();
      const { b } = await box(target);
      await page.evaluate(([x, y, w, h]) => window.__lb.ring(x, y, w, h), [b.x, b.y, b.width, b.height]);
      if (hold) await sleep(hold);
    },
    async unring() {
      await page.evaluate(() => window.__lb && window.__lb.unring());
    },
  };
}

// ------------------------------------------------------------------- record
const scenes = SCENES[which].scenes;
console.log(`Synthesizing ${scenes.length} voice-over lines...`);
const voice = synthesize(scenes);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: SCALE,
  // Geolocation is not granted, so the app uses its Downtown St. John's default
});
const page = await context.newPage();
const helper = await context.newPage(); // second "customer device" for the restaurant demo
await page.bringToFront();

const cdp = await context.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const file = path.join(framesDir, `f${String(frames.length).padStart(6, '0')}.jpg`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  frames.push({ file, t: metadata.timestamp });
  try {
    await cdp.send('Page.screencastFrameAck', { sessionId });
  } catch {
    // session closed
  }
});

const drv = makeDriver(page);
await page.setContent('<body style="margin:0;background:#121316"></body>');
await SCENES[which].setup?.({ drv, helper, base: BASE });

await cdp.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 88,
  maxWidth: WIDTH * SCALE,
  maxHeight: HEIGHT * SCALE,
  everyNthFrame: 1,
});

const t0 = Date.now() / 1000;
const timeline = [];
for (let i = 0; i < scenes.length; i++) {
  const scene = scenes[i];
  const start = Date.now() / 1000;
  timeline.push({ at: start - t0, audio: voice[i].out, seconds: voice[i].seconds });
  console.log(`Scene ${i + 1}/${scenes.length} (${voice[i].seconds.toFixed(1)}s): ${scene.say}`);
  await scene.run({ drv, helper, base: BASE });
  const minEnd = start + voice[i].seconds + (scene.after ?? 0.6);
  const wait = minEnd - Date.now() / 1000;
  if (wait > 0) await page.waitForTimeout(wait * 1000);
}
const tEnd = Date.now() / 1000;
await cdp.send('Page.stopScreencast');
await browser.close();

// -------------------------------------------------------------------- encode
// Frames arrive only when the screen changes; hold each one until the next.
const duration = tEnd - t0;
const usable = frames.filter((f) => f.t >= t0 - 1);
const lines = [];
for (let i = 0; i < usable.length; i++) {
  const start = Math.max(usable[i].t, t0);
  const next = i + 1 < usable.length ? Math.max(usable[i + 1].t, t0) : tEnd;
  if (next <= start && i + 1 < usable.length) continue;
  lines.push(`file '${usable[i].file}'`, `duration ${Math.max(next - start, 0.001).toFixed(4)}`);
}
lines.push(`file '${usable[usable.length - 1].file}'`);
fs.writeFileSync(path.join(work, 'frames.txt'), lines.join('\n'));

const audioInputs = [];
const filters = [];
timeline.forEach((s, i) => {
  audioInputs.push('-i', s.audio);
  const ms = Math.round(s.at * 1000 + 250);
  filters.push(`[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`);
});
filters.push(`${timeline.map((_, i) => `[a${i}]`).join('')}amix=inputs=${timeline.length}:normalize=0,apad[aout]`);

const outDir = path.join(root, 'public', 'videos');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, SCENES[which].file);
execFileSync(FFMPEG, [
  '-y', '-loglevel', 'error',
  '-f', 'concat', '-safe', '0', '-i', path.join(work, 'frames.txt'),
  ...audioInputs,
  '-filter_complex', filters.join(';'),
  '-map', '0:v', '-map', '[aout]',
  '-vf', `scale=${WIDTH * SCALE}:${HEIGHT * SCALE}:flags=lanczos,fps=30,format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-tune', 'animation',
  '-c:a', 'aac', '-b:a', '160k',
  '-t', duration.toFixed(2),
  '-movflags', '+faststart',
  outFile,
], { stdio: 'inherit' });

// Poster frame from the first second of the app footage
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(SCENES[which].posterAt ?? 4), '-i', outFile,
  '-frames:v', '1', '-vf', 'scale=1280:-1', '-q:v', '4', outFile.replace(/\.mp4$/, '.jpg')]);

console.log(`\nWrote ${path.relative(root, outFile)} (${duration.toFixed(1)}s, ${frames.length} frames)`);
