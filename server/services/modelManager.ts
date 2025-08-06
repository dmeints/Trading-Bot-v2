import fs from 'fs';
import path from 'path';
import { analyticsLogger } from './analyticsLogger';

const MODELS_PATH = './models';
const BACKUP_PATH = './models/backup';

export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  type: 'trading' | 'sentiment' | 'risk' | 'market-analysis';
  createdAt: string;
  updatedAt: string;
  accuracy?: number;
  trainingData?: {
    samples: number;
    dateRange: { from: string; to: string };
  };
  performance?: {
    precision: number;
    recall: number;
    f1Score: number;
  };
  parameters?: Record<string, any>;
  isActive: boolean;
  description?: string;
}

export interface ModelFile {
  id: string;
  filename: string;
  size: number;
  checksum: string;
  modelId: string;
}

class ModelManager {
  private modelsMetadata: Map<string, ModelMetadata> = new Map();
  private modelFiles: Map<string, ModelFile> = new Map();

  constructor() {
    this.ensureDirectories();
    this.loadExistingModels();
  }

  private ensureDirectories() {
    const dirs = [MODELS_PATH, BACKUP_PATH];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[ModelManager] Created directory: ${dir}`);
      }
    });
  }

  private loadExistingModels() {
    try {
      const metadataPath = path.join(MODELS_PATH, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, 'utf8');
        const metadata = JSON.parse(data);
        
        Object.values(metadata.models || {}).forEach((model: any) => {
          this.modelsMetadata.set(model.id, model);
        });
        
        Object.values(metadata.files || {}).forEach((file: any) => {
          this.modelFiles.set(file.id, file);
        });
        
        console.log(`[ModelManager] Loaded ${this.modelsMetadata.size} models`);
      }
    } catch (error) {
      console.error('[ModelManager] Failed to load existing models:', error);
      analyticsLogger.logError({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Failed to load model metadata',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  private saveMetadata() {
    try {
      const metadata = {
        models: Object.fromEntries(this.modelsMetadata),
        files: Object.fromEntries(this.modelFiles),
        lastUpdated: new Date().toISOString(),
      };

      const metadataPath = path.join(MODELS_PATH, 'metadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('[ModelManager] Failed to save metadata:', error);
      analyticsLogger.logError({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Failed to save model metadata',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  registerModel(metadata: Omit<ModelMetadata, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = this.generateModelId();
    const now = new Date().toISOString();

    const model: ModelMetadata = {
      id,
      createdAt: now,
      updatedAt: now,
      ...metadata,
    };

    this.modelsMetadata.set(id, model);
    this.saveMetadata();

    analyticsLogger.logAnalyticsEvent({
      timestamp: now,
      tradeId: `model-${id}`,
      strategy: 'model-registration',
      regime: 'sideways',
      type: 'scalp',
      risk: 'low',
      source: 'model-manager',
      pnl: 0,
      latencyMs: 0,
      signalStrength: 1.0,
      confidence: 1.0,
      metadata: { modelType: metadata.type, modelName: metadata.name },
    });

    console.log(`[ModelManager] Registered model: ${metadata.name} (${id})`);
    return id;
  }

  uploadModelFile(modelId: string, filename: string, data: Buffer): string {
    if (!this.modelsMetadata.has(modelId)) {
      throw new Error(`Model ${modelId} not found`);
    }

    const fileId = this.generateFileId();
    const filePath = path.join(MODELS_PATH, `${fileId}_${filename}`);
    
    // Calculate checksum
    const checksum = require('crypto')
      .createHash('sha256')
      .update(data)
      .digest('hex');

    // Save file
    fs.writeFileSync(filePath, data);

    const modelFile: ModelFile = {
      id: fileId,
      filename,
      size: data.length,
      checksum,
      modelId,
    };

    this.modelFiles.set(fileId, modelFile);
    this.saveMetadata();

    console.log(`[ModelManager] Uploaded file: ${filename} for model ${modelId}`);
    return fileId;
  }

  getModel(id: string): ModelMetadata | null {
    return this.modelsMetadata.get(id) || null;
  }

  getAllModels(type?: string): ModelMetadata[] {
    const models = Array.from(this.modelsMetadata.values());
    return type ? models.filter(m => m.type === type) : models;
  }

  getActiveModels(type?: string): ModelMetadata[] {
    return this.getAllModels(type).filter(m => m.isActive);
  }

  updateModel(id: string, updates: Partial<ModelMetadata>): boolean {
    const model = this.modelsMetadata.get(id);
    if (!model) return false;

    const updatedModel = {
      ...model,
      ...updates,
      id, // Ensure ID can't be changed
      updatedAt: new Date().toISOString(),
    };

    this.modelsMetadata.set(id, updatedModel);
    this.saveMetadata();

    analyticsLogger.logAnalyticsEvent({
      timestamp: new Date().toISOString(),
      tradeId: `model-update-${id}`,
      strategy: 'model-update',
      regime: 'sideways',
      type: 'scalp',
      risk: 'low',
      source: 'model-manager',
      pnl: 0,
      latencyMs: 0,
      signalStrength: 1.0,
      confidence: 1.0,
      metadata: { modelId: id, updates: Object.keys(updates) },
    });

    return true;
  }

  activateModel(id: string): boolean {
    return this.updateModel(id, { isActive: true });
  }

  deactivateModel(id: string): boolean {
    return this.updateModel(id, { isActive: false });
  }

  backupModel(id: string): string | null {
    const model = this.modelsMetadata.get(id);
    if (!model) return null;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${model.name}_${model.version}_${timestamp}.json`;
      const backupPath = path.join(BACKUP_PATH, backupFileName);

      // Get associated files
      const associatedFiles = Array.from(this.modelFiles.values())
        .filter(f => f.modelId === id);

      const backup = {
        model,
        files: associatedFiles,
        backupCreated: new Date().toISOString(),
      };

      fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

      // Also backup actual model files
      associatedFiles.forEach(file => {
        const sourcePath = path.join(MODELS_PATH, `${file.id}_${file.filename}`);
        const backupFilePath = path.join(BACKUP_PATH, `${timestamp}_${file.id}_${file.filename}`);
        
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, backupFilePath);
        }
      });

      console.log(`[ModelManager] Backed up model: ${model.name} to ${backupFileName}`);
      return backupPath;
    } catch (error) {
      console.error('[ModelManager] Backup failed:', error);
      analyticsLogger.logError({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Model backup failed',
        stack: error instanceof Error ? error.stack : undefined,
        metadata: { modelId: id },
      });
      return null;
    }
  }

  deleteModel(id: string): boolean {
    const model = this.modelsMetadata.get(id);
    if (!model) return false;

    try {
      // Backup before deletion
      this.backupModel(id);

      // Delete associated files
      const associatedFiles = Array.from(this.modelFiles.values())
        .filter(f => f.modelId === id);

      associatedFiles.forEach(file => {
        const filePath = path.join(MODELS_PATH, `${file.id}_${file.filename}`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        this.modelFiles.delete(file.id);
      });

      // Delete model metadata
      this.modelsMetadata.delete(id);
      this.saveMetadata();

      analyticsLogger.logAnalyticsEvent({
        timestamp: new Date().toISOString(),
        tradeId: `model-delete-${id}`,
        strategy: 'model-deletion',
        regime: 'sideways',
        type: 'scalp',
        risk: 'medium',
        source: 'model-manager',
        pnl: 0,
        latencyMs: 0,
        signalStrength: 1.0,
        confidence: 1.0,
        metadata: { modelName: model.name },
      });

      console.log(`[ModelManager] Deleted model: ${model.name} (${id})`);
      return true;
    } catch (error) {
      console.error('[ModelManager] Delete failed:', error);
      return false;
    }
  }

  getModelFile(fileId: string): { file: ModelFile; data: Buffer } | null {
    const file = this.modelFiles.get(fileId);
    if (!file) return null;

    try {
      const filePath = path.join(MODELS_PATH, `${file.id}_${file.filename}`);
      const data = fs.readFileSync(filePath);
      return { file, data };
    } catch (error) {
      console.error('[ModelManager] Failed to read file:', error);
      return null;
    }
  }

  getSystemStats() {
    const totalModels = this.modelsMetadata.size;
    const activeModels = this.getActiveModels().length;
    const totalFiles = this.modelFiles.size;
    
    const modelsByType = Array.from(this.modelsMetadata.values()).reduce((acc, model) => {
      acc[model.type] = (acc[model.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalFileSize = Array.from(this.modelFiles.values())
      .reduce((sum, file) => sum + file.size, 0);

    return {
      totalModels,
      activeModels,
      totalFiles,
      totalFileSize,
      modelsByType,
      lastUpdated: new Date().toISOString(),
    };
  }

  private generateModelId(): string {
    return `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const modelManager = new ModelManager();