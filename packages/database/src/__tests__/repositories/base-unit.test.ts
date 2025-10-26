/**
 * Unit tests for BaseRepository (without database connection)
 */

import { z } from 'zod';
import { BaseRepository } from '../../repositories/base';
import { Pool } from 'pg';

// Mock the database connection
jest.mock('../../connection', () => ({
  db: {
    getPool: jest.fn(),
    transaction: jest.fn(),
  },
}));

// Test schema for a simple entity
const testEntitySchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  created_at: z.date(),
  updated_at: z.date(),
});

const createTestEntitySchema = testEntitySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

const updateTestEntitySchema = testEntitySchema.partial().omit({
  id: true,
  created_at: true,
  updated_at: true,
});

type TestEntity = z.infer<typeof testEntitySchema>;

// Test repository implementation
class TestRepository extends BaseRepository<TestEntity> {
  constructor(mockPool: Pool) {
    super(
      'test_entities',
      'id',
      createTestEntitySchema,
      updateTestEntitySchema
    );
    this.pool = mockPool;
  }
}

describe('BaseRepository Unit Tests', () => {
  let mockPool: any;
  let repository: TestRepository;

  beforeEach(() => {
    mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    repository = new TestRepository(mockPool);
  });

  describe('Data validation', () => {
    describe('create schema validation', () => {
      it('should validate valid create data', () => {
        const validData = {
          org_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Entity',
          description: 'A test entity',
          is_active: true,
        };

        expect(() => createTestEntitySchema.parse(validData)).not.toThrow();
      });

      it('should reject invalid create data', () => {
        const invalidCases = [
          { org_id: 'invalid-uuid', name: 'Test' },
          { org_id: '123e4567-e89b-12d3-a456-426614174000', name: '' },
          { org_id: '123e4567-e89b-12d3-a456-426614174000' }, // Missing name
        ];

        invalidCases.forEach(data => {
          expect(() => createTestEntitySchema.parse(data)).toThrow();
        });
      });

      it('should use default values', () => {
        const data = {
          org_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Entity',
        };

        const result = createTestEntitySchema.parse(data);
        expect(result.is_active).toBe(true);
      });
    });

    describe('update schema validation', () => {
      it('should validate partial update data', () => {
        const validUpdates = [
          { name: 'Updated Name' },
          { description: 'Updated description' },
          { is_active: false },
          { name: 'New Name', description: 'New description' },
          {}, // Empty update should be valid
        ];

        validUpdates.forEach(update => {
          expect(() => updateTestEntitySchema.parse(update)).not.toThrow();
        });
      });

      it('should reject invalid update data', () => {
        const invalidUpdates = [
          { name: '' }, // Empty name
          { org_id: 'invalid-uuid' }, // Invalid UUID
        ];

        invalidUpdates.forEach(update => {
          expect(() => updateTestEntitySchema.parse(update)).toThrow();
        });
      });
    });
  });

  describe('Query building', () => {
    describe('findAll with filters', () => {
      it('should build query without filters', async () => {
        (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

        await repository.findAll();

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM test_entities',
          []
        );
      });

      it('should build query with single filter', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await repository.findAll({ is_active: true });

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM test_entities WHERE is_active = $1',
          [true]
        );
      });

      it('should build query with multiple filters', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await repository.findAll({ 
          is_active: true, 
          org_id: '123e4567-e89b-12d3-a456-426614174000' 
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM test_entities WHERE is_active = $1 AND org_id = $2',
          [true, '123e4567-e89b-12d3-a456-426614174000']
        );
      });

      it('should build query with array filter (IN clause)', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await repository.findAll({ 
          org_id: ['uuid1', 'uuid2', 'uuid3'] 
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM test_entities WHERE org_id IN ($1, $2, $3)',
          ['uuid1', 'uuid2', 'uuid3']
        );
      });

      it('should build query with pagination', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await repository.findAll({}, { limit: 10, offset: 20 });

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM test_entities LIMIT $1 OFFSET $2',
          [10, 20]
        );
      });

      it('should build query with ordering', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await repository.findAll({}, { 
          orderBy: 'created_at', 
          orderDirection: 'DESC' 
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM test_entities ORDER BY created_at DESC',
          []
        );
      });

      it('should build complex query with filters, pagination, and ordering', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await repository.findAll(
          { is_active: true },
          { 
            orderBy: 'name', 
            orderDirection: 'ASC',
            limit: 5,
            offset: 10
          }
        );

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM test_entities WHERE is_active = $1 ORDER BY name ASC LIMIT $2 OFFSET $3',
          [true, 5, 10]
        );
      });
    });

    describe('count with filters', () => {
      it('should build count query without filters', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '5' }] });

        const result = await repository.count();

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT COUNT(*) FROM test_entities',
          []
        );
        expect(result).toBe(5);
      });

      it('should build count query with filters', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '3' }] });

        const result = await repository.count({ is_active: true });

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT COUNT(*) FROM test_entities WHERE is_active = $1',
          [true]
        );
        expect(result).toBe(3);
      });
    });
  });

  describe('Data mapping', () => {
    it('should map snake_case database columns to camelCase', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        org_id: '456e7890-e89b-12d3-a456-426614174000',
        name: 'Test Entity',
        is_active: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
      };

      const mapped = repository['mapRowToEntity'](dbRow);

      expect(mapped).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        orgId: '456e7890-e89b-12d3-a456-426614174000',
        name: 'Test Entity',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      });
    });

    it('should handle null and undefined values', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        org_id: '456e7890-e89b-12d3-a456-426614174000',
        name: 'Test Entity',
        description: null,
        is_active: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
      };

      const mapped = repository['mapRowToEntity'](dbRow);

      expect(mapped.description).toBeNull();
    });
  });

  describe('String conversion utilities', () => {
    it('should convert snake_case to camelCase', () => {
      const testCases = [
        ['snake_case', 'snakeCase'],
        ['simple', 'simple'],
        ['multiple_words_here', 'multipleWordsHere'],
        ['with_numbers_123', 'withNumbers_123'],
        ['already_camelCase', 'alreadyCamelCase'],
      ];

      testCases.forEach(([input, expected]) => {
        const result = repository['snakeToCamel'](input);
        expect(result).toBe(expected);
      });
    });

    it('should convert camelCase to snake_case', () => {
      const testCases = [
        ['camelCase', 'camel_case'],
        ['simple', 'simple'],
        ['multipleWordsHere', 'multiple_words_here'],
        ['withNumbers123', 'with_numbers123'],
        ['already_snake_case', 'already_snake_case'],
      ];

      testCases.forEach(([input, expected]) => {
        const result = repository['camelToSnake'](input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database query errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.query.mockRejectedValue(dbError);

      await expect(repository.findById('some-id')).rejects.toThrow('Database connection failed');
    });

    it('should handle validation errors on create', async () => {
      const invalidData = {
        org_id: 'invalid-uuid',
        name: '',
      };

      await expect(repository.create(invalidData as any)).rejects.toThrow();
    });

    it('should handle validation errors on update', async () => {
      const invalidUpdates = {
        name: '',
      };

      await expect(repository.update('some-id', invalidUpdates)).rejects.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty result sets', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.findAll();
      expect(result).toEqual([]);
    });

    it('should handle null values in filters', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ 
        is_active: true,
        description: null,
        undefined_field: undefined,
      });

      // Should only include non-null, non-undefined values in query
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM test_entities WHERE is_active = $1',
        [true]
      );
    });

    it('should handle empty array filters', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ 
        org_id: [] 
      });

      // Empty array should create IN () condition
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM test_entities WHERE org_id IN ()',
        []
      );
    });
  });
});