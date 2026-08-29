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

/** Packaged, files live in the asar; in dev they sit next to this file. */
const asset = (name) => path.join(__dirname, "build", name);

// The daemon serves the built dashboard under /next/ - the bare /companion
// path belongs to the vite dev server, not to the daemon.
/* Two windows, one app:
 *   - the DASHBOARD, an ordinary window with the full UI
 *   - the WIDGET, frameless and always on top
 * Both are views of the same bundle served by the daemon, so neither
 * duplicates anything; the app is a window manager, not a second client. */
const BASE = process.env.NOISY_DAEMON_URL || "http://127.0.0.1:7765";
const WIDGET_URL = process.env.NOISY_COMPANION_URL || `${BASE}/next/companion?transparent=1`;
const DASHBOARD_URL = process.env.NOISY_DASHBOARD_URL || `${BASE}/next/`;

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
  dash.loadURL(DASHBOARD_URL);
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

  win.loadURL(WIDGET_URL);
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

app.whenReady().then(() => {
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
  tray.setToolTip("noisy-coding companion");
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
