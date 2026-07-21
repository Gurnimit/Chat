# TECHNICAL_DEBT.md

## Critical Debt

### 1. God Component (ChatDashboard.tsx)
- **File**: `client/src/pages/ChatDashboard.tsx` (~2000+ lines)
- **Issue**: Single component manages ALL application state, ALL socket listeners, ALL API calls
- **Debt**: Should be decomposed into domain-specific components with proper state management
- **Priority**: Critical — blocks maintainability and testing

### 2. No State Management Library
- **Issue**: All state lives in ChatDashboard via useState hooks, drilled through 60+ props
- **Debt**: Should use Redux, Zustand, or similar for global state
- **Priority**: Critical — causes cascading re-renders and prop drilling nightmares

### 3. No Test Suite
- **Issue**: Zero unit, integration, or E2E tests despite Playwright being in devDependencies
- **Debt**: Should have at minimum integration tests for auth, messaging, and calling flows
- **Priority**: Critical — no safety net for changes

### 4. No TypeScript Strict Mode on Client
- **File**: `client/tsconfig.json`
- **Issue**: `noUnusedLocals: false`, `noUnusedParameters: false`
- **Debt**: Should enable strict checks
- **Priority**: High

## High Debt

### 5. Duplicate Read Receipt System
- **Issue**: Both `MessageRead` and `MessageStatus` tables track the same concept
- **Debt**: Consolidate into single table
- **Priority**: High — data inconsistency risk

### 6. No Error Boundaries
- **Issue**: No React Error Boundary anywhere in the component tree
- **Debt**: Should wrap major layout sections with error boundaries
- **Priority**: High — unhandled errors crash entire app

### 7. Massive Prop Drilling
- **File**: `MobileDashboard.tsx` — 60+ props
- **Issue**: All state passed as props from ChatDashboard through MobileDashboard to children
- **Debt**: Should use context or state management library
- **Priority**: High — fragile, hard to refactor

### 8. In-Memory State for Critical Features
- **Issue**: Rate limiters, active calls, presence updates all in-memory
- **Debt**: Should use Redis or database-backed state for production
- **Priority**: High — data loss on restart

### 9. No CI/CD Pipeline
- **Issue**: No GitHub Actions, no automated testing, no deployment automation
- **Debt**: Should add basic CI with lint, type-check, and test
- **Priority**: High

### 10. Hardcoded Configuration
- **Issue**: Magic numbers scattered throughout (rate limits, timeouts, sizes)
- **Debt**: Should centralize configuration
- **Priority**: Medium

## Medium Debt

### 11. No ESLint Configuration
- **Issue**: ESLint referenced in package.json scripts but no config file exists
- **Debt**: Should configure and enforce linting
- **Priority**: Medium

### 12. No Prettier Configuration
- **Issue**: No code formatting standard
- **Debt**: Should add Prettier with consistent config
- **Priority**: Medium

### 13. Inline Styles Predominate in Login.tsx
- **File**: `client/src/pages/Login.tsx`
- **Issue**: Most styling done via inline `style={}` objects instead of Tailwind classes
- **Debt**: Should convert to Tailwind for consistency
- **Priority**: Medium

### 14. Console.log Statements Everywhere
- **Issue**: Extensive `console.log`, `console.error`, `console.warn` throughout production code
- **Debt**: Should use structured logger (server has one, client doesn't)
- **Priority**: Medium

### 15. No Code Splitting
- **Issue**: Single bundle for entire application
- **Debt**: Should use React.lazy for route-based code splitting
- **Priority**: Medium — impacts initial load time

### 16. Firebase Service Account in Repo
- **File**: `firebase/service-account.json`
- **Issue**: Sensitive credentials committed to repository
- **Debt**: Should use environment variables or secrets management
- **Priority**: Medium (security)

### 17. No Database Indexing Strategy
- **Issue**: Only unique constraints, no performance indexes on frequently queried columns
- **Debt**: Should add indexes on chatId, senderId, createdAt for messages
- **Priority**: Medium — will matter at scale

### 18. Missing Prisma Migrations for Later Schema Changes
- **Issue**: Only 2 migrations exist but schema has many more fields (publicId, call-related, notification preferences)
- **Debt**: Schema drifted from migrations, using `prisma db push` instead of proper migrations
- **Priority**: Medium
