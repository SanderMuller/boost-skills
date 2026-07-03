# Design verification — per-element comparison of design vs implementation

> Loaded on demand. Read this when a UI change has an **approved design** (a Figma
> frame, a mockup, a ticket attachment) and you need to confirm the implementation
> matches it — not just that it renders and works. This is the visual-fidelity
> companion to the `frontend-quality` eye-verify step (which proves behaviour) and to
> the screenshot the `pull-requests` skill embeds for reviewers.

"Looks about right" is how visual regressions ship. A screenshot beside a design is only
useful when read **per element, per attribute** — a glance at the whole image misses a
4px-vs-8px radius, a dropped gradient, or a control drifted 3px off-centre. Force the
comparison to be explicit.

## When to use

- A change alters user-facing UI **and** an approved design exists for it — judge the same
  screenshot you capture for reviewers against that design.
- When a testable is "matches the design", or before review on any pixel-sensitive change
  (a new component, a redesign, a layout tweak a designer signed off).
- If there is **no** design to compare against, this doesn't apply — fall back to the ordinary
  eye-verify (renders, no untranslated-key leaks, no console errors).

## Inputs

1. **The reference design** — a Figma export, a mockup, or a ticket attachment. You need it as
   a viewable image to *score*; you only need it as a committed file to *embed* it in the PR
   (see the `pull-requests` skill's screenshot guidance for private-repo embedding).
2. **The implementation screenshot** — captured against *this* working tree, cropped to the
   changed surface with **≥15px breathing room** around it (a flush crop hides alignment and
   spacing errors at the element's own edges). The skill's `scripts/screenshot.mjs` companion
   does this — `--selector` crops to the element and pads automatically; see `scripts/README.md`.

Put the two side by side before scoring.

## Method — enumerate elements, then score each on every attribute

1. **List the discrete elements** the design defines, **plus the element as a whole** (its
   container/background). For a small component that's usually 4–6 rows. Name each concretely
   so the comparison is unambiguous.
2. **Exclude out-of-scope elements and documented deviations — but only when the divergence is
   written down** (ticket, spec, or PR). An **undocumented** difference is a finding, not a
   deviation.
3. **Score every remaining element against every applicable attribute.** "Applicable": a text
   node has no border-radius; a container has no typography of its own — skip the N/A ones, but
   walk the whole list each time so none is forgotten.

   | Attribute | Check (design → implementation) |
   |---|---|
   | **Alignment** | Horizontal position **and vertical alignment** (centred vs top/baseline) — the most common miss. |
   | **Size** | Width, height; for a control, the clickable/tap area, not just the visible glyph. |
   | **Text colour** | Glyph colour vs the design's. |
   | **Background** | Fill colour — **and gradient**: match direction and stops, not a flat average. A missing gradient is a real miss. |
   | **Borders** | Presence/absence (an inherited border where the design has none is a miss), colour, width, style. |
   | **Border-radius** | Corner rounding, per corner when they differ. |
   | **Icons** | Correct glyph, size, and colour. |
   | **Typography** | Font family, **weight**, size, line-height, letter-spacing, case. |
   | **Spacing** | Internal padding, and gaps between sibling elements. |
   | **Shadow / elevation** | Drop shadow / focus ring presence, blur, colour. |

4. **When there's no design-token spec (only a screenshot), sample the image** for exact values
   rather than guessing — pixel-pick gradient stops and text colours from the design, then map
   each to the nearest **project token** (Tailwind palette / SCSS variable / CSS custom
   property), not an approximate literal.

## Output

- A **per-element table**: one row per element, a column per attribute, each cell
  `✓` (matches) / `✗ design→impl` (mismatch, with both values) / `–` (N/A) /
  `intentional` (documented deviation).
- A short list of the `✗` mismatches as `element — attribute: design vs implementation`, so
  each converts directly into a fix task.
- The excluded elements named, with why (out of scope / documented deviation).

Every `✗` is a fix, or — when it's a genuine UX judgement call — a question flagged to the
designer/user, never a silent pass.
