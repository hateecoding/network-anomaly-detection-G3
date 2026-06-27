import axios, { type AxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../config/api";

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

type SharedRequestConfig = Omit<
  AxiosRequestConfig,
  "baseURL" | "data" | "method" | "url"
>;

type ErrorPayload = {
  detail?: string | { msg?: string }[] | Record<string, unknown>;
  details?: string | Record<string, unknown>;
  error?: string | { message?: string; details?: unknown };
  error_info?: { message?: string; details?: unknown };
  message?: string;
};

// One private Axios client keeps the base URL, timeout, and transport policy consistent across every page.
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const isMultipart =
    typeof FormData !== "undefined" && config.data instanceof FormData;

  if (isMultipart) {
    // The browser must generate the multipart boundary; manually setting this header breaks uploads.
    config.headers.delete("Content-Type");
  } else if (config.data !== undefined && config.data !== null) {
    config.headers.set("Content-Type", "application/json");
  }

  return config;
});

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getJson<T>(
  path: string,
  config: SharedRequestConfig = {},
): Promise<T> {
  return executeRequest<T>({ ...config, method: "GET", url: path });
}

export function postJson<TResponse, TBody = unknown>(
  path: string,
  body: TBody,
  config: SharedRequestConfig = {},
): Promise<TResponse> {
  return executeRequest<TResponse>({ ...config, data: body, method: "POST", url: path });
}

export function postMultipart<T>(
  path: string,
  body: FormData,
  config: SharedRequestConfig = {},
): Promise<T> {
  return executeRequest<T>({ ...config, data: body, method: "POST", url: path });
}

export async function checkBackendHealth(): Promise<void> {
  await getJson<unknown>("/health");
}

async function executeRequest<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await apiClient.request<T>(config);
    return response.data;
  } catch (error) {
    // All pages receive the same friendly ApiError shape regardless of Axios/FastAPI error details.
    throw normalizeApiError(error);
  }
}

function normalizeApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return new ApiError("The request could not be completed.", 0);
  }

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new ApiError("The backend request timed out. Please try again.", 0);
  }

  if (!error.response) {
    return new ApiError("Unable to reach the backend service. Please try again.", 0);
  }

  const status = error.response.status;
  const payload = parsePayload(error.response.data);
  return new ApiError(getErrorMessage(payload, status), status);
}

function parsePayload(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getErrorMessage(data: unknown, status: number) {
  if (!data || typeof data !== "object") {
    return `Request failed with status ${status}.`;
  }

  const payload = data as ErrorPayload;

  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (typeof payload.details === "string" && payload.details.trim()) {
    return payload.details;
  }

  if (Array.isArray(payload.detail)) {
    const joined = payload.detail
      .map((item) => item.msg)
      .filter((value): value is string => Boolean(value))
      .join(", ");

    if (joined) return joined;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (
    payload.error &&
    typeof payload.error === "object" &&
    typeof payload.error.message === "string" &&
    payload.error.message.trim()
  ) {
    return payload.error.message;
  }

  if (
    payload.error_info &&
    typeof payload.error_info.message === "string" &&
    payload.error_info.message.trim()
  ) {
    return payload.error_info.message;
  }

  return `Request failed with status ${status}.`;
}
