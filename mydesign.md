# TraceScribe Design System Guide

A comprehensive design guide for replicating TraceScribe's visual language. This document covers typography, colors, spacing, components, and interaction patterns.

---

## 1. Typography

### Font Families

| Font | Usage | Fallback |
|------|-------|----------|
| **Plus Jakarta Sans** | Primary UI text, body, headings | system-ui, sans-serif |
| **JetBrains Mono** | Code blocks, technical content | monospace |

```css
/* CSS Variables */
--font-jakarta: 'Plus Jakarta Sans', system-ui, sans-serif;
--font-jetbrains: 'JetBrains Mono', monospace;
```

### Font Scale

| Element | Size | Weight | Extras |
|---------|------|--------|--------|
| Hero headline | 48-60px (5xl-6xl) | Bold (700) | `tracking-tight` |
| Section heading | 24-32px (2xl-3xl) | Bold/Semibold | `tracking-tight` |
| Card title | 20px (xl) | Bold (700) | - |
| Body text | 16px (base) | Medium (500) | `leading-relaxed` |
| Small text | 14px (sm) | Medium (500) | - |
| Badge/label | 12px (xs) | Semibold (600) | - |
| Micro text | 10px | Bold (700) | Uppercase optional |

---

## 2. Color System

### Brand Colors

```
Primary (Teal):     HSL(168, 76%, 32%)  →  #0D9488
Accent (Coral):     HSL(25, 95%, 53%)   →  #F97316
```

### Light Mode Palette

```css
/* Backgrounds */
--background:           hsl(30, 20%, 98%);    /* Warm off-white */
--card:                 hsl(0, 0%, 100%);     /* Pure white */
--muted:                hsl(220, 14%, 96%);   /* Light gray */
--sidebar-bg:           hsl(222, 47%, 11%);   /* Deep charcoal */

/* Foregrounds */
--foreground:           hsl(222, 47%, 11%);   /* Deep charcoal */
--muted-foreground:     hsl(220, 9%, 46%);    /* Medium gray */
--sidebar-foreground:   hsl(210, 40%, 98%);   /* Off-white */

/* Interactive */
--primary:              hsl(168, 76%, 32%);   /* Teal */
--primary-foreground:   hsl(0, 0%, 100%);     /* White */
--accent:               hsl(25, 95%, 53%);    /* Coral */
--accent-foreground:    hsl(0, 0%, 100%);     /* White */
--secondary:            hsl(30, 15%, 94%);    /* Warm stone */

/* Borders */
--border:               hsl(220, 13%, 91%);
--ring:                 hsl(168, 76%, 32%);   /* Focus ring = primary */

/* Semantic */
--success:              hsl(160, 84%, 39%);   /* Emerald */
--warning:              hsl(38, 92%, 50%);    /* Amber */
--info:                 hsl(199, 89%, 48%);   /* Sky blue */
--destructive:          hsl(0, 84%, 60%);     /* Red */
```

### Dark Mode Palette

```css
/* Backgrounds */
--background:           hsl(222, 47%, 6%);    /* Very dark */
--card:                 hsl(222, 47%, 9%);    /* Slightly lighter */
--muted:                hsl(217, 33%, 17%);
--sidebar-bg:           hsl(222, 47%, 8%);

/* Foregrounds */
--foreground:           hsl(210, 40%, 98%);   /* Off-white */
--muted-foreground:     hsl(215, 20%, 65%);

/* Interactive - Elevated brightness */
--primary:              hsl(168, 76%, 58%);   /* Brighter teal */
--accent:               hsl(25, 95%, 63%);    /* Brighter coral */

/* Borders */
--border:               hsl(217, 33%, 20%);
```

### Color Usage Guidelines

