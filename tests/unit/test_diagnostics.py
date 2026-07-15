import asyncio

from noisy_coding import diagnostics


def test_each_check_reports_its_own_verdict(monkeypatch):
    async def passing():
        pass

    async def failing():
        raise RuntimeError("HTTP 400: Incorrect API key")

    monkeypatch.setattr(
        diagnostics, "CHECKS", {"api_key": passing, "tts_stream": failing}
    )

    results = diagnostics.run_checks_sync()

    assert results["api_key"]["ok"] is True
    assert isinstance(results["api_key"]["ms"], int)
    assert results["tts_stream"]["ok"] is False
    assert "Incorrect API key" in results["tts_stream"]["detail"]


def test_one_failing_check_does_not_poison_the_others(monkeypatch):
    async def passing():
        pass

    async def exploding():
        raise ConnectionError("peer closed")

    monkeypatch.setattr(
        diagnostics,
        "CHECKS",
        {"a": passing, "b": exploding, "c": passing},
    )

    results = diagnostics.run_checks_sync()

    assert [results[name]["ok"] for name in ("a", "b", "c")] == [True, False, True]


def test_hung_check_fails_by_timeout_instead_of_blocking(monkeypatch):
    async def hangs():
        await asyncio.sleep(60)

    monkeypatch.setattr(diagnostics, "CHECK_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(diagnostics, "CHECKS", {"stt_stream": hangs})

    results = diagnostics.run_checks_sync()

    assert results["stt_stream"]["ok"] is False


def test_billing_check_runs_only_when_configured(monkeypatch):
    async def passing():
        pass

    monkeypatch.setattr(diagnostics, "CHECKS", {"api_key": passing})
    monkeypatch.delenv(diagnostics.MANAGEMENT_KEY_ENV_VAR, raising=False)
    monkeypatch.delenv(diagnostics.TEAM_ID_ENV_VAR, raising=False)
    assert "billing" not in diagnostics.run_checks_sync()

    monkeypatch.setenv(diagnostics.MANAGEMENT_KEY_ENV_VAR, "mk")
    monkeypatch.setenv(diagnostics.TEAM_ID_ENV_VAR, "team")

    async def fake_billing():
        pass

    monkeypatch.setattr(diagnostics, "_check_billing", fake_billing)
    assert "billing" in diagnostics.run_checks_sync()
