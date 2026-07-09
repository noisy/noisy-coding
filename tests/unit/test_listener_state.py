from grok_voice_mcp.listener.state import ListenerState


def test_drain_returns_transcripts_in_order_and_empties_queue():
    state = ListenerState()
    state.add_transcript("first")
    state.add_transcript("second")

    drained = state.drain()

    assert [t.text for t in drained] == ["first", "second"]
    assert state.drain() == []


def test_events_since_returns_only_newer_events_including_drain_delivery():
    state = ListenerState()
    state.add_event("recording")
    state.add_transcript("hello")
    seen = state.events_since(0)
    state.drain()

    fresh = state.events_since(seen[-1]["seq"])

    assert [e["kind"] for e in seen] == ["recording", "transcript"]
    assert [(e["kind"], e["detail"]) for e in fresh] == [("delivered", "hello")]


def test_last_transcript_at_tracks_newest_transcript():
    state = ListenerState()
    assert state.last_transcript_at == 0.0

    state.add_transcript("hello")

    assert state.last_transcript_at > 0.0
