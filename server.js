import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import cors from 'cors';
import { analyzeCropImage } from './src/lib/openai_vision_api.ts';

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
      
      const result = await analyzeCropImage(imageBase64, {
        apiKey,
        model: 'gpt-4o',
        maxTokens: 1500,
        temperature: 0.2,
      });

      if (!result.success) {
        console.error('Vision API error:', result.error, result.details);
        return res.status(500).json({
          error: result.error,
          details: result.details,
        });
      }

      console.log('Analysis completed:', {
        diseaseName: result.data.diseaseName,
        confidence: result.data.confidence,
        cropType: result.data.cropType,
        farmId: farmId || 'none',
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json(result.data);
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
    console.log('API endpoint: http://localhost:' + PORT + '/api/analyze-crop');
    console.log('Crop disease detection ready\n');
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