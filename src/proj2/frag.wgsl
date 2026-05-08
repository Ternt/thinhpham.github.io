// --- TheSchwartz bindings ---------------------------------------------------------

@group(0) @binding(0) var<uniform> res         : vec2f;
@group(0) @binding(1) var<uniform> frame       : f32;
@group(0) @binding(2) var<uniform> mouse       : vec3f;
@group(0) @binding(3) var<uniform> audio       : vec3f;
@group(0) @binding(4) var          backSampler : sampler;
@group(0) @binding(5) var          backBuffer  : texture_2d<f32>;

// --- TheSchwartz constants --------------------------------------------------------

const PI  : f32 = 3.14159265358979323846;
const PI2 : f32 = 6.28318530717958647692;

const red     : vec3f = vec3f(1.0, 0.0, 0.0);
const green   : vec3f = vec3f(0.0, 1.0, 0.0);
const blue    : vec3f = vec3f(0.0, 0.0, 1.0);
const purple  : vec3f = vec3f(0.5, 0.0, 1.0);
const pink    : vec3f = vec3f(1.0, 0.4, 0.7);
const teal    : vec3f = vec3f(0.0, 0.8, 0.8);
const black   : vec3f = vec3f(0.0, 0.0, 0.0);
const white   : vec3f = vec3f(1.0, 1.0, 1.0);
const orange  : vec3f = vec3f(1.0, 0.5, 0.0);
const magenta : vec3f = vec3f(1.0, 0.0, 1.0);
const brown   : vec3f = vec3f(0.6, 0.3, 0.1);
const yellow  : vec3f = vec3f(1.0, 1.0, 0.0);

// --- TheSchwartz utility functions ------------------------------------------------

// pixel position -> -1 to 1
fn uv(p: vec2f) -> vec2f {
  return (p / res) * 2.0 - vec2f(1.0);
}

// pixel position -> 0 to 1
fn uvN(p: vec2f) -> vec2f {
  return p / res;
}

// rotate a 2D point by angle (radians)
fn rotate(p: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(p.x * c - p.y * s, p.x * s + p.y * c);
}

// sample previous frame (expects normalized 0-1 coords)
fn lastframe(p: vec2f) -> vec4f {
  return textureSample(backBuffer, backSampler, p);
}

// seconds elapsed
fn seconds() -> f32 { return frame / 60.0; }

// milliseconds elapsed
fn ms() -> f32 { return (frame / 60.0) * 1000.0; }

// --- Our Actual Shader Constants --------------------------------------------------

// Animation constants
const anim_speed_modifier : f32 = 0.4;
const anim_length_s       : f32 = anim_speed_modifier * 60.0;

// Arpeggiator timing — used to gate periodic glitch fx
const arp_anim_up_length    : f32 = 1.025;
const arp_anim_down_length  : f32 = 1.332;
const arp_anim_total_length : f32 = arp_anim_up_length + arp_anim_down_length;

// Letterbox frame — 0..1 normalized, centered
const FRAME_W : f32 = 0.52;
const FRAME_H : f32 = 0.52;
const FRAME_L : f32 = (1.0 - FRAME_W) * 0.5;
const FRAME_R : f32 = FRAME_L + FRAME_W;
const FRAME_T : f32 = (1.0 - FRAME_H) * 0.5;
const FRAME_B : f32 = FRAME_T + FRAME_H;

// Color bleed base offset
const BLEED : f32 = 0.006;

// Number of glitch fx variants in fx_applyFx (cases 1..4)
const fx_sequence_count : i32 = 4;

// Circle SDF
fn sdf_circle(p: vec2f, r: f32) -> f32 { return length(p) - r; }

// --- Sky background helpers -------------------------------------------------------

// Value noise hash
fn hash2(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

// Smooth value noise — bilinear interpolation between lattice points
fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i),                   hash2(i + vec2f(1.0, 0.0)), u.x),
    mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), u.x),
    u.y
  );
}

