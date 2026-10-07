import { z } from 'zod';
export const SPECIAL = ['?', '☕'] as const;
export const scaleSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    cards: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(20),
          value: z.number().finite().nonnegative().max(1e12).optional(),
        }),
      )
      .min(2)
      .max(30),
  })
  .refine(
    (s) =>
      new Set(s.cards.map((c) => c.label)).size === s.cards.length &&
      s.cards.every((c) => !SPECIAL.includes(c.label as (typeof SPECIAL)[number])),
    'Las etiquetas deben ser únicas y no pueden ser ? o ☕.',
  );
export type Scale = z.infer<typeof scaleSchema>;
export const FIBONACCI: Scale = {
  name: 'Fibonacci',
  cards: [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89].map((value) => ({ label: String(value), value })),
};
export const TSHIRT: Scale = {
  name: 'Camisetas',
  cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((label) => ({ label })),
};
