const CLUSTER_X              : u32 = 16u;
const CLUSTER_Y              : u32 = 9u;
const CLUSTER_Z              : u32 = 24u;
const MAX_LIGHTS_PER_CLUSTER : u32 = 100u;
const TOTAL_CLUSTERS         : u32 = CLUSTER_X * CLUSTER_Y * CLUSTER_Z;

struct ClusterBounds {
  min_p : vec4f,
  max_p : vec4f,
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

@group(0) @binding(0) var<uniform>             camera      : Camera;
@group(0) @binding(1) var<storage, read>       clusters    : array<ClusterBounds>;
@group(0) @binding(2) var<storage, read>       lights      : array<Light>;
@group(0) @binding(3) var<uniform>             light_count : u32;
@group(0) @binding(4) var<storage, read_write> light_grid  : array<LightGrid>;
@group(0) @binding(5) var<storage, read_write> light_list  : array<u32>;

fn sphere_aabb(center: vec3f, radius: f32, aabb_min: vec3f, aabb_max: vec3f) -> bool {
  let closest = clamp(center, aabb_min, aabb_max);
  let dist    = length(center - closest);
  return dist <= radius;
}

@compute @workgroup_size(1, 1, 1)
fn cs(@builtin(global_invocation_id) gid: vec3u) {
  let idx      = gid.x + gid.y * CLUSTER_X + gid.z * CLUSTER_X * CLUSTER_Y;
  let aabb_min = clusters[idx].min_p.xyz;
  let aabb_max = clusters[idx].max_p.xyz;

  var count  : u32 = 0u;
  var offset : u32 = idx * MAX_LIGHTS_PER_CLUSTER;

  for (var i = 0u; i < light_count; i++) {
    let light    = lights[i];
    let view_pos = (camera.view * vec4f(light.position.xyz, 1.0)).xyz;
    let radius   = light.position.w;          
    if (sphere_aabb(view_pos, radius, aabb_min, aabb_max)) {
      if (count < MAX_LIGHTS_PER_CLUSTER) {
        light_list[offset + count] = i;
        count++;
      }
    }
  }

  light_grid[idx].offset = offset;
  light_grid[idx].count  = count;
}
