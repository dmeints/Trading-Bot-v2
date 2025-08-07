import { Router } from 'express';
import { openApiGenerator } from '../utils/openApiGenerator';
import path from 'path';
import fs from 'fs';

const router = Router();

// Serve OpenAPI specification
router.get('/openapi.json', (req, res) => {
  try {
    const spec = openApiGenerator.getSpec();
    res.json(spec);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate OpenAPI specification' });
  }
});

// Serve Swagger UI
router.get('/docs', (req, res) => {
  const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skippy Trading Platform API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
    .swagger-ui .topbar {
      background-color: #2563eb;
    }
    .swagger-ui .topbar .download-url-wrapper {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        tryItOutEnabled: true,
        requestInterceptor: function(request) {
          // Add any auth headers or other modifications here
          return request;
        },
        responseInterceptor: function(response) {
          // Handle responses here
          return response;
        }
      });
    }
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(swaggerHtml);
});

// API documentation endpoint with basic info
router.get('/info', (req, res) => {
  res.json({
    name: 'Skippy Trading Platform API',
    version: '1.0.0',
    description: 'Comprehensive API for cryptocurrency trading, AI insights, and plugin management',
    documentation: '/api/docs',
    openapi_spec: '/api/openapi.json',
    endpoints: {
      authentication: '/api/auth/*',
      market_data: '/api/market/*',
      trading: '/api/trading/*',
      ai: '/api/ai/*',
      plugins: '/api/plugins/*',
      mlops: '/api/mlops/*',
      vector_search: '/api/vector/*',
      data_fusion: '/api/fusion/*'
    },
    features: [
      'Real-time market data',
      'AI-powered trading recommendations',
      'Plugin architecture for extensibility',
      'Vector search for historical analogues',
      'On-chain data and sentiment fusion',
      'MLOps pipeline for model management'
    ]
  });
});

export default router;