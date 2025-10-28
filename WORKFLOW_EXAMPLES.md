# 🚀 Simple Workflow Examples to Get Started

## Available Node Types

Your workflow designer has these nodes:

### 🎯 **Triggers** (Start your workflow)

- **Event Trigger** - Triggered by employee lifecycle events
- **Schedule** - Time-based triggers (cron schedule)

### 👤 **Identity & Access**

- **Identity Service** - Provision/deprovision user accounts

### 📧 **Communication**

- **Email** - Send personalized emails
- **Slack** - Send Slack messages
- **Calendar** - Schedule meetings

### 📄 **Documents & AI**

- **Document** - Distribute documents
- **AI Content** - Generate personalized content with AI

### 🔀 **Flow Control**

- **Condition** - Conditional branching (if/else logic)
- **Delay** - Wait before continuing

---

## Example 1: Simple Welcome Email Workflow 📧

**What it does:** When a new employee joins, automatically send them a welcome email.

### Steps:

1. **Login** to your OfficeFlow dashboard at http://localhost:5173
2. Click **"Create Workflow"** button
3. Give it a name: `"New Employee Welcome Email"`
4. **Add nodes from the left sidebar:**

   **Node 1: Event Trigger**
   - Drag "Event Trigger" to the canvas
   - Click on it to configure
   - Set Event Type: `employee.onboard`

   **Node 2: Email**
   - Drag "Email" node to the canvas
   - Click on it to configure
   - Template: `welcome`
   - Recipients: `{{employee.email}}`
   - Subject: `Welcome to the Team!`
   - Content: `Hi {{employee.firstName}}, welcome aboard!`

5. **Connect the nodes:**
   - Click and drag from the bottom circle of the Trigger node
   - Drop on the top circle of the Email node

6. **Save the workflow** (click the Save button in the top right)

**Your first workflow is ready!** ✅

---

## Example 2: Employee Onboarding with Delay ⏰

**What it does:** Send a welcome email immediately, then send another email after 24 hours.

### Node Flow:

```
[Event Trigger: employee.onboard]
        ↓
    [Email: Welcome Email]
        ↓
    [Delay: 24 hours]
        ↓
    [Email: Day 2 Follow-up]
```

### Steps:

1. Create workflow: `"Employee Onboarding with Follow-up"`

2. **Add Trigger:**
   - Type: Event Trigger
   - Event Type: `employee.onboard`

3. **Add Email Node 1:**
   - Template: `welcome`
   - Recipients: `{{employee.email}}`
   - Subject: `Welcome to {{company.name}}!`

4. **Add Delay:**
   - Duration: `24`
   - Unit: `hours`

5. **Add Email Node 2:**
   - Template: `day2_checkin`
   - Recipients: `{{employee.email}}`
   - Subject: `Your First Day - How's it going?`

6. **Connect:** Trigger → Email 1 → Delay → Email 2

7. **Save and Activate**

---

## Example 3: Conditional Workflow (Department-Based) 🔀

**What it does:** Send different welcome emails based on the employee's department.

### Node Flow:

```
[Event Trigger: employee.onboard]
        ↓
    [Condition: Check Department]
        ↓               ↓
   (Engineering)    (Other)
        ↓               ↓
   [Email: Tech]   [Email: General]
```

### Steps:

1. Create workflow: `"Department-Specific Onboarding"`

2. **Add Trigger:**
   - Event Type: `employee.onboard`

3. **Add Condition:**
   - Expression: `{{employee.department}} === "Engineering"`

4. **Add Email Node 1** (for Engineering):
   - Template: `engineering_welcome`
   - Recipients: `{{employee.email}}`
   - Subject: `Welcome to Engineering!`

5. **Add Email Node 2** (for Others):
   - Template: `general_welcome`
   - Recipients: `{{employee.email}}`
   - Subject: `Welcome to the Team!`

6. **Connect:**
   - Trigger → Condition
   - Condition (TRUE output) → Email 1
   - Condition (FALSE output) → Email 2

7. **Save**

---

## Example 4: Complete Onboarding Workflow 🎉

**What it does:** Full onboarding sequence with multiple steps.

### Node Flow:

```
[Event Trigger: employee.onboard]
        ↓
[Identity: Provision Google Account]
        ↓
    [AI: Generate Welcome Message]
        ↓
    [Email: Send Welcome]
        ↓
    [Slack: Notify Team]
        ↓
    [Document: Send Handbook]
        ↓
    [Calendar: Schedule 1:1 Meeting]
```

### Steps:

1. Create workflow: `"Complete Employee Onboarding"`

