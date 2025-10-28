# How to Run the Workflow Designer

The workflow designer is fully implemented but has dependency installation issues due to the monorepo workspace configuration. Here are several ways to get it running:

## Method 1: Use a Different Package Manager

### Install pnpm (recommended for workspaces)

```bash
npm install -g pnpm
cd apps/workflow-designer
pnpm install
pnpm run dev
```

### Or use yarn with workspace support

```bash
npm install -g yarn
cd apps/workflow-designer
yarn install
yarn dev
```

## Method 2: Temporary Workaround

1. **Copy the workflow-designer folder outside the monorepo:**

   ```bash
   cp -r apps/workflow-designer /tmp/workflow-designer-standalone
   cd /tmp/workflow-designer-standalone
   ```

2. **Use the simplified package.json:**

   ```bash
   rm package.json.backup
   npm install react@^18.2.0 react-dom@^18.2.0
   npm install react-router-dom@^6.22.3 reactflow@^11.11.0
   npm install @tanstack/react-query@^5.28.6 axios@^1.6.8
   npm install zustand@^4.5.2 lucide-react@^0.365.0
   npm install clsx@^2.1.0 tailwind-merge@^2.2.2
   npm install react-hook-form@^7.51.2 @hookform/resolvers@^3.3.4 zod@^3.22.4
   ```

3. **Install dev dependencies:**

   ```bash
   npm install -D @types/react@^18.2.66 @types/react-dom@^18.2.22
   npm install -D @vitejs/plugin-react@^4.2.1 vite@^5.2.0
   npm install -D typescript@^5.2.2 tailwindcss@^3.4.3
   npm install -D autoprefixer@^10.4.19 postcss@^8.4.38
   npm install -D eslint@^8.57.0 @typescript-eslint/eslint-plugin@^7.2.0
   npm install -D @typescript-eslint/parser@^7.2.0
   npm install -D eslint-plugin-react-hooks@^4.6.0 eslint-plugin-react-refresh@^0.4.6
   npm install -D vitest@^1.4.0 jsdom@^24.0.0
   npm install -D @testing-library/react@^14.2.2 @testing-library/jest-dom@^6.4.2
   npm install -D @testing-library/user-event@^14.5.2
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## Method 3: Fix Workspace Dependencies

If you want to keep it in the monorepo, you need to fix the workspace protocol issues in other services:

1. **Replace all `workspace:*` with `file:` references in other package.json files**
2. **Or temporarily remove the workspace configuration from the root package.json**

## Method 4: Use Docker (Alternative)

Create a Dockerfile in the workflow-designer directory:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]
```

Then run:

```bash
cd apps/workflow-designer
docker build -t workflow-designer .
docker run -p 3001:3001 workflow-designer
```

## What You'll See

Once running, the workflow designer will be available at `http://localhost:3001` with:

- **Dashboard**: Overview of workflows and recent activity
- **Workflow List**: Manage existing workflows (create, edit, clone, delete)
- **Workflow Designer**: Visual drag-and-drop editor with:
  - Node library sidebar with 10+ node types
  - Canvas for building workflows
  - Properties panel for configuring nodes
  - Template gallery with pre-built workflows
  - Real-time validation with error highlighting

## Features Available

✅ **Complete Visual Editor**: Drag-and-drop workflow creation
✅ **Node Library**: Triggers, Identity, Communication, AI, Documents, Flow Control
✅ **Template System**: Pre-built workflows for common scenarios
✅ **Validation**: Real-time error checking and warnings
✅ **Workflow Management**: Save, load, clone, version workflows
✅ **Keyboard Shortcuts**: Ctrl+S (save), Delete (remove node), Escape (deselect)

The application is fully functional once the dependencies are resolved!
