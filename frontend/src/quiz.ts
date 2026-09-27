/** Display order is independent of the canonical server question indices. */
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
