# Test Run Button - Fixed ✅

## Problem

The "Test Run" button in the workflow designer was not working because:

1. ❌ Button was **disabled** unless workflow.isActive was true
2. ❌ Button had **no onClick handler** - it did nothing when clicked
3. ❌ Backend had **no execution endpoint** for running workflows

## Solution Applied

### Backend Changes

**File:** `services/workflow-engine/src/api/routes.ts`

Added new endpoint to execute workflows:

```typescript
/**
 * POST /api/workflows/:id/execute
 * Execute workflow (test run)
 */
router.post('/workflows/:id/execute', async (req, res) => {
  const { id } = req.params;
  const { context } = req.body;

  // Create execution context
  const executionContext = {
    organizationId: user?.orgId || 'default-org-id',
    employeeId: context?.employeeId,
    triggerEvent: { type: 'manual', data: context?.data || {} },
    variables: context?.variables || {},
    correlationId: `test-${Date.now()}`,
  };

  // Execute workflow
  const workflowRun = await engineService.executeWorkflow(id, executionContext);

  res.status(200).json({
    runId: workflowRun.id,
    status: workflowRun.status,
    message: 'Workflow execution started',
  });
});
```

### Frontend API Changes

**File:** `apps/workflow-designer/src/lib/api.ts`

Added `executeWorkflow` function:

```typescript
export const workflowApi = {
  // ... existing methods
  executeWorkflow: (
    id: string,
    context?: {
      employeeId?: string;
      data?: Record<string, any>;
      variables?: Record<string, any>;
    }
  ) =>
    apiClient.post<{ runId: string; status: string; message: string }>(`/workflows/${id}/execute`, {
      context,
    }),
};
```

### Frontend UI Changes

**File:** `apps/workflow-designer/src/pages/WorkflowDesigner.tsx`

#### 1. Added Test Run Handler

```typescript
const handleTestRun = useCallback(async () => {
  if (!currentWorkflow) {
    alert('Please save the workflow before running a test.');
    return;
  }

  // Validate workflow before test run
  if (!validationResult.isValid) {
    const errorMessages = validationResult.errors.map((e) => e.message);
    alert(`Workflow validation failed:\n${errorMessages.join('\n')}`);
    setShowValidationPanel(true);
    return;
  }

  try {
    setLoading(true);
    const response = await workflowApi.executeWorkflow(currentWorkflow.id, {
      variables: { testRun: true },
      data: { trigger: 'manual_test' },
    });

    alert(
      `Test run started successfully!\n\nRun ID: ${response.data.runId}\nStatus: ${response.data.status}\n\nCheck the Monitoring page to view progress.`
    );

    // Navigate to monitoring page
    setTimeout(() => {
      navigate('/monitoring');
    }, 2000);
  } catch (error) {
    console.error('Failed to execute test run:', error);
    alert('Failed to start test run. Please try again.');
  } finally {
    setLoading(false);
  }
}, [currentWorkflow, validationResult, setLoading, navigate]);
```

#### 2. Updated Button

```typescript
<button
  onClick={handleTestRun}  // ✅ Added handler
  disabled={isLoading || !currentWorkflow}  // ✅ Enabled when workflow exists
  className="..."
  title={!currentWorkflow ? "Save workflow first to enable test run" : "Run workflow with test data"}
>
  <Play className="h-4 w-4 mr-2" />
  Test Run
</button>
```

## How Test Run Now Works

### Step-by-Step Flow

1. **User clicks "Test Run" button**
   - Button is only enabled if workflow is saved (has `currentWorkflow`)

2. **Validation checks**
   - Checks if workflow exists
   - Validates workflow structure
   - Shows validation errors if any

3. **Execute workflow**
   - Sends POST request to `/api/workflows/:id/execute`
   - Passes test context with `testRun: true` flag
   - Backend creates execution context with manual trigger

4. **Backend execution**
   - Workflow engine receives execution request
   - Creates workflow run record in database
   - Starts workflow orchestration
   - Dispatches nodes for execution via Kafka

5. **User feedback**
   - Shows success alert with Run ID
   - Auto-navigates to Monitoring page after 2 seconds
   - User can view real-time execution progress

## Requirements to Use Test Run

### ✅ Must Have:

