
export default class ColliderDebug {
  constructor(device, format, cameraBuf) {
    this.device    = device;
    this.format    = format;
    this.cameraBuf = cameraBuf;
    this.enabled   = false;
    this.drawCalls = [];

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F2') {
        e.preventDefault();
        this.enabled = !this.enabled;
      }
    });
  }

  async init(shaderSrc) {
    const { device, format } = this;

    const module = device.createShaderModule({ code: shaderSrc });

    this.bgl = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      layout:   device.createPipelineLayout({ bindGroupLayouts: [this.bgl] }),
      vertex:   { module, entryPoint: 'vs' },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one',       dstFactor: 'zero',                operation: 'add' },
          },
        }],
      },
      primitive:    { topology: 'line-list' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'less-equal' },
    });
  }

  addCollider(verts, model, color = [0, 1, 0], isLineList = false) {
    const { device } = this;
    const lines = isLineList ? verts : this._trianglesToLines(verts);

    const vertBuf = device.createBuffer({
      size:  lines.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertBuf, 0, lines);

    const modelBuf = device.createBuffer({
      size:  64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(modelBuf, 0, model instanceof Float32Array ? model : new Float32Array(model));

    const colorBuf = device.createBuffer({
      size:  16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(colorBuf, 0, new Float32Array([...color, 1.0]));

    const bindGroup = device.createBindGroup({
      layout: this.bgl,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuf } },
        { binding: 1, resource: { buffer: vertBuf } },
        { binding: 2, resource: { buffer: modelBuf } },
        { binding: 3, resource: { buffer: colorBuf } },
      ],
    });

    const handle = { vertBuf, vertCount: lines.length / 3, modelBuf, colorBuf, bindGroup };
    this.drawCalls.push(handle);
    return handle;
  }

  updateModel(handle, model) {
    this.device.queue.writeBuffer(
      handle.modelBuf, 0,
      model instanceof Float32Array ? model : new Float32Array(model)
    );
  }

  _trianglesToLines(verts) {
    const triCount = verts.length / 9;
    const lines    = new Float32Array(triCount * 18);
    let   out      = 0;

    for (let t = 0; t < triCount; t++) {
      const base = t * 9;
      const ax = verts[base],   ay = verts[base+1], az = verts[base+2];
      const bx = verts[base+3], by = verts[base+4], bz = verts[base+5];
      const cx = verts[base+6], cy = verts[base+7], cz = verts[base+8];

      lines[out++]=ax; lines[out++]=ay; lines[out++]=az;
      lines[out++]=bx; lines[out++]=by; lines[out++]=bz;

      lines[out++]=bx; lines[out++]=by; lines[out++]=bz;
      lines[out++]=cx; lines[out++]=cy; lines[out++]=cz;

      lines[out++]=cx; lines[out++]=cy; lines[out++]=cz;
      lines[out++]=ax; lines[out++]=ay; lines[out++]=az;
    }
    return lines;
  }

  clear() {
    for (const dc of this.drawCalls) {
      dc.vertBuf.destroy();
      dc.modelBuf.destroy();
      dc.colorBuf.destroy();
    }
    this.drawCalls = [];
  }

  draw(pass) {
    if (!this.enabled || this.drawCalls.length === 0) return;
    pass.setPipeline(this.pipeline);
    for (const dc of this.drawCalls) {
      pass.setBindGroup(0, dc.bindGroup);
      pass.draw(dc.vertCount);
    }
  }
}
