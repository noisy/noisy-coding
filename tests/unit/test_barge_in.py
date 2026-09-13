"""Push-to-talk beats the echo mute (#61, #64)."""

from noisy_coding.listener.daemon import _ptt_barge_in
from noisy_coding.listener.state import ListenerState


def test_held_key_lifts_the_mute_and_parks_the_cut_clip_as_unheard():
    state = ListenerState()
    state.register_agent("tab-a", "Alpha")
    clip = state.create_utterance("claude", "playing through speakers…", text="long answer", agent="tab-a")
    state.set_playing_utterance_id(clip)
    state.set_claude_speaking(True, "tab-a")
    state.set_paused(True)  # the echo mute the speech thread sets while playing

    assert _ptt_barge_in(state) is True

    assert state.paused is False  # capture may proceed on this very frame
    card = next(u for u in state.utterances() if u["id"] == clip)
    assert card["status"] == "unheard — interrupted by push-to-talk"  # replayable, not "played"
    assert state.playing_utterance_id == 0


def test_barge_in_with_nothing_playing_only_lifts_the_mute():
    state = ListenerState()
    state.set_paused(True)
    assert _ptt_barge_in(state) is False
    assert state.paused is False


def test_user_mute_is_not_overridden_by_the_key():
    # The loop only calls barge-in when the pause is the echo mute, never the
    # user's explicit mute; the helper itself never touches user_muted.
    state = ListenerState()
    state.set_user_muted(True)
    state.set_paused(True)
    _ptt_barge_in(state)
    assert state.user_muted is True
    assert state.paused is True  # paused property includes the user mute
