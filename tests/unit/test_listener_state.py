from grok_voice_mcp.listener.state import ListenerState


def test_drain_returns_transcripts_in_order_and_empties_queue():
    state = ListenerState()
    state.add_transcript("first")
    state.add_transcript("second")

    drained = state.drain()

    assert [t.text for t in drained] == ["first", "second"]
    assert state.drain() == []


def test_last_transcript_at_tracks_newest_transcript():
    state = ListenerState()
    assert state.last_transcript_at == 0.0

    state.add_transcript("hello")

    assert state.last_transcript_at > 0.0
