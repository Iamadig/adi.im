import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type CdpResult<T = unknown> = { result?: T; error?: { message: string } };

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = process.env.TEARABLE_TEST_URL || 'http://127.0.0.1:3000/';
const EXPECTED_CLOTH_BACKEND = TARGET_URL.includes('wasmCloth=0') ? 'typescript' : 'wasm';
const PORT = Number(process.env.TEARABLE_CDP_PORT || 9300 + Math.floor(Math.random() * 500));

if (!existsSync(CHROME_PATH)) {
  throw new Error(`Chrome not found at ${CHROME_PATH}. Set CHROME_PATH to run the browser smoke test.`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const profileDir = mkdtempSync(join(tmpdir(), 'tearable-smoke-'));
const chrome = spawn(CHROME_PATH, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--window-size=1280,720',
  'about:blank',
], { stdio: 'ignore' });

async function waitForJson() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json`);
      if (response.ok) return response.json() as Promise<Array<{ type: string; webSocketDebuggerUrl?: string }>>;
    } catch {}
    await sleep(100);
  }
  throw new Error('Chrome DevTools endpoint did not become available.');
}

async function main() {
  const tabs = await waitForJson();
  const page = tabs.find((tab) => tab.type === 'page') ?? tabs[0];
  assert.ok(page?.webSocketDebuggerUrl, 'Chrome page websocket should exist');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map<number, { resolve: (value: CdpResult<any>) => void; reject: (error: Error) => void }>();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data.toString());
    if (!message.id || !pending.has(message.id)) return;
    const waiter = pending.get(message.id)!;
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message);
  });
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), { once: true });
    ws.addEventListener('error', () => reject(new Error('Chrome websocket failed')), { once: true });
  });

  const send = <T = unknown>(method: string, params: Record<string, unknown> = {}) => {
    const messageId = ++id;
    ws.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise<CdpResult<T>>((resolve, reject) => pending.set(messageId, { resolve, reject }));
  };
  const evaluate = async <T>(expression: string) => {
    const response = await send<{ result: { value: T } }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return response.result!.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.bringToFront');
  await send('Page.navigate', { url: TARGET_URL });
  await sleep(4200);

  const before = await evaluate<{ state: { section: string; passives: number; activeWorker?: { supported: boolean; enabled: boolean; ready: boolean; backend?: string } } | null; hintRect: { top: number; bottom: number }; innerHeight: number }>(`(() => ({
    state: typeof window.__tearState === 'function' ? window.__tearState() : null,
    hintRect: (() => {
      const rect = document.querySelector('.tearable-page-hint')?.getBoundingClientRect();
      return rect ? { top: rect.top, bottom: rect.bottom } : { top: -1, bottom: -1 };
    })(),
    innerHeight
  }))()`);
  assert.equal(before.state?.section, 'About Me', 'smoke test should start on About Me');
  assert.equal(before.state?.passives, 0, 'initial page should have no falling sheets');
  assert.ok(
    !before.state?.activeWorker?.supported || (before.state.activeWorker.enabled && before.state.activeWorker.ready),
    'active sheet should initialize the active cloth worker when Worker is available',
  );
  assert.equal(before.state?.activeWorker?.backend, EXPECTED_CLOTH_BACKEND, `active cloth worker should use ${EXPECTED_CLOTH_BACKEND}`);
  assert.ok(before.hintRect.top >= 0 && before.hintRect.bottom <= before.innerHeight + 1, 'desktop bottom hint should stay visible');

  await send('Runtime.evaluate', {
    expression: `window.__tearSmokeOpenedHref = null; window.open = (href) => { window.__tearSmokeOpenedHref = href; return null; };`,
    returnByValue: true,
  });
  const firstLinkClick = await evaluate<{ x: number; y: number }>(`(() => {
    const state = window.__tearState();
    const region = state.hitRegions.find((hit) => hit.kind === 'link');
    if (!region) throw new Error('missing profile link region');
    const rect = document.querySelector('canvas').getBoundingClientRect();
    return {
      x: rect.left + ((region.x + region.width / 2) / 2048) * rect.width,
      y: rect.top + ((region.y + region.height / 2) / 1152) * rect.height,
    };
  })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: firstLinkClick.x, y: firstLinkClick.y, button: 'none' });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: firstLinkClick.x, y: firstLinkClick.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: firstLinkClick.x, y: firstLinkClick.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(500);
  const afterProtectedClick = await evaluate<{ state: { section: string; passives: number }; openedHref: string | null }>(`(() => ({
    state: window.__tearState(),
    openedHref: window.__tearSmokeOpenedHref
  }))()`);
  assert.equal(afterProtectedClick.state.section, 'About Me', 'clicking a protected link should not navigate cloth layers');
  assert.equal(afterProtectedClick.state.passives, 0, 'clicking a protected link should not tear or create falling sheets');
  assert.ok(afterProtectedClick.openedHref, 'protected link click should still activate the link handler');

  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
  await sleep(700);
  const afterArrowRight = await evaluate<{ state: { section: string; passives: number; hitRegions: Array<{ kind: string }> } }>(`(() => ({ state: window.__tearState() }))()`);
  assert.equal(afterArrowRight.state.section, 'Thoughts', 'ArrowRight should navigate to the next hidden page');
  assert.equal(afterArrowRight.state.passives, 0, 'keyboard navigation should not create falling sheets');
  assert.equal(afterArrowRight.state.hitRegions.filter((region) => region.kind === 'thought').length, 0, 'Thoughts article content should not render or register on the canvas cloth');
  assert.equal(await evaluate(`document.querySelector('.tearable-page-hint') === null`), true, 'Thoughts should hide the bottom hint so it does not cover the article reader');
  const thoughtsReader = await evaluate<{ visible: boolean; scrollHeight: number; clientHeight: number; before: number; x: number; y: number }>(`(() => {
    const reader = document.querySelector('.tearable-thoughts-reader');
    if (!reader) return { visible: false, scrollHeight: 0, clientHeight: 0, before: 0, x: 0, y: 0 };
    const rect = reader.getBoundingClientRect();
    return { visible: rect.width > 0 && rect.height > 0, scrollHeight: reader.scrollHeight, clientHeight: reader.clientHeight, before: reader.scrollTop, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  assert.ok(thoughtsReader.visible, 'Thoughts should expose an article reader');
  assert.ok(thoughtsReader.scrollHeight > thoughtsReader.clientHeight, 'Thoughts article reader should have protected scrollable content');
  const repeatedDescription = await evaluate<boolean>(`document.querySelector('.tearable-thoughts-description') !== null`);
  assert.equal(repeatedDescription, false, 'Thoughts reader should not render an excerpt when it repeats the article opening');
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: thoughtsReader.x, y: thoughtsReader.y, deltaX: 0, deltaY: 260 });
  await sleep(300);
  assert.ok(await evaluate(`document.querySelector('.tearable-thoughts-reader')?.scrollTop > ${thoughtsReader.before}`), 'Thoughts article reader should scroll independently from real wheel input');
  const articleButton = await evaluate<{ x: number; y: number; titleBefore: string | null; buttonText: string | null }>(`(() => {
    const buttons = Array.from(document.querySelectorAll('.tearable-thoughts-list button'));
    const button = buttons[1];
    const rect = button?.getBoundingClientRect();
    return { x: rect ? rect.left + rect.width / 2 : 0, y: rect ? rect.top + rect.height / 2 : 0, titleBefore: document.querySelector('.tearable-thoughts-reader h1')?.textContent ?? null, buttonText: button?.querySelector('span')?.textContent ?? null };
  })()`);
  assert.ok(articleButton.buttonText, 'Thoughts article list should expose a second clickable article');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: articleButton.x, y: articleButton.y, button: 'none' });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: articleButton.x, y: articleButton.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: articleButton.x, y: articleButton.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(500);
  const afterArticleClick = await evaluate<{ title: string | null; state: { section: string; passives: number } }>(`(() => ({ title: document.querySelector('.tearable-thoughts-reader h1')?.textContent ?? null, state: window.__tearState() }))()`);
  assert.equal(afterArticleClick.title, articleButton.buttonText, 'Thoughts article list click should update the protected article pane');
  assert.equal(afterArticleClick.state.section, 'Thoughts', 'clicking the article pane should stay on Thoughts');
  assert.equal(afterArticleClick.state.passives, 0, 'clicking the article pane should not tear or create falling sheets');
  assert.equal(await evaluate(`window.__tearState().hitRegions.some((hit) => hit.kind === 'thought')`), false, 'canvas thought-region activation path should not exist');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
  await sleep(700);
  const afterArrowLeft = await evaluate<{ state: { section: string; passives: number } }>(`(() => ({ state: window.__tearState() }))()`);
  assert.equal(afterArrowLeft.state.section, 'About Me', 'ArrowLeft should navigate back to About Me');

  for (let i = 0; i < 2; i += 1) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
    await sleep(450);
  }
  const quotesSurface = await evaluate<{ section: string; passives: number; blockedRegions: number; hitKinds: string[] }>(`(() => {
    const state = window.__tearState();
    return {
      section: state.section,
      passives: state.passives,
      blockedRegions: state.hitRegions.filter((hit) => hit.kind === 'input' || hit.kind === 'button' || hit.action === 'pull-signal').length,
      hitKinds: state.hitRegions.map((hit) => hit.kind),
    };
  })()`);
  assert.equal(quotesSurface.section, 'Quotes', 'ArrowRight twice should navigate to Quotes');
  assert.equal(quotesSurface.passives, 0, 'viewing Quotes should not create falling sheets');
  assert.equal(quotesSurface.blockedRegions, 0, 'Quotes should remain display-only with no input, pull, or button regions');
  assert.ok(!quotesSurface.hitKinds.includes('input'), 'Quotes should not register input regions');
  for (let i = 0; i < 2; i += 1) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
    await sleep(450);
  }
  assert.equal(await evaluate(`window.__tearState().section`), 'About Me', 'hidden navigation should recover after display-only Quotes');

  const tearPath = [
    [250, 220],
    [470, 360],
    [780, 570],
    [1160, 690],
    [160, 650],
    [1120, 120],
    [220, 610],
    [1180, 680],
  ];
  async function dragTear(modifiers = 0, button = 'left', buttons = 1) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: tearPath[0][0], y: tearPath[0][1], button: 'none', modifiers });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: tearPath[0][0], y: tearPath[0][1], button, buttons, clickCount: 1, modifiers });
    for (const [x, y] of tearPath.slice(1)) {
      await sleep(80);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button, buttons, modifiers });
    }
    await sleep(80);
    const [lastX, lastY] = tearPath.at(-1)!;
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: lastX, y: lastY, button, buttons: 0, clickCount: 1, modifiers });
  }
  async function pressReset() {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82, nativeVirtualKeyCode: 82 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82, nativeVirtualKeyCode: 82 });
  }

  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__tearFrameStats = { samples: [], running: true, last: performance.now() };
      const tick = (now) => {
        const stats = window.__tearFrameStats;
        if (!stats?.running) return;
        stats.samples.push(now - stats.last);
        stats.last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })()`,
    returnByValue: true,
  });

  await dragTear(8);
  await sleep(90);

  const duringRebound = await evaluate<{ state: { phase: string; passives: number; activeWorker?: { supported: boolean; enabled: boolean; ready: boolean; appliedSteps: number } } | null }>(`(() => ({
    state: typeof window.__tearState === 'function' ? window.__tearState() : null
  }))()`);
  assert.equal(duringRebound.state?.phase, 'torn', 'released sheet should rebound before promoting to falling passive');
  assert.equal(duringRebound.state?.passives, 0, 'released sheet should remain the active cloth during the rebound hold');
  assert.ok(
    !duringRebound.state?.activeWorker?.supported || (duringRebound.state.activeWorker.enabled && duringRebound.state.activeWorker.ready && duringRebound.state.activeWorker.appliedSteps > 0),
    'active worker should keep simulating the post-release rebound',
  );
  let duringDrop: {
    state: {
      section: string;
      phase: string;
      passives: number;
      activeWorker?: {
        supported: boolean;
        enabled: boolean;
        ready: boolean;
        pending: boolean;
        appliedSteps: number;
        topologyUpdates: number;
        timing?: { solveMs: number; copyMs: number; topologyMs: number; totalMs: number; steps: number };
        upload?: { positionCount: number; normalCount: number; topologyChanged?: boolean };
      };
      passiveWorker?: {
        supported: boolean;
        enabled: boolean;
        active: number;
        backend?: string;
        timing?: { solveMs: number; copyMs: number; topologyMs: number; totalMs: number; steps: number };
        upload?: { positionCount: number; normalCount: number };
      };
      passiveSheets?: Array<{ age: number; y: number; worker: boolean }>;
    } | null;
  } | null = null;
  for (let i = 0; i < 14; i += 1) {
    await sleep(100);
    duringDrop = await evaluate(`(() => ({
      state: typeof window.__tearState === 'function' ? window.__tearState() : null
    }))()`);
    if (duringDrop?.state?.phase === 'dropping') break;
  }
  assert.equal(duringDrop.state?.section, 'About Me', 'next section should not become active immediately after drop');
  assert.equal(duringDrop.state?.phase, 'dropping', 'released sheet should have a distinct falling phase');
  assert.ok((duringDrop.state?.passives ?? 0) >= 1, 'released sheet should be live while falling');
  assert.ok(
    !duringDrop.state?.activeWorker?.supported || (duringDrop.state.activeWorker.enabled && duringDrop.state.activeWorker.appliedSteps > 0),
    'active tear simulation should run through the active cloth worker before release',
  );
  assert.ok(
    !duringDrop.state?.activeWorker?.supported || duringDrop.state.activeWorker.topologyUpdates > 0,
    'active cloth worker should provide topology index updates when constraints tear',
  );
  assert.ok(
    !duringDrop.state?.activeWorker?.supported || Number.isFinite(duringDrop.state.activeWorker.timing?.solveMs ?? NaN),
    'active cloth worker should expose solve/copy timing metadata',
  );
  assert.ok(
    !duringDrop.state?.activeWorker?.supported || (duringDrop.state.activeWorker.upload?.positionCount ?? 0) > 0,
    'active cloth worker should expose worker-computed geometry upload ranges',
  );
  assert.ok(
    !duringDrop.state?.activeWorker?.supported || (!duringDrop.state.activeWorker.ready && !duringDrop.state.activeWorker.pending),
    'active cloth worker should be suspended after the active sheet is promoted to falling passive',
  );
  assert.ok(
    !duringDrop.state?.passiveWorker?.supported || (duringDrop.state.passiveWorker.enabled && duringDrop.state.passiveWorker.active >= 1),
    'released sheets should use the passive cloth worker when Worker is available',
  );
  assert.equal(duringDrop.state?.passiveWorker?.backend, EXPECTED_CLOTH_BACKEND, `passive cloth worker should use ${EXPECTED_CLOTH_BACKEND}`);
  for (let i = 0; i < 10 && duringDrop.state?.passiveWorker?.supported && !duringDrop.state.passiveWorker.timing; i += 1) {
    await sleep(100);
    duringDrop = await evaluate(`(() => ({
      state: typeof window.__tearState === 'function' ? window.__tearState() : null
    }))()`);
  }
  assert.ok(
    !duringDrop.state?.passiveWorker?.supported || Number.isFinite(duringDrop.state.passiveWorker.timing?.solveMs ?? NaN),
    'passive cloth worker should expose solve/copy timing metadata',
  );
  assert.ok(
    !duringDrop.state?.passiveWorker?.supported || (duringDrop.state.passiveWorker.upload?.positionCount ?? 0) > 0,
    'passive cloth worker should expose worker-computed geometry upload ranges',
  );
  const firstPassiveY = duringDrop.state?.passiveSheets?.[0]?.y ?? 0;
  const firstPassiveAge = duringDrop.state?.passiveSheets?.[0]?.age ?? 0;
  assert.ok(firstPassiveAge > 0, 'falling sheet should already be simulating during dropping phase');
  assert.ok(firstPassiveY < 0, 'falling sheet should move downward during dropping phase before reveal');

  await pressReset();
  await sleep(700);

  const afterDropReset = await evaluate<{ state: { section: string; passives: number } | null }>(`(() => ({
    state: typeof window.__tearState === 'function' ? window.__tearState() : null
  }))()`);
  assert.equal(afterDropReset.state?.section, 'About Me', 'R should reset while the sheet is still falling');
  assert.equal(afterDropReset.state?.passives, 0, 'reset during fall should clear falling sheets');

  await dragTear();
  await sleep(1200);

  const afterTear = await evaluate<{ state: { section: string; passives: number; advanceCooldown: number; cloth: { maxStretchRatio: number } } | null }>(`(() => ({
    state: typeof window.__tearState === 'function' ? window.__tearState() : null
  }))()`);
  assert.equal(afterTear.state?.section, 'Thoughts', 'tear gesture should reveal Thoughts');
  assert.ok((afterTear.state?.passives ?? 0) >= 1, 'released sheet should remain as a live falling passive');
  assert.ok((afterTear.state?.cloth.maxStretchRatio ?? 0) < 7, 'runtime solver stretch should stay bounded after tear');
  const frameStats = await evaluate<{ count: number; average: number; p95: number; max: number }>(`(() => {
    const stats = window.__tearFrameStats;
    if (!stats) return { count: 0, average: 0, p95: 0, max: 0 };
    stats.running = false;
    const samples = stats.samples.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
    const sum = samples.reduce((total, value) => total + value, 0);
    return {
      count: samples.length,
      average: samples.length ? sum / samples.length : 0,
      p95: samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))] : 0,
      max: samples.length ? samples[samples.length - 1] : 0,
    };
  })()`);
  assert.ok(frameStats.count > 30, 'frame pacing check should observe enough frames during tear/drop');
  assert.ok(frameStats.p95 < 80, `tear/drop frame pacing should avoid visible sustained stalls, p95=${frameStats.p95.toFixed(1)}ms`);
  assert.ok(frameStats.max < 250, `tear/drop frame pacing should avoid single-frame freezes, max=${frameStats.max.toFixed(1)}ms`);

  await pressReset();
  await sleep(700);

  const afterReset = await evaluate<{ state: { section: string; passives: number } | null }>(`(() => ({
    state: typeof window.__tearState === 'function' ? window.__tearState() : null
  }))()`);
  assert.equal(afterReset.state?.section, 'About Me', 'R should reset to About Me');
  assert.equal(afterReset.state?.passives, 0, 'reset should clear falling sheets');

  const multiGrab = await evaluate<{ state: { cloth: { activeGrabSlots: number; grabCount: number }; pointers: Array<{ tearing: boolean; slot: number }> } | null }>(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas || typeof PointerEvent !== 'function') return { state: null };
    const rect = canvas.getBoundingClientRect();
    const fire = (type, pointerId, x, y, buttons = 1) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId,
      pointerType: 'touch',
      isPrimary: pointerId === 21,
      clientX: x,
      clientY: y,
      button: 0,
      buttons,
      bubbles: true,
      cancelable: true,
    }));
    const left = { x: rect.left + rect.width * 0.28, y: rect.top + rect.height * 0.30 };
    const right = { x: rect.left + rect.width * 0.72, y: rect.top + rect.height * 0.30 };
    fire('pointerdown', 21, left.x, left.y);
    fire('pointerdown', 22, right.x, right.y);
    fire('pointermove', 21, left.x - 90, left.y + 110);
    fire('pointermove', 22, right.x + 90, right.y + 110);
    return { state: window.__tearState() };
  })()`);
  assert.ok(multiGrab.state, 'synthetic multi-touch should expose tear state');
  assert.equal(multiGrab.state?.cloth.activeGrabSlots, 2, 'two touch pointers should create two independent grab slots');
  assert.ok((multiGrab.state?.cloth.grabCount ?? 0) > 0, 'multi-touch grab slots should attach cloth particles');
  assert.equal(multiGrab.state?.pointers.filter((pointer) => pointer.tearing).length, 2, 'both touch pointers should remain active while tearing');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas || typeof PointerEvent !== 'function') return false;
      const fire = (pointerId) => canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId, pointerType: 'touch', isPrimary: pointerId === 21, clientX: 0, clientY: 0, button: 0, buttons: 0, bubbles: true, cancelable: true }));
      fire(21); fire(22); return true;
    })()`,
    returnByValue: true,
  });
  await pressReset();
  await sleep(700);

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: TARGET_URL });
  await sleep(1800);
  const mobileLayout = await evaluate<{
    innerWidth: number;
    innerHeight: number;
    scrollWidth: number;
    hintRect: { top: number; bottom: number; height: number };
    canvasRect: { width: number; height: number };
  }>(`(() => {
    const hint = document.querySelector('.tearable-page-hint')?.getBoundingClientRect();
    const canvas = document.querySelector('canvas')?.getBoundingClientRect();
    return {
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      hintRect: hint ? { top: hint.top, bottom: hint.bottom, height: hint.height } : { top: -1, bottom: -1, height: 0 },
      canvasRect: canvas ? { width: canvas.width, height: canvas.height } : { width: 0, height: 0 },
    };
  })()`);
  assert.ok(mobileLayout.canvasRect.width > 0 && mobileLayout.canvasRect.height > 0, 'mobile canvas should render');
  assert.ok(mobileLayout.scrollWidth <= mobileLayout.innerWidth + 2, 'mobile layout should not horizontally overflow');
  assert.ok(mobileLayout.hintRect.bottom <= mobileLayout.innerHeight + 1, 'mobile bottom hint should stay visible');
  assert.ok(mobileLayout.hintRect.top >= 0, 'mobile bottom hint should not be clipped above the viewport');

  const screenshot = await send<{ data: string }>('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const screenshotPath = join(tmpdir(), 'tearable-browser-smoke.png');
  writeFileSync(screenshotPath, Buffer.from(screenshot.result!.data, 'base64'));
  console.log(`tearable browser smoke passed: ${screenshotPath}`);
  ws.close();
}

main().finally(async () => {
  chrome.kill();
  await Promise.race([
    new Promise((resolve) => chrome.once('exit', resolve)),
    sleep(1800),
  ]);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
      return;
    } catch {
      await sleep(250);
    }
  }
  console.warn(`Could not remove temporary Chrome profile: ${profileDir}`);
});
