import { StatusBadge } from "./StatusBadge";

type PredictionResultCardProps = {
  label: "Normal" | "Suspicious" | "Attack";
  confidence: number;
  score: number;
  interpretation: string;
  scoreLabel?: string;
  scoreSuffix?: string;
  testedAt?: string;
};

export function PredictionResultCard({
  label,
  confidence,
  score,
  interpretation,
  scoreLabel = "Score",
  scoreSuffix = "",
  testedAt,
}: PredictionResultCardProps) {
  const tone =
    label === "Attack" ? "attack" : label === "Suspicious" ? "suspicious" : "normal";

  return (
    <div className="prediction-card">
      <div className="prediction-card-header">
        <div>
          <p className="eyebrow">Prediction Result</p>
          <h4>{label}</h4>
        </div>
        <StatusBadge label={label} tone={tone} />
      </div>
      <div className="prediction-card-metrics">
        <div>
          <span>Confidence</span>
          <strong>{confidence}%</strong>
        </div>
        <div>
          <span>{scoreLabel}</span>
          <strong>
            {score}
            {scoreSuffix}
          </strong>
        </div>
        <div>
          <span>Checked at</span>
          <strong>{testedAt ?? "Just now"}</strong>
        </div>
      </div>
      <p>{interpretation}</p>
    </div>
  );
}
