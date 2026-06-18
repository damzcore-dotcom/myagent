---
name: Obsidian Sentinel
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#becaba'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#899485'
  outline-variant: '#3f4a3d'
  surface-tint: '#7bdb80'
  primary: '#7bdb80'
  on-primary: '#00390e'
  primary-container: '#238636'
  on-primary-container: '#f9fff3'
  inverse-primary: '#006e23'
  secondary: '#c1c7d0'
  on-secondary: '#2b3138'
  secondary-container: '#41474f'
  on-secondary-container: '#b0b5be'
  tertiary: '#a2c9ff'
  on-tertiary: '#00315c'
  tertiary-container: '#1377cd'
  on-tertiary-container: '#fffdff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#97f999'
  primary-fixed-dim: '#7bdb80'
  on-primary-fixed: '#002106'
  on-primary-fixed-variant: '#005319'
  secondary-fixed: '#dde3ec'
  secondary-fixed-dim: '#c1c7d0'
  on-secondary-fixed: '#161c23'
  on-secondary-fixed-variant: '#41474f'
  tertiary-fixed: '#d3e4ff'
  tertiary-fixed-dim: '#a2c9ff'
  on-tertiary-fixed: '#001c38'
  on-tertiary-fixed-variant: '#004882'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
  text-silver: '#e6edf3'
  text-muted: '#8b949e'
  status-red: '#f85149'
  status-yellow: '#d29922'
  bg-elevated: '#161b22'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: jetbrainsMono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-sm:
    fontFamily: jetbrainsMono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  status-xs:
    fontFamily: jetbrainsMono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 24px
  container-max: 1200px
---

## Brand & Style

The design system embodies a **"Hacker-Chic"** aesthetic, blending the raw, utilitarian power of a command-line interface with the refined precision of a premium developer tool. It is designed for developers and power users who view their AI agent as a high-performance extension of their workflow.

The visual narrative is driven by **Modern Minimalism** and **Technical Sophistication**. It avoids decorative excess in favor of information density, high-contrast readability, and subtle structural cues. The atmosphere is quiet, focused, and futuristic—evoking the feeling of a secure terminal operating in deep space. Key attributes include:

- **Precision:** Every pixel serves a functional purpose.
- **Authority:** A dark, monochromatic foundation punctuated by a singular "action" green.
- **Transparency:** System states (listening, processing, idling) are surfaced through clear, persistent status indicators.

## Colors

The palette is rooted in the "GitHub Dark" spectrum, optimized for long-duration focus and reduced eye strain. 

- **Primary Green (#238636):** Reserved for successful execution, active agent states, and primary calls to action. It represents "Go" and "Active."
- **Deep Background (#0d1117):** The foundational void. It provides maximum contrast for the silver text.
- **Border Gray (#30363d):** Used for structural definition. These borders should be subtle, appearing almost as thin etchings in the dark surface.
- **Text Silver (#e6edf3):** High-legibility content color.
- **Tertiary Blue (#58a6ff):** Used sparingly for informational links or system-level metadata.

## Typography

This design system utilizes a dual-font approach to distinguish between "Interface" and "Data."

1.  **Inter (Sans-serif):** Used for the primary UI framework, headings, and instructional text. It provides a modern, clean readability that softens the technical edge of the system.
2.  **JetBrains Mono (Monospace):** Used for all AI-generated content, terminal logs, input fields, and technical metadata. This font choice reinforces the "Local Agent" persona and provides the rhythmic legibility required for code and technical data.

**Hierarchy Rules:**
- Use **Inter** for structural elements (Sidebar labels, Page titles).
- Use **JetBrains Mono** for the "Chat" stream and any area where the user interacts with data.
- All "Labels" (button text, tags) should be in Monospace to maintain the technical aesthetic.

## Layout & Spacing

The layout is governed by a **fixed-fluid hybrid grid** based on a 4px base unit.

- **Desktop:** A fixed sidebar (260px) for navigation and system status, with a fluid main content area for the chat/work space.
- **Information Density:** High. Use narrow gutters (16px) to maximize the amount of visible data, reflecting a professional tool rather than a consumer app.
- **Vertical Rhythm:** Use consistent 8px or 16px steps between message blocks in the chat history.
- **Alignment:** Content is strictly left-aligned to mimic the natural flow of a terminal or code editor.

## Elevation & Depth

In this design system, depth is communicated through **Tonal Layering** and **Low-Contrast Outlines** rather than traditional shadows.

- **Base Layer (#0d1117):** The canvas.
- **Raised Surfaces (#161b22):** Used for cards, input areas, and headers. These should be defined by a 1px solid border (#30363d) rather than a shadow.
- **Active State:** When an element is focused or active (like an input field), the border shifts from Gray (#30363d) to the Accent Green (#238636) or Blue (#58a6ff).
- **Shadows:** Avoid shadows entirely. If absolutely necessary for a floating popover, use a sharp, 0-blur 4px offset shadow in #000000 to maintain the "Retro-Technical" feel.

## Shapes

The shape language is **Soft-Geometric**. 

- **Corners:** We use a `roundedness: 1` (4px) standard for most UI components. This is enough to feel modern and "designed" without losing the professional, rigid feel of a developer tool.
- **Buttons:** Primary buttons use a slightly higher radius (6px) to distinguish them from structural containers.
- **Chat Bubbles:** These should not look like "bubbles." They are rectangular blocks with a subtle background and a 4px corner radius, resembling code blocks.

## Components

### Buttons
- **Primary:** Filled Accent Green (#238636) with Text Silver (#e6edf3). JetBrains Mono, All-caps. No gradients.
- **Secondary:** Transparent background, 1px Border Gray (#30363d). Hover state shifts border to Blue (#58a6ff).
- **Status-Specific:** Stop/Alert buttons use #da3633.

### Input Fields
- Darkest background (#0d1117), 1px Gray border. 
- On focus: Border becomes Green (#238636) with a subtle "terminal" blinking cursor.
- Text: JetBrains Mono.

### Message Blocks (Chat)
- **User Message:** Minimal. A simple silver text block preceded by a `>_` prompt symbol.
- **Agent Message:** Contained in a #161b22 background block with a 1px border. 
- **Metadata:** Timestamps and model info in Text Muted (#8b949e) using `label-sm` typography.

### Status Indicators
- Use a solid circle dot (e.g., `🔴` for recording, `🟢` for ready, `🟡` for processing).
- Always pair icons with text labels in `status-xs` typography to ensure accessibility and clarity.

### Dividers
- 1px solid Gray (#30363d). In terminal views, use ASCII-style lines (`━━━━`) for section breaks.