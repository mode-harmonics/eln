---
version: alpha
name: ELN
description: Dense battery laboratory notebook with workflow-led navigation and inspectable data tables.
colors:
  primary: "#f27429"
  primaryHover: "#d95f16"
  background: "#ffffff"
  subtle: "#f7f8fa"
  border: "#e5e7eb"
  text: "#1f2937"
typography:
  sans:
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif'
rounded:
  control: "0.375rem"
  surface: "0.5rem"
spacing:
  page-gap: "1rem"
components:
  button: {}
  table: {}
  dialog: {}
  drawer: {}
---

# ELN Design System

## Overview

### Creative North Star

A laboratory record sheet: process steps, material groups, battery identifiers and numerical evidence remain the visual hierarchy. Preserve the current product identity while repairing reliability and accessibility.

### Product context and register

Battery-laboratory researchers and administrators coordinate experiments, procurement and measurements. This is a product interface, not a marketing surface. English and Chinese are supported through `apps/frontend/src/i18n.ts`; locale alone does not establish a geographic market. Dense desktop tables are primary, with all actions reachable at narrow widths.

Runtime token ownership stays in `apps/frontend/src/index.css`; this document records its current values and does not generate CSS. Shared components under `apps/frontend/src/components` own behavior. Domain and authorization authority comes from current backend controllers/services and `packages/shared`; AGENTS.md warns that BACKEND_SPEC.md is historical.

## Colors

White data surfaces and pale gray navigation use orange for primary actions, active state and keyboard focus. Keep danger red, success green and warnings amber, with text labels in addition to color. Existing chart palettes encode groups; do not reinterpret chart color as mutation intent.

## Typography

Use existing Inter/system sans stack and browser locale-capable fallbacks. Tables currently use 11–13px headings/data; page titles use larger semibold text. Preserve precision of decimal strings. No new font downloads or ornamental display type.

## Layout

Keep Layout as the navigation shell and each table wrapper as horizontal scroll owner. Data-heavy lists need a content-width floor rather than collapsing columns at phone widths. Forms retain natural content height and modal bodies scroll internally. Do not apply table-specific fixed heights to sibling form panels.

## Elevation & Depth

Use borders for normal surfaces and shadows for existing menus/modals. Drawers portal to document.body, above application chrome. Feedback must not shift critical controls.

## Shapes

Controls use the 0.375rem radius token; surfaces use 0.5rem. Reuse Button, Modal, Drawer, TableWrapper and existing form fields. Avoid parallel component styling.

## Components

### Foundational visual states

Busy operations have visible progress and synchronous duplicate-submit guards. Failed reads are distinct from empty results and offer retry. A successful partial operation remains visible and retry resumes the unfinished step; never claim synchronized or submitted until those operations succeed.

### Buttons and actions

Retain existing Button emphasis variants. Icon-only actions require localized accessible names including the target object where useful. Delete remains separated from safe actions and uses the existing confirmation pattern.

### Navigation and data display

Resource changes reset route-scoped state. Native read-oriented tables remain semantic tables, with overflow available on narrow screens. Lab summaries do not silently convert failed measurements into zero rows.

### Forms and overlays

Use shared Modal/Drawer keyboard behavior: focus entry, Escape, focus containment/restoration and background isolation. Native select popup geometry is accepted for existing FormSelect and table editors; custom selectors remain existing maintained components. Do not add secrets or lab drafts to persistent browser storage. API authorization remains the security boundary.

### Iconography

Lucide line icons remain the sole interface icon family. Decorative icons do not replace action text or accessible names.

### Motion

Preserve restrained existing hover/focus transitions. No new decorative animation. Loading communicates actual pending work.

### Content and data visualization

Use concrete action verbs and domain terms. Report server failure at the relevant scope, preserve inputs and provide an explicit next action. Show unavailable/failed data separately from real empty results.

## Do's and Don'ts

- Do extend shared primitives and use runtime tokens.
- Do preserve partial-success identity when retrying multi-request operations.
- Do keep measurement tables readable through local horizontal scrolling.
- Don't introduce a rebrand, marketing layout, speculative units or new workflow policy.
- Don't use a successful toast to hide a failed required operation.

## Known follow-up boundaries

This records the existing design and current repairs, not complete WCAG certification. Whole-application unsaved-draft recovery and session-expiry recovery need a separate persistence/security design. Frontend workflow preflight does not replace server-side atomic transition checks.
