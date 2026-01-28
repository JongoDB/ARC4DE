# UI Overhaul Design Document

## Overview

Complete visual overhaul of ARC4DE's UI to achieve a Discord/Slack-inspired dark theme with proper visual weight, generous spacing, and mobile-friendly touch targets.

## Problems with Current UI

1. **No visual containment** - Content runs edge-to-edge with minimal padding
2. **Invisible cards** - Borders blend into background, no visual separation
3. **Tiny touch targets** - Buttons and nav items too small for comfortable mobile use
4. **Cramped mobile layout** - Bottom nav too short, everything feels squeezed
5. **Poor contrast** - Text colors too muted, cards indistinguishable from background

## Design Direction

**Style:** Discord/Slack - dense but readable, strong visual weight, obvious interactive elements

## Color Palette (Discord-Inspired)

```css
:root {
  /* Backgrounds - more contrast between layers */
  --color-bg-primary: #0a0e17;      /* Page background - darkest */
  --color-bg-secondary: #1a1d24;    /* Sidebar, secondary areas */
  --color-bg-tertiary: #2b2d31;     /* Cards, elevated surfaces */
  --color-bg-elevated: #32353b;     /* Hover states, inputs */

  /* Borders - actually visible */
  --color-border: #3f4147;
  --color-border-hover: #4f545c;

  /* Text - better contrast */
  --color-text-primary: #f2f3f5;
  --color-text-secondary: #b5bac1;
  --color-text-muted: #80848e;

  /* Accent - keep blue but ensure visibility */
  --color-accent: #5865f2;          /* Discord blurple */
  --color-accent-hover: #4752c4;
  --color-accent-muted: rgba(88, 101, 242, 0.2);

  /* Status */
  --color-success: #23a559;
  --color-warning: #f0b232;
  --color-error: #da373c;
}
```

## Layout Specifications

### Desktop (1200px+)

```
┌──────────────────────────────────────────────────────────────┐
│ ┌─────────────┐ ┌──────────────────────────────────────────┐ │
│ │             │ │                                          │ │
│ │   SIDEBAR   │ │              CONTENT AREA                │ │
│ │   240px     │ │         max-width: 800px                 │ │
│ │             │ │         padding: 32px                    │ │
│ │  Nav items  │ │         centered                         │ │
│ │  48px tall  │ │                                          │ │
│ │  full width │ │                                          │ │
│ │             │ │                                          │ │
│ └─────────────┘ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- **Sidebar**: 240px wide, bg-secondary, 1px right border
- **Nav items**: 48px tall, 12px horizontal padding, 8px gap between items
- **Active state**: bg-tertiary background, accent-colored left border (3px)
- **Content**: max-width 800px, 32px padding, centered in remaining space

### Tablet (768px - 1199px)

```
┌────────────────────────────────────────────┐
│ ┌──────┐ ┌───────────────────────────────┐ │
│ │      │ │                               │ │
│ │ 72px │ │        CONTENT AREA           │ │
│ │icons │ │        padding: 24px          │ │
│ │only  │ │                               │ │
│ │      │ │                               │ │
│ └──────┘ └───────────────────────────────┘ │
└────────────────────────────────────────────┘
```

- **Sidebar**: 72px wide, icons only (24px icons), tooltip on hover
- **Nav items**: 56px tall, centered icons
- **Content**: Full remaining width, 24px padding

### Mobile (<768px)

```
┌─────────────────────────────┐
│         HEADER              │
│         56px tall           │
├─────────────────────────────┤
│                             │
│       CONTENT AREA          │
│       padding: 16px         │
│       full-width cards      │
│                             │
│                             │
├─────────────────────────────┤
│        BOTTOM NAV           │
│        72px tall            │
│   ┌─────┐ ┌─────┐ ┌─────┐  │
│   │     │ │     │ │     │  │
│   │ 24px│ │icons│ │     │  │
│   └─────┘ └─────┘ └─────┘  │
│      + safe area padding    │
└─────────────────────────────┘
```

- **Header**: 56px, logo centered or left
- **Bottom nav**: 72px + safe area, 24px icons, labels below
- **Active state**: Pill background behind active item
- **Content**: 16px horizontal padding, cards go nearly edge-to-edge

## Component Specifications

### Cards

```
┌─────────────────────────────────────────────┐
│                                             │
│  ┌────┐                                     │
│  │icon│  Title Text (text-lg, semibold)     │
│  │48px│  Subtitle (text-sm, secondary)      │
│  └────┘                                     │
│                                             │
└─────────────────────────────────────────────┘

Background: var(--color-bg-tertiary)
Border: 1px solid var(--color-border)
Border-radius: 12px
Padding: 20px
Hover: border-color -> var(--color-border-hover)
       background -> slightly lighter
```

### Buttons

**Primary Button:**
```
Height: 44px minimum
Padding: 12px 24px
Font: 15px, font-medium
Background: var(--color-accent)
Border-radius: 8px
Hover: var(--color-accent-hover)
```

**Secondary Button:**
```
Height: 44px minimum
Padding: 12px 24px
Font: 15px, font-medium
Background: transparent
Border: 1px solid var(--color-border)
Border-radius: 8px
Hover: background var(--color-bg-elevated)
```

**Icon Button:**
```
Size: 40x40px minimum
Border-radius: 8px
Background: transparent
Hover: var(--color-bg-elevated)
```

### Form Inputs

```
Height: 48px
Padding: 12px 16px
Font: 16px (prevents iOS zoom)
Background: var(--color-bg-elevated)
Border: 1px solid var(--color-border)
Border-radius: 8px
Focus: border-color var(--color-accent),
       ring 2px var(--color-accent-muted)
```

### Navigation Items

**Desktop sidebar:**
```
Height: 48px
Padding: 12px 16px
Border-radius: 8px
Gap between icon and text: 12px
Icon size: 20px

Default: text-secondary
Hover: bg-elevated, text-primary
Active: bg-tertiary, text-primary, 3px left border accent
```

**Mobile bottom nav:**
```
Item height: 72px (plus safe area)
Icon size: 24px
Label: 11px, medium weight
Gap between icon and label: 4px

Default: text-muted
Active: text-primary, pill background (accent-muted)
```

## Files to Modify

### Styles
- `frontend/src/styles/global.css` - Updated color variables

### Layouts
- `frontend/src/layouts/DesktopLayout.tsx` - 240px sidebar, content container
- `frontend/src/layouts/TabletLayout.tsx` - 72px icon sidebar
- `frontend/src/layouts/MobileLayout.tsx` - 72px bottom nav, header

### Pages
- `frontend/src/components/server/ServerListPage.tsx` - Card redesign, spacing
- `frontend/src/components/auth/LoginPage.tsx` - Form sizing, card
- `frontend/src/components/terminal/SessionPickerPage.tsx` - Cards, buttons
- `frontend/src/components/terminal/TerminalPage.tsx` - Status bar, action bar
- `frontend/src/components/terminal/QuickActionBar.tsx` - Button sizing

## Success Criteria

1. All touch targets minimum 44x44px
2. Cards visually distinct from background (clear border + bg contrast)
3. Mobile bottom nav 72px tall with clear active state
4. Desktop sidebar 240px with proper nav item sizing
5. Content area has max-width container on large screens
6. Form inputs 48px tall, 16px font (no iOS zoom)
7. Primary buttons 44px tall minimum
8. All existing functionality preserved
9. TypeScript compiles without errors
10. Responsive layouts work correctly at all breakpoints
