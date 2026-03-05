import { apiClient } from "@/services/api/client";
import type { Crop } from "@/types/api";

export const cropsApi = {
  listByFarm: (farmId: string) => apiClient.get<Crop[]>(`/farms/${farmId}/crops`),
  create: (farmId: string, payload: Pick<Crop, "name" | "status">) =>
    apiClient.post<Crop>(`/farms/${farmId}/crops`, payload),
};
