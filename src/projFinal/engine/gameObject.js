import Transform from './transform.js';
import Mesh from './mesh.js';

export default class GameObject {
  constructor(name, mesh = null) {
    this.name      = name;
    this.transform = new Transform();
    this.parent    = null;
    this.children  = [];
    this.mesh      = mesh instanceof Mesh ? mesh : null;
    
    this.localMatrix = null;
  }

  localMatrixData() {
    return this.localMatrix ?? this.transform.toMatrix();
  }

  worldMatrix() {
    const local = this.localMatrixData();
    if (this.parent) {
      return Transform.multiply(this.parent.worldMatrix(), local);
    }
    return local;
  }

  worldMatrixF32() {
    return new Float32Array(this.worldMatrix());
  }
  
  addChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }
}
