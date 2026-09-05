import type { Meta, StoryObj } from '@storybook/vue3';
import App from './App.vue';
import { resetScenario, type Scenario } from './storybook/daemon.fixture';
const meta:Meta = {
  title:'Product/Dashboard', component:App, parameters:{layout:'fullscreen'},
};
export default meta;
function story(scenario:Scenario):StoryObj {
  return {render:()=>{ resetScenario(scenario); return {components:{App},template:'<App />'}; }};
}
export const Conversation=story('conversation');
export const Recording=story('recording');
export const Speaking=story('speaking');
export const Queued=story('queued');
export const Muted=story('muted');
export const Offline=story('offline');
export const Error=story('error');
export const Empty=story('empty');
export const Setup=story('setup');
export const Shutdown=story('shutdown');
export const LongContent=story('long');