| Color | Use For |
|-------|---------|
| **Primary (Teal)** | Main CTAs, active states, focus rings, logo |
| **Accent (Coral)** | Secondary CTAs, badges, highlights, hover states |
| **Success (Green)** | Completed status, checkmarks, positive feedback |
| **Warning (Amber)** | Pending states, alerts, caution indicators |
| **Info (Blue)** | Informational badges, tips |
| **Destructive (Red)** | Errors, delete actions, critical alerts |

---

## 3. Spacing System

### Base Scale (Tailwind)

```
4px   = 1    (p-1)
8px   = 2    (p-2)
12px  = 3    (p-3)
16px  = 4    (p-4)
20px  = 5    (p-5)
24px  = 6    (p-6)
32px  = 8    (p-8)
48px  = 12   (p-12)
64px  = 16   (p-16)
```

### Component Spacing

| Component | Padding | Gap |
|-----------|---------|-----|
| Card | `p-6` (24px) | - |
| Card header | `p-6` | `space-y-1.5` |
| Button (default) | `px-4 py-2` | - |
| Button (small) | `px-3` | - |
| Button (large) | `px-8` | - |
| Sidebar | `p-4` (16px) | - |
| Nav items | `px-3 py-2` | - |
| Page content | `p-6` (24px) | - |
| Grid gaps | - | `gap-4` to `gap-6` |

---

## 4. Border Radius

### Scale

```css
--radius: 0.625rem;  /* 10px base */

/* Derived sizes */
--radius-lg: var(--radius);                    /* 10px */
--radius-md: calc(var(--radius) - 2px);        /* 8px */
--radius-sm: calc(var(--radius) - 4px);        /* 6px */
```

### Usage

| Element | Radius |
|---------|--------|
| Buttons | `rounded-md` (8px) |
| Cards | `rounded-xl` or `rounded-2xl` (16px) |
| Badges | `rounded-full` (pill) |
| Inputs | `rounded-md` (8px) |
| Icon boxes | `rounded-lg` (10px) |
| Feature cards | `rounded-2xl` (16px) |

---

## 5. Shadows

### Shadow Tokens

```css
/* Card shadows */
--shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.1),
               0 1px 2px -1px rgb(0 0 0 / 0.1);

--shadow-card-hover: 0 10px 15px -3px rgb(0 0 0 / 0.1),
                     0 4px 6px -4px rgb(0 0 0 / 0.1);

/* Glow effects */
--shadow-glow: 0 0 20px -5px hsl(168, 76%, 32% / 0.3);        /* Teal glow */
--shadow-glow-accent: 0 0 20px -5px hsl(25, 95%, 53% / 0.3);  /* Coral glow */
```

### Usage

| State | Shadow |
|-------|--------|
| Card resting | `shadow-card` |
| Card hover | `shadow-card-hover` |
| Hero CTA button | `shadow-glow` |
| Active sidebar item | `shadow-glow` |

---

## 6. Animations

### Keyframes

```css
/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Fade in with upward movement */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Slide from left */
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Subtle pulse */
@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Teal glow pulse */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(13, 148, 136, 0.3); }
  50% { box-shadow: 0 0 12px rgba(13, 148, 136, 0.5); }
}
```

### Utility Classes

```css
.animate-fade-in { animation: fadeIn 0.5s ease-out; }
.animate-fade-in-up { animation: fadeInUp 0.5s ease-out; }
.animate-slide-in-left { animation: slideInLeft 0.3s ease-out; }
.animate-pulse-subtle { animation: pulse-subtle 2s ease-in-out infinite; }
.animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
```

### Stagger Children

```css
/* Apply progressive delays to children */
.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 50ms; }
.stagger-children > *:nth-child(3) { animation-delay: 100ms; }
.stagger-children > *:nth-child(4) { animation-delay: 150ms; }
/* ... up to nth-child(10) at 450ms */
```

### Transitions

| Duration | Use Case |
|----------|----------|
| `duration-200` | Hover states, color changes |
| `duration-300` | Card lifts, transforms |
| `ease-out` | Most animations |
| `ease-in-out` | Looping animations |

