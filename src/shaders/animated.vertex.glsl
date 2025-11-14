precision highp float;

// Attributes
attribute vec3 position;
attribute vec3 normal;
attribute float countryIndex;

// Uniforms
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform sampler2D animationTexture;
uniform float animationTextureWidth;
uniform float animationAmplitude;

// Varyings (will be injected)
// VARYINGS_PLACEHOLDER

void main(void) {
    // Read animation value from 1D texture (single row)
    float texCoord = (countryIndex + 0.5) / animationTextureWidth;
    float animValue = texture2D(animationTexture, vec2(texCoord, 0.5)).r;

    // Apply animation - scale outward from center
    vec3 animatedPosition = position;
    vec3 centerDir = normalize(position);
    animatedPosition += centerDir * animValue * animationAmplitude;

    gl_Position = worldViewProjection * vec4(animatedPosition, 1.0);

    // VARYING_ASSIGNMENTS_PLACEHOLDER
}
