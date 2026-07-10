---
version: alpha
name: Droplog Logistics Cockpit
description: Premium distributor-facing portal for Syngenta Bangladesh's route delivery tracking system
colors:
  primary: "#007A3D"
  secondary: "#0065A8"
  tertiary: "#7AC143"
  neutral: "#F4F9F2"
  surface: "#FFFFFF"
  on-surface: "#163226"
  surface-variant: "#EAF7E8"
  on-surface-variant: "#5A7168"
  outline: "rgba(4,57,39,0.08)"
  outline-variant: "rgba(4,57,39,0.14)"
  green-deep: "#043927"
  green-leaf: "#7AC143"
  green-soft: "#EAF7E8"
  green-hl: "#DDF3C2"
  blue-track: "#0065A8"
  blue-live: "#2CB5E8"
  amber-warn: "#F5B335"
  red-exception: "#D94A38"
  purple-escalate: "#6E3FA3"
  glass-bg: "rgba(255,255,255,0.78)"
  glass-border: "rgba(255,255,255,0.25)"
  glass-shadow: "0 18px 55px rgba(0,57,32,0.18)"
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 67.2px
    fontWeight: 900
    lineHeight: 0.94
    letterSpacing: -0.06em
  display-lg:
    fontFamily: Inter
    fontSize: 28.8px
    fontWeight: 900
    lineHeight: 1
    letterSpacing: -0.04em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: -0.035em
  body-lg:
    fontFamily: Inter
    fontSize: 18.4px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Inter
    fontSize: 14.72px
    fontWeight: 600
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 12.48px
    fontWeight: 400
    lineHeight: 1.5
  label-lg:
    fontFamily: Inter
    fontSize: 13.12px
    fontWeight: 800
    lineHeight: 1
    letterSpacing: 0.5px
  label-md:
    fontFamily: Inter
    fontSize: 11.52px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.3px
  label-sm:
    fontFamily: Inter
    fontSize: 10.88px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.2px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.4px
  metric-display:
    fontFamily: Inter
    fontSize: 25.6px
    fontWeight: 900
    lineHeight: 1
    letterSpacing: -0.04em
  kpi-number:
    fontFamily: Inter
    fontSize: 25.6px
    fontWeight: 900
    lineHeight: 1
    letterSpacing: -0.04em
  kpi-label:
    fontFamily: Inter
    fontSize: 11.2px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.4px
  bengali-body:
    fontFamily: Noto Sans Bengali
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: 10px
  md: 18px
  lg: 28px
  xl: 32px
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 10px
  md: 16px
  lg: 24px
  xl: 40px
  gap-sm: 8px
  gap-md: 16px
  gap-lg: 28px
  container-max: 1180px
  container-padding: 20px
  glass-padding: 20px
