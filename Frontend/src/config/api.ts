const DEFAULT_API_BASE_URL = "https://guaepynme4.ap-southeast-2.awsapprunner.com";

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
);

export function buildApiUrl(path: string) {
  // Centralizes the App Runner base URL so components never hardcode production endpoints.
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
