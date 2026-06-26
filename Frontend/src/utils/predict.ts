import { requestJson } from "./api";

export type PredictionInput = {
  duration: number;
  srcBytes: number;
  dstBytes: number;
  totalBytes: number;
  byteRatio: number;
  activityCount: number;
  serviceCount: number;
  sameServiceRate: number;
  destinationHostCount: number;
  destinationHostServiceCount: number;
  protocolGroup: "TCP" | "UDP" | "ICMP" | "OTHER";
  serviceGroup: "DNS" | "EMAIL" | "FILE" | "INFRA" | "OTHER" | "REMOTE" | "WEB";
  connectionGroup: "Attempted" | "ERROR" | "Established" | "Rejected" | "Reset";
  serviceDetail: string;
  connectionDetail: string;
};

export type PredictionResult = {
  label: "Normal" | "Attack";
  score: number;
  confidence: number;
  explanation: string;
};

type BackendPredictionResponse = {
  result: "attack" | "normal";
  attack_probability: number;
  confidence?: number;
};

export async function predictNetworkSample(
  input: PredictionInput,
): Promise<PredictionResult> {
  // Maps the demo form's camelCase fields into the FastAPI /predict schema used by the model pipeline.
  const response = await requestJson<BackendPredictionResponse>("/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      duration: input.duration,
      src_bytes: input.srcBytes,
      dst_bytes: input.dstBytes,
      total_bytes: input.totalBytes,
      byte_ratio: input.byteRatio,
      activity_count: input.activityCount,
      service_count: input.serviceCount,
      same_service_rate: input.sameServiceRate,
      destination_host_count: input.destinationHostCount,
      destination_host_service_count: input.destinationHostServiceCount,
      protocol_group: input.protocolGroup,
      service_group: input.serviceGroup,
      connection_group: input.connectionGroup,
      service_detail: input.serviceDetail,
      connection_detail: input.connectionDetail,
    }),
  });

  const attackProbability = clamp(response.attack_probability, 0, 1);
  const confidence = clamp(
    response.confidence ??
      (response.result === "attack" ? attackProbability : 1 - attackProbability),
    0,
    1,
  );

  return {
    label: response.result === "attack" ? "Attack" : "Normal",
    score: Math.round(attackProbability * 100),
    confidence: Math.round(confidence * 100),
    explanation:
      "This is a probability-based model result. Per-feature contribution evidence is not included in the deployed response.",
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
