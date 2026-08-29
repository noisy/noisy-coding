/**
 * A window, and nothing else.
 *
 * The daemon stays in Python and the UI stays in the browser bundle it
 * already ships; this process exists only to do the four things a browser
 * cannot: be transparent, stay above other applications, let clicks pass
 * through to whatever is underneath, and have no window frame.
 *
 * Deliberately thin. If Electron turns out to be the wrong choice, the
 * thing being replaced should be this file, not an application.
 */
const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, screen } = require("electron");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");

/** Packaged, files live in the asar; in dev they sit next to this file. */
const asset = (name) => path.join(__dirname, "build", name);

// The daemon serves the built dashboard under /next/ - the bare /companion
// path belongs to the vite dev server, not to the daemon.
/* Which daemon does the app talk to?
 *
 * Three instances can coexist and must never fight over a port:
 *   8765  production, the Docker container
 *   7765  a developer instance
 *   9765  ours, spawned by this app
 * (the audio bridge is always HTTP port + 1, automatically.)
 *
 * But spawning is the LAST resort. Two daemons mean two microphones
 * competing for the same device, which is a mess we spent this morning
 * untangling - so if one is already listening, attach to it instead. That
 * also matches the spec: the app must live alongside an existing CLI or
 * Docker install rather than replacing it.
 */
const OWN_PORT = Number(process.env.NOISY_APP_PORT || 9765);
/* Ours first, then the developer instance, then production.
 * Production last on purpose: it runs a PUBLISHED image, which may predate
 * the views this app needs - attaching to it first served a not-found page
 * where the widget should have been. */
const CANDIDATE_PORTS = [OWN_PORT, 7765, 8765];

/** Can this port serve what the app actually needs?
 *
 * Not "is something alive" - an older daemon answers /status happily and
 * then 404s the widget, which looks like a broken app rather than an
 * unsuitable daemon. Ask for the view itself. */
