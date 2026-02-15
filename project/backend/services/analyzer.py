from __future__ import annotations

from backend.config import Settings
from backend.schemas import AnalysisResponse, AnalyzeRequest
from backend.services.providers.heuristic_provider import HeuristicProvider, safe_sentence_split
from backend.services.providers.openai_provider import OpenAIProvider, OpenAIProviderError


class AnalyzerService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.openai = OpenAIProvider(settings)
        self.heuristic = HeuristicProvider()

    def analyze(self, request: AnalyzeRequest) -> AnalysisResponse:
        normalized_text = " ".join((request.text or "").split())
        sentences = safe_sentence_split(normalized_text)

        warning_parts = []
        if len(sentences) > request.max_sentences:
            clipped = " ".join(sentences[: request.max_sentences])
            normalized_text = clipped
            warning_parts.append(
                f"Input was clipped to the first {request.max_sentences} sentences for stability."
            )

        normalized_request = AnalyzeRequest(
            text=normalized_text,
            summarize=request.summarize,
            include_sentence_breakdown=request.include_sentence_breakdown,
            max_sentences=request.max_sentences,
            language_hint=request.language_hint,
        )

        if self.openai.available:
            try:
                result = self.openai.analyze(normalized_request)
                if warning_parts:
                    warning = " ".join(warning_parts)
                    result.warning = warning
                    result.model_info.warning = warning
                return result
            except OpenAIProviderError as exc:
                warning_parts.append(f"OpenAI unavailable; fallback heuristic used ({exc}).")

        fallback = self.heuristic.analyze(normalized_request)
        if warning_parts:
            warning = " ".join(warning_parts)
            fallback.warning = warning
            fallback.model_info.warning = warning
        return fallback

    def health(self) -> dict:
        return {
            "openai_ready": self.openai.available,
            "fallback_ready": True,
        }