---

## 7. Component Patterns

### Button

```jsx
// Variants: default, destructive, outline, secondary, ghost, link
// Sizes: default (h-10), sm (h-9), lg (h-11), icon (h-10 w-10)

<button className="
  inline-flex items-center justify-center
  rounded-md
  text-sm font-medium
  h-10 px-4 py-2
  bg-primary text-primary-foreground
  hover:bg-primary/90
  transition-colors
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
  disabled:opacity-50 disabled:pointer-events-none
">
  Button Text
</button>
```

### Card

```jsx
<div className="rounded-xl border bg-card text-card-foreground shadow-card">
  <div className="flex flex-col space-y-1.5 p-6">
    <h3 className="text-2xl font-semibold tracking-tight">Card Title</h3>
    <p className="text-sm text-muted-foreground">Card description</p>
  </div>
  <div className="p-6 pt-0">
    {/* Content */}
  </div>
</div>
```

### Badge

```jsx
// Variants: default (primary bg), secondary, destructive, outline

<span className="
  inline-flex items-center
  rounded-full
  px-2.5 py-0.5
  text-xs font-semibold
  bg-primary text-primary-foreground
">
  Badge
</span>
```

### Input

```jsx
<input className="
  flex h-10 w-full
  rounded-md border border-input
  bg-background
  px-3 py-2
  text-sm
  placeholder:text-muted-foreground
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
  disabled:cursor-not-allowed disabled:opacity-50
" />
```

### Bento Card

```jsx
<div className="
  group
  relative
  rounded-2xl
  border bg-card
  p-6
  shadow-card
  transition-all duration-300
  hover:shadow-card-hover hover:-translate-y-0.5
">
  <div className="
    h-12 w-12
    rounded-lg
    bg-gradient-to-br from-primary/10 to-accent/10
    flex items-center justify-center
    mb-4
  ">
    <Icon className="h-6 w-6 text-primary" />
  </div>
  <h3 className="text-xl font-bold mb-2">Feature Title</h3>
  <p className="text-muted-foreground">Feature description text.</p>
</div>
```

---

## 8. Layout Patterns

### Hero Section

```jsx
<section className="relative min-h-[80vh] flex items-center justify-center">
  {/* Background effect */}
  <div className="absolute inset-0 overflow-hidden">
    <div className="
      absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
      w-[600px] h-[600px]
      bg-primary/5
      rounded-full blur-3xl
    " />
  </div>

  {/* Content */}
  <div className="relative max-w-4xl mx-auto text-center px-4">
    <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
      Headline Text
    </h1>
    <p className="mt-6 text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
      Supporting description text.
    </p>
    <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
      <Button size="lg" className="shadow-glow">Primary CTA</Button>
      <Button variant="outline" size="lg">Secondary CTA</Button>
    </div>
  </div>
</section>
```

### Features Grid

```jsx
<section className="py-24 px-4">
  <div className="max-w-6xl mx-auto">
    <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
    <div className="
      grid
      grid-cols-1 md:grid-cols-2 lg:grid-cols-3
      gap-6
      stagger-children
    ">
      {features.map((feature) => (
        <BentoCard key={feature.id} {...feature} />
      ))}
    </div>
  </div>
</section>
```

### Sidebar Layout

```jsx
<div className="min-h-screen">
  {/* Sidebar */}
  <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar-bg text-sidebar-foreground">
    {/* Logo */}
    <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent" />
      <span className="ml-3 font-bold">Brand</span>
    </div>

    {/* Navigation */}
    <nav className="p-4 space-y-6">
      <NavGroup label="Section">
        <NavItem icon={Icon} label="Item" active />
        <NavItem icon={Icon} label="Item" />
      </NavGroup>
    </nav>
  </aside>

  {/* Main content */}
  <main className="pl-64 p-6">
    {/* Page content */}
  </main>
</div>
```

---

## 9. Special Effects

