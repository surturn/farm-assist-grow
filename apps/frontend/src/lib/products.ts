import { apiClient } from "@/api/client";

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
        const { data } = await apiClient.get('/products', { params: { disease: diseaseName } });
        return data;
    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
}
