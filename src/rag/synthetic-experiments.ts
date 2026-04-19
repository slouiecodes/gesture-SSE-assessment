/** Short synthetic “past experiment” briefs for RAG demos (not product facts). */
export const SYNTHETIC_EXPERIMENT_DOCS: string[] = [
  `Experiment E-101: onboarding prompt tone (A=friendly, B=concise). Outcome: A had +6% completion; B had lower latency. Guardrail: avoid over-promising.`,
  `Experiment E-204: CTA placement in checkout (A=sticky bar, B=inline). Outcome: B won on mobile conversion; A won desktop. Segment by device next time.`,
  `Experiment E-310: lead scoring threshold (A=0.7, B=0.85). Outcome: B improved sales-qualified rate but reduced volume; hybrid rule recommended.`,
  `Experiment E-412: retrieval chunk size (A=400 tokens, B=900 tokens). Outcome: A improved answer grounding scores; B increased cost with marginal lift.`,
  `Experiment E-501: follow-up question count (A=1, B=3). Outcome: B increased intent capture but raised drop-off on low-intent users.`,
  `Experiment E-602: pricing disclosure timing (A=early, B=late). Outcome: A improved trust metrics; B improved click-through to demo.`,
  `Experiment E-718: model temperature (A=0.2, B=0.7). Outcome: A reduced hallucinations in regulated copy; B improved creativity tasks.`,
  `Experiment E-809: webhook batching (A=realtime, B=5s batch). Outcome: B cut CRM API errors during spikes; acceptable delay for ops.`,
];
