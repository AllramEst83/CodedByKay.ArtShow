#!/usr/bin/env node
// Dev-only regression check for the gallery. Not part of the published site
// and it adds no runtime dependency: it serves the repo with a Netlify-style
// SPA fallback and drives a locally installed Chrome/Chromium over the DevTools
// protocol (Node 22+ for the global WebSocket/fetch).
//
//   node scripts/verify.mjs [--out <dir>] [--chrome <path>] [--keep]
//
// Per wall (dark/gray/paper) x width (375/768/1440) it loads /, /collections,
// /collections/<slug> and /art/<id>, saves screenshots, and asserts: no console
// errors, no horizontal scroll, exactly one h1, deep link opens the viewer and
// Escape closes it. It also checks the app boots with localStorage throwing,
// that no hex colours live outside css/tokens.css, and (coarse pointer) that
// interactive controls are at least 44px.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const OUT = path.resolve(argOf('--out') || path.join(os.tmpdir(), 'artshow-verify'));
const WALLS = ['dark', 'gray', 'paper'];
const WIDTHS = [375, 768, 1440];

const CHROME_CANDIDATES = [
  argOf('--chrome'),
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const failures = [];
const passes = [];
function check(name, ok, detail = '') {
  (ok ? passes : failures).push(`${name}${detail ? ` — ${detail}` : ''}`);
}

// ─── Static server with SPA fallback ──────────────────────────────────────────

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const isAsset = /\.[a-z0-9]+$/i.test(url.pathname);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (isAsset) { res.writeHead(404); return res.end(); }
      file = path.join(ROOT, 'index.html');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ─── Minimal CDP client ───────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchChrome() {
  const chrome = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error('No Chrome/Chromium found. Pass --chrome <path> or set CHROME_PATH.');
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'artshow-chrome-'));
  const proc = spawn(chrome, [
    '--headless=new', `--remote-debugging-port=${port}`, '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  let targets = [];
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      if (targets.some((t) => t.type === 'page')) break;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  const target = targets.find((t) => t.type === 'page');
  if (!target) throw new Error('Chrome did not expose a page target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let nextId = 0;
  const pending = new Map();
  const consoleIssues = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleIssues.push(`exception: ${d.exception?.description || d.text}`);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleIssues.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      // Ignore third-party font/image failures when offline; the app's own
      // failures are caught by exceptions / console.error above.
      if (!/fonts\.(googleapis|gstatic)|kaysartshow\.fyi|favicon/.test(msg.params.entry.url || '')) {
        consoleIssues.push(`log: ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
      }
    }
  };

  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');

  return {
    send,
    consoleIssues,
    async evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) {
        throw new Error(r.result.exceptionDetails.exception?.description || 'evaluate failed');
      }
      return r.result.result.value;
    },
    async close() {
      try { ws.close(); } catch { /* ignore */ }
      proc.kill();
      await sleep(300);
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

// ─── Checks ───────────────────────────────────────────────────────────────────

function checkTokensOnly() {
  const hex = /#[0-9a-fA-F]{3,8}\b/g;
  ['styles.css', 'browse.css', 'viewer.css'].forEach((name) => {
    const text = fs.readFileSync(path.join(ROOT, 'css', name), 'utf8');
    const hits = text.split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => hex.test(line.replace(/\/\*.*?\*\//g, '')) && !line.includes('&#'));
    hex.lastIndex = 0;
    check(`no hex colours in css/${name}`, hits.length === 0,
      hits.slice(0, 3).map((h) => `L${h.n}: ${h.line.trim()}`).join(' | '));
  });
}

async function openPage(browser, base, route, { wall, width, height = 900, mobile = false, breakStorage = false }) {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile,
  });
  await browser.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', {
    source: breakStorage
      ? `Storage.prototype.getItem = Storage.prototype.setItem = Storage.prototype.removeItem = function () { throw new Error('storage blocked'); };`
      : `try { localStorage.setItem('artshow_wall', JSON.stringify('${wall}')); } catch (e) {}`,
  });
  browser.consoleIssues.length = 0;
  await browser.send('Page.navigate', { url: base + route });
  // Wait for the app to finish booting (page loader removed, a view rendered).
  for (let i = 0; i < 60; i++) {
    const ready = await browser.evaluate(
      `!document.getElementById('page-loader') && !!document.querySelector('#view h1, #viewer[open]')`);
    if (ready) break;
    await sleep(250);
  }
  await sleep(500);
}

async function screenshot(browser, name) {
  const r = await browser.send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.result.data, 'base64'));
}

async function pressEscape(browser) {
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', windowsVirtualKeyCode: 27 });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(500);
}

async function main() {
  checkTokensOnly();

  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'artwork.json'), 'utf8'));
  const firstId = String(data[0].id);
  const firstGroup = (data.find((a) => a.groups && a.groups.length) || {}).groups?.[0] || 'x';
  const slug = firstGroup.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchChrome();

  try {
    const routes = [
      ['home', '/'],
      ['collections', '/collections'],
      ['collection', `/collections/${slug}`],
      ['art', `/art/${firstId}`],
    ];

    for (const wall of WALLS) {
      for (const width of WIDTHS) {
        for (const [name, route] of routes) {
          const label = `${name} @${width} ${wall}`;
          await openPage(browser, base, route, { wall, width, mobile: width < 768 });
          await screenshot(browser, `${name}-${width}-${wall}`);

          check(`${label}: no console errors`, browser.consoleIssues.length === 0, browser.consoleIssues[0]);
          check(`${label}: no horizontal scroll`,
            await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'));
          check(`${label}: wall applied`,
            (await browser.evaluate(`document.documentElement.dataset.wall`)) === wall);
          check(`${label}: one h1 in view`,
            (await browser.evaluate(`document.querySelectorAll('#view h1').length`)) === 1);

          if (name === 'art') {
            check(`${label}: deep link opens viewer`, await browser.evaluate(`document.getElementById('viewer').open`));
            await pressEscape(browser);
            check(`${label}: Escape closes viewer and restores /`,
              !(await browser.evaluate(`document.getElementById('viewer').open`)) &&
              (await browser.evaluate('location.pathname')) === '/');
          }
        }
      }
    }

    // Boots with localStorage blocked
    await openPage(browser, base, '/', { wall: 'dark', width: 1440, breakStorage: true });
    check('boots with localStorage throwing',
      (await browser.evaluate(`document.querySelectorAll('#view .art-card').length`)) > 0,
      browser.consoleIssues[0]);

    // Touch targets on a coarse pointer
    await openPage(browser, base, '/', { wall: 'dark', width: 390, height: 844, mobile: true });
    await browser.evaluate(`document.querySelector('.toolbar__btn')?.click()`);
    const small = await browser.evaluate(`(() => {
      const sel = '.app-header a, .app-header button, .toolbar button, .facet__toggle, .segmented__btn';
      return [...document.querySelectorAll(sel)]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width < 44 || r.height < 44)
        .map(({ el, r }) => (el.id || el.className || el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height))
        .slice(0, 5);
    })()`);
    check('touch targets >= 44px (header + toolbar + facets)', small.length === 0, small.join('; '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n${passes.length} passed, ${failures.length} failed`);
  failures.forEach((f) => console.log(`  FAIL ${f}`));
  console.log(`Screenshots: ${OUT}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
