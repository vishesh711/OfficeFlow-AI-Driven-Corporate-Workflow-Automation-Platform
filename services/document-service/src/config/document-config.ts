export interface DocumentServiceConfig {
  port: number;
  storageProvider: 'minio' | 's3';
  storageBucket: string;
  maxFileSize: number;
  allowedFileTypes: string[];
  tempDir: string;
  thumbnailSize: number;
  urlExpiryHours: number;
  encryptionKey: string;
  minio?: {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
  };
  aws?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  };
}

export const getDocumentConfig = (): DocumentServiceConfig => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 
    'txt', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'zip'
  ];

  const config: DocumentServiceConfig = {
    port: parseInt(process.env.PORT || '3004'),
    storageProvider: (process.env.STORAGE_PROVIDER as 'minio' | 's3') || 'minio',
    storageBucket: process.env.STORAGE_BUCKET || 'officeflow-documents',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB
    allowedFileTypes: allowedTypes,
    tempDir: process.env.TEMP_DIR || './temp',
    thumbnailSize: parseInt(process.env.THUMBNAIL_SIZE || '200'),
    urlExpiryHours: parseInt(process.env.URL_EXPIRY_HOURS || '24'),
    encryptionKey: process.env.ENCRYPTION_KEY || 'default-key-change-in-production',
  };

  if (config.storageProvider === 'minio') {
    config.minio = {
      endpoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    };
  } else if (config.storageProvider === 's3') {
    config.aws = {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      bucket: process.env.AWS_S3_BUCKET || 'officeflow-documents',
    };
  }

  return config;
};