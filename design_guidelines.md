# Design Guidelines: AI-Based Smart Classroom Attention Analyzer

## Design Approach
**Selected Approach:** Design System (Material Design-inspired)
**Justification:** This is a utility-focused educational tool requiring clear data visualization, real-time feedback, and functional clarity over visual storytelling. The interface prioritizes efficiency, readability, and distraction-free learning.

**Key Principles:**
- Data clarity over decorative elements
- Real-time feedback prominence
- Distraction-free educational environment
- Efficient information hierarchy

## Typography
- **Primary Font:** Inter (Google Fonts) - excellent readability for data-heavy interfaces
- **Headings:** 600 weight, sizes: text-3xl (dashboard titles), text-2xl (section headers), text-xl (card titles)
- **Body Text:** 400 weight, text-base for descriptions, text-sm for metadata
- **Metrics/Numbers:** 700 weight, large sizes (text-4xl to text-6xl) for attention score display
- **Data Labels:** 500 weight, text-xs uppercase with tracking-wide for graph labels and stats

## Layout System
**Spacing Units:** Tailwind units 2, 4, 6, 8, 12, 16
- Component padding: p-6 to p-8
- Section spacing: space-y-6 to space-y-8
- Card gaps: gap-6
- Mobile: Reduce to p-4, gap-4

**Container Strategy:**
- Main app: max-w-7xl mx-auto for desktop dashboard
- Active session view: max-w-4xl for focused camera + metrics view
- Mobile: full-width with px-4 padding

## Core Component Library

### Active Session View (Primary Interface)
**Layout:** Two-column on desktop (60/40 split), stacked on mobile
- **Left Column:** Live camera feed with face tracking overlay
  - Video container with rounded-lg border
  - Semi-transparent overlay showing face landmarks (optional visualization)
  - Status indicator (green dot) when face detected
- **Right Column:** Real-time metrics panel
  - Large attention score display (circular progress or prominent number)
  - Live line graph (updating every second)
  - Current session timer
  - Individual metrics grid (Eye openness, Blink rate, Gaze, Head pose)

### Dashboard View
**Grid Layout:** 
- Stats overview cards (grid-cols-1 md:grid-cols-3): Daily average, Weekly trend, Total sessions
- Large attention timeline graph (full-width card)
- Session history table with sortable columns
- Export controls section

### Cards
- Elevated appearance with subtle shadow
- Rounded corners (rounded-xl)
- White background with border
- Consistent padding (p-6)
- Header with title + optional action button

### Buttons
- Primary: Solid fill for main actions (Start Session, Export Data)
- Secondary: Outlined for secondary actions (View History, Settings)
- Sizes: px-6 py-3 for primary actions, px-4 py-2 for secondary
- Rounded: rounded-lg
- Icons: 20x20px from Heroicons

### Data Visualization
- **Attention Score Display:** 
  - Large numerical value (text-6xl font-bold)
  - Contextual text label below (text-sm)
  - Progress indicator or gauge visualization
- **Line Graph:** 
  - Chart.js or Recharts for live updates
  - Smooth curves, minimal gridlines
  - Time-based x-axis (last 60 seconds for live, dates for history)
  - Y-axis: 0-100 attention score
- **Metric Cards Grid:**
  - Small cards displaying: Eye Openness, Blink Rate, Gaze Direction, Head Pose
  - Icon + label + current value
  - Grid: grid-cols-2 gap-4

### Navigation
- Top bar with app title, current view indicator, settings icon
- Sticky positioning on scroll
- Height: h-16
- Mobile: Hamburger menu for navigation between Active/Dashboard/History views

### Camera Feed Component
- Aspect ratio: 4:3 or 16:9 based on device camera
- Rounded corners with border
- Real-time face tracking visualization (optional green dots on facial landmarks)
- Permission prompt overlay when camera access needed
- "Position your face in frame" guidance overlay

### Forms & Controls
- Session controls: Start/Stop/Pause buttons (large, accessible)
- Settings panel: Toggle switches for features (show landmarks, auto-save, sound alerts)
- Export format selector: Radio buttons for CSV/JSON
- All inputs: rounded-md, border, focus ring

## Mobile Optimization
- Stack all columns to single column
- Camera feed: full-width, aspect-ratio-square or 16:9
- Attention score: Sticky at top while scrolling
- Collapsible sections for detailed metrics
- Bottom navigation bar for view switching

## Visual Hierarchy
1. Attention Score (most prominent - large, bold, color-coded)
2. Camera Feed (primary content area)
3. Live Graph (secondary visualization)
4. Individual Metrics (supporting data)
5. Controls and Settings (tertiary)

## Accessibility
- High contrast text on all backgrounds
- Focus indicators on all interactive elements
- ARIA labels for screen readers
- Keyboard navigation support
- Camera permission clear messaging

## Animations
**Minimal and Purposeful:**
- Attention score number transitions (smooth counting)
- Graph line drawing animation (subtle)
- Card hover: slight scale (scale-105) and shadow increase
- NO distracting animations during active sessions

## Images
**No hero images or decorative photography needed.** This is a pure functional tool. Visual interest comes from:
- Live camera feed
- Real-time data visualization
- Clean, organized interface layout