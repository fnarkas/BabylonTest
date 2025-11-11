precision highp float;

// Varying
varying float vCountryIndex;

// Uniforms
uniform float countryHsvSaturation;
uniform float countryHsvValue;

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main(void) {
    // Create unique color per country using HSV
    float hue = fract(vCountryIndex / 360.0);
    vec3 color = hsv2rgb(vec3(hue, countryHsvSaturation, countryHsvValue));

    gl_FragColor = vec4(color, 1.0);
}
