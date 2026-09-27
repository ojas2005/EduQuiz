import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalAnswers, shuffledOrder, validOrder } from '../.test-build/quiz.js';

test('retry changes even when randomness returns the previous ordering', () => {
  const previous = [0, 1, 2, 3, 4, 5];
  const next = shuffledOrder(6, previous, () => 0.9999);
  assert.notDeepEqual(next, previous);
  assert.deepEqual([...next].sort(), previous);
});
test('display order never changes which canonical question an answer belongs to', () => {
  const order = [2, 0, 1];
  const answers = {};
  [3, 1, 2].forEach((answer, displayedIndex) => { answers[order[displayedIndex]] = answer; });
  assert.deepEqual(canonicalAnswers(answers, 3), [1, 2, 3]);
});
test('restore only complete, unique in-range question permutations', () => {
  assert.equal(validOrder([2, 0, 1], 3), true);
  for (const invalid of [[0, 0, 2], [0, 1], [0, 1, 3], [0, 1, -1], [0, 1, '2'], null]) {
    assert.equal(validOrder(invalid, 3), false);
  }
});
test('shuffling supports every allowed quiz size without dropping questions', () => {
  for (const count of [3, 4, 5, 6, 8]) {
    const previous = Array.from({ length: count }, (_, i) => i);
    for (let i = 0; i < 20; i++) {
      const next = shuffledOrder(count, previous);
      assert.equal(validOrder(next, count), true);
      assert.notDeepEqual(next, previous);
    }
  }
});
