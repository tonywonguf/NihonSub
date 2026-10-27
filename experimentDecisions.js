const DECISION_CHOICES = new Set(['keep-a', 'use-b', 'inconclusive', 'current', 'archive']);

function isValidDecision(decision) {
  return decision && DECISION_CHOICES.has(decision.choice) &&
    typeof decision.decidedAt === 'string' && !Number.isNaN(Date.parse(decision.decidedAt));
}

export function appendExperimentDecision(history, choice, decidedAt = new Date().toISOString()) {
  if (!Array.isArray(history) || history.some(decision => !isValidDecision(decision))) {
    throw new Error('Invalid decision history.');
  }
  if (!DECISION_CHOICES.has(choice) || !isValidDecision({ choice, decidedAt })) {
    throw new Error('Invalid decision.');
  }
  return [...history, { choice, decidedAt }];
}
