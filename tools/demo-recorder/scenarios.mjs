const crewTurns = [
  { prompt: "how's staging?", agent: 'Lux', replies: [
    { voice: 'Lux', clip: 'lux-1', text: 'Green! Ready to promote.' },
  ] },
  { prompt: 'do it', agent: 'Lux', replies: [
    { voice: 'Lux', clip: 'lux-2', text: 'on it!' },
    { voice: 'Rex', clip: 'rex-1', text: "Last week's PR - finally approved!!!", handover: true },
    { voice: 'Luna', clip: 'luna-1', text: 'Alarm went off! It was the courier.', handover: true },
    { voice: 'Luna', clip: 'luna-2', text: 'Package is big - probably the printer.' },
  ] },
  { prompt: 'thanks', agent: 'Luna', replies: [] },
];

export const SCENARIOS = [
  { id: 'crew', title: '1 · Meet your crew', intro: [], turns: crewTurns },
  { id: 'hero', title: '2 · Hero — fix the webhook', intro: [
    { voice: 'Lux', clip: 'hero-lux-1', text: "I'm ready." },
    { voice: 'Lux', clip: 'hero-lux-2', text: "Your session is running. I'll keep you posted." },
  ], turns: [
    { prompt: "What's wrong with the webhook?", agent: 'Lux', replies: [
      { voice: 'Lux', clip: 'hero-lux-3', text: 'Bad signatures were retried forever. I made them fail fast.' },
    ] },
    { prompt: 'Good. Run the full suite.', agent: 'Lux', replies: [
      { voice: 'Lux', clip: 'hero-lux-4', text: 'Running - both paths are pinned by the new test.' },
    ] },
  ] },
];
