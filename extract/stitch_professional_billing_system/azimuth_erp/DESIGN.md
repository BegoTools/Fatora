---
name: Azimuth ERP
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#42474f'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#727780'
  outline-variant: '#c2c7d1'
  surface-tint: '#2d6197'
  primary: '#00355f'
  on-primary: '#ffffff'
  primary-container: '#0f4c81'
  on-primary-container: '#8ebdf9'
  inverse-primary: '#a0c9ff'
  secondary: '#006d37'
  on-secondary: '#ffffff'
  secondary-container: '#7bf8a1'
  on-secondary-container: '#007239'
  tertiary: '#003462'
  on-tertiary: '#ffffff'
  tertiary-container: '#004b89'
  on-tertiary-container: '#8cbcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d2e4ff'
  primary-fixed-dim: '#a0c9ff'
  on-primary-fixed: '#001c37'
  on-primary-fixed-variant: '#07497d'
  secondary-fixed: '#7efba4'
  secondary-fixed-dim: '#61de8a'
  on-secondary-fixed: '#00210c'
  on-secondary-fixed-variant: '#005228'
  tertiary-fixed: '#d4e3ff'
  tertiary-fixed-dim: '#a4c9ff'
  on-tertiary-fixed: '#001c39'
  on-tertiary-fixed-variant: '#004883'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  numeric-data:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 24px
  gutter: 16px
  table-cell-padding: 12px 16px
  section-gap: 32px
---

## Brand & Style

The design system is engineered for efficiency, reliability, and precision, catering specifically to the Middle Eastern pharmaceutical and retail sectors. The brand personality is **Professional, Technical, and Secure**, aiming to transform complex inventory and billing data into a streamlined, high-tech experience.

### Visual Style: High-Tech Corporate
The design utilizes a **Corporate Modern** aesthetic with subtle influences from **Minimalism**. 
- **Efficiency First:** Interfaces are designed to minimize cognitive load during high-speed data entry.
- **Precision:** Sharp, clear demarcations and consistent alignment reflect the accuracy required in financial and inventory management.
- **Cultural Context:** Native Right-to-Left (RTL) support is baked into the foundation, ensuring that the visual flow follows the natural reading direction of the Arabic script.

## Colors

The palette balances the deep, trustworthy blues of professional medicine with the energetic greens of successful commerce.

- **Primary (Midnight Navy):** Derived from the "AZ PHARM" heritage but shifted toward a modern, saturated navy to convey authority and stability. Used for headers, primary navigation, and key branding.
- **Secondary (Growth Green):** A vibrant, high-visibility green used for "Easy Store" touchpoints and positive financial actions (Save, Complete Payment, Add Stock).
- **Surface & Backgrounds:** We use a tiered neutral system (`#F8FAFC`, `#F1F5F9`) to separate sidebar navigation from the main workspace, reducing eye strain during long shifts.
- **Semantic Colors:** Critical for ERP safety—Red is strictly reserved for "Out of Stock" or "Overdue Payments," while Amber indicates "Low Stock" thresholds.

## Typography

The system utilizes **IBM Plex Sans Arabic** for its exceptional clarity and technical structure. It bridges the gap between traditional calligraphic roots and modern digital geometry.

- **Dual-Script Harmony:** While Arabic is the primary script, **Inter** is used for numerical data and SKU codes within tables to ensure maximum legibility and vertical alignment of figures.
- **Rhythm:** A strict typographic hierarchy ensures that total amounts and inventory counts are instantly scannable.
- **RTL Considerations:** Text alignment is consistently right-aligned for Arabic text, with careful attention to line heights to prevent descender clipping in high-density tables.

## Layout & Spacing

The layout utilizes a **Fixed-Fluid Hybrid** grid system optimized for wide-screen desktop monitors common in pharmacies and warehouses.

- **Main Navigation:** A persistent right-side sidebar (280px) for RTL flow.
- **Dashboard Grid:** A 12-column system. Cards typically span 3 columns for metrics or 6-12 columns for data tables.
- **Density:** High density is favored for inventory lists to minimize scrolling. Use the 4px base unit to maintain a tight but breathable "Work" rhythm.
- **Responsive Reflow:** On smaller screens (Tablets), the sidebar collapses into an icon-only rail to preserve horizontal space for wide data tables.

## Elevation & Depth

This design system uses **Tonal Layers** supplemented by **Ambient Shadows** to create a functional hierarchy without visual clutter.

- **Base Layer:** `#F1F5F9` (Light Gray) for the main application background.
- **Surface Layer:** White (`#FFFFFF`) for cards and table containers, using a very soft, diffused shadow (0px 4px 12px, 5% opacity) to lift content.
- **Interactive Layer:** Active states and dropdown menus use a slightly more pronounced shadow and a 1px border in the Primary color to denote focus.
- **Zero-Shadow Rule:** In high-density data tables, remove shadows entirely and use 1px dividers (`#E2E8F0`) to maintain a clean, flat aesthetic.

## Shapes

The shape language is **Rounded (8px base)**. This softens the technical nature of an ERP, making the software feel modern and approachable for daily users.

- **Primary Buttons & Inputs:** 8px (Soft Rounded).
- **Dashboard Cards:** 12px (Large Rounded) to create clear containment.
- **Status Badges/Chips:** Full pill-shaped (999px) to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Solid Primary Blue with white text. High-contrast.
- **Success:** Solid Secondary Green for "Finalize Invoice" or "Receive Stock."
- **Ghost:** Primary Blue border with no fill for secondary actions like "Cancel" or "Print Draft."

### Data Tables
- **Header:** Light gray background (`#F8FAFC`) with bold labels.
- **Zebra Striping:** Use very subtle `#F1F5F9` on even rows for row tracking.
- **Alignment:** Numbers (Price, Qty) are left-aligned (or right-aligned in LTR contexts) to ensure decimal points line up; text is right-aligned.

### Input Fields
- Outline style with a 1px border. On focus, the border thickens to 2px Primary Blue with a soft blue outer glow.
- **Validation:** Clear error states with the Status Red color for invalid SKU or quantity errors.

### Dashboard Cards
- Top-weighted headers.
- Large numerical indicators using the "Numeric-data" typography spec for instant recognition of "Today's Sales" or "Total Items."

### Iconography
- **Outline Style:** 2px stroke weight. 
- **Consistency:** Use the same icon library across the system (e.g., Lucide or Phosphor) to ensure a unified technical feel.