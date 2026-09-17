import { apiClient } from "@/lib/api-client";
import type { HealthResponse } from "@/types/health";

export function getApiHealth(): Promise<HealthResponse> {
  return apiClient<HealthResponse>("/api/health");
}
