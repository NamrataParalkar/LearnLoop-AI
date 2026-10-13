/**
 * LearnLoop API Base URL configuration.
 * Reads from process.env.NEXT_PUBLIC_API_URL, defaulting to http://localhost:8000.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Helper to build full backend API URLs
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
