# Summary Panel UI Spec

## Purpose
Define a layered UI for the HN Companion summary side panel. 
The spec is declarative and describes required structure, placement, and responsibilities for global vs summary-specific elements.
The style of this UI should match the HN site aesthetic and theme (color, typography, spacing etc).

## Visual Hierarchy (Layers)
1. Base layer: Summary panel container (frame, background, resizer, layout).
2. Global layer: Header and Footer (panel-wide, persistent).
3. Content layer: Tabs (context switcher).
4. Topmost content: Active tab content (Summary tab content is highest priority).

## Global Header (Panel-Wide)
- Must contain only global controls: Settings, Help, Close.
- Must NOT contain summary-specific controls (Regenerate, Copy) or summary metadata.
- Branding may be present but minimal (icon + short label).

## Global Footer (Panel-Wide)
- Must contain only global links: Privacy, FAQ, About (or equivalent).
- Must NOT contain summary metadata (created time, provider info) or summary actions.

## Tabs (Global)
- Tabs are global and sit below the header.
- Summary tab is default/primary.
- Additional tabs may exist in the future; each tab owns its own content and controls.

## Summary Tab (Topmost Content Layer)
- Summary actions must live here, near the summary content:
  - Regenerate
  - Copy
- Summary metadata must live here, near the summary content:
  - Created time (cache age)
  - Provider origin: "HN Companion" vs "User LLM"
Both the metadata and actions should be in the same horizontal row, above the summary text.
Explore options to show the metadata as in differ visual styles (e.g. chips, inline text).

```
 ┌───────────────────────────────────────────┐
 │ [Cached] [23m ago]                  icons │
 └───────────────────────────────────────────┘
```
- Summary text is the primary content and has the strongest visual emphasis.


## Layout Line Art
```
┌──────────────────────────────────────────────┐
│ HEADER (global)                              │
│ [Brand]              [Settings][Help][Close] │
├──────────────────────────────────────────────┤
│ TABS (global)                                │
│ [Summary] [Other…]                           │
├──────────────────────────────────────────────┤
│ SUMMARY TAB (content layer)                  │
│  Actions: [Regenerate] [Copy]                │
│  Meta: Created 23m ago · Provider: HN Comp.  │
│                                              │
│  Summary text…                               │
│  …                                           │
│                                              │
├──────────────────────────────────────────────┤
│ FOOTER (global)                              │
│ Privacy · FAQ · About                        │
└──────────────────────────────────────────────┘
```
