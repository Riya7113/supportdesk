from app.main import app, health_check


def test_health_route_is_registered() -> None:
    assert "/health" in app.openapi()["paths"]


def test_health_handler_returns_ok() -> None:
    assert health_check() == {"status": "ok"}
