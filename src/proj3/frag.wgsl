@group(0) @binding(0) var<uniform> resolution     : vec2f;
@group(0) @binding(1) var          videoSampler   : sampler;
@group(0) @binding(2) var<uniform> options        : vec4u;
@group(1) @binding(0) var          videoBuffer    : texture_external;

fn sobel_convMat(tex: texture_external, samp: sampler, uv: vec2f) -> vec3f {
  let o = vec2f(1.0) / resolution;

  // sample the 3x3 neighborhood
  let tl = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x,  o.y)).rgb;
  let tm = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( 0.0,  o.y)).rgb;
  let tr = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x,  o.y)).rgb;
  let ml = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x,  0.0)).rgb;
  let mr = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x,  0.0)).rgb;
  let bl = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x, -o.y)).rgb;
  let bm = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( 0.0, -o.y)).rgb;
  let br = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x, -o.y)).rgb;

  // applying sobel's kernel
  let gx = -tl + tr + -2.0 * ml + 2.0 * mr + -bl + br;
  let gy =  tl + 2.0 * tm + tr + -bl - 2.0 * bm - br;

  return sqrt(gx * gx + gy * gy);
}

fn sobel(tex: texture_external, samp: sampler, uv: vec2f) -> f32 {
  let o = vec2f(1.0) / resolution;

  // sample the 3x3 neighborhood
  let tl = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x,  o.y)).rgb;
  let tm = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( 0.0,  o.y)).rgb;
  let tr = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x,  o.y)).rgb;
  let ml = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x,  0.0)).rgb;
  let mr = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x,  0.0)).rgb;
  let bl = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x, -o.y)).rgb;
  let bm = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( 0.0, -o.y)).rgb;
  let br = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x, -o.y)).rgb;

  let luma = vec3f(0.299, 0.587, 0.114);
  let gx = -dot(tl, luma) + dot(tr, luma)
         + -2.0 * dot(ml, luma) + 2.0 * dot(mr, luma)
         + -dot(bl, luma) + dot(br, luma);
  let gy =  dot(tl, luma) + 2.0 * dot(tm, luma) + dot(tr, luma)
         + -dot(bl, luma) - 2.0 * dot(bm, luma) - dot(br, luma);

  return sqrt(gx * gx + gy * gy);
}

fn prewitt_convMat(tex: texture_external, samp: sampler, uv: vec2f) -> vec3f {
  let o = vec2f(1.0) / resolution;

  // sample the 3x3 neighborhood
  let tl = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x,  o.y)).rgb;
  let tm = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( 0.0,  o.y)).rgb;
  let tr = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x,  o.y)).rgb;
  let ml = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x,  0.0)).rgb;
  let mr = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x,  0.0)).rgb;
  let bl = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x, -o.y)).rgb;
  let bm = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( 0.0, -o.y)).rgb;
  let br = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x, -o.y)).rgb;

  // applying prewitt's kernel
  let gx = -tl + tr + -ml +  mr + -bl + br;
  let gy =  tl + tm +  tr + -bl -  bm - br;

  return sqrt(gx * gx + gy * gy);
}

fn prewitt(tex: texture_external, samp: sampler, uv: vec2f) -> f32 {
  let o = vec2f(1.0) / resolution;

  // sample the 3x3 neighborhood
  let tl = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x,  o.y)).rgb;
  let tm = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( 0.0,  o.y)).rgb;
  let tr = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x,  o.y)).rgb;
  let ml = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x,  0.0)).rgb;
  let mr = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x,  0.0)).rgb;
  let bl = textureSampleBaseClampToEdge(tex, samp, uv + vec2f(-o.x, -o.y)).rgb;
  let bm = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( 0.0, -o.y)).rgb;
  let br = textureSampleBaseClampToEdge(tex, samp, uv + vec2f( o.x, -o.y)).rgb;

  let luma = vec3f(0.299, 0.587, 0.114);
  let gx = -dot(tl, luma) + dot(tr, luma)
         + -dot(ml, luma) + dot(mr, luma)
         + -dot(bl, luma) + dot(br, luma);
  let gy =  dot(tl, luma) + dot(tm, luma) + dot(tr, luma)
         + -dot(bl, luma) - dot(bm, luma) - dot(br, luma);

  return sqrt(gx * gx + gy * gy);
}

@fragment
fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy / resolution;
  let video = textureSampleBaseClampToEdge(videoBuffer, videoSampler, p);
  
  // extract options
  let algorithm = options.x;
  let algorithmView = options.y;

  var out = video.rgb;
  switch (algorithm) {
    default {}
    case 0u {} // original video
    case 1u {  // sobel
      switch (algorithmView) {
        default {}
        case 0u { // edges only
          out = vec3(sobel(videoBuffer, videoSampler, p));
        }
        case 1u { // convulation matrix
          out = sobel_convMat(videoBuffer, videoSampler, p);
        }
      }
    }
    case 2u {  // prewitt
      switch (algorithmView) {
        default {}
        case 0u { // edges only
          out = vec3(prewitt(videoBuffer, videoSampler, p));
        }
        case 1u { // convulation matrix
          out = prewitt_convMat(videoBuffer, videoSampler, p);
        }
      }
    }
  }

  return vec4f(out, 1.0);
}
