// constants
const DEBUG_NONE    : u32 = 0u;
const DEBUG_CLUSTER : u32 = 1u;
const DEBUG_HEATMAP : u32 = 2u;
const DEBUG_ZSLICE  : u32 = 3u;

const CLUSTER_X              : u32 = 16u;
const CLUSTER_Y              : u32 = 9u;
const CLUSTER_Z              : u32 = 24u;
const MAX_LIGHTS_PER_CLUSTER : u32 = 100u;

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

struct Light {
  position : vec4f,
  color    : vec4f,
  attn     : vec4f,
}

struct LightGrid {
  offset : u32,
  count  : u32,
}

struct Camera {
  view       : mat4x4f,
  projection : mat4x4f,
  inv_proj   : mat4x4f,
  near       : f32,
  far        : f32,
  screen_w   : f32,
  screen_h   : f32,
}

@group(0) @binding(0) var<uniform> uniforms         : Uniforms;
@group(0) @binding(4) var          albedo_texture   : texture_2d<f32>;
@group(0) @binding(5) var          albedo_sampler   : sampler;
@group(0) @binding(6) var<uniform> has_texture      : u32;
@group(0) @binding(7) var          emissive_texture : texture_2d<f32>;
@group(0) @binding(8) var<uniform> has_emissive_tex : u32;
@group(0) @binding(10) var screen_texture : texture_2d<f32>;
@group(0) @binding(11) var screen_sampler : sampler;

@group(1) @binding(0) var<uniform>       camera      : Camera;
@group(1) @binding(1) var<storage, read> lights      : array<Light>;
@group(1) @binding(2) var<uniform>       light_count : u32;
@group(1) @binding(3) var<storage, read> light_grid  : array<LightGrid>;
@group(1) @binding(4) var<storage, read> light_list  : array<u32>;
@group(1) @binding(5) var<uniform> debug_mode : u32;

fn cluster_index(clip_pos: vec4f, view_z: f32) -> u32 {
  let x = u32(clip_pos.x / camera.screen_w * f32(CLUSTER_X));
  let y = u32(clip_pos.y / camera.screen_h * f32(CLUSTER_Y));
  let z = u32(floor(log(max(-view_z, camera.near) / camera.near)
              / log(camera.far / camera.near) * f32(CLUSTER_Z)));
  return clamp(x, 0u, CLUSTER_X - 1u)
       + clamp(y, 0u, CLUSTER_Y - 1u) * CLUSTER_X
       + clamp(z, 0u, CLUSTER_Z - 1u) * CLUSTER_X * CLUSTER_Y;
}

fn clq_attenuation(dist: f32, radius: f32, intensity: f32, C: f32, L: f32, Q: f32) -> f32 {
  if (dist >= radius) { return 0.0; }
  let denom = C + L * dist + Q * dist * dist;
  let raw   = intensity / max(denom, 1e-6);
  let t    = dist / radius;
  let soft = 1.0 - smoothstep(0.7, 1.0, t);
  return raw * soft;
}

// wireframe debug shader.
fn wireframe(bary: vec3f, thickness: f32) -> f32 {
  let d = fwidth(bary) * thickness;
  let a = smoothstep(vec3f(0.0), d, bary);
  return 1.0 - min(min(a.x, a.y), a.z);
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let N           = normalize(in.world_normal);
  let cluster_idx = cluster_index(in.clip_position, in.view_pos.z);
  let grid        = light_grid[cluster_idx];

  var base_color : vec3f;
  if (has_texture == 1u) {
    base_color = textureSample(albedo_texture, albedo_sampler, in.uv).rgb;
  } else {
    base_color = vec3f(0.6, 0.6, 0.65);
  }

  let ambient = base_color * 0.05;

  var Lo = vec3f(0.0);
  for (var i = 0u; i < grid.count; i++) {
    let light_idx      = light_list[grid.offset + i];
    let light          = lights[light_idx];
    let light_view_pos = (camera.view * vec4f(light.position.xyz, 1.0)).xyz;
    let L_vec          = light_view_pos - in.view_pos;
    let dist           = length(L_vec);
    let radius         = light.position.w;
    let C              = light.attn.x;
    let L_coeff        = light.attn.y;
    let Q              = light.attn.z;
    let intensity      = light.color.w;

    let attenuation = clq_attenuation(dist, radius, intensity, C, L_coeff, Q);
    if (attenuation <= 0.0) { continue; }

    let diffuse = max(dot(N, normalize(L_vec)), 0.0);
    Lo += base_color * light.color.rgb * diffuse * attenuation;
  }

  var emissive = uniforms.emissive;
  if (has_emissive_tex == 1u) {
    emissive *= textureSample(emissive_texture, albedo_sampler, in.uv).rgb;
  }

  // final lighting color output
  let lit = vec4f(ambient + Lo + emissive, 1.0);

  if (debug_mode == DEBUG_NONE) {
    return lit;
  }

  let cx = clamp(u32(in.clip_position.x / camera.screen_w * f32(CLUSTER_X)), 0u, CLUSTER_X - 1u);
  let cy = clamp(u32(in.clip_position.y / camera.screen_h * f32(CLUSTER_Y)), 0u, CLUSTER_Y - 1u);
  let cz = clamp(u32(floor(log(max(-in.view_pos.z, camera.near) / camera.near)
    / log(camera.far / camera.near) * f32(CLUSTER_Z))), 0u, CLUSTER_Z - 1u);

  var debug_color = vec3f(0.0);

  if (debug_mode == DEBUG_CLUSTER) {
    let parity = (cx + cy + cz) % 2u;
    debug_color = select(vec3f(0.1, 0.1, 0.4), vec3f(0.4, 0.1, 0.1), parity == 1u);
    debug_color += (ambient + Lo + emissive) * 0.3;
  }

  if (debug_mode == DEBUG_HEATMAP) {
    let count = light_grid[cluster_idx].count;
    let t     = clamp(f32(count) / 8.0, 0.0, 1.0);
    if (t < 0.25) {
      debug_color = mix(vec3f(0.0, 0.0, 1.0), vec3f(0.0, 1.0, 1.0), t / 0.25);
    } else if (t < 0.5) {
      debug_color = mix(vec3f(0.0, 1.0, 1.0), vec3f(0.0, 1.0, 0.0), (t - 0.25) / 0.25);
    } else if (t < 0.75) {
      debug_color = mix(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 1.0, 0.0), (t - 0.5) / 0.25);
    } else {
      debug_color = mix(vec3f(1.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), (t - 0.75) / 0.25);
    }
  }

  if (debug_mode == DEBUG_ZSLICE) {
    let t   = f32(cz) / f32(CLUSTER_Z);
    debug_color = vec3f(t, 1.0 - t, sin(t * 3.14159));
  }

  // overlay wireframe on all debug modes
  let wire       = wireframe(in.barycentric, 1);
  let wire_color = vec3f(0.6, 0.6, 1.0);
  debug_color    = mix(debug_color, wire_color, wire * 0.8);

  return vec4f(debug_color, 1.0);
}
