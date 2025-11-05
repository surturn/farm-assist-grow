import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

async function startServer() {
  const app = express();

  // Middleware - MUST be before routes
  app.use(cors()); // Enable CORS for all routes
  app.use(express.json({ limit: '10mb' }));

  /**
   * Health Check Endpoint
   * GET /api/analyze-crop
   */
  app.get('/api/analyze-crop', (req, res) => {
    res.status(200).json({
      status: 'ok',
      message: 'Crop analysis API is operational',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Crop Disease Analysis API
   * POST /api/analyze-crop
   */
  app.post('/api/analyze-crop', async (req, res) => {
    try {
      const { imageBase64, farmId } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      if (!imageBase64.startsWith('data:image/')) {
        return res.status(400).json({
          error: 'Invalid image format. Must be a base64 data URL.',
        });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error('OPENAI_API_KEY is missing in environment variables.');
        return res.status(500).json({
          error: 'Server configuration error. Please contact support.',
        });
      }

      console.log('Starting crop analysis...');
      console.log('Farm ID:', farmId || 'none');
      
      // Direct OpenAI API call
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

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
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
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: 1500,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json().catch(() => ({}));
        console.error('OpenAI API error:', errorData);
        return res.status(500).json({
          error: `OpenAI API request failed with status ${openaiResponse.status}`,
          details: errorData.error?.message || JSON.stringify(errorData),
        });
      }

      const data = await openaiResponse.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.error('No content in OpenAI response:', data);
        return res.status(500).json({
          error: 'No content in API response',
          details: JSON.stringify(data),
        });
      }

      // Parse the JSON response
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', content);
        return res.status(500).json({
          error: 'Failed to parse API response',
          details: content,
        });
      }

      console.log('Analysis completed:', {
        diseaseName: result.diseaseName,
        confidence: result.confidence,
        cropType: result.cropType,
        farmId: farmId || 'none',
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('Unexpected error in /api/analyze-crop:', error);
      return res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Initialize Vite in middleware mode BEFORE starting the server
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      port: 5173
    },
    appType: 'spa'
  });

  // Use Vite's middleware AFTER API routes so API routes take precedence
  app.use(vite.middlewares);

  // Start server
  const PORT = process.env.PORT || 5173;
  app.listen(PORT, () => {
    console.log('\nServer running on http://localhost:' + PORT);
    console.log(' API endpoint: http://localhost:' + PORT + '/api/analyze-crop');
    console.log(' Crop disease detection ready\n');
  });

  // Process-level error handlers
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });
  
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});