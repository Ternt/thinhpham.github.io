export default class Transform {
  constructor() {
    this.position = [0, 0, 0];
    this.rotation = [0, 0, 0]; 
    this.scale    = [1, 1, 1];
  }

  static identity() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  
  static multiply(a, b) {
    const out = new Array(16).fill(0);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        for (let k = 0; k < 4; k++) {
          out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
        }
      }
    }
    return out;
  }

  static translationMatrix(tx, ty, tz) {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      tx, ty, tz, 1,
    ];
  }

  static scaleMatrix(sx, sy, sz) {
    return [
      sx, 0,  0,  0,
      0,  sy, 0,  0,
      0,  0,  sz, 0,
      0,  0,  0,  1,
    ];
  }

  static rotationX(r) {
    const c = Math.cos(r), s = Math.sin(r);
    return [
      1,  0, 0, 0,
      0,  c, s, 0,
      0, -s, c, 0,
      0,  0, 0, 1,
    ];
  }

  static rotationY(r) {
    const c = Math.cos(r), s = Math.sin(r);
    return [
       c, 0, s, 0,
       0, 1, 0, 0,
      -s, 0, c, 0,
       0, 0, 0, 1,
    ];
  }

  static rotationZ(r) {
    const c = Math.cos(r), s = Math.sin(r);
    return [
      c, -s, 0, 0,
      s,  c, 0, 0,
      0,  0, 1, 0,
      0,  0, 0, 1,
    ];
  }

  toMatrix() {
    const T  = Transform.translationMatrix(...this.position);
    const Rx = Transform.rotationX(this.rotation[0]);
    const Ry = Transform.rotationY(this.rotation[1]);
    const Rz = Transform.rotationZ(this.rotation[2]);
    const S  = Transform.scaleMatrix(...this.scale);
    return Transform.multiply(T, Transform.multiply(Rx, Transform.multiply(Ry, Transform.multiply(Rz, S))));
  }
}
