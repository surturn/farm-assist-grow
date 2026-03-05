export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface Farm {
  id: string;
  name: string;
  location?: string;
  ownerId: string;
  createdAt: string;
}

export interface Crop {
  id: string;
  farmId: string;
  name: string;
  status: "PLANNED" | "GROWING" | "HARVESTED";
  createdAt: string;
}
