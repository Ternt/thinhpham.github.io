import Transform from './transform.js';
import GameObject from './gameObject.js';
import Mesh, { VertexInput } from './mesh.js';

function trs(translation, rotation, scale) {
  const [x, y, z, w] = rotation    ?? [0, 0, 0, 1];
  const [sx, sy, sz] = scale       ?? [1, 1, 1];
  const [tx, ty, tz] = translation ?? [0, 0, 0];
  const x2=x+x, y2=y+y, z2=z+z;
  const xx=x*x2, xy=x*y2, xz=x*z2;
  const yy=y*y2, yz=y*z2, zz=z*z2;
  const wx=w*x2, wy=w*y2, wz=w*z2;
  return new Float32Array([
    (1-(yy+zz))*sx, (xy+wz)*sx,     (xz-wy)*sx,     0,
    (xy-wz)*sy,     (1-(xx+zz))*sy, (yz+wx)*sy,     0,
    (xz+wy)*sz,     (yz-wx)*sz,     (1-(xx+yy))*sz, 0,
    tx,             ty,             tz,              1,
  ]);
}

function trsFromComponents(t, r, s) {
  return trs(t, r, s);
}

export default class ModelLoader {

  static async fromFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    switch (ext) {
      case 'glb':  return ModelLoader.parseGLB(await file.arrayBuffer());
      case 'gltf': return ModelLoader.parseGLTF(await file.text(), file);
      default:     throw new Error(`Unsupported format: .${ext}`);
    }
  }

  static async fromURL(url) {
    const ext = url.split('.').pop().toLowerCase();
    switch (ext) {
      case 'glb':  return ModelLoader.parseGLB(await fetch(url).then(r => r.arrayBuffer()));
      case 'gltf': return ModelLoader.parseGLTF(await fetch(url).then(r => r.text()), null, url);
      default:     throw new Error(`Unsupported format: .${ext}`);
    }
  }

  static async parseGLB(buffer) {
    const view = new DataView(buffer);

    // check for GLB magic.
    if (view.getUint32(0, true) !== 0x46546C67) throw new Error('GLB: invalid magic.');
    if (view.getUint32(4, true) !== 2)          throw new Error('GLB: unsupported version.');

    let jsonChunk = null;
    let binChunk  = null;
    let offset    = 12;
    while (offset < buffer.byteLength) {
      const chunkLen  = view.getUint32(offset,     true);
      const chunkType = view.getUint32(offset + 4, true);
      offset += 8;
      if (chunkType === 0x4E4F534A) {
        jsonChunk = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset, chunkLen)));
      } else if (chunkType === 0x004E4942) {
        binChunk = buffer.slice(offset, offset + chunkLen);
      }
      offset += chunkLen;
    }
    if (!jsonChunk) throw new Error('GLB: no JSON chunk.');
    return ModelLoader._parseGLTFJson(jsonChunk, () => binChunk);
  }

  static async parseGLTF(jsonText, file, baseUrl = '') {
    const gltf = JSON.parse(jsonText);
    const bufferCache = {};
    const getBuffer = async (idx) => {
      if (bufferCache[idx]) return bufferCache[idx];
      const uri = gltf.buffers[idx].uri;
      let buf;
      if (uri.startsWith('data:')) {
        const b64 = uri.split(',')[1];
        const bin = atob(b64);
        buf = new ArrayBuffer(bin.length);
        new Uint8Array(buf).forEach((_, i, a) => a[i] = bin.charCodeAt(i));
      } else {
        const url = baseUrl ? new URL(uri, baseUrl).href : uri;
        buf = await fetch(url).then(r => r.arrayBuffer());
      }
      bufferCache[idx] = buf;
      return buf;
    };
    return ModelLoader._parseGLTFJson(gltf, getBuffer);
  }

  static async _parseGLTFJson(gltf, getBuffer) {
    const images = [];

    const readAccessor = async (accessorIdx) => {
      const accessor   = gltf.accessors[accessorIdx];
      const bufView    = gltf.bufferViews[accessor.bufferView];
      const buf        = await getBuffer(bufView.buffer);
      const byteOffset = (bufView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      const count      = accessor.count;
      const componentCount = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16 }[accessor.type];
      const total = count * componentCount;
      switch (accessor.componentType) {
        case 5126: return new Float32Array(buf, byteOffset, total);
        case 5123: return new Uint16Array(buf,  byteOffset, total);
        case 5125: return new Uint32Array(buf,  byteOffset, total);
        case 5121: return new Uint8Array(buf,   byteOffset, total);
        default:   throw new Error(`GLTF: unsupported componentType ${accessor.componentType}`);
      }
    };

    if (gltf.images) {
      for (const imgDef of gltf.images) {
        if (imgDef.bufferView !== undefined) {
          const bufView = gltf.bufferViews[imgDef.bufferView];
          const buf     = await getBuffer(bufView.buffer);
          const blob    = new Blob(
            [buf.slice(bufView.byteOffset, bufView.byteOffset + bufView.byteLength)],
            { type: imgDef.mimeType }
          );
          images.push(await createImageBitmap(blob));
        }
      }
    }

    const meshLookup = [];
    for (const meshDef of gltf.meshes ?? []) {
      const vertices = [];
      let emissiveFactor = [0, 0, 0];
      let emissiveImage  = null;

      for (const prim of meshDef.primitives ?? []) {
        const posArr = prim.attributes.POSITION   !== undefined ? await readAccessor(prim.attributes.POSITION)   : null;
        const norArr = prim.attributes.NORMAL     !== undefined ? await readAccessor(prim.attributes.NORMAL)     : null;
        const uvArr  = prim.attributes.TEXCOORD_0 !== undefined ? await readAccessor(prim.attributes.TEXCOORD_0) : null;
        const idxArr = prim.indices               !== undefined ? await readAccessor(prim.indices)               : null;

        if (!posArr) continue;

        const addVertex = (i) => {
          const pos = [posArr[i*3],   posArr[i*3+1], posArr[i*3+2]];
          const nor = norArr ? [norArr[i*3], norArr[i*3+1], norArr[i*3+2]] : [0, 1, 0];
          const uv  = uvArr  ? [uvArr[i*2],  uvArr[i*2+1]]                 : [0, 0];
          vertices.push(new VertexInput(pos, nor, uv));
        };

        if (idxArr) {
          for (let i = 0; i < idxArr.length; i++) addVertex(idxArr[i]);
        } else {
          for (let i = 0; i < posArr.length / 3; i++) addVertex(i);
        }

        if (emissiveFactor[0] === 0 && emissiveFactor[1] === 0 && emissiveFactor[2] === 0) {
          const mat = gltf.materials?.[prim.material];
          if (mat) {
            const factor   = mat.emissiveFactor ?? [0, 0, 0];
            const strength = mat.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1.0;
            emissiveFactor = factor.map(c => c * strength);
            const emissiveTexIdx = mat.emissiveTexture?.index;
            if (emissiveTexIdx !== undefined) {
              const texDef = gltf.textures[emissiveTexIdx];
              emissiveImage = images[texDef.source] ?? null;
            }
          }
        }
      }

      const mesh          = new Mesh(vertices, images);
      mesh.emissiveFactor = emissiveFactor;
      mesh.emissiveImage  = emissiveImage;
      meshLookup.push(mesh);
    }

    const buildNode = async (nodeIdx, parent = null) => {
      const nodeDef = gltf.nodes[nodeIdx];
      const obj     = new GameObject(nodeDef.name ?? `node_${nodeIdx}`);
      obj.parent    = parent;

      if (nodeDef.matrix) {
        obj.localMatrix = new Float32Array(nodeDef.matrix);
      } else {
        obj.localMatrix = trs(nodeDef.translation, nodeDef.rotation, nodeDef.scale);
      }

      if (nodeDef.mesh !== undefined) {
        obj.mesh = meshLookup[nodeDef.mesh];
      }

      obj.instanceMatrices = Transform.identity();
      obj.instanceCount    = 1;

      for (const childIdx of nodeDef.children ?? []) {
        obj.children.push(await buildNode(childIdx, obj));
      }

      return obj;
    };

    const sceneIdx  = gltf.scene ?? 0;
    const sceneDef  = gltf.scenes?.[sceneIdx];
    const rootNodes = await Promise.all((sceneDef?.nodes ?? []).map(idx => buildNode(idx)));

    let root;
    if (rootNodes.length === 1) {
      root = rootNodes[0];
    } else {
      root = new GameObject('root');
      root.localMatrix      = Transform.identity();
      root.instanceMatrices = Transform.identity();
      root.instanceCount    = 1;
      for (const n of rootNodes) root.addChild(n);
    }

    return root;
  }
}
