import { useEffect, useState, useTransition } from "react";
import { checkBackendHealth } from "../utils/api";
import { predictNetworkSample, type PredictionInput } from "../utils/predict";
import { STANDARD_SYNC_INTERVAL_MS, type SyncCallbacks } from "../utils/sync";
import { EmptyState } from "./EmptyState";
import { Panel } from "./Panel";
import { PredictionResultCard } from "./PredictionResultCard";

type NumericField =
  | "duration"
  | "srcBytes"
  | "dstBytes"
  | "totalBytes"
  | "byteRatio"
  | "activityCount"
  | "serviceCount"
  | "sameServiceRate"
  | "destinationHostCount"
  | "destinationHostServiceCount";

type PredictionFormInput = Record<NumericField, string> & {
  protocolGroup: PredictionInput["protocolGroup"];
  serviceGroup: PredictionInput["serviceGroup"];
  connectionGroup: PredictionInput["connectionGroup"];
  serviceDetail: string;
  connectionDetail: string;
};

const numericFields: NumericField[] = [
  "duration",
  "srcBytes",
  "dstBytes",
  "totalBytes",
  "byteRatio",
  "activityCount",
  "serviceCount",
  "sameServiceRate",
  "destinationHostCount",
  "destinationHostServiceCount",
];

const fieldConfig: Record<NumericField, { label: string; description: string; max?: number }> = {
  duration: { label: "Duration", description: "Connection duration in seconds.", max: 604800 },
  srcBytes: { label: "Source bytes", description: "Bytes sent by the source." },
  dstBytes: { label: "Destination bytes", description: "Bytes returned by the destination." },
  totalBytes: { label: "Total bytes", description: "Combined source and destination bytes." },
  byteRatio: { label: "Byte ratio", description: "Source bytes divided by destination bytes." },
  activityCount: { label: "Activity count", description: "Recent related connection count." },
  serviceCount: { label: "Service count", description: "Recent connections using the same service." },
  sameServiceRate: { label: "Same service rate", description: "Ratio from 0 to 1.", max: 1 },
  destinationHostCount: { label: "Destination host count", description: "Recent connections to the destination host." },
  destinationHostServiceCount: { label: "Destination host service count", description: "Recent destination connections using the same service." },
};

const initialInput: PredictionFormInput = {
  duration: "",
  srcBytes: "",
  dstBytes: "",
  totalBytes: "",
  byteRatio: "",
  activityCount: "",
  serviceCount: "",
  sameServiceRate: "",
  destinationHostCount: "",
  destinationHostServiceCount: "",
  protocolGroup: "TCP",
  serviceGroup: "WEB",
  connectionGroup: "Established",
  serviceDetail: "http",
  connectionDetail: "sf",
};

type SelfTestPageProps = SyncCallbacks & {
  refreshNonce: number;
};

