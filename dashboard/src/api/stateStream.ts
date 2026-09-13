/** The daemon's pushed state stream (#73).
 *
 * A WebSocket on the bridge port (HTTP port + 1), path /state. The daemon
 * sends a full snapshot on connect and a new full snapshot whenever anything
 * changes; the dashboard renders exactly what arrives and never merges.
 * Polling /status remains only as the fallback while the socket is down.
 */
import type { DaemonStatus, Utterance } from "../types";

export interface StateSnapshot {
  type: "snapshot";
  status: DaemonStatus;
  utterances: Utterance[];
}

export function stateStreamUrl(): string {
  // Same rule as the audio bridge: served from the daemon it is port+1; on
  // the Vite dev server (which proxies HTTP but not WS) assume the default.
  const served = Number(window.location.port || "0");
  const bridgePort = served && served !== 5173 ? served + 1 : 8766;
  return `ws://${window.location.hostname}:${bridgePort}/state`;
}

export function parseSnapshot(raw: unknown): StateSnapshot | null {
  if (typeof raw !== "string") return null;
  try {
    const message = JSON.parse(raw);
    if (message && message.type === "snapshot" && message.status && Array.isArray(message.utterances)) {
      return message as StateSnapshot;
    }
  } catch {
    /* not a snapshot */
  }
  return null;
}

export interface StreamHandle {
  close(): void;
}

/** Open the stream and keep it open; `onSnapshot` fires per message,
 * `onState` on every open/close so the caller can gate its polling. Reconnects
 * with a short backoff; returns a handle that stops everything. */
export function openStateStream(
  onSnapshot: (snapshot: StateSnapshot) => void,
  onState: (open: boolean) => void,
): StreamHandle | null {
  if (typeof WebSocket === "undefined") return null; // tests / non-browser
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let closed = false;

  const connect = () => {
    if (closed) return;
    try {
      socket = new WebSocket(stateStreamUrl());
    } catch {
      schedule();
      return;
    }
    socket.onopen = () => {
      attempts = 0;
      onState(true);
    };
    socket.onmessage = (event) => {
      const snapshot = parseSnapshot(event.data);
      if (snapshot) onSnapshot(snapshot);
    };
    socket.onerror = () => {
      /* onclose follows */
    };
    socket.onclose = () => {
      socket = null;
      onState(false);
      schedule();
    };
  };
  const schedule = () => {
    if (closed) return;
    const delay = Math.min(5000, 500 * 2 ** Math.min(attempts++, 4));
    timer = setTimeout(connect, delay);
  };

  connect();
  return {
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    },
  };
}
