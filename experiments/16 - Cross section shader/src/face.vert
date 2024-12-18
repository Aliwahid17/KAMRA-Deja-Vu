varying vec2 vUv;
varying vec4 vPos;

void main() {
  vUv = uv;
  vPos = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
