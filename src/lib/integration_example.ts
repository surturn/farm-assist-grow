/**
 * Integration Example: How to use the image upload and OpenAI Vision API
 * in your Scan component
 */

import { processImageUpload } from './imageUploadUtil';
import { analyzeCropImage, VisionAPIConfig } from './openaiVisionAPI';

// 1. Configuration
const VISION_API_CONFIG: VisionAPIConfig = {
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '', // Store in env variables
  model: 'gpt-4o',
  maxTokens: 1500,
  temperature: 0.2,
};

// 2. Modified handleFileSelect function
const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    // Process and validate the image
    const uploadResult = await processImageUpload(file, {
      maxSizeInMB: 10,
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 0.9,
    });

    if (!uploadResult.success) {
      toast({
        title: "Upload Error",
        description: uploadResult.error,
        variant: "destructive",
      });
      return;
    }

    // Set the processed image
    setSelectedImage(uploadResult.data!);
    setResult(null);

    // Optional: Show image metadata
    if (uploadResult.metadata) {
      console.log('Image uploaded:', {
        size: `${(uploadResult.metadata.fileSize / 1024).toFixed(2)} KB`,
        dimensions: uploadResult.metadata.dimensions,
      });
    }
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to process image",
      variant: "destructive",
    });
  }
};

// 3. Modified handleAnalyze function with real API integration
const handleAnalyze = async () => {
  if (!selectedImage) return;

  setIsAnalyzing(true);
  setProgress(0);

  // Progress simulation
  const progressInterval = setInterval(() => {
    setProgress((prev) => {
      if (prev >= 90) {
        clearInterval(progressInterval);
        return 90;
      }
      return prev + 10;
    });
  }, 300);

  try {
    // Call OpenAI Vision API
    const response = await analyzeCropImage(selectedImage, VISION_API_CONFIG);

    clearInterval(progressInterval);
    setProgress(100);

    if (!response.success) {
      toast({
        title: "Analysis Failed",
        description: response.error,
        variant: "destructive",
      });
      setIsAnalyzing(false);
      setProgress(0);
      return;
    }

    // Set the result from API
    setResult(response.data);
    
    toast({
      title: "Analysis Complete",
      description: `Detected: ${response.data.diseaseName}`,
    });
  } catch (error) {
    clearInterval(progressInterval);
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Analysis failed",
      variant: "destructive",
    });
  } finally {
    setIsAnalyzing(false);
    setProgress(0);
  }
};

// 4. Alternative: Server-side API route (recommended for production)
// This keeps your API key secure on the server

// File: /app/api/analyze-crop/route.ts
export async function POST(request: Request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return Response.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    const config: VisionAPIConfig = {
      apiKey: process.env.OPENAI_API_KEY!, // Server-side env variable
      model: 'gpt-4o',
      maxTokens: 1500,
      temperature: 0.2,
    };

    const result = await analyzeCropImage(imageBase64, config);

    if (!result.success) {
      return Response.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }

    return Response.json(result.data);
  } catch (error) {
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 5. Client-side function to call the server API route
const handleAnalyzeViaAPI = async () => {
  if (!selectedImage) return;

  setIsAnalyzing(true);
  setProgress(0);

  const progressInterval = setInterval(() => {
    setProgress((prev) => Math.min(prev + 10, 90));
  }, 300);

  try {
    const response = await fetch('/api/analyze-crop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: selectedImage,
      }),
    });

    clearInterval(progressInterval);
    setProgress(100);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Analysis failed');
    }

    const data = await response.json();
    setResult(data);

    toast({
      title: "Analysis Complete",
      description: `Detected: ${data.diseaseName}`,
    });
  } catch (error) {
    clearInterval(progressInterval);
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Analysis failed",
      variant: "destructive",
    });
  } finally {
    setIsAnalyzing(false);
    setProgress(0);
  }
};

// 6. Environment variables setup
// Create a .env.local file in your project root:
/*
OPENAI_API_KEY=sk-your-api-key-here
NEXT_PUBLIC_OPENAI_API_KEY=sk-your-api-key-here (only if using client-side)
*/

// 7. Error handling wrapper
const safeAnalyze = async (analyzeFunction: () => Promise<void>) => {
  try {
    await analyzeFunction();
  } catch (error) {
    console.error('Analysis error:', error);
    toast({
      title: "Unexpected Error",
      description: "Please try again later",
      variant: "destructive",
    });
    setIsAnalyzing(false);
    setProgress(0);
  }
};

// Usage in component:
// <Button onClick={() => safeAnalyze(handleAnalyzeViaAPI)}>
//   Analyze Crop
// </Button>
