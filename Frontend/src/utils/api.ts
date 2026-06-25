import { buildApiUrl } from "../config/api";

type RequestJsonOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | null;
};

type ErrorPayload = {
  detail?: string | { msg?: string }[] | Record<string, unknown>;
  details?: string | Record<string, unknown>;
  error?: string | { message?: string; details?: unknown };
  error_info?: { message?: string; details?: unknown };
  message?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function requestJson<T>(
  path: string,
  options: RequestJsonOptions = {},
): Promise<T> {
  const response = await fetch(buildApiUrl(path), options);
  const rawBody = await response.text();
  const data: unknown = parseJson(rawBody);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(data, response.status), response.status);
  }

  return data as T;
}

export async function checkBackendHealth(): Promise<void> {
  await requestJson<unknown>("/health");
}

function parseJson(value: string) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
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

    if (joined) {
      return joined;
    }
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
