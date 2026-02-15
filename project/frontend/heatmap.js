const SIGNAL_KEYWORDS = [
  { phrase: "deep state", level: "high", signalName: "conspiracy-keyword-density" },
  { phrase: "cover-up", level: "high", signalName: "conspiracy-keyword-density" },
  { phrase: "coverup", level: "high", signalName: "conspiracy-keyword-density" },
  { phrase: "secret agenda", level: "high", signalName: "conspiracy-keyword-density" },
  { phrase: "suppressed", level: "high", signalName: "conspiracy-keyword-density" },
  { phrase: "hidden truth", level: "high", signalName: "conspiracy-keyword-density" },
  { phrase: "globalists", level: "high", signalName: "conspiracy-keyword-density" },
  { phrase: "elite", level: "med", signalName: "conspiracy-keyword-density" },
  { phrase: "hoax", level: "high", signalName: "conspiracy-keyword-density" },
  { phrase: "rigged", level: "high", signalName: "conspiracy-keyword-density" },
  { phrase: "might", level: "low", signalName: "epistemic-uncertainty" },
  { phrase: "maybe", level: "low", signalName: "epistemic-uncertainty" },
  { phrase: "possibly", level: "low", signalName: "epistemic-uncertainty" },
  { phrase: "allegedly", level: "low", signalName: "epistemic-uncertainty" },
  { phrase: "claims", level: "low", signalName: "epistemic-uncertainty" },
];

const LEVEL_WEIGHT = { low: 1, med: 2, high: 3 };

function severityFromLabel(label) {
  if (label === "conspiracy") return "high";
  if (label === "uncertain") return "med";
  return "low";
}

function mapSentenceAnchors(text, sentenceResults) {
  const anchors = [];
  let cursor = 0;

  for (const item of sentenceResults || []) {
    const sentence = (item.sentence || "").trim();
    if (!sentence) {
      anchors.push(null);
      continue;
    }

    let start = text.indexOf(sentence, cursor);
    if (start === -1) {
      start = text.indexOf(sentence);
    }
    if (start === -1) {
      anchors.push(null);
      continue;
    }

    const end = start + sentence.length;
    anchors.push({ start, end });
    cursor = end;
  }

  return anchors;
}

function collectSpans(text, sentenceResults, anchors) {
  const spans = [];

  for (let i = 0; i < (sentenceResults || []).length; i += 1) {
    const item = sentenceResults[i];
    const anchor = anchors[i];
    if (!anchor) continue;

    const sentenceText = text.slice(anchor.start, anchor.end);
    const localLower = sentenceText.toLowerCase();
    const labelSeverity = severityFromLabel(item.label);

    let added = false;
    if (Array.isArray(item.highlight_span) && item.highlight_span.length === 2) {
      const [rawStart, rawEnd] = item.highlight_span;
      const localStart = Number(rawStart);
      const localEnd = Number(rawEnd);
      if (
        Number.isInteger(localStart) &&
        Number.isInteger(localEnd) &&
        localStart >= 0 &&
        localEnd > localStart &&
        localEnd <= sentenceText.length
      ) {
        spans.push({
          start: anchor.start + localStart,
          end: anchor.start + localEnd,
          level: labelSeverity,
          signalName: "provider-span",
          sentenceIndex: i,
        });
        added = true;
      }
    }

    if (!added) {
      for (const kw of SIGNAL_KEYWORDS) {
        let idx = localLower.indexOf(kw.phrase);
        while (idx !== -1) {
          spans.push({
            start: anchor.start + idx,
            end: anchor.start + idx + kw.phrase.length,
            level: kw.level,
            signalName: kw.signalName,
            sentenceIndex: i,
          });
          added = true;
          idx = localLower.indexOf(kw.phrase, idx + kw.phrase.length);
        }
      }
    }

    if (!added && item.label !== "non_conspiracy") {
      spans.push({
        start: anchor.start,
        end: anchor.end,
        level: labelSeverity,
        signalName: "sentence-soft-highlight",
        sentenceIndex: i,
      });
    }
  }

  return spans.filter((span) => span.end > span.start);
}

function buildSegments(textLength, spans) {
  const boundaries = new Set([0, textLength]);
  for (const span of spans) {
    boundaries.add(span.start);
    boundaries.add(span.end);
  }

  const points = [...boundaries].sort((a, b) => a - b);
  const segments = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;

    const active = spans.filter((span) => span.start < end && span.end > start);
    if (!active.length) {
      segments.push({ start, end, level: null, sentenceIndex: null, signalName: null });
      continue;
    }

    active.sort((a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level]);
    const top = active[0];
    segments.push({
      start,
      end,
      level: top.level,
      sentenceIndex: top.sentenceIndex,
      signalName: top.signalName,
    });
  }

  return segments;
}

function clearFocused(container) {
  container.querySelectorAll(".heat-focused").forEach((el) => el.classList.remove("heat-focused"));
}

export function createHeatmapController(container) {
  let sentenceAnchorIds = new Map();
  let triggerCount = 0;
  let levelCounts = { high: 0, med: 0, low: 0 };

  return {
    render(sourceText, sentenceResults) {
      const text = sourceText || "";
      sentenceAnchorIds = new Map();

      if (!text.trim()) {
        container.textContent = "Run analysis to view evidence mapping.";
        triggerCount = 0;
        return { triggerCount: 0 };
      }

      const anchors = mapSentenceAnchors(text, sentenceResults || []);
      const spans = collectSpans(text, sentenceResults || [], anchors);
      const segments = buildSegments(text.length, spans);
      triggerCount = spans.length;
      levelCounts = { high: 0, med: 0, low: 0 };
      for (const span of spans) {
        if (levelCounts[span.level] !== undefined) {
          levelCounts[span.level] += 1;
        }
      }

      container.innerHTML = "";
      const frag = document.createDocumentFragment();

      for (const seg of segments) {
        const piece = text.slice(seg.start, seg.end);
        if (!seg.level) {
          frag.appendChild(document.createTextNode(piece));
          continue;
        }

        const mark = document.createElement("mark");
        mark.className = `heat heat-${seg.level}`;
        mark.textContent = piece;
        if (typeof seg.sentenceIndex === "number") {
          mark.dataset.sentenceIndex = String(seg.sentenceIndex);
          if (!sentenceAnchorIds.has(seg.sentenceIndex)) {
            const id = `heat-anchor-${seg.sentenceIndex}`;
            sentenceAnchorIds.set(seg.sentenceIndex, id);
            mark.id = id;
          }
        }
        if (seg.signalName) {
          const sentence = (sentenceResults || [])[seg.sentenceIndex];
          const confidencePct = sentence ? `${(sentence.confidence * 100).toFixed(0)}%` : "n/a";
          mark.title = `Signal: ${seg.signalName} | Severity: ${seg.level} | Sentence confidence: ${confidencePct}`;
        }
        frag.appendChild(mark);
      }

      container.appendChild(frag);
      return { triggerCount, levelCounts: { ...levelCounts } };
    },

    focusSentence(index) {
      clearFocused(container);
      const id = sentenceAnchorIds.get(index);
      if (!id) return;
      const node = document.getElementById(id);
      if (!node) return;

      node.classList.add("heat-focused");
      node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    },

    clear() {
      sentenceAnchorIds = new Map();
      triggerCount = 0;
      levelCounts = { high: 0, med: 0, low: 0 };
      container.textContent = "Run analysis to view evidence mapping.";
    },

    getTriggerCount() {
      return triggerCount;
    },
    getLevelCounts() {
      return { ...levelCounts };
    },
  };
}
