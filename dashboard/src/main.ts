import { createApp } from "vue";
import App from "./App.vue";
import DebugView from "./debug/DebugView.vue";
import LogsView from "./logs/LogsView.vue";
import "./styles/hud.css";

// Client-side view routing on pathname:
// /debug — chat-window sandbox (hand-clicked state transitions).
// /logs  — live daemon event stream (incl. #16 nudge decisions).
function rootView() {
  const path = window.location.pathname;
  if (path.startsWith("/debug")) return DebugView;
  if (path.startsWith("/logs")) return LogsView;
  return App;
}
createApp(rootView()).mount("#app");
