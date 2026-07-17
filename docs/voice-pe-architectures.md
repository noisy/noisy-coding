# Voice PE integration — two candidate architectures

How to hook the **Home Assistant Voice Preview Edition** speaker into the
noisy-coding / Claude Code voice system. Two candidate designs:

- **Architecture A — "default"**: the speaker is paired with Home Assistant the way
  Nabu Casa intended; HA owns the audio pipeline (STT/TTS) and hands *text* to a
  thin bridge plugged into its conversation-agent slot.
- **Architecture B — "direct"**: no HA in the audio path; the noisy-coding daemon
  speaks the ESPHome native API itself (via `aioesphomeapi`) and owns STT/TTS.

In **both** designs the brain is the same: Claude Code running on the
subscription (no per-token API billing), fed through the daemon queue on
`:8765`. Home Assistant, when present, is additionally exposed to the agent as
an **MCP server** for device control — that part is identical in A and B and
independent of the audio path.

---

## Architecture A — speaker paired with Home Assistant (default)

### Components

```mermaid
flowchart LR
    subgraph Device["Voice PE (hardware)"]
        WW["microWakeWord<br/>('Hey Jarvis', on ESP32-S3)"]
        XMOS["XMOS XU316<br/>AEC + noise suppression"]
        SPK["Speaker / 3.5mm jack"]
    end

    subgraph HA["Home Assistant (Docker, 24/7)"]
        PIPE["Assist pipeline"]
        STT["STT provider<br/>(Whisper local / HA Cloud)"]
        BRIDGE["Custom conversation agent<br/>'noisy-coding bridge' (~150 LOC)"]
        TTS["TTS provider<br/>(Piper local / HA Cloud / Grok-via-Wyoming)"]
        MCPS["Built-in MCP server<br/>(lights, sensors, Zigbee, Matter…)"]
    end

    subgraph Mac["Mac (noisy-coding + agent)"]
        Q["Daemon queue :8765"]
        CC["Claude Code<br/>(subscription, hooks)"]
        GTTS["Grok TTS (optional,<br/>for announce path)"]
    end

    Device -- "ESPHome native API<br/>(TCP + protobuf, audio stream)" --> PIPE
    PIPE --> STT --> BRIDGE
    BRIDGE -- "POST transcript" --> Q --> CC
    CC -- "reply text" --> BRIDGE --> TTS --> SPK
    CC -. "long answers:<br/>assist_satellite.announce (text or MP3 URL)" .-> PIPE
    GTTS -. "rendered MP3 served over LAN" .-> PIPE
    CC == "MCP tools (device control)" ==> MCPS
```

### Utterance flow (sequence)

```mermaid
sequenceDiagram
    autonumber
    actor K as Krzysztof
    participant PE as Voice PE
    participant HA as Home Assistant<br/>(Assist pipeline)
    participant ST as STT provider
    participant BR as Bridge<br/>(conversation agent)
    participant Q as Daemon queue :8765
    participant CC as Claude Code
    participant TT as TTS provider

    K->>PE: "Hey Jarvis, …question…"
    Note over PE: wake word detected on-device<br/>XMOS applies AEC / denoise
    PE->>HA: open voice session, stream audio<br/>(ESPHome API, TCP)
    HA->>ST: audio stream
    ST-->>HA: final transcript (text)
    HA->>BR: async_process(text, conversation_id, lang)
    BR->>Q: POST /transcript
    Q->>CC: hook injects [VOICE] message

    alt quick answer (fits pipeline timeout)
        CC-->>BR: reply text
        BR-->>HA: conversation result
        HA->>TT: synthesize reply
        TT-->>HA: audio
        HA-->>PE: play audio
        PE-->>K: spoken answer
    else long agent turn (tool use, minutes)
        BR-->>HA: fast ack ("on it…")
        HA->>TT: synthesize ack
        HA-->>PE: play ack
        Note over CC: agent works (tools, MCP…)
        CC->>HA: assist_satellite.announce<br/>(text, or MP3 URL from Grok TTS)
        HA-->>PE: play announcement
        PE-->>K: spoken answer (later)
    end
```

### Notes

- **Speaker ↔ HA transport is not HTTP**: persistent TCP with protobuf
  (ESPHome native API); audio is streamed over it after wake-word detection.
- **STT/TTS are pluggable pipeline providers** (Wyoming protocol = simple TCP,
  runs as sidecar containers). No ready-made Grok STT provider exists; wrapping
  Grok in Wyoming is ~150 LOC if ever needed.
- **Language / engine switching by voice**: pipeline settings are HA config;
  the satellite exposes a `select` entity choosing the active pipeline. The
  agent flips it via MCP ("switch to English" → next utterance uses the other
  pipeline).
- **Voice identity**: the synchronous reply path uses the pipeline TTS voice
  (e.g. Piper), *not* Grok's carina. The announce path can carry ready-made
  Grok MP3s, so the daily-driver voice can stay consistent there.

---

## Architecture B — daemon talks to the speaker directly (no HA in audio path)

### Components

