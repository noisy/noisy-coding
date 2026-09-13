import { createApp } from "vue";
import { applyPreviewAccent } from "./previewAccent";
import App from "./App.vue";
import "./style.css";
import { websiteAnalytics } from './analytics';

applyPreviewAccent();
websiteAnalytics.start();

createApp(App).mount("#app");
