import { initThemeToggle } from "/assets/theme.js";
import { populateSamples, getSampleById } from "/assets/samples.js";
import { downloadAnalysisJSON } from "/assets/export.js";
import { createHeatmapController } from "/assets/heatmap.js";

const MAX_CHARS = 120000;
const AUTO_ANALYZE_MIN_LENGTH = 80;
const PASTE_DEBOUNCE_MS = 900;

const form = document.getElementById("analyze-form");
const analyzeBtn = document.getElementById("analyze-btn");
const clearBtn = document.getElementById("clear-btn");
const retryBtn = document.getElementById("retry-btn");
const exportBtn = document.getElementById("export-json");
const loading = document.getElementById("loading");
const loadingPhase = document.getElementById("loading-phase");
const errorDiv = document.getElementById("error");
const warning = document.getElementById("warning");
const results = document.getElementById("results");
const healthBadge = document.getElementById("health-badge");
const modelBadge = document.getElementById("model-badge");
const versionBadge = document.getElementById("version-badge");
const overallLabel = document.getElementById("overall-label");
const score = document.getElementById("score");
const confidenceRange = document.getElementById("confidence-range");
const summaryText = document.getElementById("summary-text");
const signals = document.getElementById("signals");
const sentenceList = document.getElementById("sentence-list");
const disclaimer = document.getElementById("disclaimer");
const triggerCount = document.getElementById("trigger-count");
const riskLevel = document.getElementById("risk-level");
const charCounter = document.getElementById("char-counter");
const estTime = document.getElementById("est-time");
const sampleSelect = document.getElementById("sample-select");
const inputText = document.getElementById("input-text");
const summarizeBox = document.getElementById("summarize");
const breakdownBox = document.getElementById("breakdown");
const autoAnalyzeBox = document.getElementById("auto-analyze");
const maxSentencesInput = document.getElementById("max-sentences");

const barConspiracy = document.getElementById("bar-conspiracy");
const barUncertain = document.getElementById("bar-uncertain");
const barNon = document.getElementById("bar-non");
const pctConspiracy = document.getElementById("pct-conspiracy");
const pctUncertain = document.getElementById("pct-uncertain");
const pctNon = document.getElementById("pct-non");
const distributionNote = document.getElementById("distribution-note");
const triggerBreakdown = document.getElementById("trigger-breakdown");

const heatmap = createHeatmapController(document.getElementById("heatmap"));

let isBusy = false;
let lastPayload = null;
let lastResult = null;
let pasteTimer = null;

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function setBusy(nextBusy, phase = "") {
  isBusy = nextBusy;
  analyzeBtn.disabled = nextBusy;
  clearBtn.disabled = nextBusy;
  retryBtn.disabled = nextBusy;
  if (nextBusy) {
    loadingPhase.textContent = phase || "Submitting...";
    loading.classList.remove("hidden");
  } else {
    loading.classList.add("hidden");
  }
}

function setPhase(text) {
  loadingPhase.textContent = text;
}

function clearTransientState() {
  errorDiv.classList.add("hidden");
  retryBtn.classList.add("hidden");
  warning.classList.add("hidden");
}

function setError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove("hidden");
  retryBtn.classList.remove("hidden");
}

function computeSentimentDistribution(data) {
  const counts = { conspiracy: 0, uncertain: 0, non_conspiracy: 0 };
  const rows = data.sentence_results || [];

  if (!rows.length) {
    counts[data.overall_label] = 1;
  } else {
    for (const row of rows) {
      if (counts[row.label] !== undefined) {
        counts[row.label] += 1;
      }
    }
  }

  const total = counts.conspiracy + counts.uncertain + counts.non_conspiracy || 1;
  const raw = {
    conspiracy: (counts.conspiracy / total) * 100,
    uncertain: (counts.uncertain / total) * 100,
    non: (counts.non_conspiracy / total) * 100,
  };
  const floor = {
    conspiracy: Math.floor(raw.conspiracy),
    uncertain: Math.floor(raw.uncertain),
    non: Math.floor(raw.non),
  };
  let remainder = 100 - (floor.conspiracy + floor.uncertain + floor.non);
  const order = [
    { key: "conspiracy", frac: raw.conspiracy - floor.conspiracy },
    { key: "uncertain", frac: raw.uncertain - floor.uncertain },
    { key: "non", frac: raw.non - floor.non },
  ].sort((a, b) => b.frac - a.frac);
  let idx = 0;
  while (remainder > 0) {
    floor[order[idx % order.length].key] += 1;
    remainder -= 1;
    idx += 1;
  }
  return floor;
}

