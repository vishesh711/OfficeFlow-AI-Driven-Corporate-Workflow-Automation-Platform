import AWS from 'aws-sdk';
import { StorageProvider } from '../types/document-types';
import { logger } from '../utils/logger';

export class S3StorageProvider implements StorageProvider {
  public readonly name = 's3';
  private s3: AWS.S3;
  private bucket: string;

  constructor(config: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  }, bucket: string) {
    AWS.config.update({
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });

    this.s3 = new AWS.S3();
    this.bucket = bucket;
  }

  public async initialize(): Promise<void> {
    try {
      await this.s3.headBucket({ Bucket: this.bucket }).promise();
      logger.info('S3 storage provider initialized');
    } catch (error) {
      if (error.statusCode === 404) {
        // Bucket doesn't exist, create it
        await this.s3.createBucket({ Bucket: this.bucket }).promise();
        logger.info(`Created S3 bucket: ${this.bucket}`);
      } else {
        logger.error('Failed to initialize S3 storage provider', {
          error: error.message,
          bucket: this.bucket,
        });
        throw error;
      }
    }
  }

  public async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    try {
      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          'upload-date': new Date().toISOString(),
        },
      };

      await this.s3.upload(params).promise();
      
      logger.info('File uploaded to S3', {
        key,
        size: buffer.length,
        contentType,
      });

      return key;
    } catch (error) {
      logger.error('Failed to upload file to S3', {
        error: error.message,
        key,
        size: buffer.length,
      });
      throw error;
    }
  }

  public async download(key: string): Promise<Buffer> {
    try {
      const params: AWS.S3.GetObjectRequest = {
        Bucket: this.bucket,
        Key: key,
      };

      const result = await this.s3.getObject(params).promise();
      const buffer = result.Body as Buffer;
      
      logger.info('File downloaded from S3', {
        key,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      logger.error('Failed to download file from S3', {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: this.bucket,
        Key: key,
      };

      await this.s3.deleteObject(params).promise();
      logger.info('File deleted from S3', { key });
    } catch (error) {
      logger.error('Failed to delete file from S3', {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  public async generatePresignedUrl(key: string, expiresIn: number): Promise<string> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        Expires: expiresIn,
      };

      const url = this.s3.getSignedUrl('getObject', params);
      
      logger.info('Generated presigned URL for S3 object', {
        key,
        expiresIn,
      });

      return url;
    } catch (error) {
      logger.error('Failed to generate presigned URL for S3 object', {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const params: AWS.S3.HeadObjectRequest = {
        Bucket: this.bucket,
        Key: key,
      };

      await this.s3.headObject(params).promise();
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        return false;
      }
      logger.error('Failed to check if S3 object exists', {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  public async listObjects(prefix?: string): Promise<string[]> {
    try {
      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: this.bucket,
        Prefix: prefix,
      };

      const result = await this.s3.listObjectsV2(params).promise();
      return result.Contents?.map(obj => obj.Key || '') || [];
    } catch (error) {
      logger.error('Failed to list S3 objects', {
        error: error.message,
        prefix,
      });
      throw error;
    }
  }
}