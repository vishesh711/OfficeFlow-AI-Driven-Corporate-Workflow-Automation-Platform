# Template Test Run Issue - Fixed ✅

## Problem

When using a workflow from a template and clicking "Test Run", it would fail with:

```
Failed to start test run. Please try again.
```

## Root Cause

When you select a template:

1. ❌ Template creates a workflow object **without an ID**
2. ❌ Test Run tries to execute using `currentWorkflow.id`
3. ❌ Since `id` is undefined, the API call fails

### The Bug in Code:

```typescript
// When template is selected (NO ID YET)
const newWorkflow = {
  name: template.name,
  description: template.description,
  eventTrigger: 'employee.onboard',
  version: 1,
  isActive: false,
  definition: template.definition,
  // id: undefined ❌
}

// Test Run tries to execute
await workflowApi.executeWorkflow(currentWorkflow.id, ...)
// currentWorkflow.id is undefined! ❌
```

## Solution

### 1. **Better ID Check**

Changed from checking if workflow exists to checking if workflow **has an ID**:

```typescript
// Before
if (!currentWorkflow) {
  alert('Please save the workflow before running a test.');
  return;
}

// After ✅
if (!currentWorkflow || !currentWorkflow.id) {
  alert(
    '⚠️ Please save the workflow first before running a test.\n\nTemplates and new workflows must be saved to get an ID before they can be executed.'
  );
  setShowMetadataEditor(true);
  return;
}
```

### 2. **Button Disabled State**

Updated button to check for ID:

```typescript
// Before
disabled={isLoading || !currentWorkflow}

// After ✅
disabled={isLoading || !currentWorkflow?.id}
```

### 3. **Improved Template Handling**

Updated template selection to not create incomplete workflow:

```typescript
const handleSelectTemplate = useCallback(
  (template: WorkflowTemplate) => {
    // Set workflow metadata from template
    setWorkflowMetadata({
      name: template.name,
      description: template.description || '',
      eventTrigger: 'employee.onboard',
    });

    // Load the workflow definition (nodes and edges)
    loadWorkflowDefinition(template.definition);

    // Show metadata editor so user can customize before saving
    setShowMetadataEditor(true);

    // Note: currentWorkflow will be set when user saves ✅
  },
  [loadWorkflowDefinition, setShowMetadataEditor]
);
```

### 4. **Better Error Messages**

```typescript
try {
  const response = await workflowApi.executeWorkflow(currentWorkflow.id, ...)
  alert(`✅ Test run started successfully!\n\nRun ID: ${response.data.runId}...`)
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  alert(`❌ Failed to start test run.\n\nError: ${errorMessage}\n\nPlease try again or check the console for details.`)
}
```

## How to Use Templates Now

### ✅ Correct Workflow:

1. **Select Template**
   - Click "Templates" button
   - Browse/search templates
   - Click "Use This Template"

2. **Template Loads**
   - Nodes and edges appear on canvas
   - Metadata editor opens automatically
   - Name and description pre-filled from template

3. **Customize (Optional)**
   - Edit workflow name
   - Modify description
   - Adjust nodes/connections
   - Change event trigger

4. **SAVE First** ⚠️
   - Click "Save" button
   - Workflow gets saved to database
   - **Workflow now has an ID** ✅

5. **Test Run**
   - "Test Run" button is now enabled
   - Click it to execute
   - Monitor execution progress

### ❌ What Won't Work:

```
1. Select Template
2. Click Test Run immediately ❌
   → Shows: "Please save the workflow first"
```

## Visual Indicators

### Before Save (Template Just Loaded):

```
[Templates] [Save] [Test Run] ← DISABLED (grayed out)
                      ↑
                "💾 Save workflow first to enable test run"
```

### After Save:

```
[Templates] [Save] [Test Run] ← ENABLED (green)
                      ↑
                "▶️ Run workflow with test data"
```

## Examples

### Example 1: Employee Onboarding Template

