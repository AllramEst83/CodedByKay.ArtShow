# App Specification: Kay's ArtShow

## Overview
Build a responsive, highly polished art portfolio web application titled **"Kay's ArtShow"** for displaying drawings, images, and photos hosted via Netlify (or local public assets).

---

## Tech Stack & Architecture
- **Framework:** "CodedByKay.ArtShow\.cursor\rules\vanilla-web-development.mdc"
- **Hosting / Assets:** Configured for Netlify deployment; images served via public directory or CDN URL paths.
- **Packages:** Utility libraries allowed for masonry layout, lightbox, or animations (e.g., `framer-motion`, `react-masonry-css`, `lucide-react` for icons).

---

## Responsive Design & Accessibility
- Fully responsive across mobile, tablet, and desktop viewports.
- **Grid Layout:** Staggered/Masonry grid that dynamically adjusts column count based on screen size (e.g., 1 column on mobile, 2–3 on tablet, 4+ on desktop).
- Accessible interactive elements (proper ARIA attributes, keyboard navigation for modal/lightbox).

---

## Metadata Structure
Store portfolio items in a dedicated JSON/TypeScript data file (`data/artwork.ts`). Each item object should follow this schema:

```json
{
  "id": "art-001",
  "title": "Sunset Reflection",
  "description": "Oil on canvas study of light on open water.",
  "dateAdded": "2024-03-15",
  "category": "Paintings",
  "tags": ["landscape", "oil", "sunset"],
  "medium": "Oil Paint",
  "dimensions": "24x36 inches",
  "imageUrl": "/images/art-001.jpg",
  "thumbnailUrl": "/images/art-001-thumb.jpg",
  "featured": true
}
```

---

## Key Features & Pages

### 1. Home Page
- **Header & Branding:** Clean title ("Kay's ArtShow") with an integrated Theme Selector dropdown/toggle.
- **Consolidated Control Bar:** A unified, compact control panel above the grid that includes:
  - **Search Input:** Real-time text search filtering title, description, and tags.
  - **Filter / Sort Popover Menu (or Chips):** Dropdown or expandable drawer containing:
    - **Filter by:** Category multi-select and Tag chips.
    - **Sort by:** Date Added (Newest/Oldest), Title (A-Z).
    - **Group by:** (Optional toggle) Group grid items by Category or Year.
  - **Active Filter Badges:** Small removable pills showing active filters with a "Clear All" button.

### 2. Interactions & Hover Effects
- **Desktop Hover Effect:** Smooth scale-up zoom (`scale-105`) with a soft shadow and subtle gradient overlay displaying the title and category on hover.
- **Mobile Touch Handling:** Disable hover scale effects on touch devices using `@media (hover: hover)`. Tapping directly opens the artwork in the Lightbox.

### 3. Lightbox / Detail View
- **Activation:** Clicking any thumbnail opens the high-resolution image in a full-screen modal overlay.
- **Features:**
  - Standard navigation (Next / Previous image controls).
  - **Keyboard Controls:** ESC to close, Left / Right Arrow keys to navigate.
  - **Details Sidebar / Drawer:** Expandable metadata panel showing description, medium, date, dimensions, and tags.
  - **Image Zoom / Fullscreen:** Toggle for viewing at 100% scale or native fullscreen.

---

## Theme System
Define a centralized theme configuration object (e.g., `config/themes.ts`) mapping CSS variables/Tailwind classes.

### Built-in Themes

#### Neo-Brutalism
Bold colors, high contrast, thick borders, raw functionality, and intentionally "undesigned" aesthetics with rough edges.

##### Key Features
- High contrast colors
- Thick borders
- Harsh shadows
- Raw typography
- Unconventional layouts

---

#### Neumorphism
Soft, extruded UI elements that appear to push through the surface, using subtle shadows to create a physical, tactile feel.

##### Key Features
- Subtle shadows
- Soft UI
- Monochromatic palette
- Minimal depth
- Light/dark versions

---

#### Glassmorphism
Frosted glass effect with transparency, blur, and subtle borders that create depth and layering.

##### Key Features
- Backdrop blur
- Transparency
- Subtle borders
- Light reflections
- Layered interfaces

---

#### Material Design
Google's design language using grid-based layouts, responsive animations, padding, and depth effects like lighting and shadows.

##### Key Features
- Paper metaphor
- Bold colors
- Grid system
- Responsive animations
- Elevation shadow system

---

#### Claymorphism
Soft, puffy, rounded UI elements that appear like clay, with soft shadows and pastel colors.

##### Key Features
- Soft shadows
- Rounded corners
- Pastel colors
- Puffy appearance
- Playful feel

