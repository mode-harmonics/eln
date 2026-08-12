# Cell Picker Frozen ID Column Implementation Plan

**Goal:** Keep the battery ID column fixed while horizontally scrolling the cell-picker table.

- [ ] Replace collapsed table borders with `border-separate border-spacing-0`.
- [ ] Give the ID header and cells explicit sticky positioning, left offset, opaque background, elevated stacking order, and edge shadow.
- [ ] Run frontend TypeScript checking and production build.
- [ ] Run `git diff --check` and inspect the focused diff.
