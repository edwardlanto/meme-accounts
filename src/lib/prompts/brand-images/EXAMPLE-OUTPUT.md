# Worked Example — Editorial Food Carousel Cover

This file shows a complete example of what the Skill should produce when given a reference image. Use this as the gold standard for tone, depth, and structure.

## User Input

> "Here's a reference carousel cover I found on Instagram (clean white background, italic serif headline reading '5-minute breakfasts', single sunny-side-up egg floating below the headline, small running header with brand name and series name, slide counter pill in top-right). Build me a JSON prompt I can use in ChatGPT Image 2 to recreate this style for my own brand called 'Grow with Alex'."

## Skill Output

### Analysis

This is a clean editorial food magazine cover slide with a minimalist split between dramatic italic display serif typography and a single floating hero food object. The whole composition rests on extreme negative space — pure white background with no surface or plate visible, soft natural shadow beneath the egg suggesting overhead studio lighting. The italic serif headline (Playfair Display feel) does the heavy lifting visually, while the running header creates the carousel system architecture (brand top-left, series top-right, slide counter in a grey pill far top-right). Key creative decisions encoded: hyperreal egg with vivid orange yolk as the single focal point, negative space dominating the upper third, italic display serif as the brand voice, and consistent header treatment that will hold across subsequent slides in the series.

### JSON Prompt

```json
{
  "prompt": {
    "scene": {
      "description": "Clean editorial food magazine carousel cover slide on a pure white background (#FFFFFF), portrait orientation 1080x1350. Top-left corner: small bold dark-navy sans-serif text 'Grow with Alex'. Top-right corner: small bold dark-navy sans-serif text '5-Minute Breakfasts'. Far top-right corner: small grey rounded rectangle pill containing white sans-serif text '1/7'. Centered upper-middle third: huge two-line italic serif display headline in pure black reads '5-minute' on the first line and 'breakfasts' on a dramatic larger second line, Playfair Display feel with high-contrast elegant italic forms. Centered lower-middle: a single photorealistic hero food object — one perfect sunny-side-up fried egg with vivid orange yolk and crispy golden edges, photographed from slight three-quarter overhead angle, cut-out style with soft natural shadow beneath, no plate or surface visible. Bottom-center small italic dark-grey sans-serif: 'Fast mornings, real food, zero compromise' followed by a tiny egg emoji and sparkle emoji.",
      "subject": "Single sunny-side-up fried egg with vivid orange-yellow yolk dome, crispy golden-brown ruffled white edges, natural irregular shape, floating on pure white with soft diffuse shadow",
      "setting": "Pure white seamless background, studio product photography treatment, no plate or surface",
      "action": "Static composition, no motion"
    },
    "style": {
      "primary": "editorial food magazine cover, minimalist floating hero object",
      "rendering_quality": "hyperrealistic food photography, crisp typography rendering",
      "surface_textures": "Glossy vivid orange-yellow yolk dome with subtle subsurface sheen, firm white egg base with slightly translucent inner edge transitioning to crispy golden-brown ruffled outer rim",
      "lighting": "Soft overhead studio diffused lighting, gentle highlight catching the yolk dome, natural soft shadow beneath egg, no harsh reflections"
    },
    "technical": {
      "camera": {
        "focal_length": "85mm",
        "aperture": "f/8",
        "depth_of_field": "deep — egg fully sharp edge to edge",
        "angle": "slight three-quarter overhead, hero food framing"
      },
      "resolution": "ultra high definition, 2K, print-quality text rendering",
      "rendering": "Clean commercial food photography finish, no grain, crisp serif typography, subtle soft drop shadow beneath food",
      "physics_accuracy": "Believable soft contact shadow beneath egg, accurate yolk colour and matte egg-white texture, realistic crispy edge translucency"
    },
    "materials": {
      "surfaces": "Glossy vivid orange-yellow yolk surface with smooth creamy sheen; firm cooked white interior with soft sheen and minor natural irregularities; slightly crispy golden-brown ruffled outer edge with translucent quality"
    },
    "composition": {
      "perspective": "Flat portrait layout, centered symmetrical hierarchy",
      "framing": "Running header top edge, huge centered italic serif headline upper-middle, floating hero food centered lower-middle, small italic tagline bottom-center",
      "subject_placement": "Hero food centered, occupying roughly 35% of frame height in the lower-middle zone, headline dominating upper-middle zone with generous negative space around",
      "ui_elements": "Top-left: 'Grow with Alex' in small bold dark-navy sans-serif. Top-right: '5-Minute Breakfasts' in small bold dark-navy sans-serif. Far top-right: small grey rounded pill with white '1/7' sans-serif. Main headline: huge two-line italic black serif '5-minute' over 'breakfasts', centered alignment, Playfair Display aesthetic, high-contrast elegant italic. Bottom-center: small italic dark-grey sans-serif 'Fast mornings, real food, zero compromise' with egg emoji and sparkle emoji at the end."
    },
    "quality": {
      "include": [
        "hyperreal fried egg texture",
        "vivid natural yolk colour",
        "crisp italic serif headline rendering",
        "clean pure white background",
        "soft natural food shadow",
        "precise small header typography",
        "editorial magazine finish",
        "balanced cover composition",
        "crispy translucent egg edge detail",
        "accurate ceramic-free presentation"
      ],
      "avoid": [
        "warped or glitched italic headline letters",
        "missing or malformed slide counter",
        "visible plate or pan beneath egg",
        "harsh reflections or unnatural lighting",
        "garbled corner header text",
        "cartoonish food rendering",
        "neon unnatural yolk colour",
        "extra eggs or duplicate elements"
      ],
      "reference_standard": "Bon Appétit, Cherry Bombe, Kinfolk food photography meets minimalist editorial magazine cover design"
    }
  }
}
```

### Tweaks

1. **Swap to a moody version** — change the background to deep aubergine #2A1F2E, headline to warm cream #F4ECDC, egg lit dramatically from the side instead of overhead. Same composition, opposite mood. Useful for testing whether the model can hold layout consistency across radically different palettes.

2. **Try a different hero food** — swap the egg for a single piece of avocado toast, an overflowing bowl of granola, or a stack of pancakes. Tests the format's flexibility without changing the system.

3. **Drop the slide counter for a single-image use** — if this is a standalone Instagram post rather than the first slide of a carousel, remove the '1/7' pill. Cleaner cover for non-series content.
