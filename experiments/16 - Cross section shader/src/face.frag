uniform sampler2D map;
uniform vec2 clipRange;

varying vec2 vUv;
varying vec4 vPos;

void main() {
  if (vPos.y < clipRange.x || clipRange.y < vPos.y) discard;

  vec4 c = texture2D(map, vUv);
  if (!gl_FrontFacing) {
    c = mix(c, vec4(0, 0, 0, 1), 0.8);
  }
  gl_FragColor = c;
}
