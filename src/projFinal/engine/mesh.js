export class VertexInput {
  constructor(position, normal, uv) {
    this.position = Array.isArray(position) ? position : [0, 0, 0];
    this.normal   = Array.isArray(normal)   ? normal   : [0, 1, 0];
    this.uv       = Array.isArray(uv)       ? uv       : [0, 0];
  }

  toF32() {
    return new Float32Array([...this.position, ...this.normal, ...this.uv]);
  }

  static byteSize() { return 8 * Float32Array.BYTES_PER_ELEMENT; }
}

export default class Mesh {
  constructor(vertices = [], images = []) {
    this.vertices = vertices;
    this.images   = images;

    
    
    
    this.emissiveFactor = [0, 0, 0];
    this.emissiveImage  = null;
  }

  toF32() {
    const out = new Float32Array(this.vertices.length * 8);
    this.vertices.forEach((v, i) => out.set(v.toF32(), i * 8));
    return out;
  }

  get vertexCount() { return this.vertices.length; }
}
