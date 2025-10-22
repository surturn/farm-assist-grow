// Complete Firebase Admin Setup & Seeding Script (TypeScript)

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

// FIREBASE ADMIN INITIALIZATION
let app: admin.app.App;

try {
  app = admin.app();
  console.log('Using existing Firebase Admin app');
} catch (error) {
  console.log('Initializing new Firebase Admin app');
  
  const serviceAccount = JSON.parse(
    fs.readFileSync('./serviceAccountKey.json', 'utf8')
  );
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// TYPE DEFINITIONS
type PriceRange = { min: number; max: number; currency: string };

type Product = {
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
};

type Disease = {
  id: string;
  name: string;
  category: string;
  description: string;
  symptoms: string[];
  preventiveMeasures: string[];
  treatments: string[];
  affectedCrops: string[];
  severity: string;
  seasonality: string;
  createdAt: string;
  updatedAt: string;
};

// DATA DEFINITIONS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFilePath = path.resolve(__dirname, '../../public/kenya_agro_products_pesticides_herbicides.csv');

function parsePriceRange(priceStr: string): { min: number; max: number; currency: string } {
  const [minStr, maxStr] = priceStr.split('-');
  return {
    min: Number(minStr),
    max: Number(maxStr),
    currency: 'KES',
  };
}

function getProductsFromCSV(): Product[] {
  const csvContent = fs.readFileSync(csvFilePath, 'utf8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });
  return records.map((row: any, idx: number) => ({
    id: `product_${idx + 1}`,
    productName: row['Product Name'],
    category: row['Category'],
    activeIngredient: row['Active Ingredient'],
    targetPests: row['Target Disease/Pest'].split(',').map((s: string) => s.trim()),
    crops: row['Crop'].split(',').map((s: string) => s.trim()),
    application: row['Application'],
    dosage: row['Dosage'],
    priceRange: parsePriceRange(row['Price in KES']),
    organic: row['Organic'].toLowerCase() === 'yes',
    phi: (row['Notes - Precautions/Effectiveness'].match(/PHI: ([^.]+)/) || [])[1] || '',
    notes: row['Notes - Precautions/Effectiveness'],
    manufacturer: '',
    inStock: true,
    rating: 0,
    imageUrl: '',
  }));
}

// SEED PRODUCTS AND DISEASES FROM CSV
async function seedProductsAndDiseases() {
  console.log('\nSeeding products and diseases from CSV...\n');
  
  try {
    const products = getProductsFromCSV();
    const diseases: Record<string, Disease> = {};

    products.forEach((product) => {
      product.targetPests.forEach((pest) => {
        if (!diseases[pest]) {
          const diseaseId = pest.toLowerCase().replace(/\s+/g, '_');
          diseases[pest] = {
            id: diseaseId,
            name: pest,
            category: product.category === 'Fungicide' ? 'Fungal Disease' : product.category === 'Herbicide' ? 'Weed' : 'Pest',
            description: `${pest} - A common agricultural problem affecting various crops.`,
            symptoms: [],
            preventiveMeasures: [],
            treatments: [],
            affectedCrops: [],
            severity: 'Medium',
            seasonality: 'Year-round',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        product.crops.forEach((crop) => {
          if (!diseases[pest].affectedCrops.includes(crop)) {
            diseases[pest].affectedCrops.push(crop);
          }
        });
      });
    });

    const productBatch = db.batch();
    products.forEach((product) => {
      const docRef = db.collection('products').doc(product.id);
      productBatch.set(docRef, product);
    });
    await productBatch.commit();
    console.log(`Seeded ${products.length} products.`);

    const diseaseBatch = db.batch();
    Object.values(diseases).forEach((disease) => {
      const docRef = db.collection('diseases').doc(disease.id);
      diseaseBatch.set(docRef, disease);
    });
    await diseaseBatch.commit();
    console.log(`Seeded ${Object.keys(diseases).length} diseases.`);
    
    console.log('\nSeeding completed successfully!\n');
  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  }
}

// MAIN EXECUTION
(async () => {
  try {
    await seedProductsAndDiseases();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed data:', error);
    process.exit(1);
  }
})();