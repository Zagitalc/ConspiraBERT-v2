from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/v2/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["fallback_ready"] is True


def test_analyze_endpoint_works_without_openai_key():
    payload = {
        "text": "This is just a normal statement about weather.",
        "summarize": True,
        "include_sentence_breakdown": True,
        "max_sentences": 10,
    }
    response = client.post("/api/v2/analyze", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert "overall_label" in body
    assert "model_info" in body
    assert body["model_info"]["provider"] in {"heuristic", "openai"}
