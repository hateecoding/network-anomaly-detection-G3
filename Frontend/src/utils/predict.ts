import { requestJson } from "./api";

export type PredictionInput = {
  duration: number;
  srcBytes: number;
  dstBytes: number;
  failedLogins: number;
  packetRate: number;
  unusualPortHits: number;
  protocol: "tcp" | "udp" | "icmp";
  service: "http" | "dns" | "ssh" | "ftp" | "auth" | "other";
  state: "SF" | "S0" | "REJ" | "RSTO";
};

export type PredictionResult = {
  label: "Normal" | "Attack";
  score: number;
  confidence: number;
  explanation: string;
};

type BackendPredictionRequest = {
  dur: number;
  proto: string;
  service: string;
  state: string;
  spkts: number;
  dpkts: number;
  sbytes: number;
  dbytes: number;
  rate: number;
  sttl: number;
  dttl: number;
  sload: number;
  dload: number;
  sloss: number;
  dloss: number;
  sinpkt: number;
  dinpkt: number;
  sjit: number;
  djit: number;
  swin: number;
  stcpb: number;
  dtcpb: number;
  dwin: number;
  tcprtt: number;
  synack: number;
  ackdat: number;
  smean: number;
  dmean: number;
  trans_depth: number;
  response_body_len: number;
  ct_srv_src: number;
  ct_state_ttl: number;
  ct_dst_ltm: number;
  ct_src_dport_ltm: number;
  ct_dst_sport_ltm: number;
  ct_dst_src_ltm: number;
  is_ftp_login: number;
  ct_ftp_cmd: number;
  ct_flw_http_mthd: number;
  ct_src_ltm: number;
  ct_srv_dst: number;
  is_sm_ips_ports: number;
};

type BackendPredictionResponse = {
  prediction: number;
  result: "attack" | "normal";
  attack_probability: number;
  confidence?: number;
  timestamp?: string;
};

const stateMap: Record<PredictionInput["state"], string> = {
  SF: "FIN",
  S0: "INT",
  REJ: "RST",
  RSTO: "RST",
};

const serviceMap: Record<PredictionInput["service"], string> = {
  http: "http",
  dns: "dns",
  ssh: "ssh",
  ftp: "ftp",
  auth: "ssh",
  other: "-",
};

export async function predictNetworkSample(
  input: PredictionInput,
): Promise<PredictionResult> {
  const response = await requestJson<BackendPredictionResponse>("/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPredictionPayload(input)),
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
    explanation: buildExplanation(response.result, attackProbability),
  };
}

function buildPredictionPayload(input: PredictionInput): BackendPredictionRequest {
  const totalBytes = Math.max(0, input.srcBytes + input.dstBytes);
  const derivedPackets = Math.max(1, Math.round(totalBytes / 750));
  const sourcePackets = Math.max(1, Math.round(derivedPackets * 0.6));
  const destinationPackets = Math.max(0, derivedPackets - sourcePackets);
  const attackSignals = Math.max(0, input.failedLogins + input.unusualPortHits);
  const rate = Math.max(0, input.packetRate);
  const interPacketTime = rate > 0 ? Number((1 / rate).toFixed(6)) : 0;

  return {
    dur: Math.max(0, input.duration),
    proto: input.protocol,
    service: serviceMap[input.service],
    state: stateMap[input.state],
    spkts: sourcePackets,
    dpkts: destinationPackets,
    sbytes: Math.max(0, input.srcBytes),
    dbytes: Math.max(0, input.dstBytes),
    rate,
    sttl: 64,
    dttl: 64,
    sload: Math.round(Math.max(0, input.srcBytes) * Math.max(rate, 1)),
    dload: Math.round(Math.max(0, input.dstBytes) * Math.max(rate, 1)),
    sloss: Math.max(0, input.failedLogins),
    dloss: Math.max(0, input.unusualPortHits),
    sinpkt: interPacketTime,
    dinpkt: interPacketTime,
    sjit: Number((input.unusualPortHits * 0.15).toFixed(3)),
    djit: Number((input.unusualPortHits * 0.1).toFixed(3)),
    swin: 255,
    stcpb: 0,
    dtcpb: 0,
    dwin: 255,
    tcprtt: 0,
    synack: 0,
    ackdat: 0,
    smean: sourcePackets > 0 ? Math.round(Math.max(0, input.srcBytes) / sourcePackets) : 0,
    dmean:
      destinationPackets > 0
        ? Math.round(Math.max(0, input.dstBytes) / destinationPackets)
        : 0,
    trans_depth: input.service === "http" ? 1 : 0,
    response_body_len: Math.max(0, input.dstBytes),
    ct_srv_src: Math.max(1, input.failedLogins + 1),
    ct_state_ttl: attackSignals > 0 ? 2 : 1,
    ct_dst_ltm: Math.max(0, input.unusualPortHits),
    ct_src_dport_ltm: Math.max(0, input.unusualPortHits),
    ct_dst_sport_ltm: 0,
    ct_dst_src_ltm: Math.max(0, input.unusualPortHits),
    is_ftp_login: input.service === "ftp" && input.failedLogins > 0 ? 1 : 0,
    ct_ftp_cmd: input.service === "ftp" ? Math.max(0, input.failedLogins) : 0,
    ct_flw_http_mthd: input.service === "http" ? 1 : 0,
    ct_src_ltm: Math.max(1, input.failedLogins + 1),
    ct_srv_dst: Math.max(1, input.unusualPortHits + 1),
    is_sm_ips_ports: input.unusualPortHits > 0 ? 1 : 0,
  };
}

function buildExplanation(
  result: BackendPredictionResponse["result"],
  attackProbability: number,
) {
  if (result === "attack") {
    if (attackProbability >= 0.85) {
      return "The deployed model sees a strong attack pattern in this traffic record and assigns a high attack probability.";
    }

    return "The deployed model still flags this traffic record as an attack, but with a more moderate margin.";
  }

  if (attackProbability >= 0.35) {
    return "The deployed model returns normal overall, but the attack probability is elevated enough to justify a closer review.";
  }

  return "The deployed model keeps this traffic record in the normal range with a low attack probability.";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
