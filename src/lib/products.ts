import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "./firebase";

export interface PriceRange {
    min: number;
    max: number;
    currency: string;
}

export interface Product {
    id: string;
    productName: string;
    category: string;
    activeIngredient: string;
    targetPests: string[];
    crops: string[];
    application: string;
    dosage: string;
    priceRange: PriceRange;
    organic: boolean;
    phi: string;
    notes: string;
    manufacturer: string;
    inStock: boolean;
    rating: number;
    imageUrl: string;
}

export async function fetchProductsForDisease(diseaseName: string): Promise<Product[]> {
    try {
        // Basic normalization to match potential constraints or case issues
        // The seed script used exact names for targetPests array.

        // We try to match where the disease name is in the targetPests array.
        // Note: This relies on the AI returning a disease name that matches the CSV/Seed data.
        // Ideally, we'd have a fuzzy match or ID-based link, but for now we search by name.

        const productsRef = collection(db, "products");

        // Create a query against the collection.
        // "targetPests" is an array field.
        const q = query(
            productsRef,
            where("targetPests", "array-contains", diseaseName),
            limit(10)
        );

        const querySnapshot = await getDocs(q);

        const products: Product[] = [];
        querySnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() } as Product);
        });

        // Fallback: If no exact match (often due to slight naming variations e.g. "Early Blight" vs "Early blight"),
        // we could try a second query or client-side filter if the dataset was small, but here we just return what we found.
        // If list is empty, maybe try splitting the name? e.g. "Blight" logic? 
        // For now, simple return.

        return products;
    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
}
