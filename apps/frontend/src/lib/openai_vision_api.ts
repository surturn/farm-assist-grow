/**
 * OpenAI Vision API Integration
 * Handles crop disease detection using GPT-4 Vision
 */
import { apiClient } from '../api/client';

export interface CropDiseaseAnalysis {
  diseaseName: string;
  confidence: number; // 0-100
  cropType: string;
  severity: "Mild" | "Moderate" | "Severe";
  symptoms: string[];
  treatment: string;
  prevention: string[];
}

export interface VisionAPIConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface VisionAPISuccess {
  success: true;
  data: {
    diseaseName: string;
    confidence: number;
    cropType: string;
    severity: "Mild" | "Moderate" | "Severe";
    symptoms: string[];
    treatment: string;
    prevention: string[];
  };
}

export interface VisionAPIFailure {
  success: false;
  error: string;
  details?: unknown;
}

export type VisionAPIResponse = VisionAPISuccess | VisionAPIFailure;

const DEFAULT_CONFIG = {
  model: 'gpt-4o', // or 'gpt-4-turbo' or 'gpt-4-vision-preview'
  maxTokens: 1500,
  temperature: 0.2, // Lower temperature for more consistent medical/agricultural advice
};

/**
 * Analyzes a crop image for disease detection using OpenAI Vision API
 */
export async function analyzeCropImage(
  imageBase64: string,
  config: VisionAPIConfig = DEFAULT_CONFIG
): Promise<VisionAPIResponse> {
  // Config is technically unused in the frontend now as the backend handles it,
  // but we keep the signature for compatibility or if we want to pass opts to backend later.

  if (!imageBase64) {
    return {
      success: false,
      error: 'Image data is required',
    };
  }

  try {
    const response = await apiClient.post('/crops/analyze', {
      imageBase64,
      // We could pass farmId here if extended
    }, {
      validateStatus: (status) => status >= 200 && status < 300 // Accept 202
    });

    const data = response.data;

    if (response.status === 202 && data.jobId) {
      // Start polling for job completion
      const maxRetries = 30; // 1 minute max polling
      let attempts = 0;
      
      while (attempts < maxRetries) {
        await new Promise(r => setTimeout(r, 2000));
        
        const pollRes = await apiClient.get(`/crops/analyze/${data.jobId}`);
        const pollData = pollRes.data;
        const state = pollData.state;
        
        if (state === 'completed') {
           return {
             success: true,
             data: pollData.result.result as CropDiseaseAnalysis,
           };
        }
        if (state === 'failed') {
           return { success: false, error: 'AI Analysis Job failed', details: pollData.reason };
        }
        
        attempts++;
      }
      return { success: false, error: 'Timeout waiting for AI analysis' };
    }

    // The backend returns the parsed JSON directly for fallback sync paths
    return {
      success: true,
      data: data as CropDiseaseAnalysis,
    };

  } catch (error) {
    return {
      success: false,
      error: 'Network error',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validates the structure of the analysis result
 */
function validateAnalysisResult(result: any): string | null {
  if (!result || typeof result !== 'object') {
    return 'Result is not an object';
  }

  const requiredFields = [
    'diseaseName',
    'confidence',
    'cropType',
    'severity',
    'symptoms',
    'treatment',
    'prevention',
  ];

  for (const field of requiredFields) {
    if (!(field in result)) {
      return `Missing required field: ${field}`;
    }
  }

  if (typeof result.diseaseName !== 'string') {
    return 'diseaseName must be a string';
  }

  if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 100) {
    return 'confidence must be a number between 0 and 100';
  }

  if (typeof result.cropType !== 'string') {
    return 'cropType must be a string';
  }

  if (!['Mild', 'Moderate', 'Severe'].includes(result.severity)) {
    return 'severity must be "Mild", "Moderate", or "Severe"';
  }

  if (!Array.isArray(result.symptoms) || result.symptoms.length === 0) {
    return 'symptoms must be a non-empty array';
  }

  if (typeof result.treatment !== 'string' || result.treatment.length === 0) {
    return 'treatment must be a non-empty string';
  }

  if (!Array.isArray(result.prevention) || result.prevention.length === 0) {
    return 'prevention must be a non-empty array';
  }

  return null;
}

/**
 * Batch analysis for multiple images (useful for comparing multiple angles)
 */
export async function analyzeCropImagesBatch(
  images: string[],
  config: VisionAPIConfig
): Promise<VisionAPIResponse[]> {
  const promises = images.map((image) => analyzeCropImage(image, config));
  return Promise.all(promises);
}

/**
 * Utility function to estimate API cost
 * Note: Prices are approximate and may change
 */
export function estimateAPICost(imageCount: number, resolution: 'low' | 'high' = 'high'): number {
  // Approximate costs (as of 2024, subject to change)
  const baseCostPerRequest = 0.01; // Base text cost
  const imageCostLow = 0.00425; // Low detail image
  const imageCostHigh = 0.00765; // High detail image (512px tiles)

  const imageCost = resolution === 'low' ? imageCostLow : imageCostHigh;

  return imageCount * (baseCostPerRequest + imageCost);
}
