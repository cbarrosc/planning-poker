import { Leaf } from 'lucide-react';
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Planning Poker, inicio">
      <span className="brand-mark">
        <Leaf size={24} strokeWidth={2} />
      </span>
      <span>Planning Poker</span>
    </a>
  );
}
