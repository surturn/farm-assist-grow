export interface DashboardData {
  totalScans: number;
  recentScans: any[];
  alerts: any[];
  recommendations: any[];
  stats?: any;
  userRegion: string;
  systemMode: 'basic' | 'iot' | 'hybrid';
}

export interface DiseaseData {
  name: string;
  scientificName: string;
  description: string;
  symptoms: string[];
  preventions: string[];
}

export interface Product {
    id: string;
    name: string;
    description: string;
    type: 'fungicide' | 'pesticide' | 'fertilizer' | 'herbicide' | 'other';
    targetDiseases: string[];
    activeIngredients: string[];
    applicationMethod: string;
    manufacturer: string;
    image?: string;
}

export interface ScanResult {
  diseaseName: string;
  confidence: number;
  cropType: string;
  severity: "Healthy" | "Mild" | "Moderate" | "Severe";
  symptoms: string[];
  possibleCauses: string[];
  treatment: string;
  prevention: string[];
}
