import GameObject from './gameObject.js';
import Transform from './transform.js';

export default class Camera extends GameObject {
  constructor(name) {
    super(name);
    this.fov    = Math.PI / 4;
    this.aspect = window.innerWidth / window.innerHeight;
    this.near   = 0.1;
    this.far    = 1000.0;

    window.addEventListener('resize', () => {
      this.aspect = window.innerWidth / window.innerHeight;
    });
  }

  projectionMatrix() {
    const f  = 1.0 / Math.tan(this.fov / 2);
    const nf = 1.0 / (this.near - this.far);
    return [
      f / this.aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, this.far * nf, -1,
      0, 0, this.far * this.near * nf, 0,
    ];
  }

  viewMatrix() {
    return Camera._invertMat4(this.worldMatrix());
  }

  projectionMatrixF32() { return new Float32Array(this.projectionMatrix()); }
  viewMatrixF32()       { return new Float32Array(this.viewMatrix()); }

  viewMatrixFromPlayer(player) {
    const px = player.transform.position[0];
    const py = player.transform.position[1] + this.transform.position[1]; 
    const pz = player.transform.position[2];

    const yaw   = player.yaw;
    const pitch = player.pitch;

    const cy = Math.cos(yaw),   sy = Math.sin(yaw);
    const cp = Math.cos(pitch),  sp = Math.sin(pitch);

    const rx =  cy,       ry = 0,   rz = -sy;
    const ux =  sy * sp,  uy = cp,  uz =  cy * sp;
    const fx = -sy * cp,  fy = sp,  fz = -cy * cp;

    return new Float32Array([
      rx,  ux, -fx, 0,
      ry,  uy, -fy, 0,
      rz,  uz, -fz, 0,
      -(rx*px + ry*py + rz*pz),
      -(ux*px + uy*py + uz*pz),
      (fx*px + fy*py + fz*pz), 1,
    ]);
  }

  static _invertMat4(m) {
    const out = new Array(16);
    const
    a00=m[0],  a01=m[1],  a02=m[2],  a03=m[3],
    a10=m[4],  a11=m[5],  a12=m[6],  a13=m[7],
    a20=m[8],  a21=m[9],  a22=m[10], a23=m[11],
    a30=m[12], a31=m[13], a32=m[14], a33=m[15];

    const b00=a00*a11-a01*a10, b01=a00*a12-a02*a10, b02=a00*a13-a03*a10;
    const b03=a01*a12-a02*a11, b04=a01*a13-a03*a11, b05=a02*a13-a03*a12;
    const b06=a20*a31-a21*a30, b07=a20*a32-a22*a30, b08=a20*a33-a23*a30;
    const b09=a21*a32-a22*a31, b10=a21*a33-a23*a31, b11=a22*a33-a23*a32;

    let det = b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06;
    if (!det) return Transform.identity();
    det = 1.0 / det;

    out[0]  = (a11*b11 - a12*b10 + a13*b09) * det;
    out[1]  = (a02*b10 - a01*b11 - a03*b09) * det;
    out[2]  = (a31*b05 - a32*b04 + a33*b03) * det;
    out[3]  = (a22*b04 - a21*b05 - a23*b03) * det;
    out[4]  = (a12*b08 - a10*b11 - a13*b07) * det;
    out[5]  = (a00*b11 - a02*b08 + a03*b07) * det;
    out[6]  = (a32*b02 - a30*b05 - a33*b01) * det;
    out[7]  = (a20*b05 - a22*b02 + a23*b01) * det;
    out[8]  = (a10*b10 - a11*b08 + a13*b06) * det;
    out[9]  = (a01*b08 - a00*b10 - a03*b06) * det;
    out[10] = (a30*b04 - a31*b02 + a33*b00) * det;
    out[11] = (a21*b02 - a20*b04 - a23*b00) * det;
    out[12] = (a11*b07 - a10*b09 - a12*b06) * det;
    out[13] = (a00*b09 - a01*b07 + a02*b06) * det;
    out[14] = (a31*b01 - a30*b03 - a32*b00) * det;
    out[15] = (a20*b03 - a21*b01 + a22*b00) * det;

    return out;
  }
}
