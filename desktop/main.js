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

// The daemon serves the built dashboard under /next/ - the bare /companion
// path belongs to the vite dev server, not to the daemon.
const DEFAULT_URL = "http://127.0.0.1:7765/next/companion?transparent=1";
const url = process.env.NOISY_COMPANION_URL || DEFAULT_URL;

let win = null;
let tray = null;
/** Click-through: the widget is visible but the editor beneath stays usable. */
let ghost = false;

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

  win.loadURL(url);
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
    { label: ghost ? "Click-through: ON" : "Click-through: OFF", click: () => setGhost(!ghost) },
    { label: "Reload", click: () => win?.reload() },
    { type: "separator" },
    { label: "Quit", role: "quit" },
  ]);
  tray?.setContextMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  // An empty image keeps the tray icon a placeholder rather than a broken
  // one; the artwork is a later problem than the window behaviour.
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("◉");
  tray.setToolTip("noisy-coding companion");
  buildTray();

  // A keyboard escape hatch: a click-through window cannot be clicked to
  // turn click-through off again.
  globalShortcut.register("Control+Alt+G", () => setGhost(!ghost));

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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// The widget is not a document: closing its window should quit, and the
// dock icon is noise for something that lives in the menu bar.
app.on("window-all-closed", () => app.quit());
app.dock?.hide();
