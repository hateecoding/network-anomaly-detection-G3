import { useState, useTransition } from "react";
import { predictNetworkSample, type PredictionInput } from "../utils/predict";
import { EmptyState } from "./EmptyState";
import { Panel } from "./Panel";
import { PredictionResultCard } from "./PredictionResultCard";

type PredictionFormInput = {
  duration: string;
  srcBytes: string;
  dstBytes: string;
  failedLogins: string;
  packetRate: string;
  unusualPortHits: string;
  protocol: PredictionInput["protocol"];
  service: PredictionInput["service"];
  state: PredictionInput["state"];
};

const initialInput: PredictionFormInput = {
  duration: "",
  srcBytes: "",
  dstBytes: "",
  failedLogins: "",
  packetRate: "",
  unusualPortHits: "",
  protocol: "tcp",
  service: "http",
  state: "SF",
};

const numericFields = [
  "duration",
  "srcBytes",
  "dstBytes",
  "failedLogins",
  "packetRate",
  "unusualPortHits",
] as const;

const fieldLabels: Record<(typeof numericFields)[number], string> = {
  duration: "Duration",
  srcBytes: "Source bytes",
  dstBytes: "Destination bytes",
  failedLogins: "Failed logins",
  packetRate: "Packet rate",
  unusualPortHits: "Unusual port hits",
};

export function SelfTestPage() {
  const [isPending, startTransition] = useTransition();
  const [input, setInput] = useState<PredictionFormInput>(initialInput);
  const [result, setResult] = useState<{
    confidence: number;
    interpretation: string;
    label: "Normal" | "Attack";
    score: number;
    testedAt: string;
  } | null>(null);
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message: string;
  }>({
    type: "idle",
    message: "Complete the fields to send a live prediction request.",
  });

  const validationErrors = validateInput(input);
  const isValid = Object.keys(validationErrors).length === 0;
  const isLoading = status.type === "loading" || isPending;
  const statusTone = status.type === "idle" ? "info" : status.type;

  const handleFieldChange = (field: keyof PredictionFormInput, value: string) => {
    setInput((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handlePredict = async () => {
    if (!isValid) {
      setStatus({
        type: "error",
        message: "Please complete all required numeric fields before prediction.",
      });
      return;
    }

    setStatus({
      type: "loading",
      message: "Sending request to the live backend model...",
    });

    try {
      const nextResult = await predictNetworkSample(toPredictionInput(input));

      startTransition(() => {
        setResult({
          confidence: nextResult.confidence,
          interpretation: nextResult.explanation,
          label: nextResult.label,
          score: nextResult.score,
          testedAt: formatNow(new Date()),
        });
        setStatus({
          type: "success",
          message: "Live prediction completed successfully.",
        });
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "The live prediction request failed.",
      });
    }
  };

  const handleReset = () => {
    setInput(initialInput);
    setResult(null);
    setStatus({
      type: "idle",
      message: "Form reset. No prediction result is currently displayed.",
    });
  };

  return (
    <div className="page-grid">
      <div className="analytics-grid">
        <Panel title="Manual prediction form" subtitle="Send one traffic record to /predict.">
          <div className="prediction-form-grid">
            <label className="input-group">
              <span>Protocol</span>
              <select value={input.protocol} onChange={(event) => handleFieldChange("protocol", event.target.value)}>
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
                <option value="icmp">ICMP</option>
              </select>
            </label>

            <label className="input-group">
              <span>Service</span>
              <select value={input.service} onChange={(event) => handleFieldChange("service", event.target.value)}>
                <option value="http">HTTP</option>
                <option value="dns">DNS</option>
                <option value="ssh">SSH</option>
                <option value="ftp">FTP</option>
                <option value="auth">Auth</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="input-group">
              <span>State</span>
              <select value={input.state} onChange={(event) => handleFieldChange("state", event.target.value)}>
                <option value="SF">SF</option>
                <option value="S0">S0</option>
                <option value="REJ">REJ</option>
                <option value="RSTO">RSTO</option>
              </select>
            </label>

            <NumberInput
              error={validationErrors.duration}
              label="Duration"
              value={input.duration}
              onChange={(value) => handleFieldChange("duration", value)}
            />
            <NumberInput
              error={validationErrors.srcBytes}
              label="Source bytes"
              value={input.srcBytes}
              onChange={(value) => handleFieldChange("srcBytes", value)}
            />
            <NumberInput
              error={validationErrors.dstBytes}
              label="Destination bytes"
              value={input.dstBytes}
              onChange={(value) => handleFieldChange("dstBytes", value)}
            />
            <NumberInput
              error={validationErrors.failedLogins}
              label="Failed logins"
              value={input.failedLogins}
              onChange={(value) => handleFieldChange("failedLogins", value)}
            />
            <NumberInput
              error={validationErrors.packetRate}
              label="Packet rate"
              value={input.packetRate}
              onChange={(value) => handleFieldChange("packetRate", value)}
            />
            <NumberInput
              error={validationErrors.unusualPortHits}
              label="Unusual port hits"
              value={input.unusualPortHits}
              onChange={(value) => handleFieldChange("unusualPortHits", value)}
            />
          </div>

          <div className="button-row">
            <button type="button" className="primary-button" onClick={handlePredict} disabled={isLoading || !isValid}>
              {isLoading ? "Predicting..." : "Predict"}
            </button>
            <button type="button" className="secondary-button" onClick={handleReset} disabled={isLoading}>
              Reset
            </button>
          </div>
          <p className={`inline-message inline-message-${statusTone}`}>{status.message}</p>
        </Panel>

        <Panel title="Prediction output" subtitle="Result appears after prediction.">
          {result ? (
            <PredictionResultCard
              confidence={result.confidence}
              interpretation={result.interpretation}
              label={result.label}
              score={result.score}
              scoreLabel="Attack probability"
              scoreSuffix="%"
              testedAt={result.testedAt}
            />
          ) : (
            <EmptyState
              title="No prediction result yet"
              description="Submit the form to run a backend prediction."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function NumberInput({
  error,
  label,
  value,
  onChange,
}: {
  error?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="input-group">
      <span>{label}</span>
      <input type="number" value={value} min="0" onChange={(event) => onChange(event.target.value)} />
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function validateInput(input: PredictionFormInput) {
  const errors: Partial<Record<(typeof numericFields)[number], string>> = {};

  for (const field of numericFields) {
    const rawValue = input[field].trim();
    const label = fieldLabels[field];
    const value = Number(rawValue);

    if (!rawValue) {
      errors[field] = `${label} is required.`;
      continue;
    }

    if (!Number.isFinite(value)) {
      errors[field] = `${label} must be numeric.`;
      continue;
    }

    if (value < 0) {
      errors[field] = `${label} cannot be negative.`;
    }
  }

  return errors;
}

function toPredictionInput(input: PredictionFormInput): PredictionInput {
  return {
    duration: Number(input.duration),
    srcBytes: Number(input.srcBytes),
    dstBytes: Number(input.dstBytes),
    failedLogins: Number(input.failedLogins),
    packetRate: Number(input.packetRate),
    unusualPortHits: Number(input.unusualPortHits),
    protocol: input.protocol,
    service: input.service,
    state: input.state,
  };
}

function formatNow(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