components:
  button-primary:
    backgroundColor: "{colors.green-deep}"
    textColor: "#FFFFFF"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: 14px 22px
    size: 14px 22px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    boxShadow: "0 12px 28px rgba(4,57,39,0.2)"
  button-ghost:
    backgroundColor: "rgba(4,57,39,0.06)"
    textColor: "{colors.green-deep}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: 14px 22px
    border: "1px solid rgba(4,57,39,0.12)"
  glass-card:
    backgroundColor: "{colors.glass-bg}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.glass-padding}"
    border: "1px solid {colors.glass-border}"
    boxShadow: "{colors.glass-shadow}"
    backdropFilter: "blur(20px)"
  glass-card-title:
    backgroundColor: "rgba(4,57,39,0.03)"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-lg}"
    padding: 14px 18px
    borderBottom: "1px solid rgba(4,57,39,0.06)"
  snap-card-primary:
    backgroundColor: "{colors.green-deep}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: 20px
    boxShadow: "0 14px 35px rgba(4,57,39,0.2)"
  snap-card-exception:
    backgroundColor: "#fff7ed"
    textColor: "{colors.amber-warn}"
    rounded: "{rounded.lg}"
    padding: 20px
    border: "1px solid rgba(245,179,53,0.2)"
  snap-card-glass:
    backgroundColor: "rgba(255,255,255,0.85)"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 20px
    border: "1px solid rgba(255,255,255,0.5)"
    backdropFilter: "blur(12px)"
    boxShadow: "0 10px 30px rgba(4,57,39,0.06)"
  snap-card-cutoff:
    backgroundColor: "{colors.green-deep}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: 20px
  status-chip-live:
    backgroundColor: "rgba(122,193,67,0.15)"
    textColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px 12px
  status-chip-transit:
    backgroundColor: "rgba(0,101,168,0.12)"
    textColor: "{colors.blue-track}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px 12px
  status-chip-delayed:
    backgroundColor: "rgba(245,179,53,0.15)"
    textColor: "#8a5a00"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px 12px
  status-chip-done:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px 12px
  status-chip-fail:
    backgroundColor: "rgba(217,74,56,0.1)"
    textColor: "{colors.red-exception}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px 12px
  dispatch-card:
    backgroundColor: "rgba(255,255,255,0.88)"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 16px 20px
    border: "1px solid rgba(4,57,39,0.07)"
    boxShadow: "0 4px 16px rgba(4,57,39,0.04)"
  bottom-nav:
    backgroundColor: "rgba(255,255,255,0.92)"
    textColor: "rgba(4,57,39,0.35)"
    rounded: "{rounded.lg}"
    border: "1px solid rgba(4,57,39,0.08)"
    boxShadow: "0 18px 45px rgba(4,57,39,0.15)"
    backdropFilter: "blur(24px)"
  bottom-nav-active:
    backgroundColor: "{colors.green-deep}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
  bottom-nav-center:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    boxShadow: "0 10px 25px rgba(0,122,61,0.25)"
  float-chip:
    backgroundColor: "rgba(255,255,255,0.95)"
    textColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 8px 14px
    border: "1px solid rgba(4,57,39,0.1)"
    boxShadow: "0 8px 25px rgba(4,57,39,0.12)"
  bp-modal:
    backgroundColor: "rgba(255,255,255,0.95)"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.xl}"
    padding: 40px 32px
    border: "1px solid {colors.glass-border}"
    boxShadow: "0 30px 70px rgba(4,57,39,0.25)"
  map-container:
    rounded: "{rounded.lg}"
    border: "1px solid rgba(4,57,39,0.08)"
    boxShadow: "0 10px 30px rgba(4,57,39,0.06)"
  exception-item:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 14px
    border: "1px solid rgba(4,57,39,0.06)"
  pod-item:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 14px
    border: "1px solid rgba(4,57,39,0.06)"
  pod-item-done:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 14px
    border: "1px solid rgba(4,57,39,0.06)"
---

## Brand & Style

The Droplog Logistics Cockpit evokes the authority of industrial agriculture and the precision of real-time logistics. The brand personality is trustworthy, urgent, and field-proven — a premium digital operations center for Syngenta Bangladesh's distributor network.

The style is **Glass Logistics Cockpit**: dark green anchors convey agricultural heritage and reliability, while glassmorphism panels and floating chips create a modern, data-dense command-center feel. The UI should feel like standing inside a field ops tent with live data streams — rugged yet refined.

## Colors

The palette is rooted in Syngenta's agricultural green heritage, extended with logistics-oriented accent colors for status signaling.

