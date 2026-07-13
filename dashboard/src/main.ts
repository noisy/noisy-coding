import { createApp } from "vue";
import App from "./App.vue";
import DebugView from "./debug/DebugView.vue";
import "./styles/hud.css";

// /debug is the chat-window sandbox: hand-clicked state transitions drive
// the real components, with an event log for bug reports.
const root = window.location.pathname.startsWith("/debug") ? DebugView : App;
createApp(root).mount("#app");
