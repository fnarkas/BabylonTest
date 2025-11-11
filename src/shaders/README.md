# GLSL Shaders

This directory contains all GLSL shader files for the Babylon.js Earth Globe application.

## Shader Files

### Vertex Shaders

- **`animated.vertex.glsl`** - Shared vertex shader for all animated meshes (countries, borders)
  - Reads animation values from a texture
  - Applies radial displacement based on country index
  - Supports dynamic varying injection via placeholders

### Fragment Shaders

- **`border.fragment.glsl`** - Fragment shader for border meshes (tube and extruded borders)
  - Simple unlit shader with solid color

- **`country.fragment.glsl`** - Fragment shader for country polygon meshes
  - Per-country HSV-based coloring
  - Includes HSV to RGB conversion function

## Shader Architecture

### Placeholders System

The vertex shader uses a placeholder system to allow dynamic varying injection:

```glsl
// VARYINGS_PLACEHOLDER - Replaced with varying declarations
// VARYING_ASSIGNMENTS_PLACEHOLDER - Replaced with varying assignments
```

This allows the same vertex shader to be used for both simple borders (no varyings) and countries (with `vCountryIndex` varying).

### Uniforms

All shaders receive these uniforms from the TypeScript code:

**Vertex Shader:**
- `worldViewProjection` - Combined world-view-projection matrix
- `world` - World transformation matrix
- `animationTexture` - 256x1 texture containing animation values
- `maxAnimationCountries` - Maximum number of countries (256)
- `animationAmplitude` - Animation displacement amount (0.08)

**Border Fragment Shader:**
- `baseColor` - RGB color for the border

**Country Fragment Shader:**
- `countryHsvSaturation` - HSV saturation value (0.7)
- `countryHsvValue` - HSV value/brightness (0.9)

## Validation

Run shader validation with:

```bash
npm run validate:shaders
```

This checks for:
- Basic syntax errors
- Missing precision qualifiers
- Missing main() function
- Common typos (gl_Postion, gl_FragColour, etc.)
- Deprecated functions
- Unmatched braces

## Building

Shaders are automatically validated before builds via the `prebuild` script:

```bash
npm run build  # Automatically runs shader validation first
```

## Development

When editing shaders:

1. Edit the `.glsl` file directly
2. Vite will hot-reload changes automatically in dev mode
3. Run `npm run validate:shaders` to check for errors
4. The shaders are imported as raw strings in `main.ts`

## GLSL Version

These shaders use **GLSL ES 1.00** (WebGL 1.0 compatible):
- Uses `texture2D()` instead of `texture()`
- Requires explicit `precision` declarations
- Uses `attribute` instead of `in` for vertex shader inputs
- Uses `varying` for vertex-to-fragment communication
- Uses `gl_FragColor` instead of out variables