function computeRiskLevel(data) {
  if (data.score >= 67) return "High";
  if (data.score >= 34) return "Medium";
  return "Low";
}

function scoreBand(scoreValue) {
  if (scoreValue >= 67) return "High confidence";
  if (scoreValue >= 34) return "Moderate confidence";
  return "Very low confidence";
}

function renderDistribution(data) {
  const dist = computeSentimentDistribution(data);

  pctConspiracy.textContent = `${dist.conspiracy}%`;
  pctUncertain.textContent = `${dist.uncertain}%`;
  pctNon.textContent = `${dist.non}%`;

  barConspiracy.style.width = `${dist.conspiracy}%`;
  barUncertain.style.width = `${dist.uncertain}%`;
  barNon.style.width = `${dist.non}%`;
  distributionNote.textContent = `Sentence-level distribution totals 100%. Overall score (${data.score}/100) is aggregate confidence.`;
}

function renderSignalChips(data) {
  signals.innerHTML = "";
  for (const item of data.signals || []) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.title = item.evidence;
    chip.textContent = `${item.name}: ${(item.weight * 100).toFixed(0)}%`;
    signals.appendChild(chip);
  }
}

function renderTriggerBreakdown(counts) {
  triggerBreakdown.innerHTML = "";
  const levels = [
    { key: "high", label: "High", cls: "chip-break-high" },
    { key: "med", label: "Medium", cls: "chip-break-med" },
    { key: "low", label: "Low", cls: "chip-break-low" },
  ];
  for (const level of levels) {
    const chip = document.createElement("div");
    chip.className = `chip ${level.cls}`;
    chip.textContent = `${level.label}: ${counts[level.key] || 0}`;
    triggerBreakdown.appendChild(chip);
  }
}

function renderSentenceList(data) {
  sentenceList.innerHTML = "";
  for (let i = 0; i < (data.sentence_results || []).length; i += 1) {
    const row = data.sentence_results[i];
    const li = document.createElement("li");
    li.className = `sentence-item ${row.label}`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sentence-btn";
    btn.textContent = `${i + 1}. ${row.sentence} (${row.label}, ${(row.confidence * 100).toFixed(0)}%)`;
    btn.addEventListener("click", () => heatmap.focusSentence(i));

    li.appendChild(btn);
    sentenceList.appendChild(li);
  }
}

function renderConfidenceRange(data) {
  const center = clamp(data.confidence || 0, 0, 1);
  const low = clamp(center - 0.08, 0, 1);
  const high = clamp(center + 0.08, 0, 1);
  confidenceRange.textContent = `Conf. ${(low * 100).toFixed(0)}-${(high * 100).toFixed(0)}%`;
}

function renderResults(data, sourceText) {
  overallLabel.textContent = (data.overall_label || "-").replaceAll("_", " ");
  score.textContent = `Score: ${data.score}/100 (${scoreBand(data.score)})`;
  summaryText.textContent = data.summary || "No summary requested.";
  disclaimer.textContent = data.disclaimer || "";
  modelBadge.textContent = `Provider: ${data.model_info.provider} (${data.model_info.model})`;

  renderConfidenceRange(data);
  renderDistribution(data);
  renderSignalChips(data);
  renderSentenceList(data);

  const heatmapResult = heatmap.render(sourceText, data.sentence_results || []);
  const fallbackTriggers = (data.signals || []).length + (data.sentence_results || []).filter((s) => s.label !== "non_conspiracy").length;
  const totalTriggers = heatmapResult.triggerCount || fallbackTriggers;
  triggerCount.textContent = String(totalTriggers);
  triggerCount.title = "Trigger count is evidence-span count; risk level is score-based.";
  const breakdown = heatmapResult.levelCounts || { high: 0, med: 0, low: 0 };
  renderTriggerBreakdown(breakdown);

  const risk = computeRiskLevel(data);
  riskLevel.textContent = risk;
  riskLevel.dataset.risk = risk.toLowerCase();
  riskLevel.title = "Risk level is derived from overall score, not raw trigger count.";

  if (data.warning || data.model_info.warning) {
    warning.textContent = data.warning || data.model_info.warning;
    warning.classList.remove("hidden");
  }

  exportBtn.disabled = false;
  results.classList.remove("hidden");
  lastResult = data;
}