// noise2 — alias used by fx helpers
fn noise2(p: vec2f) -> f32 { return noise(p); }

// Fractional Brownian Motion — 4 octaves for cloud-like softness
fn fbm(p: vec2f) -> f32 {
  var v: f32 = 0.0; var a: f32 = 0.5; var q: vec2f = p;
  for (var i = 0; i < 4; i++) {
    v += a * noise(q);
    q  = q * 2.1 + vec2f(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

// Sky gradient with cloud texture.
// Gradient rotated ~25° — warm yellow-green (bottom-left) → teal → deep blue (top-right).
fn sky_color(p: vec2f) -> vec3f {
  let rotated = rotate(p - vec2f(0.5), -0.44) + vec2f(0.5);
  let t = clamp(rotated.x * 0.45 + rotated.y * 0.55, 0.0, 1.0);

  let horizon : vec3f = vec3f(0.72, 0.84, 0.60);
  let midtone : vec3f = vec3f(0.25, 0.75, 0.80);
  let zenith  : vec3f = vec3f(0.10, 0.42, 0.78);

  var grad: vec3f = select(
    mix(midtone, zenith,  (t - 0.5) * 2.0),
    mix(horizon, midtone, t * 2.0),
    t < 0.5
  );

  let drift   = vec2f(seconds() * 0.012, seconds() * 0.004);
  let cloud   = smoothstep(0.38, 0.72,
    fbm(p * 3.8 + drift) * 0.6 + fbm(p * 7.2 - drift * 1.3 + vec2f(4.1, 2.9)) * 0.4);
  let lum     = 1.0 + 0.06 * fbm(p * 1.4 + vec2f(3.3, 1.1));

  return mix(grad, vec3f(0.82, 0.92, 0.94), cloud * 0.55) * lum;
}

// --- Letterbox video frame with color bleed ---------------------------------------

// Procedural sky-based frame with per-channel UV offset (VHS color fringe).
// Uses select() rather than early return to keep control flow uniform.
fn video_frame(p: vec2f, bleed_strength: f32) -> vec4f {
  let inside = p.x > FRAME_L && p.x < FRAME_R && p.y > FRAME_T && p.y < FRAME_B;

  let vid_uv    = vec2f((p.x - FRAME_L) / FRAME_W, (p.y - FRAME_T) / FRAME_H);
  let bleed_dir = normalize(vid_uv - vec2f(0.5) + vec2f(0.001));

  let uv_r = clamp(vid_uv + bleed_dir * bleed_strength,       vec2f(0.0), vec2f(1.0));
  let uv_g = clamp(vid_uv,                                     vec2f(0.0), vec2f(1.0));
  let uv_b = clamp(vid_uv - bleed_dir * bleed_strength * 0.8, vec2f(0.0), vec2f(1.0));

  // Slightly zoomed + independently drifting sky as frame content
  let zoom  = 0.7;
  let t_off = vec2f(seconds() * 0.03, 0.0);
  let r = sky_color((uv_r - 0.5) * zoom + 0.5 + t_off).r;
  let g = sky_color((uv_g - 0.5) * zoom + 0.5 + t_off).g;
  let b = sky_color((uv_b - 0.5) * zoom + 0.5 + t_off).b;

  return select(vec4f(0.0), vec4f(vec3f(r, g, b) * 1.12, 1.0), inside);
}

// --- Post-processing effects ------------------------------------------------------

// Glitch smear: walks upward from screen_uv and locks onto the first pixel
// whose luminance falls in [threshold_lower, threshold_upper], holding that
// color downward — creates horizontal VHS smear artifacts.
// lastframe() must be called every iteration to satisfy uniform control flow.
fn fx_glitchSmear(
  screen_uv: vec2f, col: vec3f,
  threshold_lower: f32, threshold_upper: f32, max_steps: i32
) -> vec3f {
  var smear: vec3f = col;
  var locked: bool = false;
  for (var i: i32 = 0; i < max_steps; i++) {
    let suv     = vec2f(screen_uv.x, screen_uv.y + f32(i) / res.y);
    let sampled = lastframe(fract(suv)).rgb;
    let lum     = dot(sampled, vec3f(0.2125, 0.7154, 0.0721));
    let update  = lum > threshold_lower && lum < threshold_upper && suv.y <= 1.0 && !locked;
    smear  = select(smear, sampled, update);
    locked = locked || update;
  }
  return smear;
}

// Glitch UV: returns a per-pixel UV offset combining five layers of distortion:
// coarse block shifts, scanline jitter, pixel quantization, stripe corruption,
// and large-scale block swaps.
fn fx_glitchUV(screen_uv: vec2f, elapsed_s: f32, intensity: f32) -> vec2f {
  let uv     = screen_uv;
  var off    = vec2f(0.0);
  let t_slow = floor(elapsed_s *  8.0) /  8.0;
  let t_med  = floor(elapsed_s * 16.0) / 16.0;
  let t_fast = floor(elapsed_s * 60.0) / 60.0;

  // LAYER 1: coarse block regions
  let bid  = floor(uv / vec2f(0.25, 0.18));
  let bact = step(0.6, noise2(bid + vec2f(t_slow * 7.3, t_slow * 3.1)));
  off += vec2f((noise2(bid + vec2f(t_med, 0.0)) - 0.5) * 0.15,
               (noise2(bid + vec2f(0.0, t_med)) - 0.5) * 0.04) * bact;

  // LAYER 2: per-scanline band shift
  let band = floor(uv.y * res.y / 6.0);
  off.x += (noise2(vec2f(band, t_med * 5.0)) - 0.5) * 0.12
         * step(0.45, noise2(vec2f(band * 0.1, t_slow)));

  // LAYER 3: per-row fine jitter
  let row = floor(uv.y * res.y);
  off.x += (noise2(vec2f(row * 0.01, t_fast * 11.0)) - 0.5) * 0.03
         * step(0.7, noise2(vec2f(row * 0.05, t_med)));

  // LAYER 4: quantized pixel stepping
  let qr  = step(0.65, noise2(floor(uv * 6.0) + t_slow));
  let qs  = mix(res.x, res.x * 0.1, qr);
  off.x  += (floor(uv.x * qs) / qs - uv.x) * qr * 0.5;

  // LAYER 5: stripe corruption
  let sb   = floor(uv.y * 12.0);
  let sact = step(0.88, noise2(vec2f(sb, t_slow * 2.0)));
  off.y   += (noise2(vec2f(sb * 3.7, t_slow)) - uv.y) * sact * 0.8;

  // LAYER 6: large-scale macro-block swap
  let mb   = floor(uv / vec2f(0.4, 0.3));
  let mact = step(0.82, noise2(mb + t_slow * 1.7));
  off += vec2f((noise2(mb + 99.0) - 0.5) * 0.6,
               (noise2(mb + 77.0) - 0.5) * 0.4) * mact;

  return off * intensity;
}

// Dispatches one of four glitch fx variants selected by arp timing.
// Called once per arpeggiator half-cycle so the effect changes with the music.
fn fx_applyFx(
  screen_uv: vec2f, col: vec3f,
  fx_id: i32, elapsed_s: f32, arp_cycle_index: f32
) -> vec3f {
  var out: vec3f = col;
  switch fx_id {
    // Case 1: glitch + chromatic aberration inside a random rect
    case 1: {
      let rsx  = noise2(vec2f(arp_cycle_index, 33.0));
      let rsy  = noise2(vec2f(arp_cycle_index, 44.0));
      let rox  = noise2(vec2f(arp_cycle_index, 11.0));
      let roy  = noise2(vec2f(arp_cycle_index, 22.0));
      let rsz  = vec2f(mix(res.x*0.4, res.x*0.9, rsx), mix(res.y*0.5, res.y*0.9, rsy));
      let luv  = (screen_uv - vec2f(rox,roy)*((res.xy-rsz)/res.xy)) / (rsz/res.xy);
      let go   = fx_glitchUV(luv, elapsed_s, 1.0);
      let ca   = vec2f(0.008, 0.0);
      let glit = vec3f(lastframe(fract(luv+go+ca)).r,
                       lastframe(fract(luv+go)).g,
                       lastframe(fract(luv+go-ca)).b);
      let inr  = luv.x>=0.0 && luv.x<=1.0 && luv.y>=0.0 && luv.y<=1.0;
      out = select(col, col + glit, inr);
    }
    // Case 2: full-screen glitch smear
    case 2: { out = fx_glitchSmear(screen_uv, col, 0.3, 0.8, 64); }
    // Case 3: full-screen glitch UV + chromatic aberration
    case 3: {
      let go  = fx_glitchUV(screen_uv, elapsed_s, 1.0);
      let ca  = vec2f(0.008, 0.0);
      out += mix(col, vec3f(lastframe(fract(screen_uv+go+ca)).r,
                            lastframe(fract(screen_uv+go)).g,
                            lastframe(fract(screen_uv+go-ca)).b), 0.85);
    }
    // Case 4: glitch smear variant (different luminance window)
    case 4: { out = fx_glitchSmear(screen_uv, col, 0.15, 0.6, 64); }
    default: { out = col; }
  }
  return out;
}

// --- Fragment entry point ---------------------------------------------------------

@fragment
fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  var screen_uv : vec2f = uvN(pos.xy);
  var uv_coord  : vec2f = uv(pos.xy);
  uv_coord.y *= -1;
  uv_coord.x *= res.x / res.y;  // aspect-correct

  // Animation time
  let elapsed_s          = frame / 60.0;
  let total_anim_time    = clamp(elapsed_s, 0.0, anim_length_s);
  let total_anim_percent = clamp(elapsed_s / anim_length_s, 0.0, 1.0);

  // Arpeggiator cycle — drives periodic fx switching
  let arp_cycle_time  = fract(total_anim_time / arp_anim_total_length) * arp_anim_total_length;
  let arp_cycle_index = floor(total_anim_time / arp_anim_total_length);

  // Audio FFT
  let fft_anim_value = 0.05 * mix(0.5, 1.2, total_anim_percent)
                       * (audio.x + audio.y + audio.z);

  // SDF circle — grows from a point to half-screen over the animation
  let radius = mix(0.01, 0.5, total_anim_percent) + fft_anim_value;
  let sdv    = sdf_circle(uv_coord, radius);

  var col: vec3f = select(vec3f(1.0), sky_color(screen_uv), sdv > 0.0);

  // Letterbox frame content
  let dynamic_bleed = BLEED + fft_anim_value * 0.8;
  let vid           = video_frame(screen_uv, dynamic_bleed);
  let frame_mask    = vid.a * select(0.0, 1.0, sdv > 0.0);
  col = mix(col, vid.rgb, frame_mask);

  let fx_up   = i32(floor(noise2(vec2f(arp_cycle_index,  0.0)) * f32(fx_sequence_count))) % fx_sequence_count;
  let fx_down = i32(floor(noise2(vec2f(arp_cycle_index, 99.0)) * f32(fx_sequence_count))) % fx_sequence_count;
  let fx_id   = select(fx_down, fx_up, arp_cycle_time < arp_anim_up_length);
  col = fx_applyFx(screen_uv, col, fx_id, elapsed_s, arp_cycle_index);

  let inside_frame = screen_uv.x > FRAME_L && screen_uv.x < FRAME_R
                  && screen_uv.y > FRAME_T && screen_uv.y < FRAME_B;
  col = select(vec3f(0.0), col, inside_frame);

  // Blue-out
  col = col * mix(vec3f(1.0), vec3f(0.0, 0.0, 0.1), total_anim_percent)
            + mix(vec3f(0.0), vec3f(0.0, 0.0, 1.0), total_anim_percent);

  return vec4f(col, 1.0);
}