2. **Add nodes in order:**
   - **Event Trigger**
     - Event Type: `employee.onboard`

   - **Identity Service**
     - Action: `provision`
     - Provider: `google`

   - **AI Content**
     - Content Type: `welcome_message`

   - **Email**
     - Recipients: `{{employee.email}}`
     - Template: `welcome`

   - **Slack**
     - Action: `send_message`
     - Channel: `#general`
     - Message: `Welcome {{employee.firstName}} to the team!`

   - **Document**
     - Action: `distribute`
     - Document Type: `handbook`

   - **Calendar**
     - Action: `schedule_meeting`
     - Attendees: `{{employee.email}}, {{employee.manager.email}}`

3. **Connect all nodes in sequence**

4. **Save and Activate**

---

## Example 5: Scheduled Weekly Report 📊

**What it does:** Send a weekly team report every Monday at 9 AM.

### Node Flow:

```
[Schedule: Monday 9 AM]
        ↓
    [AI: Generate Report]
        ↓
    [Email: Send to Team]
```

### Steps:

1. Create workflow: `"Weekly Team Report"`

2. **Add Schedule Trigger:**
   - Schedule: `0 9 * * 1` (Every Monday at 9 AM)
   - (Cron format: minute hour day-of-month month day-of-week)

3. **Add AI Content:**
   - Content Type: `weekly_report`

4. **Add Email:**
   - Recipients: `team@company.com`
   - Subject: `Weekly Team Report - {{date}}`
   - Template: `weekly_report`

5. **Connect:** Schedule → AI → Email

6. **Save**

---

## 🎨 How to Use the Workflow Designer

### Creating a Workflow:

1. **Navigate** to http://localhost:5173
2. **Login** with your credentials (john snow / Welcome@2024!)
3. **Click** "Workflows" in the sidebar
4. **Click** "Create Workflow" button
5. **Enter** a name and description

### Adding Nodes:

**Method 1: Drag & Drop**

- Find the node in the left sidebar
- Click and drag it onto the canvas
- Drop it where you want

**Method 2: Click to Add**

- Click on any node in the left sidebar
- It will appear on the canvas

### Connecting Nodes:

1. **Click** the small circle at the **bottom** of a node (source)
2. **Drag** to the small circle at the **top** of another node (target)
3. The connection will be created with an animated arrow

### Configuring Nodes:

1. **Click** on any node
2. The **Properties Panel** appears on the right
3. **Edit** the node's parameters
4. Changes are saved automatically

### Saving & Testing:

1. **Click** the **"Save"** button (top right)
2. **Click** the **"Test Run"** button to test your workflow
3. **Click** the **"Activate"** button to enable it

---

## 📝 Variables & Templates

You can use variables in your workflows:

### Employee Variables:

- `{{employee.email}}` - Employee's email
- `{{employee.firstName}}` - First name
- `{{employee.lastName}}` - Last name
- `{{employee.department}}` - Department
- `{{employee.jobTitle}}` - Job title
- `{{employee.manager.email}}` - Manager's email

### Company Variables:

- `{{company.name}}` - Company name
- `{{company.domain}}` - Company domain

### Date Variables:

- `{{date}}` - Current date
- `{{time}}` - Current time

---

## 🔧 Tips & Best Practices

1. **Start Simple:** Begin with a 2-3 node workflow
2. **Test First:** Always use "Test Run" before activating
3. **Use Delays:** Add delays between actions to avoid overwhelming services
4. **Add Conditions:** Use conditions to create smart, adaptive workflows
5. **Name Clearly:** Give your workflows descriptive names
6. **Check Connections:** Ensure all nodes are properly connected

---

## 🐛 Troubleshooting

### Nodes won't connect?

- Make sure you're dragging from the **bottom** circle to the **top** circle
- Each node must have a valid connection path

### Can't see properties panel?

- Click on a node to select it
- The panel appears on the right side

### Workflow not saving?

- Check that all required fields are filled
- Look for validation errors in red

### Test run fails?

- Verify all node configurations
- Check that services are running (email, slack, etc.)

---

## 🎯 Quick Start Checklist

- [ ] Login to OfficeFlow (http://localhost:5173)
- [ ] Navigate to Workflows page
- [ ] Click "Create Workflow"
- [ ] Add a Trigger node
- [ ] Add an Email node
- [ ] Connect them
- [ ] Configure the Email parameters
- [ ] Save the workflow
- [ ] Click "Test Run"
- [ ] Activate when ready

---

## 🚀 Ready to Start?

**Try Example 1 first** - it's the simplest and will help you get familiar with the interface!

1. Go to http://localhost:5173
2. Login
3. Click "Create Workflow"
4. Follow Example 1 steps above
5. Experiment and have fun!

**Need help?** Check the UI for tooltips and validation messages.
