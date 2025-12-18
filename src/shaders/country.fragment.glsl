precision highp float;

// Varying
varying float vCountryIndex;

// Uniforms
uniform sampler2D animationTexture;
uniform float animationTextureWidth;
uniform float countryHsvSaturation;  // Global saturation (deprecated, using per-country now)
uniform float countryHsvValue;

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main(void) {
    // Read per-country saturation from animation texture (G channel)
    float texCoord = (vCountryIndex + 0.5) / animationTextureWidth;
    float saturation = texture2D(animationTexture, vec2(texCoord, 0.5)).g;

    // Create unique color per country using HSV
    float hue = fract(vCountryIndex / 360.0);
    vec3 color = hsv2rgb(vec3(hue, saturation, countryHsvValue));

    gl_FragColor = vec4(color, 1.0);
}
