from backend.config import Settings
from backend.services.providers.openai_provider import OpenAIProvider


def test_openai_provider_normalizes_signal_evidence_list_to_string():
    provider = OpenAIProvider(Settings())

    payload = {
        "signals": [
            {"name": "signal-a", "weight": 0.5, "evidence": ["fragment one", "fragment two"]},
            {"name": "signal-b", "weight": 0.2, "evidence": "already string"},
            {"name": "signal-c", "weight": 0.1, "evidence": None},
        ]
    }

    normalized = provider._normalize_payload(payload)

    assert normalized["signals"][0]["evidence"] == "fragment one; fragment two"
    assert normalized["signals"][1]["evidence"] == "already string"
    assert normalized["signals"][2]["evidence"] == ""
