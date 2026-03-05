import { collection, doc, getDocs, setDoc, query, where, limit } from "firebase/firestore";
import { db } from "./firebase";

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

export async function seedDiseases() {
    try {
        const diseasesRef = collection(db, "diseases");
        const snapshot = await getDocs(diseasesRef);

        if (snapshot.empty) {
            console.log("Seeding disease database...");
            for (const disease of COMMON_DISEASES) {
                // Use name as ID for simplicity and deduplication
                await setDoc(doc(db, "diseases", disease.name.toLowerCase().replace(/\s+/g, '-')), disease);
            }
            console.log("Disease database seeded.");
        }
    } catch (error) {
        console.error("Error seeding diseases:", error);
    }
}

export async function getFallbackDisease(): Promise<DiseaseData | null> {
    try {
        const diseasesRef = collection(db, "diseases");
        const q = query(diseasesRef, limit(5)); // Fetch a few to show as "Possible Matches"
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            // Auto-seed if empty when trying to fetch
            await seedDiseases();
            return null; // Return null for now, next retry will get data
        }

        // For now, return the first one or logic could be improved to return a list
        const docSnap = snapshot.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as DiseaseData;
    } catch (error) {
        console.error("Error fetching fallback disease:", error);
        return null;
    }
}

export async function getAllDiseases(): Promise<DiseaseData[]> {
    try {
        const diseasesRef = collection(db, "diseases");
        const snapshot = await getDocs(diseasesRef);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DiseaseData));
    } catch (error) {
        console.error("Error getting all diseases:", error);
        return [];
    }
}
