import { Client as MinioClient } from 'minio';
import { StorageProvider } from '../types/document-types';
import { logger } from '../utils/logger';

export class MinioStorageProvider implements StorageProvider {
  public readonly name = 'minio';
  private client: MinioClient;
  private bucket: string;

  constructor(config: {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
  }, bucket: string) {
    this.client = new MinioClient({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
    this.bucket = bucket;
  }

  public async initialize(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        logger.info(`Created MinIO bucket: ${this.bucket}`);
      }
      logger.info('MinIO storage provider initialized');
    } catch (error) {
      logger.error('Failed to initialize MinIO storage provider', {
        error: error.message,
        bucket: this.bucket,
      });
      throw error;
    }
  }

  public async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    try {
      const metadata = {
        'Content-Type': contentType,
        'Upload-Date': new Date().toISOString(),
      };

      await this.client.putObject(this.bucket, key, buffer, buffer.length, metadata);
      
      logger.info('File uploaded to MinIO', {
        key,
        size: buffer.length,
        contentType,
      });

      return key;
    } catch (error) {
      logger.error('Failed to upload file to MinIO', {
        error: error.message,
        key,
        size: buffer.length,
      });
      throw error;
    }
  }

  public async download(key: string): Promise<Buffer> {
    try {
      const stream = await this.client.getObject(this.bucket, key);
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          logger.info('File downloaded from MinIO', {
            key,
            size: buffer.length,
          });
          resolve(buffer);
        });
        stream.on('error', (error) => {
          logger.error('Failed to download file from MinIO', {
            error: error.message,
            key,
          });
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Failed to download file from MinIO', {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, key);
      logger.info('File deleted from MinIO', { key });
    } catch (error) {
      logger.error('Failed to delete file from MinIO', {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  public async generatePresignedUrl(key: string, expiresIn: number): Promise<string> {
    try {
      const url = await this.client.presignedGetObject(this.bucket, key, expiresIn);
      logger.info('Generated presigned URL for MinIO object', {
        key,
        expiresIn,
      });
      return url;
    } catch (error) {
      logger.error('Failed to generate presigned URL for MinIO object', {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      logger.error('Failed to check if MinIO object exists', {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  public async listObjects(prefix?: string): Promise<string[]> {
    try {
      const objects: string[] = [];
      const stream = this.client.listObjects(this.bucket, prefix, true);

      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => {
          if (obj.name) {
            objects.push(obj.name);
          }
        });
        stream.on('end', () => resolve(objects));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to list MinIO objects', {
        error: error.message,
        prefix,
      });
      throw error;
    }
  }
}