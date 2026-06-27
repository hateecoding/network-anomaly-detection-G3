const DEFAULT_API_BASE_URL = "https://guaepynme4.ap-southeast-2.awsapprunner.com";

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeBaseUrl(
  // Amplify supplies VITE_API_BASE_URL; the App Runner URL keeps production usable if it is omitted.
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
);
