import GameObject from './gameObject.js';

export default class SceneGraph {
  constructor() {
    this.root    = new GameObject('root');
    this.objects = new Map([['root', this.root]]);
  }

  add(name, parentName = 'root') {
    const parent = this.objects.get(parentName);
    if (!parent) throw new Error(`Parent '${parentName}' not found.`);

    const obj    = new GameObject(name);
    obj.parent   = parent;
    parent.children.push(obj);
    this.objects.set(name, obj);
    return obj;
  }

  get(name) {
    return this.objects.get(name);
  }

  remove(name) {
    if (name === 'root') throw new Error('Cannot remove root.');
    const obj = this.objects.get(name);
    if (!obj) return;

    
    if (obj.parent) {
      obj.parent.children = obj.parent.children.filter(c => c !== obj);
    }

    
    this._removeDescendants(obj);
    this.objects.delete(name);
  }

  _removeDescendants(obj) {
    for (const child of obj.children) {
      this._removeDescendants(child);
      this.objects.delete(child.name);
    }
  }

  traverse(fn, node = this.root, depth = 0) {
    fn(node, depth);
    for (const child of node.children) {
      this.traverse(fn, child, depth + 1);
    }
  }

  print() {
    this.traverse((node, depth) => {
      console.log('  '.repeat(depth) + node.name);
    });
  }
}
