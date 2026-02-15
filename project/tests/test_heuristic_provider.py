from backend.schemas import AnalyzeRequest
from backend.services.providers.heuristic_provider import HeuristicProvider, safe_sentence_split


def test_safe_sentence_split_has_output():
    parts = safe_sentence_split("One sentence. Another sentence! Last sentence?")
    assert len(parts) >= 2


def test_heuristic_provider_returns_schema_fields():
    provider = HeuristicProvider()
    response = provider.analyze(
        AnalyzeRequest(
            text="The media hides the truth and there is a secret agenda behind this event.",
            summarize=True,
            include_sentence_breakdown=True,
            max_sentences=80,
        )
    )
    assert response.overall_label in {"conspiracy", "uncertain", "non_conspiracy"}
    assert 0 <= response.score <= 100
    assert response.model_info.provider == "heuristic"


def test_heuristic_summary_is_capped():
    provider = HeuristicProvider()
    text = " ".join(
        [
            "Analysts reviewed documents and timelines for this event."
            " Some observers claim details remain unclear and possibly incomplete."
        ]
        * 20
    )
    response = provider.analyze(
        AnalyzeRequest(
            text=text,
            summarize=True,
            include_sentence_breakdown=True,
            max_sentences=80,
        )
    )
    assert response.summary is not None
    assert len(response.summary) <= 303
