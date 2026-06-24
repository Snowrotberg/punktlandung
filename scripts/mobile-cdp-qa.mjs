import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const existingPort = process.env.CDP_PORT ? Number(process.env.CDP_PORT) : null;
const port = existingPort ?? 9333 + Math.floor(Math.random() * 400);
const outDir = path.resolve("test-artifacts/mobile-qa-after");
const userDataDir = await mkdtemp(path.join(tmpdir(), "punktlandung-cdp-"));

await mkdir(outDir, { recursive: true });

const chrome = existingPort ? null : spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-dev-shm-usage",
  "--no-sandbox",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-allow-origins=*",
  "--remote-debugging-address=127.0.0.1",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "--window-size=402,780",
  "about:blank"
], { stdio: "ignore" });

let chromeExit = null;
chrome?.once("exit", (code, signal) => {
  chromeExit = { code, signal };
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function waitForPageWs() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const pages = await getJson(`http://127.0.0.1:${port}/json/list`);
      const page = pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still booting.
    }
    await sleep(150);
  }
  throw new Error(`Chrome DevTools endpoint did not become ready. exit=${JSON.stringify(chromeExit)} port=${port}`);
}

const wsUrl = await waitForPageWs();
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const browserErrors = [];
const networkIssues = [];
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    browserErrors.push(message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text ?? "Runtime exception");
  }
  if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params?.entry?.level)) {
    browserErrors.push(message.params.entry.text);
  }
  if (message.method === "Network.responseReceived") {
    const response = message.params?.response;
    if (response?.status >= 400) {
      networkIssues.push({ status: response.status, url: response.url });
    }
  }
  if (message.method === "Network.loadingFailed") {
    networkIssues.push({ errorText: message.params?.errorText, url: message.params?.requestId });
  }
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Runtime evaluation failed.");
  }
  return result.result.value;
}

async function screenshot(name) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const file = path.join(outDir, name);
  await writeFile(file, Buffer.from(result.data, "base64"));
  return file;
}

try {
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 402,
    height: 780,
    deviceScaleFactor: 3,
    mobile: true
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });

  await send("Page.navigate", { url: `http://localhost:3000/?cdpQa=${Date.now()}` });
  await sleep(1400);

  const startBefore = await evaluate(`(() => ({
    y: scrollY,
    docH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight,
    appError: document.body.innerText.includes("Application error"),
    originalIcons: [...document.querySelectorAll('img[src^="/category-icons/"]')].slice(0, 6).map((img) => img.getAttribute("src")),
    lineIconCount: document.querySelectorAll('img[src^="/category-icons-line/"]').length
  }))()`);

  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 200, y: 500, deltaY: 650, deltaX: 0 });
  await sleep(250);
  const startAfter = await evaluate(`(() => ({ y: scrollY, docH: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight }))()`);
  const startShot = await screenshot("iphone17-start-scroll-after.png");

  await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Solo / Party starten");
    button?.scrollIntoView({ block: "center" });
    button?.click();
    return Boolean(button);
  })()`);
  await sleep(900);

  const lobbyBefore = await evaluate(`(() => ({
    y: scrollY,
    docH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight,
    appError: document.body.innerText.includes("Application error"),
    originalIcons: [...document.querySelectorAll('img[src^="/category-icons/"]')].slice(0, 6).map((img) => {
      const r = img.getBoundingClientRect();
      return { src: img.getAttribute("src"), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 16 && r.height > 16 };
    })
  }))()`);

  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 200, y: 500, deltaY: 700, deltaX: 0 });
  await sleep(250);
  const lobbyAfter = await evaluate(`(() => ({ y: scrollY, docH: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight }))()`);
  const lobbyShot = await screenshot("iphone17-lobby-scroll-after.png");

  await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Starten");
    button?.scrollIntoView({ block: "center" });
    button?.click();
    return Boolean(button);
  })()`);
  await sleep(3600);

  const mapOpenPoint = await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Karte auf");
    if (button) {
      button.click();
      return null;
    }
    const section = [...document.querySelectorAll("section")].find((item) => item.textContent.includes("Karte öffnen"));
    if (!section) return null;
    section.scrollIntoView({ block: "center" });
    const r = section.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + Math.min(r.height - 24, 90)) };
  })()`);
  await sleep(250);
  if (mapOpenPoint) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: mapOpenPoint.x, y: mapOpenPoint.y, button: "none" });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: mapOpenPoint.x, y: mapOpenPoint.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mapOpenPoint.x, y: mapOpenPoint.y, button: "left", clickCount: 1 });
  }
  await sleep(1500);

  const mapClickPoint = await evaluate(`(() => {
    const map = document.querySelector(".leaflet-container");
    if (!map) return null;
    const r = map.getBoundingClientRect();
    return {
      x: Math.round(r.x + r.width * 0.47),
      y: Math.round(r.y + r.height * 0.52)
    };
  })()`);
  if (mapClickPoint) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: mapClickPoint.x, y: mapClickPoint.y, button: "none" });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: mapClickPoint.x, y: mapClickPoint.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mapClickPoint.x, y: mapClickPoint.y, button: "left", clickCount: 1 });
    await sleep(600);
  }
  await evaluate(`(() => {
    const section = [...document.querySelectorAll("section")].find((item) => item.textContent.includes("Tipp setzen"));
    section?.scrollIntoView({ block: "end" });
    return Boolean(section);
  })()`);
  await sleep(250);

  const mapButtons = await evaluate(`(() => {
    const buttons = [...document.querySelectorAll("button")].map((button) => {
      const text = button.textContent.trim();
      const r = button.getBoundingClientRect();
      return { text, disabled: button.disabled, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 };
    }).filter((button) => ["Groß", "Kleiner", "Abgeben", "Gesendet", "×"].includes(button.text));
    const sections = [...document.querySelectorAll("section")].map((section) => {
      const r = section.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), text: section.textContent.slice(0, 120) };
    });
    return {
      viewport: { w: innerWidth, h: innerHeight },
      appError: document.body.innerText.includes("Application error"),
      buttons,
      mapSection: sections.find((section) => section.text.includes("Tipp") || section.text.includes("Abgeben") || section.text.includes("Karte")) ?? null
    };
  })()`);
  const mapShot = await screenshot("iphone17-map-bottom-buttons.png");

  console.log(JSON.stringify({
    startBefore,
    startAfter,
    lobbyBefore,
    lobbyAfter,
    mapButtons,
    screenshots: { startShot, lobbyShot, mapShot }
    ,
    browserErrors
    ,
    networkIssues
  }, null, 2));
} finally {
  ws.close();
  chrome?.kill();
  await sleep(500);
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}
