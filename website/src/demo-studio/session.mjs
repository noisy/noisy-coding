/** Script playback uses one clock; recordings and exported events share its origin. */
export class StudioSession {
  constructor(scenario, { now, play, wait, update, schedule = null }) {
    Object.assign(this, { scenario, now, play, wait, update, schedule });
    this.events = [];
    this.turn = 0;
    this.phase = 'ready';
    this.abort = new AbortController();
  }
  log(type, detail = {}) {
    this.events.push({ sequence: this.events.length, atMs: this.now(), type, ...detail });
    this.update();
  }
  async start() {
    this.phase = 'reply';
    this.log('recording-start');
    await this.replies(this.scenario.intro);
    if (!this.abort.signal.aborted) await this.prompt();
  }
  async prompt() {
    if (this.turn >= this.scenario.turns.length) return this.stop(true);
    await this.pauses(this.schedule?.beforeTurn[`u${this.turn + 1}`] ?? []);
    if (this.abort.signal.aborted) return;
    const turn = this.scenario.turns[this.turn];
    this.phase = 'user';
    this.log('user-start', { utterance: `u${this.turn + 1}`, prompt: turn.prompt, voice: turn.agent });
    this.log('transcript', { utterance: `u${this.turn + 1}`, text: turn.prompt, final: false, source: 'script' });
  }
  async advance() {
    if (this.phase !== 'user') return;
    this.phase = 'reply';
    const turn = this.scenario.turns[this.turn];
    this.log('transcript', { utterance: `u${this.turn + 1}`, text: turn.prompt, final: true, source: 'script' });
    this.log('user-end', { utterance: `u${this.turn + 1}` });
    await this.replies(turn.replies);
    if (this.abort.signal.aborted) return;
    this.turn++;
    await this.prompt();
  }
  async replies(replies) {
    for (const reply of replies) {
      if (this.abort.signal.aborted) return;
      await this.pauses(this.schedule?.beforeReply[reply.clip] ?? (reply.pauseBeforeMs ? [{ durationMs: reply.pauseBeforeMs, text: null }] : []));
      if (this.abort.signal.aborted) return;
      await this.play(reply, this.abort.signal, () => this.log('agent-start', reply));
      if (this.abort.signal.aborted) return;
      this.log('agent-end', { clip: reply.clip });
    }
  }
  async pauses(pauses) {
    for (const pause of pauses) {
      if (this.abort.signal.aborted) return;
      if (pause.text) this.log('activity-start', { text: pause.text });
      await this.wait(pause.durationMs, this.abort.signal);
      if (this.abort.signal.aborted) return;
      if (pause.text) this.log('activity-end');
    }
  }
  stop(complete = false) {
    if (this.phase === 'done') return;
    if (this.phase === 'user') this.log('user-end', { utterance: `u${this.turn + 1}` });
    this.abort.abort();
    this.phase = 'done';
    this.log('recording-stop', { complete });
  }
}

export function wait(ms, signal) {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}
