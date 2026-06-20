import { Tone } from "../data/mockData";
import { StatusBadge } from "./StatusBadge";

type SummaryCardProps = {
  label: string;
  value: string;
  helper: string;
  tone: Tone;
};

export function SummaryCard({ label, value, helper, tone }: SummaryCardProps) {
  return (
    <article className={`summary-card summary-card-${tone}`}>
      <div className="summary-card-header">
        <p>{label}</p>
        <StatusBadge label={tone} tone={tone} />
      </div>
      <strong>{value}</strong>
      <span>{helper}</span>
    </article>
  );
}
