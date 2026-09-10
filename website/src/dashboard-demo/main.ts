import { applyPreviewAccent } from '../previewAccent';
import { createApp } from 'vue';
import App from '@dashboard/App.vue';
import '@dashboard/styles/hud.css';
import { resetScenario } from '@dashboard/storybook/daemon.fixture';
import { useAvatarSet } from '@dashboard/composables/useAvatarSet';

applyPreviewAccent();
resetScenario('conversation');
useAvatarSet().selectAvatarSet('editorial');
createApp(App).mount('#app');
