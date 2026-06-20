import { Tone } from "../data/mockData";

type StatusBadgeProps = {
  label: string;
  tone: Tone;
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return <span className={`status-badge status-${tone}`}>{label}</span>;
}
