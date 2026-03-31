/* ORBITAL SYSTEMS • OPS CONSOLE NODE 07
   Intentionally light JS: state toggles, telemetry drift, radar blips, logs. */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const now = () => new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const timeStamp = (d = now()) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function fmt(num, digits = 0) {
    return Number(num).toFixed(digits);
  }

  function setCssVar(name, val) {
    document.documentElement.style.setProperty(name, String(val));
  }

  // --- State model -----------------------------------------------------------
  const state = {
    mode: "ops", // ops | alert | low
    power: "booting", // offline | booting | nominal
    locked: false,
    armed: false,
    synced: false,
    iff: "PASSIVE",

    boot: {
      pct: 0,
      step: 0,
      running: true,
    },

    telemetry: {
      reactor: 62,
      pressure: 101.2,
      comms: 94,
      thermal: 38.5,
      gain: 12.8,
      noise: -68.2,
      dust: 0.014,
      cpu: 42,
      mem: 57,
      bus: 33,
      stability: 78,
      sweepHz: 0.8,
      clutter: 12,
      commsDrift: 0.07,
      pressureVar: 0.3,
      thermalLoop: 2,
      chan: "C",
      instab: 9,
      chanDrift: 0.11,
      knob: 0.55,
      linkLevel: 12,
    },

    // temporary effect timers (ms)
    effects: {
      ventUntil: 0,
      syncUntil: 0,
      pingUntil: 0,
      sweepBoostUntil: 0,
    },

    alerts: {
      unacked: 0,
    },
  };

  // --- DOM refs --------------------------------------------------------------
  const el = {
    html: document.documentElement,

    clock: $("#clock"),
    sysCode: $("#sysCode"),
    bunkerText: $("#bunkerText"),

    mainStateText: $("#mainStateText"),
    mainStatePill: $("#mainStatePill"),

    bootFill: $("#bootFill"),
    bootPct: $("#bootPct"),
    bootHint: $("#bootHint"),
    bootList: $("#bootList"),

    segmentMain: $("#segmentMain"),
    segmentSub: $("#segmentSub"),

    chipPower: $("#chipPower"),
    chipComms: $("#chipComms"),
    chipThermal: $("#chipThermal"),
    chipSec: $("#chipSec"),
    chipNav: $("#chipNav"),

    subCore: $("#subCore"),
    subComms: $("#subComms"),
    subThermal: $("#subThermal"),
    subNav: $("#subNav"),
    subSec: $("#subSec"),
    subEnv: $("#subEnv"),

    stabilityPct: $("#stabilityPct"),
    dialNeedle: $("#dialNeedle"),

    lockTag: $("#lockTag"),
    lockState: $("#lockState"),
    lockBtn: $("#btnLock"),

    btnPower: $("#btnPower"),
    btnPowerMeta: $("#btnPowerMeta"),
    btnAlert: $("#btnAlert"),
    btnRandomize: $("#btnRandomize"),

    // telemetry
    mReactor: $("#mReactor"),
    barReactor: $("#barReactor"),
    mReactorTrend: $("#mReactorTrend"),

    mPressure: $("#mPressure"),
    barPressure: $("#barPressure"),
    mPressureVar: $("#mPressureVar"),

    mComms: $("#mComms"),
    barComms: $("#barComms"),
    mCommsDrift: $("#mCommsDrift"),

    mThermal: $("#mThermal"),
    barThermal: $("#barThermal"),
    mThermalLoop: $("#mThermalLoop"),

    mGain: $("#mGain"),
    barGain: $("#barGain"),
    mNoise: $("#mNoise"),

    envDust: $("#envDust"),
    segLink: $("#segLink"),
    linkChan: $("#linkChan"),

    // radar
    radarBlips: $("#radarBlips"),
    contactCount: $("#contactCount"),
    sweepHz: $("#sweepHz"),
    clutterPct: $("#clutterPct"),
    iffMode: $("#iffMode"),
    contactTag: $("#contactTag"),

    btnPing: $("#btnPing"),
    btnSweep: $("#btnSweep"),
    btnIff: $("#btnIff"),

    // log
    logList: $("#logList"),
    logViewport: $("#logViewport"),
    alertCount: $("#alertCount"),
    alertCountTag: $("#alertCountTag"),
    btnAck: $("#btnAck"),
    btnClear: $("#btnClear"),
    btnInject: $("#btnInject"),

    // signals
    eqBars: $("#eqBars"),
    instabPct: $("#instabPct"),
    instabTag: $("#instabTag"),
    syncTag: $("#syncTag"),
    knobPointer: $("#knobPointer"),
    chanMode: $("#chanMode"),
    tinyGrid: $("#tinyGrid"),
    chanDrift: $("#chanDrift"),

    // bottom strip
    cmdArm: $("#cmdArm"),
    cmdVent: $("#cmdVent"),
    cmdSync: $("#cmdSync"),
    cmdPurge: $("#cmdPurge"),
    cmdLock: $("#cmdLock"),
    armState: $("#armState"),

    cpuPct: $("#cpuPct"),
    memPct: $("#memPct"),
    busPct: $("#busPct"),
    miniCpu: $("#miniCpu"),
    miniMem: $("#miniMem"),
    miniBus: $("#miniBus"),

    // modes / toggles
    modeOps: $("#modeOps"),
    modeAlert: $("#modeAlert"),
    modeLow: $("#modeLow"),
    toggleCrt: $("#toggleCrt"),
    toggleScan: $("#toggleScan"),

    // tabs
    railTabs: $$(".railbtn[role='tab']"),
  };

  // --- Log system ------------------------------------------------------------
  const LOG_MAX = 72;
  const bootLines = [
    ["SYS", "BOOTSTRAP SEQUENCE ACCEPTED", "ok"],
    ["BUS", "BACKPLANE LINK TRAINING", "ok"],
    ["CORE", "CRYO-LATCH RELEASE CONFIRMED", "ok"],
    ["COMMS", "PHASE ARRAY CALIBRATION", "ok"],
    ["NAV", "INERTIAL STACK ZEROING", "ok"],
    ["SEC", "PANEL LOCK MATRIX ONLINE", "ok"],
    ["SENS", "TELEMETRY BUS PRIMED", "ok"],
    ["RF", "SPECTRUM WINDOWS OPENED", "ok"],
    ["SYS", "NOMINAL ENVELOPE TARGETED", "ok"],
  ];

  const incidentPool = {
    ok: [
      ["CORE", "THERMAL ENVELOPE WITHIN NOMINAL BAND"],
      ["COMMS", "PHASE ARRAY SYNC CONVERGED"],
      ["SYS", "SCHEDULER JITTER UNDER THRESHOLD"],
      ["NAV", "STAR TRACKER CONFIDENCE: 0.91"],
      ["RF", "NOISE FLOOR STABLE"],
    ],
    warn: [
      ["COMMS", "PHASE ARRAY SYNC DRIFT DETECTED"],
      ["SENS", "PRESSURE MICRO-OSCILLATION"],
      ["RF", "CHANNEL INSTABILITY INCREASING"],
      ["CORE", "THERMAL LOOP SLIP COMPENSATION"],
      ["NAV", "INERTIAL BIAS DELTA NOTED"],
    ],
    crit: [
      ["SEC", "UNVERIFIED CONSOLE HANDSHAKE"],
      ["CORE", "REACTOR LOAD SURGE BEYOND BAND"],
      ["COMMS", "LINK INTEGRITY COLLAPSE IMMINENT"],
      ["SENS", "HULL PRESSURE DROP RATE SPIKE"],
      ["RF", "HOSTILE SIGNATURE IN SWEEP WINDOW"],
    ],
  };

  function pushLog(src, msg, sev = "ok") {
    const li = document.createElement("li");
    li.className = "logline";
    li.dataset.sev = sev;

    const t = document.createElement("div");
    t.className = "logline__time";
    t.textContent = timeStamp();

    const s = document.createElement("div");
    s.className = "logline__src";
    s.textContent = src;

    const m = document.createElement("div");
    m.className = "logline__msg";
    m.textContent = msg;

    li.append(t, s, m);
    el.logList.appendChild(li);

    while (el.logList.children.length > LOG_MAX) {
      el.logList.removeChild(el.logList.firstChild);
    }

    el.logViewport.scrollTop = el.logViewport.scrollHeight;

    if (sev === "warn" || sev === "crit") {
      state.alerts.unacked += 1;
      updateAlertCount();
    }
  }

  function updateAlertCount() {
    el.alertCount.textContent = String(state.alerts.unacked);
    el.alertCountTag.style.borderColor =
      state.alerts.unacked > 0 ? "rgba(255, 176, 74, 0.22)" : "rgba(87, 240, 255, 0.12)";
  }

  function injectIncident(sev = null) {
    const chosenSev = sev ?? (Math.random() < 0.12 ? "crit" : Math.random() < 0.38 ? "warn" : "ok");
    const [src, msg] = pick(incidentPool[chosenSev]);
    pushLog(src, msg, chosenSev);
  }

  // --- Boot sequence ---------------------------------------------------------
  const bootHints = [
    "Handshake: cold start",
    "Bus training: lane align",
    "Entropy: seed accepted",
    "Thermal: loop priming",
    "Comms: phase lock",
    "Security: interlocks",
    "Sensors: bias map",
    "RF: window open",
    "Console: nominal",
  ];

  function setMainState(label, sev, sysCode) {
    el.mainStateText.textContent = label;
    el.segmentMain.textContent = label;
    el.mainStatePill.dataset.sev = sev;
    el.sysCode.textContent = sysCode;
  }

  function setPowerMode(mode) {
    state.power = mode;
    el.html.dataset.power = mode;

    if (mode === "offline") {
      setMainState("OFFLINE", "warn", "SYS-OFF");
      el.segmentSub.textContent = "POWER BUS DISENGAGED • SAFE STATE";
      el.btnPowerMeta.textContent = "HOLD TO BOOT";
      el.chipPower.dataset.state = "offline";
    } else if (mode === "booting") {
      setMainState("BOOTING", "warn", "SYS-BOOT");
      el.segmentSub.textContent = "INITIAL LINK • COLD START";
      el.btnPowerMeta.textContent = "HOLD TO POWER DOWN";
      el.chipPower.dataset.state = "syncing";
    } else {
      setMainState(state.mode === "alert" ? "ALERT" : "NOMINAL", state.mode === "alert" ? "crit" : "ok", "SYS-LIVE");
      el.segmentSub.textContent =
        state.mode === "alert" ? "RESPONSE POSTURE • REDLINE AUTHORITY" : "INSTRUMENTS GREEN • NOMINAL BAND";
      el.btnPowerMeta.textContent = "HOLD TO POWER DOWN";
      el.chipPower.dataset.state = "nominal";
    }
  }

  function setSubsystem(idEl, stateStr) {
    idEl.dataset.state = stateStr;
    idEl.textContent = stateStr.toUpperCase();
  }

  function bootListAdd(text, sev = "ok") {
    const li = document.createElement("li");
    li.textContent = `${timeStamp()} ${text}`;
    li.dataset.sev = sev;
    el.bootList.appendChild(li);
    el.bootList.scrollTop = el.bootList.scrollHeight;
  }

  function bootTick() {
    if (!state.boot.running) return;
    if (state.power !== "booting") return;

    const target = 100;
    const pace = 2.3 + Math.random() * 2.8; // smooth-ish
    state.boot.pct = clamp(state.boot.pct + pace, 0, target);
    setCssVar("--boot", state.boot.pct.toFixed(1));
    el.bootPct.textContent = `${pad2(Math.floor(state.boot.pct))}%`;
    el.bootHint.textContent = bootHints[Math.min(bootHints.length - 1, Math.floor(state.boot.pct / 12))];

    const steps = bootLines.length;
    const shouldStep = Math.floor((state.boot.pct / 100) * steps);
    while (state.boot.step < shouldStep) {
      const [src, msg, sev] = bootLines[state.boot.step];
      bootListAdd(`${src} / ${msg}`, sev);
      pushLog(src, msg, sev);
      state.boot.step += 1;
    }

    // Subsystem progress ramp
    const p = state.boot.pct / 100;
    setSubsystem(el.subCore, p < 0.2 ? "syncing" : "nominal");
    setSubsystem(el.subComms, p < 0.35 ? "offline" : p < 0.55 ? "syncing" : "nominal");
    setSubsystem(el.subThermal, p < 0.45 ? "offline" : p < 0.65 ? "syncing" : "nominal");
    setSubsystem(el.subNav, p < 0.55 ? "offline" : p < 0.75 ? "syncing" : "nominal");
    setSubsystem(el.subSec, p < 0.65 ? "offline" : p < 0.85 ? "syncing" : "nominal");
    setSubsystem(el.subEnv, p < 0.7 ? "offline" : p < 0.9 ? "syncing" : "nominal");

    // Top chips mirror
    el.chipComms.dataset.state = el.subComms.dataset.state;
    el.chipThermal.dataset.state = el.subThermal.dataset.state;
    el.chipNav.dataset.state = el.subNav.dataset.state;
    el.chipSec.dataset.state = el.subSec.dataset.state;

    if (state.boot.pct >= 100) {
      state.boot.running = false;
      setPowerMode("nominal");
      pushLog("SYS", "CONSOLE READY • OPERATOR AUTH GRANTED", "ok");
    }
  }

  // --- Telemetry drift (believable) -----------------------------------------
  function drift(v, min, max, strength = 0.5) {
    const mid = (min + max) / 2;
    const span = (max - min) / 2;
    const towardMid = (mid - v) / span;
    const noise = (Math.random() - 0.5) * 2;
    const delta = (noise * 0.45 + towardMid * 0.55) * strength;
    return clamp(v + delta, min, max);
  }

  function tickTelemetry() {
    if (state.power !== "nominal") return;

    const t = state.telemetry;
    const ts = performance.now();
    const isAlert = state.mode === "alert";

    const alertMult = isAlert ? 1.45 : 1.0;
    const calmMult = state.effects.syncUntil > ts ? 0.65 : 1.0;
    const strength = alertMult * calmMult;

    const venting = state.effects.ventUntil > ts;

    t.reactor = drift(t.reactor, 45, 88, 1.2 * strength);
    t.pressure = drift(t.pressure, 99.6, 102.2, 0.06 * strength) + (venting ? -0.05 : 0);
    t.comms = drift(t.comms, 72, 98, 1.0 * strength) + (state.synced ? 0.15 : 0);
    t.thermal = drift(t.thermal, 28, 62, 0.24 * strength) + (venting ? -0.12 : 0);
    t.gain = drift(t.gain, 6.5, 18.5, 0.28 * strength);
    t.noise = drift(t.noise, -76, -58, 0.18 * strength);

    t.pressureVar = drift(t.pressureVar, 0.1, 1.4, 0.09 * strength);
    t.commsDrift = drift(t.commsDrift, 0.02, 0.35, 0.03 * strength);
    t.thermalLoop = Math.round(drift(t.thermalLoop, 1, 7, 0.18 * strength));
    t.dust = drift(t.dust, 0.008, 0.04, 0.0012 * strength);

    t.cpu = drift(t.cpu, 18, 92, 2.2 * strength);
    t.mem = drift(t.mem, 22, 88, 1.6 * strength);
    t.bus = drift(t.bus, 12, 84, 2.0 * strength);

    t.stability = drift(t.stability, 52, 96, 1.4 * (isAlert ? 1.7 : 1.0));

    t.sweepHz = drift(t.sweepHz, 0.55, 1.35, 0.04 * strength) + (state.effects.sweepBoostUntil > ts ? 0.08 : 0);
    t.clutter = drift(t.clutter, 4, 32, 0.25 * strength) + (isAlert ? 1.1 : 0);

    t.instab = drift(t.instab, 2, 46, 0.9 * strength);
    t.chanDrift = drift(t.chanDrift, 0.01, 0.62, 0.06 * strength);
    t.knob = drift(t.knob, 0.1, 0.9, 0.02 * strength);
    t.linkLevel = Math.round(drift(t.linkLevel, 2, 16, 0.42 * strength) + (state.synced ? 0.35 : -0.1));

    // UI update
    el.mReactor.textContent = fmt(t.reactor, 0);
    el.barReactor.style.setProperty("--p", `${t.reactor}%`);
    el.mReactorTrend.textContent = t.reactor > 80 ? "↑ hot" : t.reactor < 55 ? "↓ slack" : "→ steady";

    el.mPressure.textContent = fmt(t.pressure, 1);
    el.barPressure.style.setProperty("--p", `${clamp(((t.pressure - 99.6) / (102.2 - 99.6)) * 100, 0, 100)}%`);
    el.mPressureVar.textContent = `${fmt(t.pressureVar, 2)}`;

    el.mComms.textContent = fmt(t.comms, 0);
    el.barComms.style.setProperty("--p", `${t.comms}%`);
    el.mCommsDrift.textContent = `${fmt(t.commsDrift, 2)} rad`;

    el.mThermal.textContent = fmt(t.thermal, 1);
    el.barThermal.style.setProperty("--p", `${clamp(((t.thermal - 28) / (62 - 28)) * 100, 0, 100)}%`);
    el.mThermalLoop.textContent = `L${t.thermalLoop}`;

    el.mGain.textContent = fmt(t.gain, 1);
    el.barGain.style.setProperty("--p", `${clamp(((t.gain - 6.5) / (18.5 - 6.5)) * 100, 0, 100)}%`);
    el.mNoise.textContent = `${fmt(t.noise, 1)} dB`;

    el.envDust.textContent = fmt(t.dust, 3);
    el.linkChan.textContent = t.chan;

    const segs = $$("span", el.segLink);
    segs.forEach((s, i) => s.classList.toggle("is-on", i < t.linkLevel));

    el.cpuPct.textContent = `${fmt(t.cpu, 0)}%`;
    el.memPct.textContent = `${fmt(t.mem, 0)}%`;
    el.busPct.textContent = `${fmt(t.bus, 0)}%`;
    el.miniCpu.style.setProperty("--m", `${t.cpu}%`);
    el.miniMem.style.setProperty("--m", `${t.mem}%`);
    el.miniBus.style.setProperty("--m", `${t.bus}%`);

    el.stabilityPct.textContent = fmt(t.stability, 0);
    setCssVar("--stab", (t.stability / 100).toFixed(3));

    el.sweepHz.textContent = fmt(t.sweepHz, 2);
    el.clutterPct.textContent = fmt(t.clutter, 0);

    el.instabPct.textContent = fmt(t.instab, 0);
    el.chanDrift.textContent = fmt(t.chanDrift, 2);
    setCssVar("--knob", t.knob.toFixed(3));

    // bottom-note rotation (subtle, haunted)
    if (Math.random() < 0.05) {
      el.bunkerText.textContent = pick([
        "do not trust readings obtained during eclipse drift",
        "if you can hear the fans, the fans can hear you",
        "instrumentation is honest; operators are not",
        "the console remembers the last lock state",
        "avoid venting during comms calibration",
      ]);
    }

    // small health indicator
    const nominal = t.reactor < 85 && t.comms > 80 && t.thermal < 56 && t.pressure > 100.0;
    el.html.querySelector("#nominalTag").dataset.on = nominal ? "1" : "0";

    if (isAlert && Math.random() < 0.12) injectIncident(Math.random() < 0.22 ? "crit" : "warn");
    else if (Math.random() < 0.06) injectIncident();
  }

  // --- Radar contacts --------------------------------------------------------
  let radarContacts = [];

  function makeBlip() {
    const b = document.createElement("div");
    b.className = "blip";
    const x = 14 + Math.random() * 72;
    const y = 14 + Math.random() * 72;
    b.style.left = `${x}%`;
    b.style.top = `${y}%`;
    const r = Math.random();
    if (state.mode === "alert" && r < 0.28) b.classList.add("is-hostile");
    else if (r < 0.22) b.classList.add("is-ghost");
    b.style.animationDelay = `${Math.random() * 0.7}s`;
    return b;
  }

  function setContacts(n) {
    el.radarBlips.innerHTML = "";
    radarContacts = [];
    for (let i = 0; i < n; i += 1) {
      const b = makeBlip();
      radarContacts.push(b);
      el.radarBlips.appendChild(b);
    }
    el.contactCount.textContent = String(n);
  }

  function ping() {
    const ts = performance.now();
    state.effects.pingUntil = ts + 2200;
    const add = state.mode === "alert" ? 4 + Math.floor(Math.random() * 5) : 2 + Math.floor(Math.random() * 4);
    const target = clamp(radarContacts.length + add, 0, 16);
    setContacts(target);
    pushLog("RF", `ACTIVE PING • RETURNS: ${target}`, target > 10 ? "warn" : "ok");
  }

  function toggleSweepBoost() {
    const ts = performance.now();
    state.effects.sweepBoostUntil = ts + 6000;
    setCssVar("--sweepSpeed", "2.4s");
    setTimeout(() => setCssVar("--sweepSpeed", "3.8s"), 6200);
    pushLog("RF", "SWEEP RATE OVERRIDE • WINDOW NARROWED", "ok");
  }

  function toggleIff() {
    state.iff = state.iff === "PASSIVE" ? "ACTIVE" : "PASSIVE";
    el.iffMode.textContent = state.iff;
    pushLog("RF", `IFF MODE: ${state.iff}`, "ok");
  }

  // --- Commands / interactions ----------------------------------------------
  function setMode(mode) {
    state.mode = mode;
    el.html.dataset.mode = mode;

    if (state.power === "nominal") {
      if (mode === "alert") {
        setMainState("ALERT", "crit", "SYS-ALRT");
        el.segmentSub.textContent = "RESPONSE POSTURE • REDLINE AUTHORITY";
        pushLog("SYS", "ALERT MODE ENGAGED • PRIORITY OVERRIDE", "crit");
        state.alerts.unacked += 1;
        updateAlertCount();
      } else {
        setMainState("NOMINAL", "ok", mode === "low" ? "SYS-LOW" : "SYS-LIVE");
        el.segmentSub.textContent = mode === "low" ? "LOW POWER • CONSERVATION PROFILE" : "INSTRUMENTS GREEN • NOMINAL BAND";
        pushLog("SYS", mode === "low" ? "LOW POWER PROFILE APPLIED" : "OPS MODE RESTORED", "ok");
      }
    }
  }

  function setLocked(on) {
    state.locked = on;
    el.html.dataset.lock = on ? "1" : "0";
    el.lockBtn.setAttribute("aria-pressed", on ? "true" : "false");
    el.cmdLock.setAttribute("aria-pressed", on ? "true" : "false");
    el.lockTag.dataset.on = on ? "1" : "0";
    el.lockTag.textContent = on ? "LOCKED" : "UNLOCKED";
    el.lockState.textContent = on ? "SEALED" : "OPEN";
    pushLog("SEC", `PANEL LOCK ${on ? "ENGAGED" : "RELEASED"}`, on ? "warn" : "ok");
  }

  function setArmed(on) {
    state.armed = on;
    el.html.dataset.armed = on ? "1" : "0";
    el.cmdArm.setAttribute("aria-pressed", on ? "true" : "false");
    el.armState.textContent = on ? "ARMED" : "SAFE";
    pushLog("SEC", `ARM STATE: ${on ? "ARMED" : "SAFE"}`, on ? "warn" : "ok");
  }

  function vent() {
    const ts = performance.now();
    state.effects.ventUntil = ts + 5200;
    pushLog("SENS", "VENT CYCLE • PRESSURE RELIEF OPENED", "warn");
  }

  function sync() {
    const ts = performance.now();
    state.synced = true;
    state.effects.syncUntil = ts + 8200;
    el.syncTag.dataset.on = "1";
    el.syncTag.textContent = "SYNCED";
    el.chanMode.textContent = "LOCK";
    pushLog("COMMS", "SYNC COMMAND ACCEPTED • PHASE LOCK", "ok");
    setTimeout(() => {
      if (performance.now() > state.effects.syncUntil) {
        state.synced = false;
        el.syncTag.dataset.on = "0";
        el.syncTag.textContent = "UNSYNCED";
        el.chanMode.textContent = "AUTO";
      }
    }, 8600);
  }

  function purge() {
    state.alerts.unacked = 0;
    updateAlertCount();
    el.logList.innerHTML = "";
    pushLog("SYS", "LOG BUFFER PURGED • NEW SESSION FORMED", "ok");
  }

  // --- Rail tabs (cosmetic) --------------------------------------------------
  function setTab(tab) {
    el.railTabs.forEach((b) => {
      const is = b.dataset.tab === tab;
      b.classList.toggle("is-active", is);
      b.setAttribute("aria-selected", is ? "true" : "false");
    });
    pushLog("SYS", `MODULE VIEW: ${tab.toUpperCase()}`, "ok");
  }

  // --- Power toggle (hold) ---------------------------------------------------
  let holdTimer = null;
  function powerHoldStart() {
    if (state.locked) return;
    if (holdTimer) return;
    el.btnPower.classList.add("is-holding");
    holdTimer = window.setTimeout(() => {
      holdTimer = null;
      el.btnPower.classList.remove("is-holding");
      togglePower();
    }, 520);
  }
  function powerHoldEnd() {
    el.btnPower.classList.remove("is-holding");
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function togglePower() {
    if (state.locked) return;
    if (state.power === "offline") {
      // boot
      state.boot = { pct: 0, step: 0, running: true };
      el.bootList.innerHTML = "";
      setCssVar("--boot", 0);
      el.bootPct.textContent = "00%";
      el.bootHint.textContent = bootHints[0];
      setPowerMode("booting");
      setContacts(2 + Math.floor(Math.random() * 4));
      pushLog("SYS", "POWER BUS ENGAGED • BOOT INIT", "ok");
    } else {
      // power down
      setPowerMode("offline");
      state.boot.running = false;
      state.boot.pct = 0;
      setCssVar("--boot", 0);
      el.bootPct.textContent = "00%";
      el.bootHint.textContent = "Handshake: cold start";
      setSubsystem(el.subCore, "offline");
      setSubsystem(el.subComms, "offline");
      setSubsystem(el.subThermal, "offline");
      setSubsystem(el.subNav, "offline");
      setSubsystem(el.subSec, "offline");
      setSubsystem(el.subEnv, "offline");
      el.chipComms.dataset.state = "offline";
      el.chipThermal.dataset.state = "offline";
      el.chipNav.dataset.state = "offline";
      el.chipSec.dataset.state = "offline";
      setContacts(0);
      pushLog("SYS", "CONTROLLED SHUTDOWN • SAFE STATE", "warn");
    }
  }

  // --- UI helpers ------------------------------------------------------------
  function randomizeTelemetrySeed() {
    const t = state.telemetry;
    t.reactor = 52 + Math.random() * 26;
    t.pressure = 100.2 + Math.random() * 1.4;
    t.comms = 84 + Math.random() * 10;
    t.thermal = 32 + Math.random() * 14;
    t.gain = 10.0 + Math.random() * 4.5;
    t.noise = -73 + Math.random() * 6;
    t.dust = 0.01 + Math.random() * 0.02;
    t.cpu = 35 + Math.random() * 20;
    t.mem = 44 + Math.random() * 25;
    t.bus = 22 + Math.random() * 22;
    t.stability = 74 + Math.random() * 14;
    t.sweepHz = 0.72 + Math.random() * 0.25;
    t.clutter = 10 + Math.random() * 14;
    t.chan = pick(["A", "B", "C", "D", "E", "F", "G", "H"]);
    t.instab = 6 + Math.random() * 10;
    t.chanDrift = 0.06 + Math.random() * 0.18;
    t.knob = 0.45 + Math.random() * 0.2;
    t.linkLevel = 10 + Math.floor(Math.random() * 4);

    pushLog("SENS", "TELEMETRY SEED REKEYED", "ok");
    tickTelemetry();
  }

  function updateEqBars() {
    const bars = $$(".eqbar", el.eqBars);
    bars.forEach((b, i) => {
      const base = (Math.sin((performance.now() / 1000) * (0.8 + i * 0.02)) + 1) / 2;
      const rnd = Math.random() * 0.25;
      const alert = state.mode === "alert" ? 0.18 : 0.0;
      b.style.setProperty("--v", clamp(base * 0.8 + rnd + alert, 0.05, 1));
      b.style.setProperty("--d", `${1.2 + (i % 6) * 0.11}s`);
    });
  }

  function updateTinyGrid() {
    const cells = $$("span", el.tinyGrid);
    const t = state.telemetry;
    const pLive = clamp(0.25 + (t.linkLevel / 16) * 0.55, 0.2, 0.85);
    const pHot = state.mode === "alert" ? 0.18 : 0.08;
    const pCrit = state.mode === "alert" ? 0.12 : 0.04;
    cells.forEach((c) => {
      c.classList.remove("is-live", "is-hot", "is-crit");
      const r = Math.random();
      if (r < pCrit) c.classList.add("is-crit");
      else if (r < pCrit + pHot) c.classList.add("is-hot");
      else if (r < pCrit + pHot + pLive) c.classList.add("is-live");
    });
  }

  function updateClock() {
    if (!el.clock) return;
    el.clock.textContent = timeStamp();
  }

  // --- Toggles ---------------------------------------------------------------
  function setCrt(on) {
    el.html.dataset.crt = on ? "1" : "0";
    el.toggleCrt.setAttribute("aria-pressed", on ? "true" : "false");
  }
  function setScan(on) {
    el.html.dataset.scan = on ? "1" : "0";
    el.toggleScan.setAttribute("aria-pressed", on ? "true" : "false");
  }

  // --- Init -----------------------------------------------------------------
  function init() {
    // defaults
    el.html.dataset.mode = state.mode;
    el.html.dataset.power = state.power;
    el.html.dataset.lock = "0";
    el.html.dataset.crt = "1";
    el.html.dataset.scan = "1";

    setCssVar("--sweepSpeed", "3.8s");
    setCssVar("--sweepGlow", "0.55");

    // initial content
    setPowerMode("booting");
    setSubsystem(el.subCore, "syncing");
    setContacts(3 + Math.floor(Math.random() * 4));

    // seed log with a few lines
    pushLog("SYS", "CONSOLE WAKE • BOOT SEQUENCE PENDING", "ok");
    pushLog("SEC", "OPERATOR PRESENCE NOT VERIFIED", "warn");

    // boot list
    el.bootList.innerHTML = "";
    bootListAdd("SYS / BOOTSTRAP SEQUENCE ACCEPTED", "ok");

    // wire buttons
    el.btnPower.addEventListener("pointerdown", powerHoldStart);
    el.btnPower.addEventListener("pointerup", powerHoldEnd);
    el.btnPower.addEventListener("pointercancel", powerHoldEnd);
    el.btnPower.addEventListener("mouseleave", powerHoldEnd);

    el.btnAlert.addEventListener("click", () => {
      if (state.locked) return;
      const next = state.mode === "alert" ? "ops" : "alert";
      setMode(next);
      el.btnAlert.setAttribute("aria-pressed", next === "alert" ? "true" : "false");
    });

    el.btnRandomize.addEventListener("click", () => {
      if (state.locked) return;
      randomizeTelemetrySeed();
    });

    el.lockBtn.addEventListener("click", () => {
      setLocked(!state.locked);
    });

    el.cmdLock.addEventListener("click", () => setLocked(!state.locked));
    el.cmdArm.addEventListener("click", () => {
      if (state.locked) return;
      setArmed(!state.armed);
    });
    el.cmdVent.addEventListener("click", () => {
      if (state.locked) return;
      vent();
    });
    el.cmdSync.addEventListener("click", () => {
      if (state.locked) return;
      sync();
    });
    el.cmdPurge.addEventListener("click", () => {
      if (state.locked) return;
      purge();
    });

    el.btnAck.addEventListener("click", () => {
      if (state.locked) return;
      state.alerts.unacked = 0;
      updateAlertCount();
      pushLog("SEC", "ALERTS ACKNOWLEDGED", "ok");
    });
    el.btnClear.addEventListener("click", () => {
      if (state.locked) return;
      el.logList.innerHTML = "";
      state.alerts.unacked = 0;
      updateAlertCount();
      pushLog("SYS", "LOG CLEARED", "ok");
    });
    el.btnInject.addEventListener("click", () => {
      if (state.locked) return;
      injectIncident(Math.random() < 0.25 ? "warn" : "ok");
    });

    el.btnPing.addEventListener("click", () => {
      if (state.locked) return;
      ping();
    });
    el.btnSweep.addEventListener("click", () => {
      if (state.locked) return;
      toggleSweepBoost();
    });
    el.btnIff.addEventListener("click", () => {
      if (state.locked) return;
      toggleIff();
    });

    // Mode pick buttons
    [el.modeOps, el.modeAlert, el.modeLow].forEach((b) => {
      b.addEventListener("click", () => {
        if (state.locked) return;
        setMode(b.dataset.modePick);
        el.btnAlert.setAttribute("aria-pressed", state.mode === "alert" ? "true" : "false");
      });
    });

    // CRT / scan toggles
    el.toggleCrt.addEventListener("click", () => {
      const on = el.html.dataset.crt !== "0";
      setCrt(!on);
    });
    el.toggleScan.addEventListener("click", () => {
      const on = el.html.dataset.scan !== "0";
      setScan(!on);
    });

    // Tabs
    el.railTabs.forEach((b) => {
      b.addEventListener("click", () => {
        if (state.locked) return;
        setTab(b.dataset.tab);
      });
    });

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === "p") {
        e.preventDefault();
        togglePower();
      } else if (k === "a") {
        e.preventDefault();
        if (state.locked) return;
        setMode(state.mode === "alert" ? "ops" : "alert");
        el.btnAlert.setAttribute("aria-pressed", state.mode === "alert" ? "true" : "false");
      } else if (k === "l") {
        e.preventDefault();
        setLocked(!state.locked);
      } else if (k === "1") {
        e.preventDefault();
        if (state.locked) return;
        ping();
      } else if (k === "2") {
        e.preventDefault();
        if (state.locked) return;
        toggleSweepBoost();
      } else if (k === "3") {
        e.preventDefault();
        if (state.locked) return;
        toggleIff();
      } else if (k === "4") {
        e.preventDefault();
        if (state.locked) return;
        state.alerts.unacked = 0;
        updateAlertCount();
        pushLog("SEC", "ALERTS ACKNOWLEDGED", "ok");
      } else if (k === "5") {
        e.preventDefault();
        if (state.locked) return;
        purge();
      } else if (k === "f1") setTab("overview");
      else if (k === "f2") setTab("power");
      else if (k === "f3") setTab("telemetry");
      else if (k === "f4") setTab("signals");
      else if (k === "f5") setTab("security");
    });

    // intervals
    updateClock();
    window.setInterval(updateClock, 1000);
    window.setInterval(bootTick, 180);
    window.setInterval(tickTelemetry, 520);
    window.setInterval(updateEqBars, 280);
    window.setInterval(updateTinyGrid, 850);

    // start telemetry seed
    randomizeTelemetrySeed();

    // make sweep feel alive
    window.setInterval(() => {
      if (state.power !== "nominal") return;
      if (Math.random() < (state.mode === "alert" ? 0.35 : 0.2)) {
        const n = clamp(radarContacts.length + (Math.random() < 0.5 ? -1 : 1), 0, 16);
        setContacts(n);
      }
    }, 2200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

