const CLUSTER_X : u32 = 16u;
const CLUSTER_Y : u32 = 9u;
const CLUSTER_Z : u32 = 24u;
const MAX_LIGHTS_PER_CLUSTER : u32 = 100u;

struct ClusterBounds {
  min_p : vec4f,
  max_p : vec4f,
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

@group(0) @binding(0) var<uniform>        camera   : Camera;
@group(0) @binding(1) var<storage, read_write> clusters : array<ClusterBounds>;

fn screen_to_view(screen: vec2f) -> vec3f {
  let ndc = vec2f(screen.x / camera.screen_w * 2.0 - 1.0,
                  1.0 - screen.y / camera.screen_h * 2.0);
  let clip  = vec4f(ndc, -1.0, 1.0);
  let view  = camera.inv_proj * clip;
  return view.xyz / view.w;
}

fn line_intersection_z(a: vec3f, b: vec3f, z: f32) -> vec3f {
  let t = (z - a.z) / (b.z - a.z);
  return a + t * (b - a);
}

@compute @workgroup_size(1, 1, 1)
fn cs(@builtin(global_invocation_id) gid: vec3u) {
  let tile_size_x = camera.screen_w / f32(CLUSTER_X);
  let tile_size_y = camera.screen_h / f32(CLUSTER_Y);

  let min_screen = vec2f(f32(gid.x) * tile_size_x, f32(gid.y) * tile_size_y);
  let max_screen = vec2f(f32(gid.x + 1u) * tile_size_x, f32(gid.y + 1u) * tile_size_y);

  let min_view = screen_to_view(min_screen);
  let max_view = screen_to_view(max_screen);

  let near = camera.near;
  let far  = camera.far;

  
  let z_near = -near * pow(far / near, f32(gid.z)       / f32(CLUSTER_Z));
  let z_far  = -near * pow(far / near, f32(gid.z + 1u)  / f32(CLUSTER_Z));

  let origin = vec3f(0.0);
  let min_near = line_intersection_z(origin, min_view, z_near);
  let max_near = line_intersection_z(origin, max_view, z_near);
  let min_far  = line_intersection_z(origin, min_view, z_far);
  let max_far  = line_intersection_z(origin, max_view, z_far);

  let idx = gid.x + gid.y * CLUSTER_X + gid.z * CLUSTER_X * CLUSTER_Y;
  clusters[idx].min_p = vec4f(min(min(min_near, max_near), min(min_far, max_far)), 0.0);
  clusters[idx].max_p = vec4f(max(max(min_near, max_near), max(min_far, max_far)), 0.0);
}
