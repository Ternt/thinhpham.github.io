@group(0) @binding(0) var<uniform> res   : vec2f;
@group(0) @binding(1) var<storage, read> state : array<f32>;

@fragment
fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy / res;
  let idx = (u32(pos.y) * u32(res.x) + u32(pos.x)) * 2;
  let a = state[idx];
  let b = state[idx + 1];
  let c = vec3(clamp(a - b, 0.0, 1.0));
  return vec4f(c, 1.0);
}