function serves(port, path) {
  return new Promise((resolve) => {
    const request = http.get(
      { host: "127.0.0.1", port, path, timeout: 700 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    request.on("timeout", () => (request.destroy(), resolve(false)));
    request.on("error", () => resolve(false));
  });
}

let child = null;   // the daemon WE started, if any

/** Where the frozen daemon lives: inside the bundle once packaged, in the
 *  build directory during development. */
function daemonBinary() {
  const packaged = path.join(process.resourcesPath || "", "daemon", "noisy-coding-daemon");
  const local = path.join(__dirname, "build", "daemon", "noisy-coding-daemon");
  return require("node:fs").existsSync(packaged) ? packaged : local;
}

/** Start our own daemon and wait for it to answer. */
async function spawnDaemon() {
  const bin = daemonBinary();
  if (!require("node:fs").existsSync(bin)) return null;

  child = spawn(bin, [], {
    env: { ...process.env, NOISY_CODING_LISTENER_PORT: String(OWN_PORT) },
    stdio: "ignore",
    // Not detached: the daemon is part of this app and must not outlive it.
    // An orphaned daemon holding the microphone is worse than no daemon.
    detached: false,
  });
  child.on("exit", () => (child = null));

  // Starting takes a few seconds - audio devices, models, the HTTP server.
  for (let i = 0; i < 40; i += 1) {
    if (await serves(OWN_PORT, "/status")) return OWN_PORT;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

/** The first daemon already running, or null when we must start our own. */
async function findDaemon() {
  for (const port of CANDIDATE_PORTS) {
    if (await serves(port, "/next/companion")) return port;
  }
  // Nothing can serve the widget: fall back to anything alive, so the
  // dashboard still works and the menu bar can say what it attached to.
  for (const port of CANDIDATE_PORTS) {
    if (await serves(port, "/status")) return port;
  }
  return null;
}

/* Two windows, one app:
 *   - the DASHBOARD, an ordinary window with the full UI
 *   - the WIDGET, frameless and always on top
 * Both are views of the same bundle served by the daemon, so neither
 * duplicates anything; the app is a window manager, not a second client. */
let base = process.env.NOISY_DAEMON_URL || null;   // resolved at startup
let attachedPort = null;                           // which daemon we found
const widgetUrl = () => `${base}/next/companion?transparent=1`;
const dashboardUrl = () => `${base}/next/`;

let win = null;
let dash = null;
let tray = null;
/** Click-through: the widget is visible but the editor beneath stays usable. */
let ghost = false;

function createDashboard() {
  if (dash && !dash.isDestroyed()) {
    dash.show();
    dash.focus();
    return dash;
  }
  dash = new BrowserWindow({
    width: 1400,
    height: 900,
    // An ordinary window: it has a title bar, it goes behind other windows,
    // it belongs in the Dock. Everything the widget deliberately is not.
    title: "Noisy Coding",
    backgroundColor: "#050e18",
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  dash.loadURL(dashboardUrl());
  dash.once("ready-to-show", () => dash.show());
  dash.on("closed", () => (dash = null));
  return dash;
}

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 280,
    // Frameless and transparent: the page paints its own background, and
    // /companion?transparent=1 strips the HUD's dark chrome for exactly this.
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: true,
    // Show only once it has painted - a transparent window that appears
    // before its content does flashes as a black rectangle.
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // "screen-saver" rather than "floating": the lower levels lose to
  // full-screen applications, which is where a widget is most wanted.
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadURL(widgetUrl());
  win.once("ready-to-show", () => win.show());
  watchHover(win);
  win.on("closed", () => (win = null));
}

/* Is the pointer over the window?
 *
 * The page cannot answer this by itself: the drag handle is an OS
 * app-region, and macOS swallows mouse events inside it - so moving onto
 * the handle looks exactly like leaving the window, and anything that
 * depends on hover disappears under the cursor.
 *
 * The main process has no such blind spot: it can ask the system where the
 * cursor is and compare it with the window's own bounds. Polled rather than
 * evented because there is no "cursor entered window" event to listen to;
 * 120ms is under the threshold where a fade feels late.
 */
function watchHover(win) {
  let inside = null;
  const timer = setInterval(() => {
    if (win.isDestroyed()) return clearInterval(timer);
    const { x, y } = screen.getCursorScreenPoint();
    const b = win.getBounds();
    const now = x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
    // Re-assert every tick rather than only on change. The page has its own
    // mouseout fallback for the browser, and inside the app that fallback
    // fires when the pointer crosses into the drag strip - the OS stops
    // sending events there, which looks to the page like leaving the window.
    // It would then clear the class and this watcher, believing nothing had
    // changed, would never put it back. So the authority repeats itself.
    if (now === inside && !now) return;
    inside = now;
    win.webContents
      .executeJavaScript(`document.body.classList.toggle("hovering", ${now})`)
      .catch(() => {});
  }, 120);
  win.on("closed", () => clearInterval(timer));
}

function setGhost(on) {
  ghost = on;
  // forward:true keeps hover and scroll working while clicks pass through -
  // without it the widget becomes a picture you cannot even scroll.
  win?.setIgnoreMouseEvents(on, { forward: true });
  win?.webContents.send("ghost", on);
  buildTray();
}

function buildTray() {
  const menu = Menu.buildFromTemplate([
    // Which daemon is answering matters when three can be running: the app
    // should never leave you guessing whose conversation you are looking at.
    {
      label: attachedPort
        ? `Daemon: :${attachedPort}${child ? " (ours)" : " (attached)"}`
        : "Daemon: not found",
      enabled: false,
    },
    { type: "separator" },
    { label: "Open dashboard", click: () => createDashboard() },
    {
      label: win && !win.isDestroyed() && win.isVisible() ? "Hide widget" : "Show widget",
      click: () => {
        if (!win || win.isDestroyed()) return createWindow();
        win.isVisible() ? win.hide() : win.show();
        buildTray();
      },
    },
    { type: "separator" },
    { label: ghost ? "Click-through: ON" : "Click-through: OFF", click: () => setGhost(!ghost) },
    {
      label: "Reload both (Ctrl+Alt+R)",
      click: () => {
        win?.reload();
        dash?.reload();
      },
    },
    { type: "separator" },
    { label: "Quit", role: "quit" },
  ]);
  tray?.setContextMenu(menu);
}

app.whenReady().then(async () => {
  /* Attach before opening anything: both windows are views of a daemon, and
   * pointing them at nothing produces a not-found page that looks like a
   * bug rather than a missing service. */
  if (!base) {
    attachedPort = await findDaemon();
    if (attachedPort) {
      base = `http://127.0.0.1:${attachedPort}`;
    } else {
      // Nothing usable is running - start the one we carry.
      attachedPort = await spawnDaemon();
      base = `http://127.0.0.1:${attachedPort || OWN_PORT}`;
    }
  }

  /* Keep the Dock icon for as long as the app runs.
   *
   * macOS drops an app out of the Dock once it owns no ordinary windows -
   * and the widget is frameless, always-on-top and visible on every space,
   * which does not count. So the icon appeared at launch and vanished a
   * moment later, exactly as described. Asking for it explicitly keeps it. */
  app.dock?.show();

  createWindow();

  // A real menu-bar icon. "Template" in the filename tells macOS it is a
  // monochrome mask, so it inverts correctly in light and dark menu bars.
  // Without this the app is running and completely invisible - which is
  // exactly how it felt.
  const trayIcon = nativeImage.createFromPath(asset("trayTemplate.png"));
  trayIcon.setTemplateImage(true);
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
  if (trayIcon.isEmpty()) tray.setTitle("◉");
  // Clicking the icon brings the widget back if it was closed or lost.
  tray.on("click", () => {
    if (!win || win.isDestroyed()) return createWindow();
    win.show();
    win.setAlwaysOnTop(true, "screen-saver");
  });
  tray.setToolTip(
    attachedPort
      ? `noisy-coding - attached to :${attachedPort}`
      : `noisy-coding - no daemon found (expected :${OWN_PORT})`,
  );
  buildTray();

  // A keyboard escape hatch: a click-through window cannot be clicked to
  // turn click-through off again.
  globalShortcut.register("Control+Alt+G", () => setGhost(!ghost));

  /* Reload BOTH windows from anywhere, even when the widget has no focus -
   * which it usually does not, since it floats over whatever you are
   * actually working in. Testing a change should not require hunting for
   * the window first. */
  globalShortcut.register("Control+Alt+R", () => {
    win?.reload();
    dash?.reload();
  });

  /* A frameless window has no menu of its own, so the ordinary shortcuts
   * have to be registered by hand - without them there is no way to reload
   * or quit except the tray, which is easy to miss on a window with no
   * chrome. Application-scoped, so they only fire while it has focus. */
  const menu = Menu.buildFromTemplate([
    {
      label: "Companion",
      submenu: [
        { role: "reload", accelerator: "CommandOrControl+R" },
        { role: "toggleDevTools", accelerator: "CommandOrControl+Alt+I" },
        { type: "separator" },
        { role: "quit", accelerator: "CommandOrControl+Q" },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  // Clicking the Dock icon opens the dashboard - the widget is always
  // there, so it is not what someone is asking for.
  app.on("activate", () => createDashboard());
});

/* Closing a window does NOT quit: the app lives in the menu bar and the
 * widget is meant to outlive any particular window. Quit from the tray. */
app.on("window-all-closed", () => {});

/* Take the daemon down with us. It was started for this app; leaving it
 * running would hold the microphone open with nothing to talk to. */
app.on("before-quit", () => {
  child?.kill("SIGTERM");
  child = null;
});
