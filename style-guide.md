# Guitar Learning App - Complete Style Guide

## Brand Essence

**Core Values:** Open, Collaborative, Energetic, Modern, Accessible  
**Personality:** Approachable yet polished. Like a talented musician friend who makes learning feel natural and exciting, not intimidating.  
**Target Audience:** Adults 18-30 who want to learn guitar in a modern, social way

---

## Color Palette

### Primary Colors
- **Electric Blue** `#2D7FF9` - Primary actions, key CTAs, interactive elements
- **Vibrant Coral** `#FF6B58` - Secondary actions, accent highlights, energy moments
- **Deep Purple** `#6C5CE7` - Premium features, special states, creative tools

### Neutral Foundation
- **Pure White** `#FFFFFF` - Main background (default mode)
- **Soft Gray** `#F7F8FA` - Secondary backgrounds, cards, panels
- **Cool Gray 300** `#E2E5EA` - Borders, dividers, subtle separations
- **Cool Gray 600** `#6B7280` - Secondary text, placeholders
- **Charcoal** `#1F2937` - Primary text, headlines

### Semantic Colors
- **Success Green** `#10B981` - Correct notes, achievements, progress
- **Warning Amber** `#F59E0B` - Timing feedback, practice reminders
- **Error Red** `#EF4444` - Missed notes, errors
- **Info Cyan** `#06B6D4` - Tips, educational moments

### Dark Mode Palette
- **Rich Black** `#0F1419` - Main background
- **Slate 900** `#1A1F2E` - Cards and panels
- **Slate 700** `#2D3748` - Borders
- **Cool Gray 300** `#E2E5EA` - Primary text
- **Cool Gray 500** `#9CA3AF` - Secondary text
- *(Primary colors remain the same but may need slight luminosity adjustment)*

---

## Typography

### Font Family
**Primary:** Inter (system fallback: -apple-system, BlinkMacSystemFont, "Segoe UI")  
**Reason:** Clean, modern, excellent readability at all sizes, web-safe

**Display/Headers:** Inter with tighter letter-spacing (-0.02em)  
**Monospace (chord diagrams, tabs):** JetBrains Mono or SF Mono

### Type Scale
- **H1 (Page Titles):** 40px / 2.5rem - Bold (700) - Line height 1.2
- **H2 (Section Headers):** 32px / 2rem - Bold (700) - Line height 1.3
- **H3 (Card Titles):** 24px / 1.5rem - Semibold (600) - Line height 1.4
- **H4 (Subsections):** 20px / 1.25rem - Semibold (600) - Line height 1.4
- **Body Large:** 18px / 1.125rem - Regular (400) - Line height 1.6
- **Body:** 16px / 1rem - Regular (400) - Line height 1.6
- **Body Small:** 14px / 0.875rem - Regular (400) - Line height 1.5
- **Caption:** 12px / 0.75rem - Medium (500) - Line height 1.4

### Typographic Style
- Sentence case for most UI elements (not Title Case)
- ALL CAPS sparingly for labels and categories (12px, letter-spacing: 0.05em)
- Medium weight (500) for emphasized body text
- Numbers in tables/stats: Tabular figures for alignment

---

## Spacing & Layout

### Spacing System (8px base unit)
- **xs:** 4px (0.25rem)
- **sm:** 8px (0.5rem)
- **md:** 16px (1rem)
- **lg:** 24px (1.5rem)
- **xl:** 32px (2rem)
- **2xl:** 48px (3rem)
- **3xl:** 64px (4rem)

### Grid & Breakpoints
- **Mobile:** 375px - 767px (Single column, 16px margins)
- **Tablet:** 768px - 1023px (2 columns possible, 24px margins)
- **Desktop:** 1024px+ (Max content width: 1440px, centered)

### Layout Principles
- Generous whitespace - don't crowd the interface
- Maximum content width: 1200px for readability
- Asymmetric layouts welcome (70/30 splits) for visual interest
- Cards have 16-24px padding
- Minimum touch target: 44x44px (mobile), 40x40px (desktop)

---

## UI Components

### Buttons

**Primary Button**
- Background: Electric Blue `#2D7FF9`
- Text: White, 16px, Semibold (600)
- Border radius: 8px
- Padding: 12px 24px
- Hover: Darken 10%, lift 2px with soft shadow
- Active: Slight scale down (0.98)

