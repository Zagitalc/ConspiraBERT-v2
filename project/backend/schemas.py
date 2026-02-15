from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


Label = Literal["conspiracy", "uncertain", "non_conspiracy"]


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=120_000)
    summarize: bool = True
    include_sentence_breakdown: bool = True
    max_sentences: int = Field(default=80, ge=1, le=200)
    language_hint: Optional[str] = None


class SentenceResult(BaseModel):
    sentence: str
    label: Label
    confidence: float = Field(..., ge=0.0, le=1.0)
    highlight_span: Optional[List[int]] = None


class Signal(BaseModel):
    name: str
    weight: float = Field(..., ge=0.0, le=1.0)
    evidence: str


class ModelInfo(BaseModel):
    provider: str
    model: str
    latency_ms: int = Field(..., ge=0)
    warning: Optional[str] = None


class AnalysisResponse(BaseModel):
    overall_label: Label
    confidence: float = Field(..., ge=0.0, le=1.0)
    score: int = Field(..., ge=0, le=100)
    summary: Optional[str] = None
    sentence_results: List[SentenceResult] = Field(default_factory=list)
    signals: List[Signal] = Field(default_factory=list)
    model_info: ModelInfo
    disclaimer: str
    warning: Optional[str] = None


class HealthResponse(BaseModel):
    status: Literal["ok"]
    openai_ready: bool
    fallback_ready: bool


class VersionResponse(BaseModel):
    name: str
    version: str
    config_fingerprint: str
