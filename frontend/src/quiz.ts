/** Display order is independent of the canonical server question indices. */
export type Draft = { answers: Record<number, number>; tasks: Record<number, boolean>; quiz: boolean; skip: boolean; order: number[]; refreshNeeded: boolean; quizRevision: number };
export function restoreDraft(value: unknown, practice: boolean, count: number, revision: number, ready: boolean): Draft {
  const order = Array.from({ length: count }, (_, index) => index);
  if (value && typeof value === 'object') {
    const saved = value as Partial<Draft>;
    if (saved.answers && saved.tasks && typeof saved.answers === 'object' && typeof saved.tasks === 'object' && typeof saved.quiz === 'boolean' && typeof saved.skip === 'boolean') {
      const interrupted = saved.quiz || saved.quizRevision !== revision;
      return { ...saved, quiz: interrupted ? false : saved.quiz, answers: interrupted ? {} : saved.answers,
        tasks: saved.tasks, skip: saved.skip, refreshNeeded: !!saved.refreshNeeded || interrupted || !ready,
        quizRevision: revision, order: validOrder(saved.order, count) ? saved.order : order };
    }
  }
  return { answers: {}, tasks: {}, quiz: practice && ready, skip: false, order, refreshNeeded: !ready, quizRevision: revision };
}
export function validOrder(value: unknown, count: number): value is number[] {
  return Array.isArray(value) && value.length === count && new Set(value).size === count
    && value.every(index => Number.isInteger(index) && index >= 0 && index < count);
}
export function shuffledOrder(count: number, previous?: number[], random = Math.random): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Randomness may return the same order. A retry must visibly change it.
  if (count > 1 && previous && order.every((value, index) => value === previous[index])) {
    order.push(order.shift()!);
  }
  return order;
}
export function canonicalAnswers(answers: Record<number, number>, count: number): number[] {
  return Array.from({ length: count }, (_, index) => answers[index]);
}
