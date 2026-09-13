export async function captureTake(camera, onStarted, onFailure) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    throw new Error('Recording is unavailable here. Open this page in a recent Chrome browser over HTTPS, or use Rehearse.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video: camera, audio: true });
  let recorder;
  try { recorder = new MediaRecorder(stream); }
  catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
  const chunks = [];
  let ending = false;
  const finished = new Promise(resolve => {
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    };
  });
  recorder.onerror = () => onFailure('Recording was interrupted. Save the captured portion and start a new take.');
  stream.getTracks().forEach(track => track.onended = () => {
    if (!ending) onFailure('Camera or microphone disconnected. Save the captured portion.');
  });
  await new Promise((resolve, reject) => {
    recorder.onstart = () => { onStarted(); resolve(); };
    try { recorder.start(250); }
    catch (error) { stream.getTracks().forEach(track => track.stop()); reject(error); }
  });
  return { stream, stop() {
    ending = true;
    if (recorder.state !== 'inactive') recorder.stop();
    return finished;
  } };
}

export function playClip(url, signal, started) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    const cleanup = () => {
      signal.removeEventListener('abort', cancelled);
      audio.onplaying = audio.onended = audio.onerror = null;
      audio.pause();
    };
    const cancelled = () => { cleanup(); resolve(); };
    if (signal.aborted) return resolve();
    signal.addEventListener('abort', cancelled, { once: true });
    audio.onplaying = () => { audio.onplaying = null; started(); };
    audio.onended = () => { cleanup(); resolve(); };
    audio.onerror = () => { cleanup(); reject(new Error('A voice clip could not load. Check your connection, save this take, and retry.')); };
    audio.play().catch(() => { cleanup(); reject(new Error('Audio playback was blocked. Save this take and retry in Chrome with sound allowed for this page.')); });
  });
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