**Secondary Button**
- Background: Transparent
- Border: 2px solid Cool Gray 300
- Text: Charcoal, 16px, Semibold (600)
- Border radius: 8px
- Padding: 12px 24px
- Hover: Background Soft Gray, border Electric Blue

**Accent Button (Special Actions)**
- Background: Vibrant Coral `#FF6B58`
- Same specs as primary
- Use sparingly for key creative actions (Start Jam, Record)

### Cards
- Background: White (light mode) / Slate 900 (dark mode)
- Border radius: 12px
- Border: 1px solid Cool Gray 300 (subtle)
- Shadow: 0 1px 3px rgba(0,0,0,0.08)
- Hover: Lift to 0 4px 12px rgba(0,0,0,0.12)
- Padding: 20px

### Input Fields
- Border: 1.5px solid Cool Gray 300
- Border radius: 8px
- Padding: 12px 16px
- Focus: Border Electric Blue, 2px, subtle glow
- Background: White / Soft Gray on hover
- Font: 16px (prevents zoom on iOS)

### Navigation
- Fixed top bar: 64px height
- Background: White with subtle shadow (0 1px 2px rgba(0,0,0,0.05))
- Logo/brand left, navigation center, profile/settings right
- Active nav item: Electric Blue underline (3px, rounded)
- Mobile: Hamburger converts to slide-out drawer

### Progress Indicators
- Circular progress: 4px stroke, Electric Blue
- Linear progress: 6px height, rounded ends, gradient (Electric Blue to Deep Purple)
- Percentage text: 14px, Semibold, Cool Gray 600

---

## Iconography

### Style
- **System:** Outline style (not filled) for most icons, 2px stroke
- **Size:** 20px or 24px (consistent throughout similar contexts)
- **Library:** Lucide Icons or Heroicons (clean, modern, web-friendly)
- **Special musical icons:** Custom designed, same stroke weight

### Icon Usage
- Always pair with text labels for primary actions
- Icon-only buttons acceptable for common actions (share, favorite, settings)
- Active state: Fill icon or change to Electric Blue
- Minimum size: 20px for tap targets

### Custom Musical Icons Needed
- Guitar (acoustic, electric)
- Chord diagram outline
- Metronome
- Tuning fork
- Audio waveform
- Play along / Jam mode
- Recording

---

## Motion & Animation

### Animation Principles
- **Energetic but not chaotic** - snappy and purposeful
- **Duration:** 200-300ms for most transitions (never over 400ms)
- **Easing:** Ease-out for entrances, ease-in for exits, ease-in-out for state changes
- **Spring physics** for playful moments (0.6 tension, 0.8 friction)

### Specific Animations

**Page Transitions**
- Fade + slight slide up (20px) - 250ms ease-out
- Maintains context, doesn't disorient

**Button Press**
- Scale down to 0.96 on press - 100ms ease-out
- Return with slight bounce - 200ms spring

**Card Hover**
- Lift shadow - 200ms ease-out
- Subtle scale (1.02) optional for emphasis

**Success Moments** (correct note played, lesson completed)
- Confetti burst or radial pulse from action point
- Scale + fade in celebratory badge - 400ms ease-out
- Haptic feedback on mobile

**Loading States**
- Skeleton screens (animated gradient shimmer)
- Pulse animation for placeholders - 1.5s ease-in-out infinite
- Never block UI completely - progressive loading

**Progress Indicators**
- Smooth spring animation when values update
- Color shift from gray to Electric Blue as progress increases

**Audio Visualization**
- Real-time waveform or frequency bars
- Smooth interpolation (60fps)
- Electric Blue with opacity based on amplitude

---

## Imagery & Artwork

### Photography Style

**Hero Images (Homepage, Feature Showcases)**
- **Subject Matter:** Young adults (diverse, inclusive) playing guitar in modern, well-lit spaces
- **Setting:** Bright, airy rooms with natural light, plants, minimalist furniture. Recording studios with modern equipment. Urban rooftops at golden hour. Cozy home setups with warm ambient lighting.
- **Composition:** Candid, authentic moments - not overly staged. Close-ups of hands on fretboard, mid-shots showing engagement and joy. Rule of thirds, negative space for text overlay.
- **Color Treatment:** Slightly elevated saturation, warm highlights, cool shadows. Teal/orange color grade subtle presence.
- **Mood:** Energetic, focused, joyful, communal when showing jam sessions