- **Green Deep (#043927):** Primary brand anchor — used for hero backgrounds, primary CTAs, bottom nav active state, and cut-off cards. Convey stability, growth, and agricultural roots.
- **Primary Green (#007A3D):** Main action color — used for buttons, interactive highlights, KPI values, and the center navigation icon. Syngenta's core brand green.
- **Green Leaf (#7AC143):** Success and positive status — used for POD confirmed counts, progress bar fills, and "live" status chips. Signals completion and health.
- **Green Soft (#EAF7E8):** Subtle success surfaces — used for completed POD items, section badges, and as a whisper background tint.
- **Blue Track (#0065A8):** In-transit and movement indicators — used for "in transit" KPIs, status chips, and route tracking elements. Conveys motion and logistics.
- **Amber Warn (#F5B335):** Attention-required states — used for delay chips, exception snap cards, and warning badges. Signals caution without alarm.
- **Red Exception (#D94A38):** Critical issues — used for priority problems, error messages, and failure status chips.
- **Purple Escalate (#6E3FA3):** Premium accent — used for POD review items and the help FAB. Adds a layer of sophistication.
- **Ink (#163226):** Primary text color. A very dark green-black for maximum readability.
- **Muted (#5A7168):** Secondary text and metadata. A desaturated mid-green for labels and captions.

## Typography

The typography strategy uses **Inter** for its neutral, highly legible geometry in a data-dense interface, with **Noto Sans Bengali** for Bengali locale support.

- **Display XL (900, 67.2px):** Hero cockpit headline — commanding, single-line impact. Tight letter spacing (-0.06em) and near-unit line height (0.94) for a bold, modern look.
- **Display LG (900, 28.8px):** Large KPI numbers and metric displays. Dense and confident.
- **Headline MD (800, 20px):** Section titles in the snapshot and dispatch board.
- **Body LG (400, 18.4px):** Hero subtitle and descriptive copy. Generous line height (1.6) for readability.
- **Body MD (600, 14.72px):** Route names, dispatch info, and item text. Semi-bold for legibility on glass surfaces.
- **Label LG (800, 13.12px):** Primary button text and uppercase glass panel headers.
- **Label MD (700, 11.52px):** Status chips, KPI labels, snapshot labels. Tight and precise.
- **Label SM (700, 10.88px):** Bottom nav labels, small badges, exception badges.
- **Metric Display (900, 25.6px):** Inline numbers within KPIs and snap cards.
- **Bengali Body:** For any Bengali text, use Noto Sans Bengali with matching metrics.

## Layout & Spacing

The layout follows a **Fluid Max-Width Grid** with a maximum container width of 1180px. The design is mobile-first with breakpoints at 940px and 640px.

- **Rhythm:** An 8px base grid governs all dimensions. Gap sizes use 8px/16px/28px scales.
- **Hero Cockpit:** Two-column split layout on desktop (1.1fr : 0.9fr). Left column carries headline and KPIs; right column carries the glass status panel with floating position chips.
- **Snapshot Grid:** Four-column asymmetrical grid (1.4fr : 0.8fr : 0.9fr : 0.9fr) on desktop; collapses to 2-col then 1-col on mobile.
- **Bottom Grid:** Two-column equal split for exceptions and POD checklist on desktop; stacks on mobile.
- **Dispatch Board:** Single-column stacked card layout, each card is a 4-column grid (status dot : info : ETA : status badge).
- **Bottom Nav:** Fixed at bottom center, max-width 600px, 5 equal columns, elevated center action that breaks the grid.
- **Containers:** Cards use generous internal padding (14-20px) and rounded corners (18-32px) to feel substantial and premium.

## Elevation & Depth

Depth is achieved through **Glassmorphism** layers and tonal contrast rather than heavy shadows.

- **Background Layer:** Soft radial gradients — green tint at top-left, blue tint at bottom-right — creating a subtle atmospheric depth without distracting.
- **Glass Layer (standard):** `backdrop-filter: blur(20px)`, white background at 78-92% opacity, 1px semi-transparent white border, soft shadow (`0 18px 55px rgba(0,57,32,0.18)`).
- **Elevated Elements (modals, FAB):** Higher blur (24-40px), higher opacity, larger shadows.
- **Interactive Lift:** Cards and buttons lift 1-2px on hover with increased shadow spread. Transition: 0.15s ease.
- **Floating Chips:** Absolute-positioned chips with 95% opacity, 12px blur, and colored dot indicators. Animated in with slight upward bounce (0.5s ease).
- **Snap Cards:** Use gradient backgrounds (deep green, amber tinted, glass, dark green) to create visual hierarchy without relying on shadows.

## Shapes

The shape language is defined by **Substantial Rounded** corners that feel modern and approachable while maintaining industrial precision.

- **Cards (lg: 28px):** Used for snapshot grid cards, exception and POD panels.
- **Cards (md: 18px):** Used for dispatch cards, KPI cards, and glass panel body.
- **Cards (sm: 10px):** Used for exception items, POD items, and internal containers.
- **Buttons (md: 18px):** Slightly smaller than cards to differentiate interaction surface. Elevated center nav button uses md.
- **Chips (full: 9999px):** Pill-shaped status chips and floating chips.
- **Bottom Nav (lg: 24px):** Matches the card rounding for visual harmony.
- **Topbar:** No border-radius at top — sticks to viewport edge.
- **Modal (xl: 32px):** BP ID entry modal uses the largest radius to feel premium.

## Components

### Glass Panel (Hero)

The hero right-side panel is the centerpiece. It features a macOS-style traffic light header (three dots: red, amber, green) with a "LIVE" label. Inside: route code headline, status chip, timeline with progress bar, and meta info (vehicle, driver, ETA). Floating chips orbit the panel at absolute positions (transit, eta, pod, delay).

### Status Chips

Six variants map to route/delivery states: Live (green on light green), Transit (blue on light blue), Delayed (amber on light amber), Done (green on soft green), Fail (red on light red), Action (red on light red for needed attention). All use `rounded.full`, small padding (6px 12px), bold label-sm text.

### Dispatch Cards

Each card in the dispatch board follows a strict 4-column grid: colored left dot (route-specific), info column (route code + name + stops), ETA column (time + label), status badge. On mobile, the ETA column hides.

### Bottom Navigation

Five items spanning full width. The center item breaks out vertically (-16px margin-top, 50×50px) with a green gradient background and shadow, serving as the primary POD action. Active items use a deep green gradient background. Inactive items are muted with hover-to-green.

### BP ID Modal

Full-screen overlay with backdrop blur (8px) and dark green tint. The modal card is centered with a brand icon diamond (green gradient, 56×56px), headline, description, input field with inline submit button, and hint text. Opens with a smooth upward animation (0.4s ease).

### Exception & POD Panels

Side-by-side on desktop, stacked on mobile. Exception items show a colored icon, description, timestamp, and severity badge. POD checklist items show a checked/unchecked circle, store name, and completion status. Completed items get a green soft background.

### Map Container

Leaflet map with 380px height (260px on mobile) inside a rounded-lg container border. Map should show circle markers for stop locations and polylines for route paths, with fitBounds to show all stops.

### Toast Notifications

Fixed position at top-center. Four variants: default (dark ink), error (red), warning (amber), success (green). Slide-down entrance animation.

## Do's and Don'ts

- Do use the deep green (#043927) as the primary visual anchor — it's the brand's agricultural foundation
- Do use glassmorphism for secondary content panels to maintain hierarchy with the green hero areas
- Don't use the green leaf (#7AC143) for text — it's reserved for backgrounds, progress bars, and icons
- Don't use more than two fonts (Inter + Noto Sans Bengali) on any screen
- Do maintain WCAG AA contrast ratios — all interactive text on colored backgrounds must pass 4.5:1
- Do use the amber warn (#F5B335) sparingly — it should only appear when action is actually required
- Don't place floating chips on mobile viewports (hide them below 640px)
- Do animate micro-interactions (hover lift, chip entrance, KPI count-up, progress bar fill) but keep them under 0.5s
- Don't use solid borders on glass panels — use the subtle white glass-border instead
- Do wrap text labels in uppercase with generous letter spacing for status indicators and metadata
- Don't center-align body text — keep it left-aligned for scanability in data-dense layouts
- Do pulse the active route marker in the glass timeline to indicate live tracking
- Don't use the purple escalate (#6E3FA3) for anything other than the help FAB and POD review section
