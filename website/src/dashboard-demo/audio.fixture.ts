import { ref } from 'vue';
/** The public dashboard demo never opens devices or an audio websocket. */
export function useBrowserAudio() {
  const active = ref(false);
  const micLive = ref(false);
  const error = ref('');
  const playbackPaused = ref(false);
  const unavailable = async () => { error.value = 'Audio devices are available in the installed application.'; };
  return {
    active, micLive, error, playbackPaused,
    connect: unavailable, enable: unavailable, resumeMic: unavailable,
    suspendMic() {}, disable() {}, skip() {},
    pauseToggle() { playbackPaused.value = !playbackPaused.value; },
  };
}