function resetOutput() {
  results.classList.add("hidden");
  exportBtn.disabled = true;
  summaryText.textContent = "-";
  signals.innerHTML = "";
  triggerBreakdown.innerHTML = "";
  sentenceList.innerHTML = "";
  heatmap.clear();
  warning.classList.add("hidden");
  errorDiv.classList.add("hidden");
  retryBtn.classList.add("hidden");
  lastResult = null;
}

function buildPayload() {
  return {
    text: inputText.value.trim(),
    summarize: summarizeBox.checked,
    include_sentence_breakdown: breakdownBox.checked,
    max_sentences: Number(maxSentencesInput.value || 80),
  };
}

async function analyze(payload) {
  clearTransientState();

  if (!payload.text) {
    setError("Please enter text before running analysis.");
    return;
  }

  if (payload.text.length > MAX_CHARS) {
    setError(`Text exceeds maximum length (${MAX_CHARS} chars).`);
    return;
  }

  lastPayload = payload;
  setBusy(true, "Submitting...");

  try {
    const requestPromise = fetch("/api/v2/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setPhase("Analyzing...");
    const response = await requestPromise;

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Request failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    setPhase("Rendering...");
    renderResults(data, payload.text);
  } catch (error) {
    setError(`Analysis failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

function updateCharacterCounter() {
  const count = inputText.value.length;
  charCounter.textContent = `${count} / ${MAX_CHARS} chars`;
  charCounter.classList.remove("warn", "critical");

  if (count >= MAX_CHARS * 0.95) {
    charCounter.classList.add("critical");
  } else if (count >= MAX_CHARS * 0.8) {
    charCounter.classList.add("warn");
  }

  const estMs = Math.max(200, Math.round((count / 4200) * 1000));
  estTime.textContent = `Est. time: ${(estMs / 1000).toFixed(1)}s`;
}

async function loadHealthAndVersion() {
  try {
    const [healthRes, versionRes] = await Promise.all([fetch("/api/v2/health"), fetch("/api/v2/version")]);

    if (healthRes.ok) {
      const health = await healthRes.json();
      healthBadge.textContent = health.openai_ready ? "SYSTEM ONLINE" : "SYSTEM ONLINE (Fallback)";
    } else {
      healthBadge.textContent = "SYSTEM DEGRADED";
    }

    if (versionRes.ok) {
      const version = await versionRes.json();
      versionBadge.textContent = `${version.name} ${version.version}`;
    } else {
      versionBadge.textContent = "Version unavailable";
    }
  } catch (_) {
    healthBadge.textContent = "SYSTEM DEGRADED";
    versionBadge.textContent = "Version unavailable";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await analyze(buildPayload());
});

clearBtn.addEventListener("click", () => {
  form.reset();
  sampleSelect.value = "";
  inputText.value = "";
  updateCharacterCounter();
  resetOutput();
});

retryBtn.addEventListener("click", async () => {
  if (!lastPayload || isBusy) return;
  await analyze(lastPayload);
});

exportBtn.addEventListener("click", () => {
  if (!lastResult) return;
  downloadAnalysisJSON(lastResult, inputText.value.trim());
});

sampleSelect.addEventListener("change", () => {
  const picked = getSampleById(sampleSelect.value);
  if (!picked) return;
  inputText.value = picked.text;
  updateCharacterCounter();
});

inputText.addEventListener("input", updateCharacterCounter);
inputText.addEventListener("paste", () => {
  if (!autoAnalyzeBox.checked) return;

  if (pasteTimer) {
    clearTimeout(pasteTimer);
  }

  pasteTimer = setTimeout(async () => {
    if (isBusy) return;
    const text = inputText.value.trim();
    if (text.length < AUTO_ANALYZE_MIN_LENGTH) return;
    await analyze(buildPayload());
  }, PASTE_DEBOUNCE_MS);
});

populateSamples(sampleSelect);
initThemeToggle(document.getElementById("theme-toggle"));
updateCharacterCounter();
loadHealthAndVersion();