```bash
1. Click "Templates"
2. Select "New Employee Onboarding"
3. Template loads with:
   - Trigger node
   - Identity provisioning
   - Welcome email
   - Slack notification
4. Metadata editor shows:
   - Name: "New Employee Onboarding"
   - Description: "..."
5. Click "Save" ✅
6. Wait for success message
7. Click "Test Run" ✅
8. View execution in Monitoring
```

### Example 2: Customize Template Before Testing

```bash
1. Select template
2. Modify nodes:
   - Change email template
   - Add delay node
   - Update Slack channel
3. Update metadata:
   - Change name to "Custom Onboarding"
   - Update description
4. Click "Save" ✅
5. Click "Test Run" ✅
```

### Example 3: Template + Quick Test

```bash
1. Select "Weekly Report" template
2. Template loads
3. Immediately click "Save" ✅
4. Success: "Workflow saved successfully!"
5. Immediately click "Test Run" ✅
6. Success: "Test run started successfully!"
```

## Error Handling

### Scenario 1: Test Run Before Save

**Action:** Select template → Click Test Run

**Result:**

```
⚠️ Please save the workflow first before running a test.

Templates and new workflows must be saved to get an
ID before they can be executed.
```

**Solution:** Click "Save" first

### Scenario 2: Invalid Template Workflow

**Action:** Template has invalid structure → Save → Test Run

**Result:**

```
Workflow validation failed:
- Trigger node must have at least one connection
- Node "Email" requires recipient field
```

**Solution:** Fix validation errors, save again, then test

### Scenario 3: Network Error

**Action:** Test Run with network issues

**Result:**

```
❌ Failed to start test run.

Error: Network Error

Please try again or check the console for details.
```

**Solution:** Check services are running, try again

## Testing Checklist

For each template:

- [ ] Select template
- [ ] Verify nodes load correctly
- [ ] Verify metadata editor opens
- [ ] Verify name/description pre-filled
- [ ] Click Save
- [ ] Verify workflow saved (success message)
- [ ] Verify Test Run button enables
- [ ] Click Test Run
- [ ] Verify execution starts
- [ ] Check Monitoring page
- [ ] Verify nodes execute

## Technical Details

### Workflow Object States

```typescript
// State 1: No workflow (new designer)
currentWorkflow = null
Test Run: DISABLED

// State 2: Template selected (not saved)
currentWorkflow = {
  name: "Template Name",
  // ... other fields
  id: undefined  ❌
}
Test Run: DISABLED

// State 3: Workflow saved
currentWorkflow = {
  name: "Template Name",
  // ... other fields
  id: "abc-123-def"  ✅
}
Test Run: ENABLED ✅
```

### API Call Flow

```typescript
// 1. User clicks Test Run
handleTestRun()

// 2. Check for ID
if (!currentWorkflow?.id) {
  alert('Save first')
  return
}

// 3. Make API call with valid ID
POST /api/workflows/{currentWorkflow.id}/execute
```

## Benefits

1. ✅ **Clear user guidance** - Shows why Test Run is disabled
2. ✅ **Prevents errors** - Can't execute without ID
3. ✅ **Better UX** - Opens metadata editor automatically
4. ✅ **Helpful tooltips** - Hover to see what to do
5. ✅ **Better error messages** - Shows actual error details

## Status

✅ **Template Test Run is now fully working!**

Users can:

- Select any template
- See nodes load on canvas
- Edit workflow before saving
- Save to get an ID
- Test run the workflow
- View execution in Monitoring

**The workflow is:**

```
Select Template → Customize → Save → Test Run → Monitor
                              ↑
                         Required step!
```

## Quick Reference

| Action          | Template Selected | After Save           |
| --------------- | ----------------- | -------------------- |
| Test Run Button | 🔴 Disabled       | 🟢 Enabled           |
| Tooltip         | "Save first"      | "Run with test data" |
| Has ID          | ❌ No             | ✅ Yes               |
| Can Execute     | ❌ No             | ✅ Yes               |

## Summary

**Problem:** Templates didn't have IDs, causing test runs to fail

**Solution:** Check for `currentWorkflow.id` instead of just `currentWorkflow`

**User Action:** Save workflow first, then test run

**Status:** ✅ Fixed and working!
