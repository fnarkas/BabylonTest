precision highp float;

// Varyings
varying vec2 vUV;

// Uniforms
uniform vec4 baseColor;
uniform sampler2D baseColorTexture;
uniform bool hasTexture;

void main(void) {
    vec4 color = baseColor;

    if (hasTexture) {
        vec4 texColor = texture2D(baseColorTexture, vUV);
        color = color * texColor;
    }

    gl_FragColor = color;
}
