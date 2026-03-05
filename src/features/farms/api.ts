import { apiClient } from "@/services/api/client";
import type { Farm } from "@/types/api";

export const farmsApi = {
  list: () => apiClient.get<Farm[]>("/farms"),
  create: (payload: Pick<Farm, "name" | "location">) =>
    apiClient.post<Farm>("/farms", payload),
};
