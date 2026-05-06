struct Camera {
  view       : mat4x4f,
  projection : mat4x4f,
  inv_proj   : mat4x4f,
  near       : f32,
  far        : f32,
  screen_w   : f32,
  screen_h   : f32,
}

struct VertexOutput {
  @builtin(position) clip_position : vec4f,
  @location(0)       color         : vec3f,
}

@group(0) @binding(0) var<uniform>       camera   : Camera;
@group(0) @binding(1) var<storage, read> vertices : array<f32>;
@group(0) @binding(2) var<uniform>       model    : mat4x4f;
@group(0) @binding(3) var<uniform>       color    : vec4f;

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VertexOutput {
  var out: VertexOutput;
  let i   = vi * 3u;
  let pos = vec4f(vertices[i], vertices[i+1u], vertices[i+2u], 1.0);
  out.clip_position = camera.projection * camera.view * model * pos;
  out.color         = color.rgb;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(in.color, 1.0);
}
