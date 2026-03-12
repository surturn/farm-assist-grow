import { apiClient } from "@/api/client";

export interface DiseaseData {
    id: string;
    name: string;
    symptoms: string[];
    treatment: string;
    prevention: string[];
    severity: "Mild" | "Moderate" | "Severe";
    commonCrops: string[];
}

const COMMON_DISEASES: Omit<DiseaseData, "id">[] = [
    {
        name: "Early Blight",
        symptoms: ["Dark concentric rings on leaves", "Yellowing of lower leaves", "Steam lesions"],
        treatment: "Apply fungicides containing copper or chlorothalonil. Improve air circulation.",
        prevention: ["Crop rotation", "Mulching", "Drip irrigation to keep foliage dry"],
        severity: "Moderate",
        commonCrops: ["Tomato", "Potato"]
    },
    {
        name: "Late Blight",
        symptoms: ["Water-soaked spots on leaves", "White fungal growth on undersides", "Rapid browning of tissue"],
        treatment: "Apply systemic fungicides immediately. Remove infected plants.",
        prevention: ["Use resistant varieties", "Avoid overhead irrigation", "Proper spacing"],
        severity: "Severe",
        commonCrops: ["Tomato", "Potato"]
    },
    {
        name: "Powdery Mildew",
        symptoms: ["White powdery spots on leaves/stems", "Distorted leaf growth", "Premature leaf drop"],
        treatment: "Neem oil or sulfur-based fungicides. Milk-water solution spray.",
        prevention: ["Resistant varieties", "Full sun exposure", "Good air circulation"],
        severity: "Mild",
        commonCrops: ["Cucumber", "Squash", "Melon"]
    },
    {
        name: "Leaf Rust",
        symptoms: ["Orange/brown pustules on leaf undersides", "Yellowing on upper leaf surface", "Stunted growth"],
        treatment: "Fungicides with propiconazole. Remove infected debris.",
        prevention: ["Resistant cultivars", "Remove volunteer plants", "Balanced fertilization"],
        severity: "Moderate",
        commonCrops: ["Maize", "Wheat", "Beans"]
    },
    {
        name: "Bacterial Wilt",
        symptoms: ["Sudden wilting during day", "Recovery at night initially", "Brown discoloration in stem"],
        treatment: "Remove and destroy infected plants immediately. No chemical cure.",
        prevention: ["Crop rotation (non-solanaceous)", "Control nematodes", "Clean tools"],
        severity: "Severe",
        commonCrops: ["Tomato", "Pepper", "Eggplant"]
    }
];

export async function getFallbackDisease(): Promise<DiseaseData | null> {
    try {
        const { data } = await apiClient.get('/diseases');
        if (data && data.length > 0) return data[0];
        return null;
    } catch (error) {
        console.error("Error fetching fallback disease:", error);
        return null;
    }
}

export async function getAllDiseases(): Promise<DiseaseData[]> {
    try {
        const { data } = await apiClient.get('/diseases');
        return data;
    } catch (error) {
        console.error("Error getting all diseases:", error);
        return [];
    }
}
