# DropLog Design Guide

## Design Tokens

### Spacing (`--sp-*`)
- `--sp-1`: 4px | `--sp-2`: 8px | `--sp-3`: 12px | `--sp-4`: 16px | `--sp-5`: 24px | `--sp-6`: 32px

### Text Sizes (`--text-*`)
- `--text-caption`: 11px | `--text-body`: 13px | `--text-label`: 12px | `--text-base`: 14px | `--text-heading`: 16px | `--text-display`: 20px | `--text-stat`: 28px

## Aesthetic Principles

### 1. Monotone First, Color as Signal
Icons, borders, and decorative elements default to neutral grays (`--gray-100` through `--gray-500`). Color is reserved for semantic meaning — green for success/delivered, blue for info/transit, red for errors, yellow for warnings/pending. Never use color purely for decoration.

### 2. Consistent Input & Button Heights
All interactive form elements should share the same visual height (~38px). Inputs use `padding: 9px 12px` with `border: 1.5px`. Buttons use `padding: 13px 14px` with `line-height: 1` and no border to compensate. This ensures form rows look balanced.

### 3. Clean Table Layout
- `width: 100%` tables with `border-collapse: collapse`
- Header cells (`<th>`): uppercase, 10px, 700 weight, letter-spacing, gray-500, bottom border only
- Body rows (`<td>`): bottom border only on non-last rows (`tr:last-child td { border-bottom: none }`)
- Hover highlight on rows

### 4. Spacing Rhythm
- Section gaps use `var(--sp-*)` consistently
- Cards: 28px padding, 20px margin-bottom
- Content area: 32px padding, 1280px max-width
- Stats row: 20px gap, 32px margin-bottom

### 5. Card Design
- White background, `--gray-200` border (1-1.5px), `--radius` border-radius (6-8px)
- Subtle hover states: border-color darkens, optional lift (scale/box-shadow)
- Consistent inner padding across all cards

### 6. Button Hierarchy
- **Primary**: `--syn-green` background, white text, no border
- **Danger**: white background, `--red` border + text
- **Small**: 13px padding vertical, 12px font, 600 weight, same height as inputs
- All buttons: `border-radius: 6px`, `transition: background 0.15s`

### 7. Form-Inline Layout
- `display: flex; gap: var(--sp-2); flex-wrap: wrap; align-items: flex-end`
- Name-type fields: `input-flex` (flex: 1, min 140px)
- Phone fields: `input-lg` (130px) — consistent across all tabs
- Short codes (PIN, BP ID): `input-sm` (80px) or `input-md` (110px)

### 8. Responsive Breakpoints
- **768px**: 2-column stats, stacked form-inline, grid nav tabs (3 cols)
- **480px**: single column stats, full-width inputs, stacked nav (2 cols)

### 9. Theme Toggle
- Sliding switch with sun/moon icons, `cubic-bezier(0.34,1.56,0.64,1)` bounce
- All themed elements transition with `0.35s ease`

### 10. Status Pill Patterns
- Completed: `--syn-green-light` bg, `--syn-green-dark` text/border
- Pending: `--transit-yellow-light` bg, `--transit-yellow` text/border
- Failed: `--red-light` bg, `--red` text/border
- Inactive: `--gray-100` bg, `--gray-500` text/border

### 11. Empty States
- Centered text, `--gray-500`, 14px, with `.hidden` class for visibility toggle
- Icon optional, text is sufficient

### 12. Upload Areas
- Dashed border (`2px dashed var(--gray-300)`), centered text
- Drag-over state: solid border, background color
- Hover: border-color changes to blue, subtle background tint

### 13. Focus States
- All inputs: `border-color: var(--syn-blue)` on focus
- Optional `box-shadow` ring for elevation (login inputs)

### 14. Utility Classes
- `.hidden`: `display: none !important`
- `.float-right`: `float: right`
- `.mono-text`: monospace font for codes/PINs
- `.mb-2/3/4`: margin-bottom using `--sp-*` scale
- `.display-none`: `display: none` (no important)
