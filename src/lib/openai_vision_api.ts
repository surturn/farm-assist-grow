/**
 * OpenAI Vision API Integration
 * Handles crop disease detection using GPT-4 Vision
 */

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
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface VisionAPIError {
  success: false;
  error: string;
  details?: string;
}

export interface VisionAPISuccess {
  success: true;
  data: CropDiseaseAnalysis;
}

export type VisionAPIResponse = VisionAPISuccess | VisionAPIError;

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
  config: VisionAPIConfig
): Promise<VisionAPIResponse> {
  const { apiKey, model, maxTokens, temperature } = { ...DEFAULT_CONFIG, ...config };

  // Validate inputs
  if (!apiKey) {
    return {
      success: false,
      error: 'API key is required',
    };
  }

  if (!imageBase64) {
    return {
      success: false,
      error: 'Image data is required',
    };
  }

  // Prepare the prompt
  const systemPrompt = `You are an expert agricultural pathologist specializing in crop disease detection. 
Analyze the provided crop image and provide a detailed disease assessment in JSON format.

Your response MUST be a valid JSON object with exactly this structure:
{
  "diseaseName": "Full disease name (including scientific name if applicable)",
  "confidence": number between 0-100,
  "cropType": "Type of crop identified",
  "severity": "Mild" | "Moderate" | "Severe",
  "symptoms": ["symptom1", "symptom2", "symptom3"],
  "treatment": "Detailed treatment recommendations",
  "prevention": ["prevention1", "prevention2", "prevention3"]
}

Guidelines:
- Be precise and use proper agricultural/botanical terminology
- Confidence should reflect your certainty about the diagnosis
- Include 3-5 specific symptoms you observe
- Treatment should be practical and actionable
- Prevention measures should be preventive, not reactive
- If no disease is detected, indicate "Healthy" as diseaseName with appropriate messaging`;

  const userPrompt = `Please analyze this crop image for any diseases or health issues. Provide your assessment in the JSON format specified.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64,
                  detail: 'high', // 'low', 'high', or 'auto'
                },
              },
            ],
          },
        ],
        max_tokens: maxTokens,
        temperature,
        response_format: { type: 'json_object' }, // Ensures JSON response
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `API request failed with status ${response.status}`,
        details: errorData.error?.message || JSON.stringify(errorData),
      };
    }

    const data = await response.json();
    
    // Extract the response content
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return {
        success: false,
        error: 'No content in API response',
        details: JSON.stringify(data),
      };
    }

    // Parse the JSON response
    let analysisResult: CropDiseaseAnalysis;
    try {
      analysisResult = JSON.parse(content);
    } catch (parseError) {
      return {
        success: false,
        error: 'Failed to parse API response',
        details: content,
      };
    }

    // Validate the response structure
    const validationError = validateAnalysisResult(analysisResult);
    if (validationError) {
      return {
        success: false,
        error: 'Invalid response structure from API',
        details: validationError,
      };
    }

    return {
      success: true,
      data: analysisResult,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Network or API error',
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
