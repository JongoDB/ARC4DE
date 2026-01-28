# UI Refresh Design Document

## Overview

Modernize ARC4DE's visual design to match premium SaaS aesthetics (Linear, Vercel, Raycast) while maintaining all existing functionality. Focus on visual polish: better cards, icons, spacing, subtle animations, and hover states.

## Design Direction

**Style:** Modern SaaS - clean, professional, subtle gradients, refined spacing
**Icons:** Lucide React - lightweight, tree-shakeable, widely used
**Scope:** Visual polish only - no functionality changes

## Design System Updates

### Color Palette

```css
:root {
  /* Backgrounds - more depth */
  --color-bg-primary: #0a0e17;
  --color-bg-secondary: #0f1419;
  --color-bg-tertiary: #1a1f2e;
  --color-bg-elevated: #1e2433;

  /* Text - slightly warmer */
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;

  /* Accent - brighter blue */
  --color-accent: #3b82f6;
  --color-accent-hover: #60a5fa;
  --color-accent-muted: rgba(59, 130, 246, 0.15);

  /* Status */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Borders */
  --color-border: #1e293b;
  --color-border-hover: #334155;
}
```

### Typography

- Headings: font-semibold, tracking-tight
- Body: 14-15px, normal weight
- Labels: 12px, medium weight, uppercase for categories
- Monospace: JetBrains Mono for terminal/code

### Spacing

- Card padding: 16px → 20px
- Section gaps: 16px → 24px
- List item gaps: 8px → 12px

### Cards

- Border radius: rounded-xl (12px)
- Border: 1px solid var(--color-border)
- Hover: border-color transition + subtle translateY(-1px)
- Background: var(--color-bg-secondary)

### Buttons

**Primary:**
- Background gradient: from-blue-600 to-blue-500
- Hover: brightness increase
- Shadow: subtle blue glow on hover

**Secondary/Ghost:**
- Transparent background
- Border on hover
- Icon + text alignment

### Transitions

- Default: 150ms ease
- Hover transforms: 200ms ease-out
- Color changes: 150ms ease

## Screen Designs

### Sidebar Navigation

```
┌─────────────────────┐
│ ARC4DE              │  ← Logo with accent "4"
├─────────────────────┤
│ ▌🖥 Servers         │  ← Active: left accent bar + filled bg
│   📑 Sessions       │  ← Inactive: muted text
│   ⬛ Terminal       │
│                     │
│                     │
│                     │
└─────────────────────┘
```

- Icons: Server, Layers, Terminal2 from Lucide
- Active state: 3px left border accent + bg-accent-muted
- Hover: bg-tertiary

### Server List Page

```
┌─────────────────────────────────────────────────┐
│ Servers                           [+ Add Server]│
│ 1 server configured                             │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ 🖥  My Home Lab                         ●   │ │  ← Green dot = healthy
│ │    http://localhost:5175            → Edit │ │  ← Actions on hover
│ └─────────────────────────────────────────────┘ │
│                                                 │
│         [Empty state with illustration]         │
│         No servers configured yet.              │
│         [+ Add your first server]               │
└─────────────────────────────────────────────────┘
```

- Cards: hover lift + border glow
- Edit/Delete: appear on hover (icon buttons)
- Status dot: green if last connection < 24h

### Login Page

```
┌─────────────────────────────────────────────────┐
│                                                 │
│           ┌───────────────────────┐             │
│           │ 🖥  My Home Lab       │             │
│           │ http://localhost:5175 │             │
│           ├───────────────────────┤             │
│           │ 🔒 ******************  │             │
│           │                       │             │
│           │ [    Connect    ]     │             │
│           │                       │             │
│           │    ← Back to servers  │             │
│           └───────────────────────┘             │
│                                                 │
└─────────────────────────────────────────────────┘
```

- Centered card with max-width
- Server icon and info at top
- Lock icon in password field
- Error: red left border + red text

### Session Picker Page

```
┌─────────────────────────────────────────────────┐
│ ← My Home Lab                     [Disconnect]  │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ + New Session                               │ │  ← Prominent card
│ │   [Shell]  [Claude Code]                    │ │  ← Plugin pills
│ │   Session name: [________________]          │ │
│ │                          [Create] [Cancel]  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ ● dev-server               shell   2h ago  │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ ○ api-testing              shell   1d ago  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

- Back link to servers with server name
- New session as expandable card (not modal)
- Plugin pills with icons
- Session cards: status dot, name, plugin badge, time

### Terminal Page

```
┌─────────────────────────────────────────────────┐
│ ● Connected │ dev-server │ My Home Lab  [← Back]│  ← Enhanced status bar
├─────────────────────────────────────────────────┤
│ [🗑 Clear] [✕ Exit]                             │  ← Lucide icons
├─────────────────────────────────────────────────┤
│                                                 │
│ root@server:~# _                                │
│                                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

- Status bar: connection status, session name, server name, back link
- Quick actions: proper icons, better button styling
- Connecting state: pulsing indicator

## New Dependencies

```json
{
  "lucide-react": "^0.469.0"
}
```

## Files to Modify

### Styles
- `frontend/src/styles/global.css` - Updated CSS variables

### Layouts
- `frontend/src/layouts/DesktopLayout.tsx` - Sidebar with icons
- `frontend/src/layouts/TabletLayout.tsx` - Sidebar updates
- `frontend/src/layouts/MobileLayout.tsx` - Bottom nav with icons

### Pages
- `frontend/src/components/server/ServerListPage.tsx` - Card redesign
- `frontend/src/components/auth/LoginPage.tsx` - Centered card
- `frontend/src/components/terminal/SessionPickerPage.tsx` - Full redesign
- `frontend/src/components/terminal/TerminalPage.tsx` - Status bar
- `frontend/src/components/terminal/QuickActionBar.tsx` - Lucide icons

## Success Criteria

1. All screens use consistent card styling with hover effects
2. Navigation has icons and clear active states
3. Buttons have proper variants (primary/ghost)
4. Icons used throughout for visual clarity
5. Smooth transitions on hover/focus states
6. All existing functionality preserved
7. TypeScript compiles without errors
8. Responsive layouts still work (mobile/tablet/desktop)
