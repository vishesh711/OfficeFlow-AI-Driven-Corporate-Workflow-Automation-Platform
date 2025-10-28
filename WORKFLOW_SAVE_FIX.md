# Workflow Save Issue - Fixed ✅

## Problem

When trying to save a workflow from the frontend, the request would fail with a 500 error:

```
POST /api/workflows → 500 Internal Server Error
"Failed to save workflow. Please try again."
```

## Root Causes

### 1. **Missing Field Transformation**

- **Frontend sends:** `camelCase` format (`eventTrigger`, `isActive`, `definition`)
- **Database expects:** `snake_case` format (`event_trigger`, `is_active`, `definition`)
- The API wasn't transforming between these formats

### 2. **Missing Required Fields**

- Database requires `org_id` (organization ID) field
- Frontend doesn't send this field
- No default value was being set

### 3. **Inconsistent Response Format**

- Database returns `snake_case` fields
- Frontend expects `camelCase` fields
- GET/UPDATE endpoints weren't transforming responses

## Solution Applied

### File Modified:

```
services/workflow-engine/src/api/routes.ts
```

### Changes Made:

#### 1. **POST /workflows (Create)**

```typescript
// Before
router.post('/workflows', async (req, res) => {
  const workflowData = req.body; // ❌ No transformation
  const workflow = await workflowRepo.create(workflowData);
  res.status(201).json(workflow); // ❌ Returns snake_case
});

// After
router.post('/workflows', async (req, res) => {
  const { name, description, eventTrigger, version, isActive, definition } = req.body;

  // Transform camelCase → snake_case
  const workflowData = {
    org_id: 'f43ed62f-0e77-4ab5-a42a-41aca2a5434c', // Default org
    name,
    description,
    event_trigger: eventTrigger, // ✅ Transformed
    version: version || 1,
    is_active: isActive !== undefined ? isActive : false, // ✅ Transformed
    definition,
  };

  const workflow = await workflowRepo.create(workflowData);

  // Transform response snake_case → camelCase
  const responseWorkflow = {
    id: workflow.workflow_id,
    eventTrigger: workflow.event_trigger, // ✅ Transformed back
    isActive: workflow.is_active, // ✅ Transformed back
    // ... other fields
  };

  res.status(201).json(responseWorkflow);
});
```

#### 2. **GET /workflows (List All)**

```typescript
// Transform all workflow responses to camelCase
const transformedWorkflows = workflows.map((w) => ({
  id: w.workflow_id,
  eventTrigger: w.event_trigger,
  isActive: w.is_active,
  // ... other fields
}));
```

#### 3. **GET /workflows/:id (Get Single)**

```typescript
// Transform single workflow response to camelCase
const responseWorkflow = {
  id: workflow.workflow_id,
  eventTrigger: workflow.event_trigger,
  isActive: workflow.is_active,
  // ... other fields
};
```

#### 4. **PUT /workflows/:id (Update)**

```typescript
// Transform incoming camelCase to snake_case
const updates: any = {};
if (eventTrigger !== undefined) updates.event_trigger = eventTrigger;
if (isActive !== undefined) updates.is_active = isActive;

// Transform response back to camelCase
const responseWorkflow = {
  eventTrigger: workflow.event_trigger,
  isActive: workflow.is_active,
  // ... other fields
};
```

## Testing

### Test Case 1: Create Simple Workflow

```bash
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow",
    "description": "My first workflow",
    "eventTrigger": "employee.onboard",
    "version": 1,
    "isActive": false,
    "definition": {
      "nodes": [
        {
          "id": "trigger-1",
          "type": "trigger",
          "position": {"x": 100, "y": 100},
          "data": {
            "label": "Event Trigger",
            "params": {"eventType": "employee.onboard"}
          }
        }
      ],
      "edges": []
    }
  }'
```

**Expected Response:**

```json
{
  "id": "abc123...",
  "name": "Test Workflow",
  "description": "My first workflow",
  "eventTrigger": "employee.onboard",
  "version": 1,
  "isActive": false,
  "definition": { ... },
  "createdAt": "2025-10-27T...",
  "updatedAt": "2025-10-27T..."
}
```

### Test Case 2: UI Workflow Save

1. Open workflow designer
2. Add trigger node
3. Add email node
4. Connect them
5. Click Save
6. **Result:** ✅ Workflow saves successfully

## Database Schema Reference

The `workflows` table schema:

```sql
CREATE TABLE workflows (
    workflow_id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(org_id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    event_trigger VARCHAR(100) NOT NULL,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    definition JSONB NOT NULL,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

## Field Mapping

| Frontend (camelCase) | Database (snake_case) | Type      | Required             |
| -------------------- | --------------------- | --------- | -------------------- |
| `id`                 | `workflow_id`         | UUID      | Auto-generated       |
| `name`               | `name`                | string    | Yes                  |
| `description`        | `description`         | string    | No                   |
| `eventTrigger`       | `event_trigger`       | string    | Yes                  |
| `version`            | `version`             | number    | Default: 1           |
| `isActive`           | `is_active`           | boolean   | Default: false       |
| `definition`         | `definition`          | object    | Yes                  |
| `createdAt`          | `created_at`          | timestamp | Auto                 |
| `updatedAt`          | `updated_at`          | timestamp | Auto                 |
| N/A                  | `org_id`              | UUID      | Required (from auth) |
| N/A                  | `created_by`          | UUID      | Optional (from auth) |

## Future Improvements

### 1. **Authentication Integration**

Currently using a hardcoded default `org_id`. Should be extracted from JWT token:

```typescript
const user = (req as any).user; // From auth middleware
const org_id = user?.orgId || 'default-org-id';
const created_by = user?.userId;
```

### 2. **Automatic Field Transformation**

Consider adding a middleware to automatically transform between camelCase and snake_case:

```typescript
app.use(camelCaseToSnakeCaseMiddleware());
app.use(snakeCaseToCamelCaseMiddleware());
```

### 3. **Type-Safe Transformation**

Use a library like `humps` or create typed transformers:

```typescript
import { camelizeKeys, decamelizeKeys } from 'humps';

const workflowData = decamelizeKeys(req.body);
const response = camelizeKeys(workflow);
```

## Status

✅ **Fixed and Working**

Workflow save functionality is now operational. Users can:

- Create new workflows from the designer
- Save workflows with nodes and edges
- Update existing workflows
- List all workflows
- Get workflow by ID

All API endpoints now properly handle field name transformations between frontend and database.

## How to Test

1. **Start the services:**

   ```bash
   pnpm run dev
   ```

2. **Open the designer:**

   ```
   http://localhost:5173
   ```

3. **Create a workflow:**
   - Click "Create Workflow"
   - Add a few nodes
   - Connect them
   - Give it a name
   - Click "Save"

4. **Verify:**
   - Check browser console (no errors)
   - Check database:
     ```sql
     SELECT workflow_id, name, event_trigger, is_active
     FROM workflows
     ORDER BY created_at DESC
     LIMIT 5;
     ```

## Notes

- The workflow engine restarts automatically when code changes (using `tsx watch`)
- Changes take effect immediately (no manual restart needed)
- CORS is configured to allow requests from `http://localhost:5173`
- Default organization ID is used until auth integration is complete
