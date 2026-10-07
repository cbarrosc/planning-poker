import { Check, Coffee, HelpCircle } from 'lucide-react';
import type { Scale } from '@poker/shared';
export function VotingDeck({
  scale,
  selected,
  disabled,
  onVote,
}: {
  scale: Scale;
  selected?: string;
  disabled: boolean;
  onVote: (choice: string) => void;
}) {
  return (
    <div className="voting-deck" aria-label="Cartas de votación">
      {[...scale.cards.map((c) => c.label), '?', '☕'].map((choice, i) => (
        <button
          key={choice}
          aria-label={`Votar ${choice === '☕' ? 'café' : choice}`}
          aria-pressed={selected === choice}
          className={`vote-card tone-${i % 5} ${selected === choice ? 'selected' : ''}`}
          disabled={disabled}
          onClick={() => onVote(choice)}
        >
          {selected === choice && (
            <span className="selection-check">
              <Check size={13} />
            </span>
          )}
          {choice === '☕' ? (
            <Coffee size={27} />
          ) : choice === '?' ? (
            <HelpCircle size={27} />
          ) : (
            <span>{choice}</span>
          )}
        </button>
      ))}
    </div>
  );
}