```mermaid
flowchart LR
    subgraph Device["Voice PE (hardware)"]
        WW2["microWakeWord<br/>('Hey Jarvis', on ESP32-S3)"]
        XMOS2["XMOS XU316<br/>AEC + noise suppression"]
        SPK2["Speaker / 3.5mm jack"]
    end

    subgraph Mac["noisy-coding daemon (voice-pipeline host)"]
        ESP["aioesphomeapi client<br/>(subscribes as voice assistant)"]
        GSTT["Grok STT"]
        Q2["Daemon queue :8765"]
        GT2["Grok TTS (carina)"]
        PB["Playback router<br/>(local speakers | browser | Voice PE)"]
    end

    subgraph Agent["Agent"]
        CC2["Claude Code<br/>(subscription, hooks)"]
    end

    subgraph HAopt["Home Assistant (optional, later)"]
        MCPS2["MCP server only —<br/>device control, no audio role"]
    end

    Device -- "ESPHome native API<br/>(TCP + protobuf, audio stream)" --> ESP
    ESP --> GSTT --> Q2 --> CC2
    CC2 -- "speak / announce" --> GT2 --> PB
    PB -- "audio back over ESPHome API" --> SPK2
    CC2 -. "MCP tools (optional)" .-> MCPS2
```

### Utterance flow (sequence)

```mermaid
sequenceDiagram
    autonumber
    actor K as Krzysztof
    participant PE as Voice PE
    participant D as noisy-coding daemon<br/>(aioesphomeapi host)
    participant GS as Grok STT
    participant Q as Queue :8765
    participant CC as Claude Code
    participant GT as Grok TTS

    Note over D,PE: daemon holds a persistent ESPHome API<br/>connection and is registered as the<br/>voice-assistant pipeline host
    K->>PE: "Hey Jarvis, …question…"
    Note over PE: wake word detected on-device<br/>XMOS applies AEC / denoise
    PE->>D: voice session start + audio stream
    D->>GS: forward audio
    GS-->>D: transcript (text)
    D->>Q: enqueue transcript
    Q->>CC: hook injects [VOICE] message
    Note over CC: agent turn (tools, MCP, any duration —<br/>no pipeline timeout to race against)
    CC->>D: speak / announce (text)
    D->>GT: synthesize (carina)
    GT-->>D: MP3/WAV
    D-->>PE: stream audio back (ESPHome API)
    PE-->>K: spoken answer
    D-->>PE: run-end → device returns to idle/wake-word state
```

### Notes

- The daemon takes the seat HA normally occupies: **one** voice-assistant host
  per device. `aioesphomeapi` is the same official library HA itself uses.
- Wake word still runs **on the device** (microWakeWord) — no cloud, no HA
  needed for it.
- STT/TTS stay on the existing Grok stack → the speaker becomes just another
  audio backend next to the Mac speakers and the planned browser-tab device;
  one consistent voice (carina) everywhere.
- Everything the "default" design gets for free must be owned here: session
  state machine, reconnects, timers/announce semantics, firmware update flow
  (still possible via ESPHome tooling, just not one-click).
- HA can be added **later** purely as an MCP device hub — nothing in the audio
  path changes.

---

## Barge-in (interrupting the assistant mid-sentence)

The hardware is ready for it in both designs: the XMOS chip cancels the
speaker's own output from the mic signal (AEC), so the device can genuinely
hear the user **while it is talking**. What differs is what the software layer
lets you do with that:

| | A — via HA (stock firmware + pipeline) | B — direct |
| --- | --- | --- |
| Say **"Stop"** mid-playback | ✅ dedicated on-device model, works out of the box | ✅ same on-device model (stock firmware) |
| Say the **wake word** mid-playback to cut in with a new command | ✅ ("Hey Jarvis, actually…") | ✅ |
| **Arbitrary** barge-in — any speech interrupts and becomes the new utterance | ❌ not supported by the stock Assist pipeline | ✅ achievable: custom ESPHome firmware streams the mic continuously; the daemon runs VAD on it (AEC already removed the echo) and kills playback when real speech appears |
| Effort | none (but hard ceiling) | custom firmware YAML + daemon-side VAD gate (the same barge-in model as the planned browser-tab audio device) |

So: **fully natural "wejść w słowo" conversation is only reachable in B** (or
in a hybrid where the speaker's audio is re-pointed at the daemon), because it
requires owning the mic stream during playback. With stock HA the interrupt
vocabulary is fixed: "Stop" and the wake word.

---

## Side-by-side

| Aspect | A — via HA | B — direct |
| --- | --- | --- |
| Audio plumbing | HA Assist pipeline (battle-tested) | own code on `aioesphomeapi` |
| New code to write | bridge ~150 LOC (+ optional Wyoming Grok TTS) | pipeline host in daemon (bigger, ongoing) |
| STT | Whisper local / HA Cloud (flat fee) | Grok STT (existing stack) |
| TTS / voice identity | pipeline voice (Piper…), Grok only via announce | Grok carina everywhere |
| Reply latency model | timeout-bound sync path + async announce | no timeout, native async |
| Barge-in | "Stop" / wake word only | arbitrary speech (with custom firmware) |
| Survives Mac being asleep | basics yes (HA runs 24/7); brain no | no (daemon *is* the host) |
| Multi-room satellites | trivial (HA manages fleet) | daemon must manage fleet |
| HA as MCP device hub | same in both — independent of audio path | same in both |
| Dependency on HA | required, 24/7 | none |
