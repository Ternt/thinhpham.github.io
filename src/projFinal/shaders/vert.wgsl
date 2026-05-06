struct Uniforms {
  model      : mat4x4f,
  view       : mat4x4f,
  projection : mat4x4f,
  emissive   : vec3f,
  _pad       : f32,
}

struct VertexOutput {
  @builtin(position) clip_position : vec4f,
  @location(0)       world_normal  : vec3f,
  @location(1)       uv            : vec2f,
  @location(2)       view_pos      : vec3f,
  @location(3)       barycentric   : vec3f,
}

@group(0) @binding(0) var<uniform>       uniforms          : Uniforms;
@group(0) @binding(1) var<storage, read> positions         : array<f32>;
@group(0) @binding(2) var<storage, read> normals           : array<f32>;
@group(0) @binding(3) var<storage, read> uvs               : array<f32>;
@group(0) @binding(9) var<storage, read> instance_matrices : array<mat4x4f>;

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VertexOutput {
  var out: VertexOutput;
  let i   = vi * 3u;
  let u   = vi * 2u;
  let pos = vec4f(positions[i], positions[i+1u], positions[i+2u], 1.0);
  let nor = vec3f(normals[i],   normals[i+1u],   normals[i+2u]);

  // barycentric coordinates for wireframe debug overlay
  let bary_idx = vi % 3u;
  if      (bary_idx == 0u) { out.barycentric = vec3f(1.0, 0.0, 0.0); }
  else if (bary_idx == 1u) { out.barycentric = vec3f(0.0, 1.0, 0.0); }
  else                     { out.barycentric = vec3f(0.0, 0.0, 1.0); }

  let instance_model = uniforms.model * instance_matrices[ii];

  let wpos = instance_model * pos;
  let vpos = uniforms.view * wpos;
  out.clip_position = uniforms.projection * vpos;
  out.world_normal  = normalize((instance_model * vec4f(nor, 0.0)).xyz);
  out.view_pos      = vpos.xyz;
  out.uv            = vec2f(uvs[u], uvs[u+1u]);
  return out;
}
