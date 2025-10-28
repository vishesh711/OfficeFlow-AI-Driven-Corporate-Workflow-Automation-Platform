/**
 * Unit tests for BaseRepository
 */

import { z } from 'zod';
import { BaseRepository } from '../../repositories/base';
import { getTestPool, createTestOrganization, cleanupTestData } from '../setup';
import { Pool } from 'pg';

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
  constructor() {
    super('test_entities', 'id', createTestEntitySchema, updateTestEntitySchema);
  }
}

describe('BaseRepository', () => {
  let pool: Pool;
  let repository: TestRepository;
  let testOrgId: string;
  let createdIds: string[] = [];

  beforeAll(async () => {
    pool = getTestPool();
    repository = new TestRepository();

    // Create test table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create test organization
    const orgData = createTestOrganization();
    testOrgId = orgData.org_id;
    await pool.query(
      'INSERT INTO organizations (org_id, name, domain, plan, settings) VALUES ($1, $2, $3, $4, $5)',
      [orgData.org_id, orgData.name, orgData.domain, orgData.plan, JSON.stringify(orgData.settings)]
    );
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData(pool, 'test_entities', 'id', createdIds);
    await cleanupTestData(pool, 'organizations', 'org_id', [testOrgId]);

    // Drop test table
    await pool.query('DROP TABLE IF EXISTS test_entities');
  });

  afterEach(async () => {
    // Clean up any entities created in tests
    if (createdIds.length > 0) {
      await cleanupTestData(pool, 'test_entities', 'id', createdIds);
      createdIds = [];
    }
  });

  describe('create', () => {
    it('should create a new entity with valid data', async () => {
      const entityData = {
        org_id: testOrgId,
        name: 'Test Entity',
        description: 'A test entity',
        is_active: true,
      };

      const created = await repository.create(entityData);
      createdIds.push(created.id);

      expect(created).toMatchObject({
        ...entityData,
        id: expect.any(String),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
      expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should validate input data using schema', async () => {
      const invalidData = {
        org_id: 'invalid-uuid',
        name: '', // Empty name should fail validation
      };

      await expect(repository.create(invalidData as any)).rejects.toThrow();
    });

    it('should set default values', async () => {
      const entityData = {
        org_id: testOrgId,
        name: 'Test Entity Without Defaults',
      };

      const created = await repository.create(entityData);
      createdIds.push(created.id);

      expect(created.is_active).toBe(true);
      expect(created.created_at).toBeInstanceOf(Date);
      expect(created.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('findById', () => {
    it('should find entity by ID', async () => {
      const entityData = {
        org_id: testOrgId,
        name: 'Findable Entity',
        description: 'An entity to find',
      };

      const created = await repository.create(entityData);
      createdIds.push(created.id);

      const found = await repository.findById(created.id);
      expect(found).toMatchObject(created);
    });

    it('should return null for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const found = await repository.findById(nonExistentId);
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Create test entities
      const entities = [
        { org_id: testOrgId, name: 'Entity 1', is_active: true },
        { org_id: testOrgId, name: 'Entity 2', is_active: false },
        { org_id: testOrgId, name: 'Entity 3', is_active: true },
      ];

      for (const entity of entities) {
        const created = await repository.create(entity);
        createdIds.push(created.id);
      }
    });

    it('should find all entities without filters', async () => {
      const entities = await repository.findAll();
      expect(entities.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter entities by criteria', async () => {
      const activeEntities = await repository.findAll({ is_active: true });
      expect(activeEntities.length).toBeGreaterThanOrEqual(2);
      expect(activeEntities.every((e) => e.is_active)).toBe(true);
    });

    it('should support pagination', async () => {
      const firstPage = await repository.findAll({}, { limit: 2, offset: 0 });
      const secondPage = await repository.findAll({}, { limit: 2, offset: 2 });

      expect(firstPage.length).toBeLessThanOrEqual(2);
      expect(secondPage.length).toBeLessThanOrEqual(2);
    });

    it('should support ordering', async () => {
      const entitiesAsc = await repository.findAll({}, { orderBy: 'name', orderDirection: 'ASC' });
      const entitiesDesc = await repository.findAll(
        {},
        { orderBy: 'name', orderDirection: 'DESC' }
      );

      expect(entitiesAsc.length).toBeGreaterThan(0);
      expect(entitiesDesc.length).toBeGreaterThan(0);

      if (entitiesAsc.length > 1) {
        expect(entitiesAsc[0].name <= entitiesAsc[1].name).toBe(true);
      }
    });
  });

  describe('update', () => {
    it('should update entity with valid data', async () => {
      const entityData = {
        org_id: testOrgId,
        name: 'Original Name',
        description: 'Original description',
      };

      const created = await repository.create(entityData);
      createdIds.push(created.id);

      const updates = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const updated = await repository.update(created.id, updates);
      expect(updated).toMatchObject({
        ...created,
        ...updates,
        updated_at: expect.any(Date),
      });
      expect(updated!.updated_at.getTime()).toBeGreaterThan(created.updated_at.getTime());
    });

    it('should return null for non-existent entity', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const updated = await repository.update(nonExistentId, { name: 'New Name' });
      expect(updated).toBeNull();
    });

    it('should validate update data', async () => {
      const entityData = {
        org_id: testOrgId,
        name: 'Test Entity',
      };

      const created = await repository.create(entityData);
      createdIds.push(created.id);

      const invalidUpdates = {
        name: '', // Empty name should fail validation
      };

      await expect(repository.update(created.id, invalidUpdates)).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete existing entity', async () => {
      const entityData = {
        org_id: testOrgId,
        name: 'Entity to Delete',
      };

      const created = await repository.create(entityData);
      const deleted = await repository.delete(created.id);

      expect(deleted).toBe(true);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent entity', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const deleted = await repository.delete(nonExistentId);
      expect(deleted).toBe(false);
    });
  });

  describe('count', () => {
    beforeEach(async () => {
      // Create test entities
      const entities = [
        { org_id: testOrgId, name: 'Count Entity 1', is_active: true },
        { org_id: testOrgId, name: 'Count Entity 2', is_active: false },
        { org_id: testOrgId, name: 'Count Entity 3', is_active: true },
      ];

      for (const entity of entities) {
        const created = await repository.create(entity);
        createdIds.push(created.id);
      }
    });

    it('should count all entities without filters', async () => {
      const count = await repository.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('should count entities with filters', async () => {
      const activeCount = await repository.count({ is_active: true });
      const inactiveCount = await repository.count({ is_active: false });

      expect(activeCount).toBeGreaterThanOrEqual(2);
      expect(inactiveCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('transaction', () => {
    it('should commit successful transactions', async () => {
      const entityData1 = { org_id: testOrgId, name: 'Transaction Entity 1' };
      const entityData2 = { org_id: testOrgId, name: 'Transaction Entity 2' };

      const result = await repository.transaction(async (client) => {
        const result1 = await client.query(
          'INSERT INTO test_entities (org_id, name) VALUES ($1, $2) RETURNING *',
          [entityData1.org_id, entityData1.name]
        );
        const result2 = await client.query(
          'INSERT INTO test_entities (org_id, name) VALUES ($1, $2) RETURNING *',
          [entityData2.org_id, entityData2.name]
        );

        return [result1.rows[0], result2.rows[0]];
      });

      createdIds.push(result[0].id, result[1].id);

      // Verify both entities were created
      const entity1 = await repository.findById(result[0].id);
      const entity2 = await repository.findById(result[1].id);

      expect(entity1).toBeTruthy();
      expect(entity2).toBeTruthy();
    });

    it('should rollback failed transactions', async () => {
      const entityData = { org_id: testOrgId, name: 'Transaction Entity' };

      await expect(
        repository.transaction(async (client) => {
          await client.query('INSERT INTO test_entities (org_id, name) VALUES ($1, $2)', [
            entityData.org_id,
            entityData.name,
          ]);

          // Force an error to trigger rollback
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      // Verify no entity was created
      const entities = await repository.findAll({ name: entityData.name });
      expect(entities.length).toBe(0);
    });
  });
});
