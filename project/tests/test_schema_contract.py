from backend.schemas import AnalysisResponse


def test_analysis_response_schema_validation():
    payload = {
        "overall_label": "uncertain",
        "confidence": 0.5,
        "score": 50,
        "summary": "summary",
        "sentence_results": [],
        "signals": [],
        "model_info": {"provider": "heuristic", "model": "heuristic-v1", "latency_ms": 10},
        "disclaimer": "disclaimer",
    }

    parsed = AnalysisResponse.model_validate(payload)
    assert parsed.score == 50
    assert parsed.model_info.provider == "heuristic"