**Lesson Thumbnails**
- Square or 16:9 format
- Focus on the guitar technique being taught (closeup of hand position, chord shape)
- Overlaid text: Lesson name, difficulty level
- Consistent color overlay (Electric Blue or Deep Purple at 20% opacity) for brand cohesion

**Instructor Photos**
- Circular crop, 120px diameter for profile
- Genuine smile, approachable expression
- Soft background blur, good lighting
- Diversity in age, gender, ethnicity

### Illustrations

**Style Direction**
- **Vector illustrations** - clean, geometric, slightly playful
- **Line weight:** 2-3px, consistent stroke
- **Style:** Minimalist but with personality - think Stripe illustrations or Pitch.com
- **Color:** Use brand palette (Electric Blue, Vibrant Coral, Deep Purple) with Soft Gray as base
- **Subject Matter:**
  - Abstract music waves/sound visualization
  - Simplified guitar outlines
  - Musical notes flowing in organic patterns
  - People collaborating (simplified, inclusive stick-figure style)
  - Achievement badges and medals

**Illustration Use Cases**
- Empty states (no lessons saved yet, no jam sessions)
- Feature explainers (how jamming works, how feedback is given)
- Onboarding flow
- Error states (404, connection issues)
- Achievement unlocks

### Custom Artwork Needed

**1. App Icon / Logo**
- **Description:** A modern guitar pick shape with sound wave ripples emanating from it
- **Style:** Geometric, clean lines, gradient from Electric Blue to Deep Purple
- **Format:** Square canvas, icon works at 16x16 up to 512x512
- **Alternative:** Stylized guitar headstock silhouette with a waveform integrated into the negative space

**2. Loading Animation**
- **Description:** Guitar string being plucked, vibrating in waveform, then settling
- **Loop:** 2 seconds, seamless
- **Colors:** Electric Blue string, Soft Gray background, Deep Purple harmonics

**3. Achievement Badges** (10-15 designs)
- **Examples:**
  - "First Chord" - Simple chord diagram with star
  - "Week Streak" - Flame/fire icon in Vibrant Coral
  - "Jam Session Pro" - Multiple guitars overlapping
  - "Perfect Timing" - Metronome with checkmark
  - "100 Songs" - Musical note with "100" badge
- **Style:** Circular, 80px, gradient backgrounds, white icon in center, subtle depth/shadow

**4. Feature Illustrations** (Large format, 500x400px)

**a. "Play Along Mode"**
- Person with guitar, music notes flowing from screen to guitar
- Split-screen showing app on tablet and person playing
- Colors: Electric Blue screen glow, Coral notes

**b. "Jam Session"**
- Multiple simplified people/guitars connected by flowing lines
- Abstract representation of collaboration
- Colors: Deep Purple connecting lines, Electric Blue and Coral for players

**c. "Real-Time Feedback"**
- Guitar with checkmarks and waveforms appearing above strings
- Visual representation of AI listening
- Colors: Success Green checkmarks, Electric Blue waveform

**d. "Open Source Community"**
- Puzzle pieces or network nodes representing contributors
- Global/collaborative feel
- Colors: Multiple brand colors, interconnected

**5. Background Patterns** (Subtle, Tileable)
- Musical staff lines (very low opacity, 0.03)
- Dot grid (Cool Gray 300, 0.5 opacity)
- Flowing wave patterns (gradient, Electric Blue to Deep Purple, 0.05 opacity)
- Usage: Large empty spaces, behind cards, section backgrounds

**6. Onboarding Illustrations** (3-4 screens)
- Screen 1: "Welcome" - Guitar with welcoming gesture/motion lines
- Screen 2: "Learn Your Way" - Multiple paths/styles branching from single guitar
- Screen 3: "Jam Together" - Community/collaboration visual
- Screen 4: "Track Progress" - Growth chart with guitar at peak
- Style: Friendly, encouraging, simple shapes, brand colors

