from __future__ import annotations

import json
import time
from typing import Any, Dict

from backend.config import Settings
from backend.schemas import AnalysisResponse, AnalyzeRequest, ModelInfo


class OpenAIProviderError(RuntimeError):
    pass


class OpenAIProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def available(self) -> bool:
        if not self.settings.openai_enabled:
            return False

        try:
            import openai  # noqa: F401

            return True
        except Exception:
            return False

    def analyze(self, request: AnalyzeRequest) -> AnalysisResponse:
        if not self.available:
            raise OpenAIProviderError("OpenAI provider is not configured.")

        try:
            from openai import OpenAI
        except Exception as exc:
            raise OpenAIProviderError("OpenAI package is unavailable.") from exc

        started = time.perf_counter()
        client = OpenAI(api_key=self.settings.openai_api_key)

        prompt = self._build_prompt(request)
        try:
            completion = client.chat.completions.create(
                model=self.settings.effective_openai_model,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a conspiracy-framing detector. Classify framing, not sentiment. "
                            "Return strict JSON only."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                timeout=self.settings.request_timeout_seconds,
            )
        except Exception as exc:
            raise OpenAIProviderError(f"OpenAI request failed: {exc}") from exc

        content = completion.choices[0].message.content if completion.choices else None
        if not content:
            raise OpenAIProviderError("Empty completion from OpenAI.")

        try:
            payload: Dict[str, Any] = json.loads(content)
        except json.JSONDecodeError as exc:
            raise OpenAIProviderError("OpenAI returned non-JSON content.") from exc

        latency_ms = int((time.perf_counter() - started) * 1000)
        payload["model_info"] = ModelInfo(
            provider="openai",
            model=self.settings.effective_openai_model,
            latency_ms=latency_ms,
        ).model_dump()

        try:
            validated = AnalysisResponse.model_validate(payload)
        except Exception as exc:
            raise OpenAIProviderError(f"OpenAI response failed schema validation: {exc}") from exc

        return validated

    def _build_prompt(self, request: AnalyzeRequest) -> str:
        return (
            "Analyze the following text for conspiratorial framing. "
            "Do not infer author intent beyond text evidence. "
            "Treat emotional language alone as insufficient for conspiracy labeling.\n\n"
            "Return JSON with keys exactly: "
            "overall_label (conspiracy|uncertain|non_conspiracy), confidence (0..1), score (0..100), "
            "summary (string or null), sentence_results (array), signals (array), disclaimer (string).\n"
            "Each sentence_results item: sentence, label, confidence, highlight_span (2-int array or null).\n"
            "Each signals item: name, weight (0..1), evidence.\n"
            f"include_sentence_breakdown={str(request.include_sentence_breakdown).lower()}\n"
            f"summarize={str(request.summarize).lower()}\n"
            f"max_sentences={request.max_sentences}\n"
            f"language_hint={request.language_hint or 'unknown'}\n\n"
            "Text:\n"
            f"{request.text}"
        )
