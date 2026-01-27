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
- Must NOT contain summary-specific controls (Generate, Copy) or summary metadata.
- Branding: icon + "HN Companion" label.

## Global Footer (Panel-Wide)
- Must contain only global links: Privacy, FAQ, About.
- Must NOT contain summary metadata (created time, provider info) or summary actions.

## Tabs (Global)
- Tabs are global and sit below the header.
- Summary tab is default/primary.
- Additional tabs may exist in the future; each tab owns its own content and controls.

## Summary Tab (Topmost Content Layer)

### Metadata Row
The metadata row displays summary status and actions in a single horizontal line:

**For cached summaries (from HN Companion server):**
```
[CACHED] 1 hr ago | HN Companion     [Regenerate with your LLM] [Copy]
```

**For generated summaries (using user's LLM):**
```
[GENERATED] 33s | google/gemini-2.5-pro                       [Copy]
```

Elements:
- **Status chip**: `[CACHED]` (gray) or `[GENERATED]` (green) badge
- **Time**: Cache age (e.g., "1 hr ago") or generation duration (e.g., "33s")
- **Separator**: `|` pipe character
- **Provider**: "HN Companion" or the user's configured LLM (e.g., "google/gemini-2.5-pro")
  - Provider is a clickable link (opens providerUrl for cached, or settings for generated)
- **Actions** (right-aligned):
  - "Regenerate with your LLM" link (orange) - generates fresh summary using user's configured LLM
  - Copy button (icon) - copies summary text to clipboard

### Summary Text
- Primary content with strongest visual emphasis
- Scrollable area with shadow effect when scrolled

## Layout Line Art
```
+----------------------------------------------+
| HEADER (global)                              |
| [Logo] HN Companion    [Settings][Help][Close]|
+----------------------------------------------+
| TABS (global)                                |
| [Summary] [Other...]                         |
+----------------------------------------------+
| METADATA ROW (summary tab)                   |
| [CACHED] 1hr ago | HN Companion  [Generate] []|
+----------------------------------------------+
| SUMMARY TEXT (scrollable)                    |
|                                              |
| Overview                                     |
| The discussion revolves around...            |
|                                              |
| Main Themes & Key Insights                   |
| - Point 1...                                 |
| - Point 2...                                 |
|                                              |
+----------------------------------------------+
| FOOTER (global)                              |
|                      Privacy . FAQ . About   |
+----------------------------------------------+
```

## CSS Class Reference

### Metadata Row Classes
- `.summary-metadata-row` - Container for the metadata row
- `.summary-metadata-info` - Left side: chip, time, separator, provider
- `.summary-metadata-actions` - Right side: generate link, copy button
- `.summary-metadata-chip` - Base chip/badge styling
- `.summary-metadata-chip-cached` - Gray chip for cached summaries
- `.summary-metadata-chip-generated` - Green chip for generated summaries
- `.summary-metadata-primary` - Primary text (time, used for emphasis)
- `.summary-metadata-separator` - Pipe separator styling
- `.summary-metadata-provider-link` - Provider link styling (black, underline on hover)

### Action Classes
- `.summary-generate-link` - "Regenerate with your LLM" link (orange)
- `.summary-panel-copy-btn` - Copy button (icon)
