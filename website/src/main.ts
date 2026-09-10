import { createApp } from "vue";
import { applyPreviewAccent } from "./previewAccent";
import App from "./App.vue";
import "./style.css";

applyPreviewAccent();

createApp(App).mount("#app");
