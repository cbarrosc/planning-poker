import type { Scale } from './scales';
export interface Statistics {
  distribution: Record<string, number>;
  ordinary: number;
  special: number;
  consensus: boolean;
  modes: string[];
  average?: number;
  median?: number;
}
export function calculateStatistics(scale: Scale, votes: string[]): Statistics {
  const distribution: Record<string, number> = Object.create(null);
  for (const vote of votes) distribution[vote] = (distribution[vote] ?? 0) + 1;
  const ordinary = votes.filter((v) => scale.cards.some((c) => c.label === v));
  const counts = scale.cards.map((c) => ({ label: c.label, count: distribution[c.label] ?? 0 }));
  const max = Math.max(0, ...counts.map((c) => c.count));
  const result: Statistics = {
    distribution,
    ordinary: ordinary.length,
    special: votes.length - ordinary.length,
    consensus: ordinary.length > 0 && new Set(ordinary).size === 1,
    modes: counts.filter((c) => max > 0 && c.count === max).map((c) => c.label),
  };
  if (ordinary.length && scale.cards.every((c) => c.value !== undefined)) {
    const values = ordinary
      .map((v) => scale.cards.find((c) => c.label === v)!.value!)
      .sort((a, b) => a - b);
    result.average = values.reduce((a, b) => a + b, 0) / values.length;
    const m = Math.floor(values.length / 2);
    result.median = values.length % 2 ? values[m] : (values[m - 1] + values[m]) / 2;
  }
  return result;
}
