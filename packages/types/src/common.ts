/**
 * Common types used throughout the OfficeFlow platform
 */

export type UUID = string;

export interface BaseEntity {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ExecutionMetadata {
  executionId: UUID;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  retryCount: number;
  correlationId: string;
}