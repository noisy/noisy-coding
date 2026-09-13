export function companionAt(events, scenario, timeMs = Infinity) {
  let voice = 'lux', mode = 'idle', activity = null, liveText = '';
  const feed = [];
  for (const event of events) {
    if (event.atMs > timeMs) continue;
    if (event.type === 'user-start') { voice = event.voice.toLowerCase(); mode = 'user'; liveText = event.prompt; }
    if (event.type === 'user-end') { feed.push({ role: 'user', text: liveText, id: event.sequence, voice }); liveText = ''; mode = 'idle'; }
    if (event.type === 'agent-start') { voice = event.voice.toLowerCase(); mode = 'claude'; feed.push({ role: 'claude', text: event.text, id: event.sequence, voice }); }
    if (event.type === 'agent-end') mode = 'idle';
    if (event.type === 'activity-start') activity = event.text;
    if (event.type === 'activity-end') activity = null;
    if (event.type === 'recording-stop') { activity = null; mode = 'idle'; liveText = ''; }
  }
  const voices = [...new Set(scenario.turns.flatMap(turn => [turn.agent, ...turn.replies.map(reply => reply.voice)]))];
  return { voice, mode, activity, liveText, feed: feed.filter(message => message.voice === voice), agents: voices.map(name => ({ name, label: name === 'Lux' ? 'Claude' : name, voice: name.toLowerCase(), active: voice === name.toLowerCase() })) };
}
