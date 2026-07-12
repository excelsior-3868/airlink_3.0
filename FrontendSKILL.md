---
name: frontend-design
description: Guidelines, blueprints, and standards for the GymOS Frontend Design including Typography, Login Pages, Sidebar, Icons, Animations, Motion Tables, and Pagination.
---

# GymOS Frontend Design Guidelines & Blueprints

This skill defines the visual standards, token mappings, design blueprints, and component implementation guides for the GymOS frontend. All development on frontend pages, layouts, and components must adhere to these standards to maintain design consistency and a premium user experience.

---

## 1. Typography & Global Layout

GymOS relies on the **Outfit** typeface to establish a modern, clean, and highly readable look.

### A. Font Configurations
- **Primary Typeface**: `Outfit`, sans-serif (`var(--font-sans)`)
- **Mono Space Font**: `source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace` (for code samples/technical outputs)
- **Title Tracking**: Heading levels `h1` through `h6` must use negative letter spacing (`letter-spacing: -0.02em`) to maintain a clean, compact appearance.

### B. Common Typography Classes
- **Heading Bold**: `font-heading font-black` or `font-heading font-bold`
- **Text Sizes**:
  - Main Page Titles: `text-2xl sm:text-3xl lg:text-4xl`
  - Subheadings/Card Titles: `text-sm sm:text-base lg:text-lg font-bold`
  - Body Text: `text-xs sm:text-sm`
  - Muted Text: `text-muted-foreground text-xs sm:text-sm`
  - Action/Button Text: `text-xs sm:text-sm lg:text-base`

### C. Scrollbars
- **Aggressive Scrollbar Hiding**: Hide scrollbars globally unless explicitly requested by the user, using:
  ```css
  * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  ```
- **Custom Class**: Use `.no-scrollbar` to manually suppress scrollbars on overflowing panels.

---

## 2. Color Palette & Design Tokens

GymOS uses HSL CSS variables mapping to Tailwind colors to allow flexible theme shifting (e.g. Light/Dark mode).

### A. Key Brand Colors (Nepal Telecom Scheme)
- **Primary**: `hsl(209 100% 32%)` (Rich NT Blue)
- **Accent**: `hsl(350 86% 72%)` (Soft Rose)
- **Accent 2**: `hsl(350 78% 66%)` (Rose Accent)
- **Background**: `hsl(210 40% 98%)` (Soft Blue-Grey Tint)
- **Card**: `hsl(0 0% 100%)` (Pure White)
- **Muted**: `hsl(210 40% 96.1%)` (Soft Grey)

### B. Glassmorphism & Panel Classes
Use the following utility classes to create premium translucent card layers:
- **`.glass-card`**: Uses backdrop filters and subtle inner gradient lines to construct a glass panel.
  ```css
  .glass-card {
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(24px);
    background: linear-gradient(180deg, hsl(var(--card) / 0.92) 0%, hsl(var(--card) / 0.84) 100%);
    box-shadow: 0 18px 45px -22px hsl(var(--primary) / 0.35), 0 8px 18px -18px hsl(var(--primary) / 0.22);
  }
  ```
- **`.surface-panel`**: Solid panel overlay for secondary content blocks.
  ```css
  .surface-panel {
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.7);
    background-color: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(24px);
    box-shadow: 0 18px 45px -24px rgba(0, 0, 0, 0.32);
  }
  ```

---

## 3. Login Page Design

The login page requires a highly stylized entry experience combining sliding gradients and premium card layout.

### A. Sliding Animated Gradient (`.gradient-background`)
Uses 4-color sliding diagonal transitions to create a responsive, modern environment:
```css
.gradient-background {
  background: linear-gradient(-45deg,
      hsl(var(--gradient-color-1)),
      hsl(var(--gradient-color-2)),
      hsl(var(--gradient-color-3)),
      hsl(var(--gradient-color-2)));
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

### B. Background Decor
Add blurry background vector circles to add depth behind the card:
```tsx
<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
<div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-accent/5 rounded-full blur-[100px]"></div>
```

### C. Submission Button (`.btn-primary`)
Must render with standard styling, hover lift transitions, and a scale-down tap animation:
```css
.btn-primary {
  color: white;
  padding: 0.625rem 1.25rem;
  border-radius: 16px;
  font-weight: 600;
  font-size: 0.875rem;
  background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(209 100% 24%) 55%, hsl(var(--nt-accent)) 130%);
  box-shadow: 0 16px 30px -18px hsl(var(--primary) / 0.65), 0 8px 18px -16px hsl(var(--nt-accent) / 0.5);
  border: 1px solid hsl(var(--primary) / 0.2);
  transition: all 0.2s ease;
}
.btn-primary:hover {
  transform: translateY(-1px);
  filter: saturate(1.06);
}
```

- **Interactive scale tap**: Wrap in Framer Motion `<motion.button whileTap={{ scale: 0.95 }}>` or use Tailwind `active:scale-95`.

---

## 4. Sidebar Design

GymOS implements a dynamic sidebar using CSS variables and Framer Motion transitions.

### A. Layout Structure
- **Shell**: The outer shell wrapper `.app-sidebar-shell` must have `rounded-[34px]`.
- **Panel**: The sidebar container `.app-sidebar-panel` utilizes:
  - Rounded corners: `rounded-[34px]`
  - Backdrops: `backdrop-blur-2xl border border-white/80`
  - Gradient Background: `linear-gradient(180deg, hsl(0 0% 100% / 0.92) 0%, hsl(210 40% 99% / 0.94) 100%)`
  - Shadow styling: `0 22px 70px -32px hsl(var(--primary) / 0.22)`

### B. Navigation Items (`.app-sidebar-nav-item`)
- **Active State (`.app-sidebar-nav-item-active`)**:
  - Gradient Background: `linear-gradient(135deg, hsl(var(--soft-red) / 0.18) 0%, hsl(var(--soft-red-2) / 0.08) 100%)`
  - Active color: Dark Rose (`#a22612`)
  - Shadows: `0 14px 34px -24px hsl(var(--soft-red) / 0.7)`
