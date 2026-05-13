# Architecture Guide

The application uses a **Multi-Portal Architecture**.

## Portals
A portal represents a distinct user group (Patient, Doctor, Admin, etc.).
Each portal is isolated using Next.js **Route Groups**.

### Existing Portals
- `(patient)` - End users booking appointments.

### Directory Structure per Portal
When adding a new portal, create the corresponding directories:
1. `src/app/({portal})/`
2. `src/components/features/{portal}/`
3. `src/types/{portal}/`
4. `src/hooks/{portal}/`
5. `src/stores/{portal}/`

## State Management
We use **Zustand**. Create slice-based stores for each portal. Avoid massive global stores.

## Authentication
We use **Clerk**.
- Auth layout and pages are in `src/app/(auth)/`.
- Protect routes in `src/middleware.ts`.