### Image Guidelines
- **File formats:** WebP for web (fallback JPG), SVG for icons/logos
- **Optimization:** All images under 200KB, lazy loading for below fold
- **Accessibility:** Alt text for all images, decorative images marked as such
- **Aspect ratios:** Maintain 16:9 for videos, 4:3 or 1:1 for cards, flexible for hero
- **Avoid:** Stock photo clichés (overly staged, fake emotions, corporate vibes)

---

## Voice & Tone

### Writing Principles
- **Conversational but clear** - like a knowledgeable friend
- **Encouraging, never condescending** - celebrate progress, normalize mistakes
- **Active voice** - "You learned 5 new chords" not "5 chords were learned"
- **Concise** - respect user's time, get to the point
- **Inclusive** - gender-neutral, accessible language

### Example Phrases
- ❌ "You failed to complete this exercise"  
  ✅ "Let's try that section again"

- ❌ "Access premium content"  
  ✅ "Unlock advanced lessons"

- ❌ "Error: Invalid input"  
  ✅ "Hmm, we didn't catch that. Try again?"

### Button Labels
- Prefer verbs: "Start Jamming", "Join Session", "Save Progress"
- Avoid: "Click Here", "Submit", generic terms

---

## Accessibility

### WCAG 2.1 AA Compliance
- **Color contrast:** Minimum 4.5:1 for text, 3:1 for large text (18pt+)
- **Focus indicators:** 2px solid Electric Blue outline, 2px offset
- **Keyboard navigation:** Full app usable without mouse
- **Screen readers:** Semantic HTML, ARIA labels where needed
- **Motion:** Respect prefers-reduced-motion, offer toggle

### Audio-Specific Accessibility
- Visual metronome for hearing impaired (flashing border)
- Alternative text descriptions for chord diagrams
- Haptic feedback options for timing/rhythm
- Adjustable audio feedback volume

---

## Responsive Behavior

### Mobile First Approach
- Design for 375px width first, scale up
- Touch targets: Minimum 44x44px
- Bottom navigation for primary actions (thumb-friendly)
- Simplified layouts, hide secondary information in drawers

### Tablet Optimizations
- Landscape mode: Side-by-side video + notation
- Portrait mode: Stacked, larger touch targets
- Utilize extra screen real estate for chord reference sidebar

### Desktop Enhancements
- Keyboard shortcuts (spacebar for play/pause, arrow keys for navigation)
- Hover states more pronounced
- Multi-column layouts for content browsing
- Picture-in-picture for video lessons

---

## Dark Mode Considerations

### Automatic Switching
- Respects system preference by default
- User can override in settings
- Smooth transition (300ms) when switching, no jarring flash

### Dark Mode Adjustments
- Reduce white to prevent eye strain (never pure #000000 black)
- Lower saturation slightly for primary colors (5-10%)
- Increase elevation shadows (lighter blacks with more blur)
- Adjust transparency values for overlays

---

## Implementation Notes

### Design System
- Build in Figma with shared component library
- Use auto-layout for responsive components
- Variants for all button/card states (default, hover, active, disabled)
- Design tokens exported as CSS variables or JSON for developers

### Performance
- Optimize all images (WebP, lazy loading)
- Use CSS transforms for animations (GPU accelerated)
- Minimize JavaScript bundle size
- Progressive Web App (PWA) capabilities for offline access

### Code Libraries Recommended
- **UI Components:** Radix UI or Headless UI (unstyled, accessible primitives)
- **Animation:** Framer Motion (React) or GSAP (vanilla JS)
- **Icons:** Lucide React or Heroicons
- **Audio:** Tone.js or Howler.js for web audio

---

## Brand Applications

### App Name Ideas (for future)
Consider names that evoke: collaboration, openness, rhythm, progression
- StrumSpace
- JamCore
- FretFlow
- AxeShare (axe = guitar)
- Riffmate
- ChordCircle

### Tagline Style
- Short, punchy, benefit-driven
- Examples: "Play together, anytime" / "Guitar learning, reimagined" / "Your open stage"

---

## Summary

This style guide creates a **modern, energetic, and approachable** experience for adult learners. The color palette provides vibrancy without overwhelming, the typography ensures clarity, and the animation brings life to interactions. The open-source, collaborative nature is reflected in the community-focused imagery and inclusive design choices.

**Core Visual DNA:** Apple's minimalism + Spotify's energy + Notion's clarity

Use this guide as the foundation for all design decisions, ensuring consistency across every touchpoint of the app experience.