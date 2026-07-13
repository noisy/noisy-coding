import http.client

import pytest

from noisy_coding.listener import http_api
from noisy_coding.listener.http_api import start_http_api
from noisy_coding.listener.state import ListenerState


@pytest.fixture
def hud_server(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html><title>HUD</title>")
    (dist / "assets").mkdir()
    (dist / "assets" / "app.js").write_text("console.log('hud')")
    (tmp_path / "secret.txt").write_text("outside dist")
    monkeypatch.setattr(http_api, "DIST_DIR", dist)
    server = start_http_api(ListenerState(), 0)
    yield server.server_address[1]
    server.shutdown()


def _get(port: int, path: str) -> http.client.HTTPResponse:
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    connection.putrequest("GET", path, skip_host=False)
    connection.endheaders()
    return connection.getresponse()


def test_root_serves_the_hud_when_built(hud_server):
    response = _get(hud_server, "/")

    assert response.status == 200
    assert b"HUD" in response.read()


def test_root_assets_are_served(hud_server):
    response = _get(hud_server, "/assets/app.js")

    assert response.status == 200
    assert response.getheader("Content-Type") == "text/javascript"


def test_legacy_dashboard_lives_at_legacy(hud_server):
    response = _get(hud_server, "/legacy")

    assert response.status == 200
    assert response.getheader("Content-Type") == "text/html; charset=utf-8"
    assert b"character-box" in response.read()  # the old inline dashboard


def test_root_falls_back_to_legacy_without_a_build(tmp_path, monkeypatch):
    monkeypatch.setattr(http_api, "DIST_DIR", tmp_path / "missing")
    server = start_http_api(ListenerState(), 0)
    try:
        response = _get(server.server_address[1], "/")
        assert response.status == 200
        assert b"character-box" in response.read()
    finally:
        server.shutdown()


def test_next_redirects_to_trailing_slash(hud_server):
    response = _get(hud_server, "/next")

    assert response.status == 301
    assert response.getheader("Location") == "/next/"


def test_next_serves_index_html(hud_server):
    response = _get(hud_server, "/next/")

    assert response.status == 200
    assert response.getheader("Content-Type") == "text/html; charset=utf-8"
    assert b"HUD" in response.read()


def test_next_serves_assets_with_content_type(hud_server):
    response = _get(hud_server, "/next/assets/app.js")

    assert response.status == 200
    assert response.getheader("Content-Type") == "text/javascript"


def test_next_blocks_path_traversal(hud_server):
    response = _get(hud_server, "/next/../secret.txt")

    assert response.status == 404


def test_next_shows_build_hint_when_dist_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(http_api, "DIST_DIR", tmp_path / "nope")
    server = start_http_api(ListenerState(), 0)
    try:
        response = _get(server.server_address[1], "/next/")
        assert response.status == 200
        assert b"npm run build" in response.read()
    finally:
        server.shutdown()
