import { useState, useTransition } from "react";
import { predictNetworkSample, type PredictionInput } from "../utils/predict";
import { EmptyState } from "./EmptyState";
import { Panel } from "./Panel";
import { PredictionResultCard } from "./PredictionResultCard";

const initialInput: PredictionInput = {
  duration: 84,
  srcBytes: 4200,
  dstBytes: 1600,
  failedLogins: 1,
  packetRate: 540,
  unusualPortHits: 2,
  protocol: "tcp",
  service: "http",
  state: "SF",
};

export function SelfTestPage() {
  const [isPending, startTransition] = useTransition();
  const [input, setInput] = useState<PredictionInput>(initialInput);
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
    message: "Ready to send a live prediction request.",
  });
  const isLoading = status.type === "loading" || isPending;
  const statusTone = status.type === "idle" ? "info" : status.type;

  const handleFieldChange = (
    field: keyof PredictionInput,
    value: string,
  ) => {
    setInput((current) => ({
      ...current,
      [field]:
        field === "protocol" || field === "service" || field === "state"
          ? value
          : Number(value),
    }));
  };

  const handlePredict = async () => {
    setStatus({
      type: "loading",
      message: "Sending request to the live backend model...",
    });

    try {
      const nextResult = await predictNetworkSample(input);

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
        <Panel
          title="Manual prediction form"
          subtitle="Send one traffic record to the FastAPI prediction endpoint."
        >
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

            <label className="input-group">
              <span>Duration</span>
              <input type="number" value={input.duration} min="0" onChange={(event) => handleFieldChange("duration", event.target.value)} />
            </label>

            <label className="input-group">
              <span>Source bytes</span>
              <input type="number" value={input.srcBytes} min="0" onChange={(event) => handleFieldChange("srcBytes", event.target.value)} />
            </label>

            <label className="input-group">
              <span>Destination bytes</span>
              <input type="number" value={input.dstBytes} min="0" onChange={(event) => handleFieldChange("dstBytes", event.target.value)} />
            </label>

            <label className="input-group">
              <span>Failed logins</span>
              <input type="number" value={input.failedLogins} min="0" onChange={(event) => handleFieldChange("failedLogins", event.target.value)} />
            </label>

            <label className="input-group">
              <span>Packet rate</span>
              <input type="number" value={input.packetRate} min="0" onChange={(event) => handleFieldChange("packetRate", event.target.value)} />
            </label>

            <label className="input-group">
              <span>Unusual port hits</span>
              <input type="number" value={input.unusualPortHits} min="0" onChange={(event) => handleFieldChange("unusualPortHits", event.target.value)} />
            </label>
          </div>

          <div className="button-row">
            <button type="button" className="primary-button" onClick={handlePredict} disabled={isLoading}>
              {isLoading ? "Predicting..." : "Predict"}
            </button>
            <button type="button" className="secondary-button" onClick={handleReset} disabled={isLoading}>
              Reset
            </button>
          </div>
          <p className={`inline-message inline-message-${statusTone}`}>{status.message}</p>
        </Panel>

        <Panel
          title="Prediction output"
          subtitle="AI classification result and derived attack probability."
        >
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
              description="Submit the form to run a real backend prediction."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function formatNow(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
