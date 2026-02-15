from __future__ import annotations

import re
import time
from collections import Counter
from typing import List

from backend.schemas import AnalysisResponse, AnalyzeRequest, ModelInfo, SentenceResult, Signal


_PUNKT_READY = False


def _ensure_punkt() -> bool:
    global _PUNKT_READY
    if _PUNKT_READY:
        return True

    try:
        import nltk

        try:
            nltk.data.find("tokenizers/punkt")
            _PUNKT_READY = True
            return True
        except LookupError:
            nltk.download("punkt", quiet=True)
            nltk.data.find("tokenizers/punkt")
            _PUNKT_READY = True
            return True
    except Exception:
        return False


def safe_sentence_split(text: str) -> List[str]:
    clean = re.sub(r"\s+", " ", text or "").strip()
    if not clean:
        return []

    if _ensure_punkt():
        try:
            import nltk

            return [s.strip() for s in nltk.sent_tokenize(clean) if s.strip()]
        except Exception:
            pass

    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean) if s.strip()]


class HeuristicProvider:
    model_name = "heuristic-v1"

    conspiracy_keywords = {
        "deep state",
        "cover-up",
        "coverup",
        "secret agenda",
        "mainstream media",
        "globalists",
        "elite",
        "false flag",
        "they don't want you to know",
        "suppressed",
        "hidden truth",
        "new world order",
        "puppet",
        "big pharma",
        "hoax",
        "rigged",
        "shadow government",
        "brainwash",
    }

    uncertainty_modals = {"might", "maybe", "possibly", "allegedly", "claims", "rumor", "rumour"}

    def _sentence_score(self, sentence: str) -> float:
        lowered = sentence.lower()

        keyword_hits = sum(1 for kw in self.conspiracy_keywords if kw in lowered)
        modal_hits = sum(1 for token in self.uncertainty_modals if re.search(rf"\b{re.escape(token)}\b", lowered))
        punctuation_boost = 0.1 if "!" in sentence or sentence.count("?") >= 2 else 0.0
        quote_boost = 0.08 if '"' in sentence or "'" in sentence else 0.0

        raw_score = (keyword_hits * 0.22) + (modal_hits * 0.08) + punctuation_boost + quote_boost
        return min(max(raw_score, 0.02), 0.98)

    def _label_from_score(self, score: float) -> str:
        if score >= 0.62:
            return "conspiracy"
        if score >= 0.36:
            return "uncertain"
        return "non_conspiracy"

    def _build_summary(self, sentences: List[str], limit: int = 3) -> str:
        if not sentences:
            return ""

        token_counter = Counter(re.findall(r"\b[a-zA-Z']{3,}\b", " ".join(sentences).lower()))

        ranked = []
        for idx, sentence in enumerate(sentences):
            tokens = re.findall(r"\b[a-zA-Z']{3,}\b", sentence.lower())
            lexical_score = sum(token_counter.get(t, 0) for t in tokens)
            ranked.append((lexical_score, -idx, sentence))

        top = [s for _, _, s in sorted(ranked, reverse=True)[:limit]]
        ordered = [s for s in sentences if s in set(top)]
        return " ".join(ordered)

    def analyze(self, request: AnalyzeRequest) -> AnalysisResponse:
        started = time.perf_counter()

        sentences = safe_sentence_split(request.text)
        sentences = sentences[: request.max_sentences]

        sentence_results: List[SentenceResult] = []
        signals: List[Signal] = []
        if sentences:
            keyword_hits_total = 0
            modal_hits_total = 0

            for sentence in sentences:
                score = self._sentence_score(sentence)
                label = self._label_from_score(score)

                keyword_hits = sum(1 for kw in self.conspiracy_keywords if kw in sentence.lower())
                modal_hits = sum(1 for token in self.uncertainty_modals if token in sentence.lower())
                keyword_hits_total += keyword_hits
                modal_hits_total += modal_hits

                sentence_results.append(
                    SentenceResult(
                        sentence=sentence,
                        label=label,
                        confidence=round(score, 3),
                        highlight_span=[0, min(len(sentence), 120)],
                    )
                )

            avg = sum(item.confidence for item in sentence_results) / len(sentence_results)
            overall_label = self._label_from_score(avg)
            score = int(round(avg * 100))
            confidence = round(avg, 3)

            signals = [
                Signal(
                    name="conspiracy-keyword-density",
                    weight=min(keyword_hits_total / max(len(sentences), 1), 1.0),
                    evidence=f"Detected {keyword_hits_total} conspiracy-leaning keyword hits.",
                ),
                Signal(
                    name="epistemic-uncertainty",
                    weight=min(modal_hits_total / max(len(sentences), 1), 1.0),
                    evidence=f"Detected {modal_hits_total} uncertainty/modal cues.",
                ),
            ]
        else:
            overall_label = "uncertain"
            score = 0
            confidence = 0.0

        summary = self._build_summary(sentences) if request.summarize else None
        latency_ms = int((time.perf_counter() - started) * 1000)

        return AnalysisResponse(
            overall_label=overall_label,
            confidence=confidence,
            score=score,
            summary=summary,
            sentence_results=sentence_results if request.include_sentence_breakdown else [],
            signals=signals,
            model_info=ModelInfo(provider="heuristic", model=self.model_name, latency_ms=latency_ms),
            disclaimer=(
                "This result is an automated estimate and not a fact-check. "
                "Use it as a triage signal, then verify claims with reliable sources."
            ),
        )