- **Idle State (`.app-sidebar-nav-item-idle`)**:
  - Color: `text-slate-500`
  - Hover states: `hover:bg-white/80 hover:text-slate-700`
- **Sub-Items Panel**: Animated dynamically with Framer Motion `<AnimatePresence>` for clean sliding expansion:
  ```tsx
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden flex flex-col gap-1 ml-5 mt-2 border-l border-slate-200 pl-4"
      >
        {/* Child items */}
      </motion.div>
    )}
  </AnimatePresence>
  ```

---

## 5. Icons & Animations

Icons and micro-interactions add polish to the application.

### A. Icons Standard
- **Library**: `lucide-react` is used exclusively.
- **Sizes**:
  - Primary Sidebar Navigation Icons: `18px`
  - Submenu/Inline list icons: `14px` or `12px`
  - Form Fields inputs: `16px` or `18px` (e.g., Mail, Lock, Eye, EyeOff)
- **Hover Micro-Animations**:
  - Scaling icons: `transition-transform group-hover:scale-110`
  - Translating arrows: `transition-all group-hover:translate-x-1`

### B. Animations
- **Scale on click**: Use `active:scale-95` on action buttons.
- **Fade & Slide In Class**:
  - `.fade-in`: Transitions opacity from `0` to `1` over `0.2s`.
  - `.slide-in`: Slides element upward or horizontally.
- **Motion Components**:
  ```tsx
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    {/* Page Content */}
  </motion.div>
  ```

---

## 6. Motion Table Design

GymOS tables are designed to look cohesive and animate dynamically when data shifts.

### A. Table Structure & Header Styling
- **Header (`thead`, `th`)**: Always uses the primary brand color with bold white text.
  ```css
  thead {
    @apply bg-primary;
  }
  th {
    @apply bg-primary font-semibold;
    color: white !important;
  }
  ```
- **Round Borders**: Ensure top-left and top-right th cell headers are rounded inside the table border box.

### B. Motion Row Transitions (`motion.tr`)
Animate table rows with cascade animations to make the list feel alive:
```tsx
{items.map((item, idx) => (
  <motion.tr
    key={item.id}
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: idx * 0.05 }}
    className="hover:bg-secondary/30 transition-all cursor-pointer group"
  >
    {/* Cells */}
  </motion.tr>
))}
```

### C. Standard Status Badging
Use the following tags for standard color-coded badges matching the data state:
- **Active / Success**: `.pill.success` or `.badge.success` (`bg-emerald-50 text-emerald-600 border-emerald-100`)
- **Inactive / Muted**: `.pill.secondary` (`bg-slate-50 text-slate-500 border-slate-100`)
- **Pending / Warning**: `.pill.warning` (`bg-amber-50 text-amber-600 border-amber-100`)
- **Failed / Destructive**: `.pill.danger` (`bg-rose-50 text-rose-600 border-rose-100`)

---

## 7. Pagination

The pagination layout must display items correctly and provide clear active-page states.

### A. Pagination Component Structure
- **Statistics Counter (Left-Aligned)**: Shows `"Showing X to Y of Z items"` in size `text-xs font-semibold text-slate-500`.
- **Navigation Controls (Right-Aligned)**: Next and Prev buttons styled as:
  `className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"`
- **Numeric Page Buttons**:
  - **Active State**: Scaled up slightly with a primary-colored shadow.
    `className="w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg border bg-primary border-primary text-white shadow-md shadow-primary/20 scale-105"`
  - **Inactive State**:
    `className="w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg border bg-white border-slate-200 text-slate-600 hover:border-primary/30 hover:text-primary transition-all"`
