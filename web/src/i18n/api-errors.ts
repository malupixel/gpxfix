import { ApiError } from "@/lib/api-client";

/** Keep server diagnostics out of UI copy; translate errors at render time. */
export function apiErrorKey(error: unknown, fallback = "errors.generic"): string {
  if (!(error instanceof ApiError)) return error instanceof TypeError ? "apiErrors.network" : fallback;
  if (error.status === 401 || error.status === 403) return "apiErrors.unauthorized";
  if (error.status === 404) return "apiErrors.notFound";
  if (error.status === 413) return "apiErrors.tooLarge";
  if (error.status === 422) return "apiErrors.invalidGpx";
  if (error.status === 400) return "apiErrors.invalid";
  if (error.status === 409) {
    if (/affected route section has changed|cannot be merged safely|anchors no longer match/.test(error.message)) return "apiErrors.mergeConflict";
    return "apiErrors.conflict";
  }
  return fallback;
}
