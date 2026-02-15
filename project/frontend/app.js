const form = document.getElementById("analyze-form");
const button = document.getElementById("analyze-btn");
const loading = document.getElementById("loading");
const errorDiv = document.getElementById("error");
const results = document.getElementById("results");
const modelBadge = document.getElementById("model-badge");
const healthBadge = document.getElementById("health-badge");
const overallLabel = document.getElementById("overall-label");
const score = document.getElementById("score");
const confidence = document.getElementById("confidence");
const meterFill = document.getElementById("meter-fill");
const summaryText = document.getElementById("summary-text");
const signals = document.getElementById("signals");
const sentences = document.getElementById("sentences");
const disclaimer = document.getElementById("disclaimer");
const warning = document.getElementById("warning");

async function loadHealth() {
  try {
    const response = await fetch("/api/v2/health");
    const data = await response.json();
    const source = data.openai_ready ? "OpenAI ready" : "Fallback only";
    healthBadge.textContent = `Status: ${source}`;
  } catch (_) {
    healthBadge.textContent = "Status: unavailable";
  }
}

function clearTransientState() {
  errorDiv.classList.add("hidden");
  warning.classList.add("hidden");
}

function renderResults(data) {
  overallLabel.textContent = data.overall_label.replaceAll("_", " ");
  score.textContent = `Score: ${data.score}/100`;
  confidence.textContent = `Confidence: ${(data.confidence * 100).toFixed(1)}%`;
  meterFill.style.width = `${Math.max(0, Math.min(100, data.score))}%`;

  summaryText.textContent = data.summary || "No summary requested.";
  disclaimer.textContent = data.disclaimer || "";

  modelBadge.textContent = `Model: ${data.model_info.provider} (${data.model_info.model})`;

  signals.innerHTML = "";
  for (const item of data.signals || []) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = `${item.name} (${(item.weight * 100).toFixed(0)}%): ${item.evidence}`;
    signals.appendChild(chip);
  }

  sentences.innerHTML = "";
  for (const item of data.sentence_results || []) {
    const block = document.createElement("div");
    block.className = `sentence-item ${item.label}`;
    block.textContent = `${item.sentence} (${item.label}, ${(item.confidence * 100).toFixed(0)}%)`;
    sentences.appendChild(block);
  }

  if (data.warning || data.model_info.warning) {
    warning.textContent = data.warning || data.model_info.warning;
    warning.classList.remove("hidden");
  }

  results.classList.remove("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearTransientState();

  const text = document.getElementById("input-text").value.trim();
  if (!text) {
    errorDiv.textContent = "Please enter text before running analysis.";
    errorDiv.classList.remove("hidden");
    return;
  }

  const payload = {
    text,
    summarize: document.getElementById("summarize").checked,
    include_sentence_breakdown: document.getElementById("breakdown").checked,
    max_sentences: Number(document.getElementById("max-sentences").value || 80),
  };

  try {
    button.disabled = true;
    loading.classList.remove("hidden");

    const response = await fetch("/api/v2/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errPayload = await response.text();
      throw new Error(`Request failed (${response.status}): ${errPayload}`);
    }

    const data = await response.json();
    renderResults(data);
  } catch (error) {
    errorDiv.textContent = `Analysis failed: ${error.message}`;
    errorDiv.classList.remove("hidden");
  } finally {
    loading.classList.add("hidden");
    button.disabled = false;
  }
});

loadHealth();
