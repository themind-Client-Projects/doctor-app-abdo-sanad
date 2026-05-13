# Portal Creation Guide

Follow these steps to add a new portal (e.g., `doctor`):

1. **Scaffold Route Group**:
   Create `src/app/(doctor)/layout.tsx` and `src/app/(doctor)/dashboard/page.tsx`.

2. **Scaffold Directories**:
   Create `src/components/features/doctor/`.
   Create `src/types/doctor/`.
   Create `src/hooks/doctor/`.
   Create `src/stores/doctor/`.

3. **Update Navigation Config**:
   Add the portal routes to `src/lib/constants/navigation.ts` to manage sidebar/bottom nav links.

4. **Update Middleware**:
   Ensure `src/middleware.ts` handles the new route group properly (e.g., checking for the 'doctor' role).
