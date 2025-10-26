#!/bin/bash

echo "Installing OfficeFlow Workflow Designer dependencies..."

# Install core React dependencies
npm install react@^18.2.0 react-dom@^18.2.0 --save

# Install routing and state management
npm install react-router-dom@^6.22.3 zustand@^4.5.2 --save

# Install React Flow
npm install reactflow@^11.11.0 --save

# Install API and data fetching
npm install @tanstack/react-query@^5.28.6 axios@^1.6.8 --save

# Install form handling
npm install react-hook-form@^7.51.2 @hookform/resolvers@^3.3.4 zod@^3.22.4 --save

# Install UI libraries
npm install lucide-react@^0.365.0 clsx@^2.1.0 tailwind-merge@^2.2.2 --save

# Install dev dependencies
npm install @types/react@^18.2.66 @types/react-dom@^18.2.22 --save-dev
npm install @vitejs/plugin-react@^4.2.1 vite@^5.2.0 --save-dev
npm install typescript@^5.2.2 --save-dev
npm install tailwindcss@^3.4.3 autoprefixer@^10.4.19 postcss@^8.4.38 --save-dev
npm install eslint@^8.57.0 @typescript-eslint/eslint-plugin@^7.2.0 @typescript-eslint/parser@^7.2.0 --save-dev
npm install eslint-plugin-react-hooks@^4.6.0 eslint-plugin-react-refresh@^0.4.6 --save-dev
npm install vitest@^1.4.0 jsdom@^24.0.0 --save-dev
npm install @testing-library/react@^14.2.2 @testing-library/jest-dom@^6.4.2 @testing-library/user-event@^14.5.2 --save-dev

echo "Dependencies installed successfully!"
echo "You can now run: npm run dev"