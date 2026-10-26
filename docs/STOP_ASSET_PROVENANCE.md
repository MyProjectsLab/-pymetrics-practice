# Stop stimulus asset provenance

Status: functional Milestone 1 assets; visual styling is provisional pending the product-wide visual direction and accessibility QA.

| File | Approved functional role | Origin |
|---|---|---|
| `public/stop/stimuli/standard-go.svg` | Red filled circle with white vertical marker | Original geometric SVG authored for Assessment Practice on 2026-09-28 |
| `public/stop/stimuli/standard-no-go.svg` | Green filled circle with white horizontal marker | Original geometric SVG authored for Assessment Practice on 2026-09-28 |
| `public/stop/stimuli/fixation.svg` | High-contrast centered plus sign | Original geometric SVG authored for Assessment Practice on 2026-09-28 |
| `public/stop/stimuli/shape-go.svg` | Solid high-contrast diamond with vertical marker | Original geometric SVG authored for Assessment Practice on 2026-09-28 |
| `public/stop/stimuli/shape-no-go.svg` | Outlined high-contrast circle with horizontal marker | Original geometric SVG authored for Assessment Practice on 2026-09-28 |

These files use only simple shapes and strokes. No competitor image, layout, source code, sequence, report, or wording was used as an input. The standard pair uses the founder-approved red/green mapping with redundant markers; the shape pair implements the approved `shape_accommodation_v1` distinction. No extended-time asset or form exists.

The color tokens, contrast, matched apparent size, display scaling, light/dark presentation, and assistive-technology behavior require the later visual and accessibility review. These assets are not represented as having passed that review.

## M2B-2 bundle use

`src/stop/assets/` contains byte-identical copies of these five originals, imported as inline SVG strings for synchronous live DOM presentation. No network fetch or image decode occurs in the timed frame path. `src/stop/assets.test.ts` verifies each copy against its M1 public source; changing either copy requires changing and reviewing both. Artwork, geometry, colors, and provenance are unchanged.
