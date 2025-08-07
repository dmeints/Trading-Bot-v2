import { OpenAPIV3 } from 'openapi-types';
import { z } from 'zod';

export class OpenAPIGenerator {
  private spec: OpenAPIV3.Document;

  constructor() {
    this.spec = {
      openapi: '3.0.3',
      info: {
        title: 'Skippy Trading Platform API',
        version: '1.0.0',
        description: 'Comprehensive API for the Skippy cryptocurrency trading platform',
        contact: {
          name: 'Skippy Team',
          email: 'support@skippy.trading'
        }
      },
      servers: [
        {
          url: '/api/v1',
          description: 'Production API'
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          SessionAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'connect.sid'
          }
        }
      },
      security: [
        { BearerAuth: [] },
        { SessionAuth: [] }
      ]
    };

    this.addCorePaths();
    this.addSchemas();
  }

  private addCorePaths(): void {
    this.spec.paths = {
      '/auth/user': {
        get: {
          summary: 'Get current user',
          tags: ['Authentication'],
          responses: {
            '200': {
              description: 'User information',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' }
                }
              }
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/market/prices': {
        get: {
          summary: 'Get current market prices',
          tags: ['Market Data'],
          responses: {
            '200': {
              description: 'Market prices',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/MarketPrice' }
                  }
                }
              }
            }
          }
        }
      },
      '/trading/trades': {
        get: {
          summary: 'Get trading history',
          tags: ['Trading'],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
            },
            {
              name: 'symbol',
              in: 'query',
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': {
              description: 'Trading history',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Trade' }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create a new trade',
          tags: ['Trading'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateTrade' }
              }
            }
          },
          responses: {
            '201': {
              description: 'Trade created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Trade' }
                }
              }
            },
            '400': {
              description: 'Invalid trade data',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/ai/recommendations': {
        get: {
          summary: 'Get AI trading recommendations',
          tags: ['AI'],
          responses: {
            '200': {
              description: 'AI recommendations',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/AIRecommendation' }
                  }
                }
              }
            }
          }
        }
      },
      '/plugins': {
        get: {
          summary: 'Get installed plugins',
          tags: ['Plugins'],
          responses: {
            '200': {
              description: 'List of plugins',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Plugin' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/plugins/strategies/execute': {
        post: {
          summary: 'Execute a plugin strategy',
          tags: ['Plugins'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ExecuteStrategy' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Strategy execution result',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/StrategyResult' }
                }
              }
            }
          }
        }
      },
      '/mlops/model-runs': {
        get: {
          summary: 'Get ML model training runs',
          tags: ['MLOps'],
          responses: {
            '200': {
              description: 'Model training runs',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ModelRun' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/vector/similar': {
        get: {
          summary: 'Find similar records using vector search',
          tags: ['Vector Search'],
          parameters: [
            {
              name: 'id',
              in: 'query',
              required: true,
              schema: { type: 'string' }
            },
            {
              name: 'k',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 50, default: 5 }
            }
          ],
          responses: {
            '200': {
              description: 'Similar records',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SimilarRecords' }
                }
              }
            }
          }
        }
      },
      '/fusion/onchain/events': {
        get: {
          summary: 'Get on-chain events',
          tags: ['Data Fusion'],
          parameters: [
            {
              name: 'hours',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 168, default: 24 }
            },
            {
              name: 'token',
              in: 'query',
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': {
              description: 'On-chain events',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/OnChainEvents' }
                }
              }
            }
          }
        }
      }
    };
  }

  private addSchemas(): void {
    this.spec.components!.schemas = {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          profileImageUrl: { type: 'string', format: 'uri' },
          createdAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'email']
      },
      MarketPrice: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          price: { type: 'number' },
          change24h: { type: 'number' },
          volume24h: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' }
        },
        required: ['symbol', 'price', 'timestamp']
      },
      Trade: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          symbol: { type: 'string' },
          side: { type: 'string', enum: ['buy', 'sell'] },
          quantity: { type: 'number' },
          price: { type: 'number' },
          status: { type: 'string', enum: ['pending', 'filled', 'cancelled'] },
          realizedPnl: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'symbol', 'side', 'quantity', 'price', 'status']
      },
      CreateTrade: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          side: { type: 'string', enum: ['buy', 'sell'] },
          quantity: { type: 'number', minimum: 0 },
          price: { type: 'number', minimum: 0 },
          type: { type: 'string', enum: ['market', 'limit'], default: 'market' }
        },
        required: ['symbol', 'side', 'quantity']
      },
      AIRecommendation: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['buy', 'sell', 'hold'] },
          symbol: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string' },
          targetPrice: { type: 'number' },
          stopLoss: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'type', 'symbol', 'confidence', 'reasoning']
      },
      Plugin: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          description: { type: 'string' },
          author: { type: 'string' },
          status: { type: 'string', enum: ['active', 'disabled', 'error'] }
        },
        required: ['name', 'version', 'description', 'author', 'status']
      },
      ExecuteStrategy: {
        type: 'object',
        properties: {
          strategyName: { type: 'string' },
          context: {
            type: 'object',
            properties: {
              marketData: { type: 'array', items: { type: 'object' } },
              indicators: { type: 'object' },
              portfolio: { type: 'object' },
              timestamp: { type: 'string', format: 'date-time' }
            },
            required: ['marketData', 'timestamp']
          }
        },
        required: ['strategyName', 'context']
      },
      StrategyResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              signals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['buy', 'sell', 'hold'] },
                    symbol: { type: 'string' },
                    confidence: { type: 'number' },
                    reason: { type: 'string' }
                  }
                }
              },
              metadata: { type: 'object' }
            }
          }
        }
      },
      ModelRun: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          agent_type: { type: 'string' },
          model_version: { type: 'string' },
          status: { type: 'string', enum: ['running', 'completed', 'failed'] },
          metrics: { type: 'object' },
          training_start: { type: 'string', format: 'date-time' },
          training_end: { type: 'string', format: 'date-time' }
        }
      },
      SimilarRecords: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                content: { type: 'string' },
                similarity: { type: 'number' },
                timestamp: { type: 'string', format: 'date-time' },
                metadata: { type: 'object' }
              }
            }
          }
        }
      },
      OnChainEvents: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                tx_hash: { type: 'string' },
                token: { type: 'string' },
                amount: { type: 'number' },
                event_type: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' }
        },
        required: ['message']
      }
    };
  }

  getSpec(): OpenAPIV3.Document {
    return this.spec;
  }

  addPath(path: string, methods: OpenAPIV3.PathItemObject): void {
    this.spec.paths[path] = methods;
  }

  addSchema(name: string, schema: OpenAPIV3.SchemaObject): void {
    if (!this.spec.components?.schemas) {
      this.spec.components = { ...this.spec.components, schemas: {} };
    }
    this.spec.components.schemas[name] = schema;
  }
}

export const openApiGenerator = new OpenAPIGenerator();