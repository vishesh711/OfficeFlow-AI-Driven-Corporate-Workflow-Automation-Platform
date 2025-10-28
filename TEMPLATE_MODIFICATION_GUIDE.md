# Template Modification Guide 🔧

## Common Issues When Modifying Templates

When you modify a template, you might encounter validation errors. Here's how to fix them!

---

## ✅ Validation Requirements

Every workflow must have:

### 1. **At Least One Trigger Node**

- Every workflow needs a starting point
- Use "Event Trigger" or "Schedule" node
- Trigger should be connected to other nodes

### 2. **All Nodes Connected**

- Nodes must form a connected path from trigger
- No isolated/floating nodes (unless warnings are OK)
- No circular connections (A → B → A)

### 3. **Required Fields Filled**

**Email Node:**

- ✅ Recipients (who gets the email)
- ✅ Template (what email to send)

**Condition Node:**

- ✅ Expression (what to check)

**Delay Node:**

- ✅ Duration (at least 1 unit)

**Identity Node:**

- ✅ Action (provision/deprovision)
- ✅ Provider (google/okta/etc)

**AI Node:**

- ✅ Content Type (what to generate)

---

## 🔍 **Common Errors & Fixes**

### Error: "Workflow must have at least one trigger node"

**Problem:** You deleted the trigger node

**Fix:**

1. Drag "Event Trigger" from sidebar
2. Connect it to your first action node

---

### Error: "Email node has no recipients configured"

**Problem:** Email node is missing recipient email address

**Fix:**

1. Click on the Email node
2. In Properties Panel (right side)
3. Fill in "Recipients" field
   - Example: `{{employee.email}}`
   - Or: `hr@company.com`

---

### Error: "Email node has no template selected"

**Problem:** Email node doesn't know what email to send

**Fix:**

1. Click on the Email node
2. In Properties Panel
3. Select a template from dropdown
   - `welcome` - Welcome email
   - `exit` - Exit email
   - etc.

---

### Error: "Node X is not connected to the workflow"

**Problem:** You have a floating node that's not connected

**Fix:**

1. Connect the node to your workflow
   - Drag from bottom circle of source node
   - Drop on top circle of target node
2. OR delete the node if you don't need it
   - Select node and press Delete key

---

### Error: "Node X is not reachable from any trigger"

**Problem:** Node is connected but can't be reached from trigger

**Fix:**

1. Trace path from trigger
2. Make sure there's a connection path to this node
3. Check for disconnected sections

---

### Error: "Circular dependency detected"

**Problem:** Nodes form a loop (A → B → C → A)

**Fix:**

1. Delete one of the circular connections
2. Workflows must flow forward, not in circles
3. Use the validation panel to see which nodes are in the loop

---

## 🎯 **Step-by-Step: Modify a Template**

### Example: Customize "Employee Onboarding" Template

1. **Select Template**

   ```
   Templates → Employee Onboarding → Use Template
   ```

2. **Template Loads**

   ```
   Trigger → Identity → Email → Slack
   ```

3. **Make Your Changes**

   **Add a Delay:**

   ```
   - Drag "Delay" node
   - Place between Email and Slack
   - Connect: Email → Delay → Slack
   - Set delay to 1 hour
   ```

   **Change Email Template:**

   ```
   - Click Email node
   - In Properties Panel
   - Change template from "welcome" to "custom_welcome"
   ```

   **Remove Slack (if not needed):**

   ```
   - Select Slack node
   - Press Delete key
   - Now: Trigger → Identity → Email → Delay
   ```

4. **Validate**

   ```
   - Check for validation errors (bottom right)
   - Fix any red errors
   - Warnings (yellow) are OK to ignore
   ```

5. **Save**

   ```
   - Click "Save" button
   - Fix any errors shown
   - Success!
   ```

6. **Test**
   ```
   - Click "Test Run"
   - Monitor execution
   ```

---

## 💡 **Pro Tips**

### Tip 1: Use Validation Panel

**How:**

