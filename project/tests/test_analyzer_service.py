from backend.config import Settings
from backend.schemas import AnalyzeRequest
from backend.services.analyzer import AnalyzerService


def test_provider_selection_without_openai_key_uses_heuristic():
    settings = Settings(openai_api_key="")
    service = AnalyzerService(settings)

    response = service.analyze(
        AnalyzeRequest(
            text="This is a short factual sentence.",
            summarize=True,
            include_sentence_breakdown=True,
            max_sentences=80,
        )
    )

    assert response.model_info.provider == "heuristic"


def test_max_sentences_clip_adds_warning():
    settings = Settings(openai_api_key="")
    service = AnalyzerService(settings)

    text = " ".join([f"Sentence {i}." for i in range(1, 140)])
    response = service.analyze(
        AnalyzeRequest(
            text=text,
            summarize=False,
            include_sentence_breakdown=True,
            max_sentences=10,
        )
    )

    assert len(response.sentence_results) <= 10
    assert response.warning is not None
    assert "clipped" in response.warning.lower()
