import { createApp } from "vue";
import App from "./App.vue";
import DebugView from "./debug/DebugView.vue";
import MobileView from "./mobile/MobileView.vue";
import "./styles/hud.css";

// /debug is the chat-window sandbox: hand-clicked state transitions drive
// the real components, with an event log for bug reports.
// /m is the mobile companion (phone via the mobile server / ngrok).
const path = window.location.pathname;
const root = path.startsWith("/debug") ? DebugView : /(^|\/)m\/?$/.test(path) ? MobileView : App;
createApp(root).mount("#app");
