import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9334;
const root = process.cwd();
const outDir = path.join(root, ".shots");
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args) => console.log(...args);

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(root, ".chrome-golden")}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function waitForChrome() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {
      /* not up yet */
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
const consoleErrors = [];
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") {
    consoleErrors.push(message.params.exceptionDetails?.exception?.description ?? "exception");
  } else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
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

function once(method, timeout = 20000) {
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

async function evaluate(expression) {
  const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

async function goto(route) {
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: `http://localhost:3000${route}` });
  await loaded;
  await sleep(500);
}

async function waitFor(expression, label, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return true;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(data, "base64"));
  log(`screenshot ${name}.png`);
}

const clickButton = (text) =>
  evaluate(`(() => {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled);
    if (!el) return "missing";
    el.click();
    return "clicked";
  })()`);

const clickSummary = (text) =>
  evaluate(`(() => {
    const el = [...document.querySelectorAll("summary")].find((s) => s.textContent.includes(${JSON.stringify(text)}));
    if (!el) return "missing";
    el.click();
    return "clicked";
  })()`);

const setValue = (selector, value) =>
  evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return "missing";
    const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value")?.set;
    if (setter) setter.call(el, ${JSON.stringify(value)});
    else el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el.value;
  })()`);

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Network.clearBrowserCookies");

const results = {};

/* 1. passcode login */
await goto("/login?member=demo-anil");
for (const digit of ["2", "5", "8", "0"]) {
  await evaluate(`[...document.querySelectorAll("button.key")].find((b) => b.textContent.trim() === "${digit}").click()`);
}
log("keypad:", await evaluate(`document.querySelector('input[name="passcode"]').value`));
await clickButton("Unlock");
await waitFor(`location.pathname === "/dashboard"`, "dashboard after unlock");
await waitFor(`document.body.innerText.includes("Kamla Sharma")`, "dashboard content");
const heading = await evaluate(`document.querySelector("h1")?.textContent.trim()`);
const hero = await evaluate(`document.querySelector("#next-dose-title")?.textContent.trim() ?? null`);
results.login = { path: await evaluate("location.pathname"), heading, nextDose: hero };
log("login ok →", results.login.heading, "| next:", hero);

/* 2. mark the next dose as taken (skipped in scan-only mode) */
const mode = process.argv[2] ?? "full";
const hasHero = mode === "full" && Boolean(hero);
if (hasHero) {
  const undoBefore = await evaluate(`[...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Undo").length`);
  await clickButton("I took it");
  await waitFor(
    `[...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Undo").length > ${undoBefore}`,
    "dose marked taken",
  );
  results.markDose = { before: undoBefore, undos: await evaluate(`[...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Undo").length`) };
  log("dose marked taken → undo buttons:", results.markDose.undos);
}

/* 3. reminder scan, twice, to prove dedupe */
await goto("/outbox");
const queueBefore = await evaluate(`document.querySelectorAll(".mail-card, .outbox-item, article").length`);
await clickButton("Run reminder scan");
await waitFor(`location.search.includes("ran=1")`, "first scan result");
await waitFor(`document.querySelector(".banner-info")?.innerText.trim().length > 0`, "first scan banner");
const firstScan = {
  url: await evaluate("location.href"),
  banner: await evaluate(`document.querySelector(".banner-info")?.innerText.replace(/\\s+/g, " ").trim() ?? null`),
};
await shot("golden-outbox");
if (mode === "scan") {
  results.consoleErrors = consoleErrors;
  log("RESULT " + JSON.stringify(results, null, 2));
  ws.close();
  chrome.kill();
  process.exit(0);
}
await clickButton("Run reminder scan");
await waitFor(`location.search.includes("dupes=") && !location.search.includes("dupes=0")`, "second scan dedupe");
await waitFor(`document.querySelector(".banner-info")?.innerText.includes("Nothing new")`, "second scan banner");
const secondScan = {
  url: await evaluate("location.href"),
  banner: await evaluate(`document.querySelector(".banner-info")?.innerText.replace(/\\s+/g, " ").trim() ?? null`),
};
results.scan = { queueBefore, first: firstScan, second: secondScan };
log("scan 1:", firstScan.banner);
log("scan 2:", secondScan.banner);

/* 4. add a medicine through the UI */
await goto("/medicines");
const activeBefore = await evaluate(`document.body.innerText.match(/(\\d+) active/)?.[1] ?? null`);
await clickSummary("Add a medicine");
await sleep(300);
await setValue("#med-name", "Paracetamol");
await setValue("#med-dosage", "650 mg");
await setValue('input[name="instructions"]', "After lunch if there is fever");
await setValue('input[name="startDate"]', "2026-11-16");
await setValue('input[name="times"]', "14:00");
await clickButton("Add medicine");
await waitFor(`document.body.innerText.includes("Paracetamol")`, "new medicine in list");
const activeAfter = await evaluate(`document.body.innerText.match(/(\\d+) active/)?.[1] ?? null`);
results.addMedicine = { activeBefore, activeAfter, listed: true };
log("medicine added → active", activeBefore, "→", activeAfter);

await shot("golden-medicines");
await goto("/dashboard");
await shot("golden-dashboard");

results.consoleErrors = consoleErrors;
log("console errors:", consoleErrors.length ? consoleErrors : "none");
log("RESULT " + JSON.stringify(results, null, 2));

ws.close();
chrome.kill();
log(`chrome ${version.Browser}`);
