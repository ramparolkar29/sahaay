import { spawn } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SignJWT } from "jose";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const root = process.cwd();
const outDir = path.join(root, ".shots");
mkdirSync(outDir, { recursive: true });

const secret = process.env.SESSION_SECRET ?? readFileSync(path.join(root, "data", ".session-secret"), "utf8");
const token = await new SignJWT({
  memberId: "demo-anil",
  circleId: "demo-sharma",
  name: "Anil Sharma",
  role: "caretaker",
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("12h")
  .sign(new TextEncoder().encode(secret));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(root, ".chrome-profile")}`,
    "about:blank",
  ],
  { stdio: "ignore", detached: false },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForChrome() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {
      /* not ready yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome did not expose the DevTools endpoint");
}

const version = await waitForChrome();
const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
const events = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  } else if (message.method && events.has(message.method)) {
    for (const handler of events.get(message.method)) handler(message.params);
  }
});

function send(method, params = {}) {
  id += 1;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function once(method, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const handler = (params) => {
      events.get(method)?.delete(handler);
      resolve(params);
    };
    if (!events.has(method)) events.set(method, new Set());
    events.get(method).add(handler);
    setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), timeout).unref();
  });
}

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Network.setCookie", { name: "sahaay_session", value: token, domain: "localhost", path: "/", httpOnly: true });

const shots = [
  ["dashboard", "/dashboard", 1500, false],
  ["medicines", "/medicines", 1650, false],
  ["appointments", "/appointments", 1150, false],
  ["team", "/team", 1150, false],
  ["outbox", "/outbox", 1500, false],
  ["activity", "/activity", 1300, false],
  ["landing", "/", 1100, true],
  ["login", "/login?member=demo-kamla", 950, true],
  ["login-code", "/login?code=SHARMA", 950, true],
  ["login-bad-code", "/login?code=ZZZZZZ", 950, true],
  ["setup", "/setup", 1050, true],
];

for (const [name, route, settle, publicPage] of shots) {
  if (publicPage) {
    await send("Network.deleteCookies", { name: "sahaay_session", domain: "localhost", path: "/" });
    await send("Network.clearBrowserCookies");
  }
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: `http://localhost:3000${route}` });
  await loaded;
  await sleep(settle);
  if (publicPage) {
    const { result } = await send("Runtime.evaluate", { expression: "location.pathname", returnByValue: true });
    console.log(`  ${name} landed on ${result.value}`);
  }
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(data, "base64"));
  console.log(`captured ${name}`);
}

await send("Network.setCookie", { name: "sahaay_session", value: token, domain: "localhost", path: "/", httpOnly: true });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
{
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: "http://localhost:3000/dashboard" });
  await loaded;
  await sleep(1200);
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(path.join(outDir, "dashboard-mobile.png"), Buffer.from(data, "base64"));
  console.log("captured dashboard-mobile");
}

const elderToken = await new SignJWT({
  memberId: "demo-kamla",
  circleId: "demo-sharma",
  name: "Kamla Sharma",
  role: "elder",
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("12h")
  .sign(new TextEncoder().encode(secret));

await send("Network.setCookie", { name: "sahaay_session", value: elderToken, domain: "localhost", path: "/", httpOnly: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
{
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: "http://localhost:3000/dashboard" });
  await loaded;
  await sleep(1400);
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(path.join(outDir, "dashboard-elder.png"), Buffer.from(data, "base64"));
  console.log("captured dashboard-elder");
}

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
{
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: "http://localhost:3000/dashboard" });
  await loaded;
  await sleep(1200);
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(path.join(outDir, "dashboard-elder-mobile.png"), Buffer.from(data, "base64"));
  console.log("captured dashboard-elder-mobile");
}

ws.close();
chrome.kill();
console.log(`chrome ${version.Browser}`);