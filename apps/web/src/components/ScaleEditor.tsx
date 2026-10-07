import { useState } from 'react';
import { FIBONACCI, TSHIRT, scaleSchema, type Scale } from '@poker/shared';
export function ScaleEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: Scale;
  onChange: (scale: Scale) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState(
    value.name === 'Fibonacci' ? 'fibonacci' : value.name === 'Camisetas' ? 'tshirt' : 'custom',
  );
  const [text, setText] = useState(
    value.cards.map((c) => (c.value === undefined ? c.label : `${c.label}=${c.value}`)).join(', '),
  );
  const [error, setError] = useState('');
  function apply(raw: string) {
    setText(raw);
    const result = scaleSchema.safeParse({
      name: 'Personalizada',
      cards: raw.split(',').map((token) => {
        const [label, n] = token.trim().split('=');
        return {
          label,
          ...(n !== undefined
            ? { value: Number(n) }
            : /^\d+(\.\d+)?$/.test(label)
            ? { value: Number(label) }
            : {}),
        };
      }),
    });
    if (result.success) {
      onChange(result.data);
      setError('');
    } else {
      onChange({ name: 'Personalizada', cards: [] });
      setError('Usa entre 2 y 30 cartas únicas. ? y café se agregan solos.');
    }
  }
  return (
    <div className="scale-editor">
      <label>
        Escala
        <select
          aria-label="Escala"
          value={mode}
          disabled={disabled}
          onChange={(e) => {
            setMode(e.target.value);
            setError('');
            if (e.target.value === 'fibonacci') onChange(FIBONACCI);
            else if (e.target.value === 'tshirt') onChange(TSHIRT);
            else apply(text);
          }}
        >
          <option value="fibonacci">Fibonacci</option>
          <option value="tshirt">Camisetas (XS–XXL)</option>
          <option value="custom">Personalizada</option>
        </select>
      </label>
      {mode === 'custom' && (
        <label>
          Cartas separadas por comas
          <input
            value={text}
            disabled={disabled}
            onChange={(e) => apply(e.target.value)}
            placeholder="1, 2, 4, 8 o S=1, M=3, L=5"
          />
          <small>Asigna valores con = para calcular promedios.</small>
        </label>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