export function SelfTestPage({
  refreshNonce,
  onSyncSuccess,
  onSyncFailure,
}: SelfTestPageProps) {
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
    message: "Enter the 15 harmonized model features.",
  });

  const validationErrors = validateInput(input);
  const isValid = Object.keys(validationErrors).length === 0;
  const isLoading = status.type === "loading" || isPending;
  const statusTone = status.type === "idle" ? "info" : status.type;

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    const syncBackendStatus = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        await checkBackendHealth();
        if (active) onSyncSuccess();
      } catch {
        if (active) onSyncFailure();
      } finally {
        requestInFlight = false;
      }
    };

    void syncBackendStatus();
    const timer = window.setInterval(() => void syncBackendStatus(), STANDARD_SYNC_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshNonce, onSyncFailure, onSyncSuccess]);

  const handlePredict = async () => {
    if (!isValid) {
      setStatus({ type: "error", message: "Correct the highlighted fields before prediction." });
      return;
    }

    setStatus({ type: "loading", message: "Sending harmonized features to the backend..." });
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
        setStatus({ type: "success", message: "Prediction completed." });
        onSyncSuccess();
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "The prediction request failed.",
      });
      onSyncFailure();
    }
  };

  return (
    <div className="page-grid">
      <div className="analytics-grid">
        <Panel title="Manual prediction" subtitle="Uses the deployed model's 15 harmonized input features.">
          <div className="prediction-form-grid">
            {numericFields.map((field) => (
              <NumberInput
                key={field}
                label={fieldConfig[field].label}
                description={fieldConfig[field].description}
                error={validationErrors[field]}
                value={input[field]}
                max={fieldConfig[field].max}
                onChange={(value) => setInput((current) => ({ ...current, [field]: value }))}
              />
            ))}

            <SelectInput label="Protocol group" value={input.protocolGroup} options={["TCP", "UDP", "ICMP", "OTHER"]} onChange={(value) => setInput((current) => ({ ...current, protocolGroup: value as PredictionInput["protocolGroup"] }))} />
            <SelectInput label="Service group" value={input.serviceGroup} options={["WEB", "DNS", "EMAIL", "FILE", "INFRA", "REMOTE", "OTHER"]} onChange={(value) => setInput((current) => ({ ...current, serviceGroup: value as PredictionInput["serviceGroup"] }))} />
            <SelectInput label="Connection group" value={input.connectionGroup} options={["Established", "Attempted", "Rejected", "Reset", "ERROR"]} onChange={(value) => setInput((current) => ({ ...current, connectionGroup: value as PredictionInput["connectionGroup"] }))} />
            <TextInput label="Service detail" value={input.serviceDetail} onChange={(value) => setInput((current) => ({ ...current, serviceDetail: value }))} />
            <TextInput label="Connection detail" value={input.connectionDetail} onChange={(value) => setInput((current) => ({ ...current, connectionDetail: value }))} />
          </div>

          <div className="button-row">
            <button type="button" className="primary-button" onClick={handlePredict} disabled={isLoading || !isValid}>
              {isLoading ? "Predicting..." : "Predict"}
            </button>
            <button type="button" className="secondary-button" onClick={() => {
              setInput(initialInput);
              setResult(null);
              setStatus({ type: "idle", message: "Form reset." });
            }} disabled={isLoading}>
              Reset
            </button>
          </div>
          <p className={`inline-message inline-message-${statusTone}`}>{status.message}</p>
        </Panel>

        <Panel title="Prediction output" subtitle="Binary model output: Normal or Attack.">
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
            <EmptyState title="No prediction result yet" description="Submit valid harmonized features to run a prediction." />
          )}
        </Panel>
      </div>
    </div>
  );
}

function NumberInput({
  error,
  label,
  description,
  value,
  max,
  onChange,
}: {
  error?: string;
  label: string;
  description: string;
  value: string;
  max?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="input-group">
      <span>{label}</span>
      <small>{description}</small>
      <input type="number" value={value} min="0" max={max} step="any" onChange={(event) => onChange(event.target.value)} />
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="input-group">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="input-group">
      <span>{label}</span>
      <input value={value} maxLength={64} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function validateInput(input: PredictionFormInput) {
  const errors: Partial<Record<NumericField, string>> = {};
  for (const field of numericFields) {
    const rawValue = input[field].trim();
    const value = Number(rawValue);
    const config = fieldConfig[field];
    if (!rawValue) errors[field] = `${config.label} is required.`;
    else if (!Number.isFinite(value)) errors[field] = `${config.label} must be numeric.`;
    else if (value < 0) errors[field] = `${config.label} cannot be negative.`;
    else if (config.max !== undefined && value > config.max) errors[field] = `${config.label} must be ${config.max} or lower.`;
  }
  if (input.totalBytes && input.srcBytes && input.dstBytes) {
    const expectedTotal = Number(input.srcBytes) + Number(input.dstBytes);
    if (Math.abs(Number(input.totalBytes) - expectedTotal) > 0.01) {
      errors.totalBytes = "Total bytes must equal source bytes plus destination bytes.";
    }
  }
  return errors;
}

function toPredictionInput(input: PredictionFormInput): PredictionInput {
  return {
    duration: Number(input.duration),
    srcBytes: Number(input.srcBytes),
    dstBytes: Number(input.dstBytes),
    totalBytes: Number(input.totalBytes),
    byteRatio: Number(input.byteRatio),
    activityCount: Number(input.activityCount),
    serviceCount: Number(input.serviceCount),
    sameServiceRate: Number(input.sameServiceRate),
    destinationHostCount: Number(input.destinationHostCount),
    destinationHostServiceCount: Number(input.destinationHostServiceCount),
    protocolGroup: input.protocolGroup,
    serviceGroup: input.serviceGroup,
    connectionGroup: input.connectionGroup,
    serviceDetail: input.serviceDetail.trim(),
    connectionDetail: input.connectionDetail.trim(),
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
