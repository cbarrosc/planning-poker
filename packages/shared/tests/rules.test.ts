import { describe, it, expect } from 'vitest';
import { calculateStatistics, FIBONACCI, TSHIRT, scaleSchema } from '../src/index';

describe('estadísticas y escalas', () => {
  it('excluye especiales sin convertirlos en ceros', () => {
    expect(calculateStatistics(FIBONACCI, ['1', '3', '?', '☕'])).toMatchObject({
      average: 2,
      median: 2,
      ordinary: 2,
      special: 2,
      consensus: false,
    });
  });
  it('no inventa resultados cuando todos se abstienen', () => {
    const s = calculateStatistics(FIBONACCI, ['?', '☕']);
    expect(s.average).toBeUndefined();
    expect(s.consensus).toBe(false);
  });
  it('calcula mediana y moda sin promediar tallas', () => {
    expect(calculateStatistics(FIBONACCI, ['1', '3', '3']).median).toBe(3);
    expect(calculateStatistics(TSHIRT, ['S', 'S'])).toMatchObject({
      consensus: true,
      modes: ['S'],
    });
    expect(calculateStatistics(TSHIRT, ['S', 'M']).average).toBeUndefined();
  });
  it('rechaza escalas ambiguas, especiales reservados y números inválidos', () => {
    for (const cards of [
      [{ label: 'a' }, { label: 'a' }],
      [{ label: '?' }, { label: 'b' }],
      [{ label: 'a', value: Infinity }, { label: 'b' }],
    ]) {
      expect(scaleSchema.safeParse({ name: 'Custom', cards }).success).toBe(false);
    }
  });
  it('conserva cero como estimación válida', () => {
    expect(calculateStatistics(FIBONACCI, ['0', '0'])).toMatchObject({
      average: 0,
      median: 0,
      consensus: true,
    });
  });
});