### Glass Morphism

```css
.glass {
  background: hsl(var(--card) / 0.6);
  backdrop-filter: blur(24px);
  border: 1px solid hsl(var(--border) / 0.5);
}

.glass-dark {
  background: hsl(var(--card) / 0.4);
  backdrop-filter: blur(24px);
  border: 1px solid rgb(255 255 255 / 0.1);
}
```

### Gradient Text

```css
.gradient-text {
  background: linear-gradient(to right, hsl(var(--primary)), hsl(var(--accent)));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Grid Background

```css
.bg-grid {
  background-image:
    linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

---

## 10. Status Indicators

### Status Badge Pattern

```jsx
const statusStyles = {
  generating: { bg: 'bg-info/10', text: 'text-info', icon: Loader2 },
  draft: { bg: 'bg-warning/10', text: 'text-warning', icon: Clock },
  final: { bg: 'bg-success/10', text: 'text-success', icon: Check },
  error: { bg: 'bg-destructive/10', text: 'text-destructive', icon: AlertCircle },
};

<span className={`
  inline-flex items-center gap-1.5
  px-2.5 py-1
  rounded-full
  text-xs font-medium
  ${statusStyles[status].bg}
  ${statusStyles[status].text}
`}>
  <StatusIcon className="h-3 w-3" />
  {statusLabel}
</span>
```

---

## 11. Icon Library

**Library:** Lucide React

### Common Icons

| Icon | Use |
|------|-----|
| `FileText` | Documents, files |
| `Sparkles` | AI features, highlights |
| `ShieldCheck` | Security, compliance |
| `ArrowRight` | CTAs, navigation |
| `ChevronRight` | Breadcrumbs, links |
| `Upload` | Upload actions |
| `Check` | Success, completed |
| `AlertCircle` | Errors, warnings |
| `Loader2` | Loading (add `animate-spin`) |
| `Moon` / `Sun` | Theme toggle |

### Sizing

| Context | Size |
|---------|------|
| Hero / large | `h-6 w-6` or `h-8 w-8` |
| Card icon | `h-5 w-5` or `h-6 w-6` |
| Navigation | `h-4 w-4` |
| Badge / inline | `h-3 w-3` |

---

## 12. Responsive Breakpoints

```css
/* Tailwind defaults */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1400px /* Wide screens */
```

### Common Patterns

```jsx
// Grid responsive
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"

// Typography responsive
className="text-4xl md:text-5xl lg:text-6xl"

// Button stack responsive
className="flex flex-col sm:flex-row gap-4"

// Padding responsive
className="px-4 md:px-6 lg:px-8"
```

---

## 13. Accessibility

- **Focus rings:** 2px offset with primary color
- **Semantic HTML:** Use `<button>`, `<nav>`, `<main>`, `<aside>`
- **Screen reader text:** `.sr-only` class for icon-only buttons
- **Color contrast:** HSL system ensures WCAG AA compliance
- **Keyboard navigation:** All interactive elements focusable

---

## 14. Quick Reference

### Brand Summary

| Element | Value |
|---------|-------|
| Primary Color | Teal `#0D9488` |
| Accent Color | Coral `#F97316` |
| Primary Font | Plus Jakarta Sans |
| Code Font | JetBrains Mono |
| Base Radius | 10px |
| Card Padding | 24px |
| Default Transition | 200ms ease-out |

### Design Philosophy

1. **Clinical yet modern** - Professional medical SaaS aesthetic
2. **Trust signals** - Teal conveys reliability and expertise
3. **Action oriented** - Coral draws attention to key actions
4. **Clean hierarchy** - Clear typography scale and spacing
5. **Subtle depth** - Soft shadows and gentle hover lifts
6. **Smooth interactions** - Consistent 200-300ms transitions
7. **Dark mode ready** - Full dark theme with elevated contrast

---

*This guide enables developers to replicate TraceScribe's design language across new features and components.*
