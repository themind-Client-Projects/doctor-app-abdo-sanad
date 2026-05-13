# Audit Rules

1. **No Duplicate Types**:
   - All types must be declared in `src/types/{portal}/`.
   - Use barrel exports (`index.ts`) for clean imports.

2. **No Duplicate Logic**:
   - Shared utilities go in `src/lib/utils/`.
   - Feature-specific hooks go in `src/hooks/{portal}/`.

3. **No Duplicate State**:
   - Global state is managed via Zustand in `src/stores/{portal}/`.
   - UI state (like open/close status of sidebars) goes in `src/stores/shared/ui.store.ts`.

4. **Component Isolation**:
   - Feature components must not import from other portals.
   - Use `src/components/shared/` for cross-portal components.

5. **Strict TypeScript**:
   - **No `any` types allowed**.
   - Interfaces should be used for objects, Types for unions/intersections.

6. **RTL & Localization**:
   - The app is strictly Right-To-Left (RTL) and Arabic.
   - Use logical properties for styling (e.g., `ms-*` instead of `ml-*`, `pe-*` instead of `pr-*`).
   - All text must be in Arabic or localized.

7. **UI/UX Aesthetics**:
   - Premium feel with subtle micro-animations (Tailwind `animate-*`).
   - Clean architecture, no inline styles. All styles via Tailwind CSS.
