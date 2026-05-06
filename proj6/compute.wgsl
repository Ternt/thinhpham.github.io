@group(0) @binding(0) var<uniform> res  : vec2f;
@group(0) @binding(1) var<uniform> feed : f32;
@group(0) @binding(2) var<uniform> kill : f32;
@group(0) @binding(3) var<uniform> dA   : f32;
@group(0) @binding(4) var<uniform> dB   : f32;
@group(0) @binding(5) var<storage, read>       currState : array<f32>;
@group(0) @binding(6) var<storage, read_write> nextState : array<f32>;

fn idx(x: u32, y: u32) -> u32 {
  return (u32(y) * u32(res.x) + u32(x)) * 2;
}

fn laplace_2d(x: u32, y: u32, off: u32) -> f32 {
  let tl = currState[idx(x - 1, y - 1) + off] * 0.05;
  let tm = currState[idx(x    , y - 1) + off] * 0.2;
  let tr = currState[idx(x + 1, y - 1) + off] * 0.05;
  let ml = currState[idx(x - 1, y    ) + off] * 0.2;
  let m  = currState[idx(x    , y    ) + off] * -1.0;
  let mr = currState[idx(x + 1, y    ) + off] * 0.2;
  let bl = currState[idx(x - 1, y + 1) + off] * 0.05;
  let bm = currState[idx(x    , y + 1) + off] * 0.2;
  let br = currState[idx(x + 1, y + 1) + off] * 0.05;
  return tl + tm + tr + ml + m + mr + bl + bm + br;
}

@compute
@workgroup_size(8, 8)
fn cs(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x;
  let y = gid.y;
  let W = res.x;
  let H = res.y;

  let i = idx(x, y);
  let currA = currState[i];
  let currB = currState[i + 1];

  let nextA = currA + (dA * laplace_2d(x, y, 0u) - (currA * currB * currB) + feed * (1.0 - currA));
  let nextB = currB + (dB * laplace_2d(x, y, 1u) + (currA * currB * currB) - (kill + feed) * currB);

  nextState[i]      = clamp(nextA, 0.0, 1.0);
  nextState[i + 1u] = clamp(nextB, 0.0, 1.0);
}