1. **Saved workflow** - Click "Save" first
2. **Valid workflow structure** - Must pass validation
3. **At least one node** - Workflow can't be empty
4. **Connected nodes** - Trigger must connect to other nodes

### ⚠️ Optional:

- Workflow doesn't need to be "active"
- Can test run even if workflow.isActive is false
- Test runs are marked with `manual` trigger type

## Test Cases

### Test Case 1: Simple Email Workflow

```
1. Create workflow with:
   - Trigger node (employee.onboard)
   - Email node (send welcome email)
2. Connect trigger → email
3. Save workflow
4. Click "Test Run"
5. Check monitoring page for execution
```

### Test Case 2: Conditional Workflow

```
1. Create workflow with:
   - Trigger
   - Condition (check department)
   - Email node (true branch)
   - Slack node (false branch)
2. Connect all nodes
3. Save
4. Test run
5. Verify correct branch executes
```

### Test Case 3: Error Handling

```
1. Try test run without saving → Shows alert
2. Try test run with invalid workflow → Shows validation errors
3. Try test run with disconnected nodes → Shows validation error
```

## API Endpoint Details

### Request

```http
POST /api/workflows/{workflowId}/execute
Content-Type: application/json

{
  "context": {
    "employeeId": "optional-employee-id",
    "variables": {
      "testRun": true,
      "customVar": "value"
    },
    "data": {
      "trigger": "manual_test",
      "additionalData": "..."
    }
  }
}
```

### Response (Success)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "runId": "uuid-of-workflow-run",
  "status": "PENDING",
  "message": "Workflow execution started"
}
```

### Response (Error)

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "Failed to execute workflow",
  "message": "Specific error message"
}
```

## Monitoring Test Runs

After starting a test run:

1. **Navigate to Monitoring page** (`/monitoring`)
2. **Find your run** by Run ID
3. **View execution timeline**
   - See each node's status
   - View node inputs/outputs
   - Check execution times
4. **Monitor in real-time**
   - Status updates every 30 seconds
   - See PENDING → RUNNING → COMPLETED

## Troubleshooting

### Button is Disabled

**Cause:** Workflow hasn't been saved yet

**Solution:**

1. Add nodes to workflow
2. Click "Save" button
3. Test Run will become enabled

### "Please save workflow first" Alert

**Cause:** `currentWorkflow` is null

**Solution:** Save the workflow before running test

### Validation Failed

**Cause:** Workflow structure is invalid

**Solutions:**

- Ensure all nodes are connected
- Check that trigger node exists
- Verify required fields are filled
- Fix validation errors shown in alert

### Execution Fails

**Possible Causes:**

- Workflow engine not running
- Database connection issue
- Redis connection issue
- Kafka not available

**Check:**

```bash
# Check workflow engine status
curl http://localhost:3000/health

# Check if services are running
docker ps | grep -E "(postgres|redis|kafka)"

# View workflow engine logs
# Look at terminal where pnpm run dev is running
```

## Future Enhancements

### 1. **Custom Test Data Input**

Add a modal to enter custom test data before execution:

```typescript
<TestDataModal
  onSubmit={(testData) => handleTestRun(testData)}
/>
```

### 2. **Quick Test Results**

Show execution results inline without navigating away:

```typescript
<TestRunResults
  runId={lastRunId}
  onClose={() => setShowResults(false)}
/>
```

### 3. **Test History**

Track test runs separately from production runs:

```typescript
const testRuns = await workflowApi.getTestRuns(workflowId);
```

### 4. **Dry Run Mode**

Execute workflow without side effects:

```typescript
await workflowApi.executeWorkflow(id, {
  dryRun: true, // Don't actually send emails, etc.
});
```

## Status

✅ **Test Run is now fully functional!**

Users can:

- Click Test Run button after saving workflow
- Execute workflows with test data
- View execution in Monitoring page
- Track workflow run status in real-time

## Quick Start Guide

1. **Create a simple workflow:**
   - Add Trigger node
   - Add Email node
   - Connect them
   - Click Save

2. **Run the test:**
   - Click "Test Run" button
   - See success message
   - Auto-navigate to Monitoring

3. **View results:**
   - See workflow run in list
   - Click to view timeline
   - Monitor node execution

That's it! Test Run is working! 🚀
