# Discord-Inspired UI Overhaul Design

## Goal
Transform the ARC4DE UI to feel polished and professional like Discord - generous spacing, clear visual hierarchy, and clean typography.

## Design System Foundation

### Spacing Scale
- Base unit: 4px
- Minimum touch target: 44px
- Button padding: 12px vertical, 20px horizontal minimum
- Card padding: 20px minimum
- Text from container edges: 16px minimum
- Gap between elements: 12-16px

### Color Palette
```css
:root {
  --bg-primary: #1e1f22;
  --bg-secondary: #2b2d31;
  --bg-tertiary: #313338;
  --bg-modifier-hover: #393c41;
  --bg-modifier-active: #43444b;

  --text-primary: #f2f3f5;
  --text-secondary: #b5bac1;
  --text-muted: #949ba4;

  --accent: #5865f2;
  --accent-hover: #4752c4;
  --accent-muted: rgba(88, 101, 242, 0.15);

  --success: #23a559;
  --danger: #da373c;

  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-strong: rgba(255, 255, 255, 0.1);
}
```

### Typography
- Base: 15px
- Headings: 20-24px bold
- Labels: 12px uppercase, letter-spacing 0.02em
- Line height: 1.4 body, 1.2 headings
- Font stack: Inter, system-ui, sans-serif

---

## Layout Structure

### Desktop (1200px+)
- Sidebar: 280px wide, 16px padding
- Main content: max-width 900px, centered, 48px padding
- Nav items: 48px height, 12px padding, 8px border-radius

### Tablet (768px-1199px)
- Collapsible sidebar or icon-only (72px)
- Main content: 32px padding

### Mobile (<768px)
- Bottom navigation: 72px + safe area
- Nav items: Icon + label stacked, 64px wide pills
- Content: 20px horizontal, 24px vertical padding

---

## Component Specifications

### Buttons

**Primary:**
- Height: 44px
- Padding: 0 20px
- Font: 15px medium (500)
- Background: var(--accent)
- Border-radius: 8px
- Hover: var(--accent-hover)

**Secondary:**
- Same dimensions
- Background: transparent
- Border: 1px solid #4f545c
- Hover: var(--bg-modifier-hover)

**Icon Button:**
- Size: 36px × 36px
- Border-radius: 6px
- Icon: 18px

### Cards
- Padding: 20px
- Border-radius: 12px
- Background: var(--bg-tertiary)
- Border: 1px solid var(--border-subtle)
- Hover: var(--bg-modifier-hover)
- Icon container: 48px × 48px, 10px radius
- Content gap: 16px

### Form Inputs
- Height: 48px
- Padding: 0 16px
- Background: var(--bg-primary)
- Border: 1px solid transparent
- Border-radius: 8px
- Focus: accent border + subtle glow
- Label: 12px uppercase, 8px margin-bottom

### Spacing
- Header to first card: 24px
- Between cards: 12px
- Form field groups: 20px

---

## Files to Modify

1. `frontend/src/styles/global.css` - Update CSS variables
2. `frontend/src/layouts/DesktopLayout.tsx` - Wider sidebar, better spacing
3. `frontend/src/layouts/MobileLayout.tsx` - Larger bottom nav
4. `frontend/src/layouts/TabletLayout.tsx` - Adjust for new system
5. `frontend/src/components/server/ServerListPage.tsx` - Card and button styling
6. `frontend/src/components/auth/LoginPage.tsx` - Form styling
7. `frontend/src/components/terminal/SessionPickerPage.tsx` - Card styling

## Success Criteria
- All interactive elements have 44px minimum touch target
- 16px minimum padding from text to container edges
- Consistent 12-16px gaps between elements
- Cards have visible depth with 20px internal padding
- Typography is readable at 15px base