1. Look at bottom right of screen
2. Click validation panel if it appears
3. Click on errors to jump to problem nodes

### Tip 2: Check Required Fields

**Before Saving:**

1. Click each node
2. Check Properties Panel (right)
3. Make sure all required fields are filled
4. Look for red asterisks (\*)

### Tip 3: Test Connections

**Good Connection:**

```
[Trigger]
    ↓
  [Email]
    ↓
  [Slack]
```

**Bad Connection (disconnected):**

```
[Trigger]     [Email]
    ↓            ↓
              [Slack]
```

### Tip 4: Save Often

**Workflow:**

```
Make change → Save → Test → Repeat
```

Don't make many changes at once without saving!

---

## 🐛 **Debugging Checklist**

Can't save? Check this list:

- [ ] Does workflow have a trigger node?
- [ ] Is trigger connected to other nodes?
- [ ] Are all email nodes configured?
  - [ ] Recipients filled
  - [ ] Template selected
- [ ] Are all condition nodes configured?
  - [ ] Expression filled
- [ ] Are all nodes connected in a path?
- [ ] No circular connections?
- [ ] Is workflow name filled in?
- [ ] Did you check the validation panel?

---

## 🔧 **Quick Fixes**

### "Just want to test the template as-is"

```bash
1. Select template
2. Don't modify anything
3. Click "Save"
4. Click "Test Run"
```

### "Want to add ONE node"

```bash
1. Select template
2. Drag new node to canvas
3. Connect it in the flow
4. Configure its properties
5. Save
6. Test
```

### "Want to remove ONE node"

```bash
1. Select template
2. Click node to remove
3. Press Delete
4. Reconnect the gap:
   - Before: A → B → C
   - Delete B
   - Connect: A → C
5. Save
6. Test
```

### "Want to change node settings"

```bash
1. Select template
2. Click node
3. Edit in Properties Panel (right)
4. Save
5. Test
```

---

## 📋 **Validation Error Reference**

| Error Message         | What It Means         | How to Fix                    |
| --------------------- | --------------------- | ----------------------------- |
| "No trigger node"     | Missing start         | Add Event Trigger or Schedule |
| "No recipients"       | Email needs address   | Fill Recipients field         |
| "No template"         | Email needs template  | Select template               |
| "No expression"       | Condition needs logic | Fill expression               |
| "Invalid duration"    | Delay time wrong      | Set to 1 or more              |
| "Not connected"       | Floating node         | Connect or delete             |
| "Not reachable"       | Path broken           | Fix connection path           |
| "Circular dependency" | Loop detected         | Remove circular connection    |

---

## ✅ **Success Checklist**

Your workflow is ready to save when:

- ✅ Has trigger node
- ✅ All nodes are green (no errors)
- ✅ Connected path from trigger to end
- ✅ No circular connections
- ✅ All required fields filled
- ✅ Workflow name entered
- ✅ Validation panel shows no errors

---

## 🆘 **Still Stuck?**

### Get Detailed Errors:

1. Click "Save"
2. Read the error message carefully
3. It will tell you exactly what's wrong
4. Click on the validation panel
5. Click on errors to jump to problem nodes

### Check Console:

1. Press F12 (Developer Tools)
2. Click "Console" tab
3. Look for red errors
4. Share error message if asking for help

### Common Mistakes:

❌ Deleted trigger by accident  
✅ Add new trigger node

❌ Disconnected nodes  
✅ Reconnect them

❌ Forgot to fill email recipients  
✅ Click node, fill field

❌ Forgot to give workflow a name  
✅ Click "Workflow Info", add name

---

## 📚 **Summary**

**To modify a template successfully:**

1. ✅ Select template
2. ✅ Make your changes carefully
3. ✅ Keep trigger node
4. ✅ Keep nodes connected
5. ✅ Fill required fields
6. ✅ Check validation panel
7. ✅ Save workflow
8. ✅ Test run

**Remember:** The validation errors will tell you exactly what's wrong! Read them carefully and fix each issue one by one.

Good luck! 🚀
