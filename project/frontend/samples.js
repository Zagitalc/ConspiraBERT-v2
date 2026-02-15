export const SAMPLE_TEXTS = [
  {
    id: "conspiracy",
    label: "Conspiracy framing",
    text: "Internal memos prove the media is hiding the real truth. The elite coordinated a cover-up and they do not want you to know what happened. Independent voices were suppressed while official reports were staged.",
  },
  {
    id: "borderline",
    label: "Borderline / suspicious",
    text: "Several observers claim the timeline does not fully match public statements. It might be a documentation issue, but some details are possibly being omitted pending legal review.",
  },
  {
    id: "neutral",
    label: "Neutral report",
    text: "The city council approved a revised transit budget after three hearings. Officials published the procurement timeline, safety audits, and quarterly milestones for public review.",
  },
  {
    id: "mixed",
    label: "Mixed narrative",
    text: "Investigators released updated data and invited external auditors. However, online posts alleged a secret agenda and a coordinated effort by powerful groups to manipulate outcomes.",
  },
];

export function populateSamples(select) {
  for (const sample of SAMPLE_TEXTS) {
    const option = document.createElement("option");
    option.value = sample.id;
    option.textContent = sample.label;
    select.appendChild(option);
  }
}

export function getSampleById(id) {
  return SAMPLE_TEXTS.find((item) => item.id === id) || null;
}
