import Camera from './camera.js';
import Transform from './transform.js';

export default class Renderer {
  static CLUSTER_X              = 16;
  static CLUSTER_Y              = 9;
  static CLUSTER_Z              = 24;
  static MAX_LIGHTS_PER_CLUSTER = 100;
  static TOTAL_CLUSTERS         = 16 * 9 * 24;
  static MAX_LIGHTS             = 256;

  constructor(wgpu, shaders) {
    this.wgpu    = wgpu;
    this.shaders = shaders;

    this.cameraBuf     = null;
    this.clusterBuf    = null;
    this.lightListBuf  = null;
    this.lightGridBuf  = null;
    this.lightsBuf     = null;
    this.lightCountBuf = null;

    this.lights = [];

    this.clusterPipeline = null;  this.clusterBG   = null;
    this.assignPipeline  = null;  this.assignBG    = null;
    this.fragLightBGL    = null;  this.fragLightBG = null;

    this.pipeline          = null;
    this.bgl               = null;
    this.bindGroups        = [];
    this.nodeRanges        = [];
    this.uniformBufs       = [];
    this.texFlagBufs       = [];
    this.emissiveFlagBufs  = [];
    this.instanceBufs      = [];
    this.posBuf = this.norBuf = this.uvBuf = null;
    this.gpuTextures          = [];
    this.emissiveTextures     = [];
    this.fallbackTexture      = null;
    this.fallbackBlackTexture = null;
    this.sampler              = null;
  }

  async init() {
    this._initClusterBuffers();
    this._uploadLights();
    await this._buildClusterPipelines();
    this.fallbackTexture      = this.wgpu.createFallbackTexture();
    this.fallbackBlackTexture = this.wgpu.createFallbackTexture([0, 0, 0, 255]);
    this.sampler              = this.wgpu.createSampler();
  }

  _initClusterBuffers() {
    const { wgpu } = this;
    const TC = Renderer.TOTAL_CLUSTERS;
    const ML = Renderer.MAX_LIGHTS_PER_CLUSTER;

    this.cameraBuf    = wgpu.createEmptyBuffer(208, GPUBufferUsage.UNIFORM  | GPUBufferUsage.COPY_DST);
    this.clusterBuf   = wgpu.createEmptyBuffer(TC * 32, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.lightListBuf = wgpu.createEmptyBuffer(TC * ML * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.lightGridBuf = wgpu.createEmptyBuffer(TC * 8, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.lightsBuf    = wgpu.createEmptyBuffer(Renderer.MAX_LIGHTS * 48, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    this.lightCountBuf = wgpu.createEmptyBuffer(4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.debugModeBuf = wgpu.createEmptyBuffer(4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

    // write 0 (no debug) by default
    wgpu.writeBuffer(this.debugModeBuf, new Uint32Array([0]));
  }

  setDebugMode(mode) {
    this.wgpu.writeBuffer(this.debugModeBuf, new Uint32Array([mode]));
  }

  setLights(lights) {
    this.lights = lights;
    this._uploadLights();
  }

  _uploadLights() {
    const count = this.lights.length;
    if (count > 0) {
      const data = new Float32Array(count * 12);
      this.lights.forEach((l, i) => {
        const base = i * 12;
        // position.xyz + position.w (radius)
        data[base + 0] = l.position[0];
        data[base + 1] = l.position[1];
        data[base + 2] = l.position[2];
        data[base + 3] = l.position[3] ?? 8.0;   // radius — was never set before!
        // color.rgb + color.w (intensity)
        data[base + 4] = l.color[0];
        data[base + 5] = l.color[1];
        data[base + 6] = l.color[2];
        data[base + 7] = l.color[3] ?? 1.0;       // intensity — was never set before!
        // attn
        data[base + 8]  = l.attn?.[0] ?? 1.0;
        data[base + 9]  = l.attn?.[1] ?? 0.2;
        data[base + 10] = l.attn?.[2] ?? 0.04;
        data[base + 11] = 0.0;
      });
      this.wgpu.writeBuffer(this.lightsBuf, data);
    }
    this.wgpu.writeBuffer(this.lightCountBuf, new Uint32Array([count]));
  }

  writeCameraUniform(camera, player, canvas) {
    const view    = camera.viewMatrixFromPlayer(player);
    const proj    = camera.projectionMatrixF32();
    const invProj = new Float32Array(Camera._invertMat4(Array.from(proj)));
    const data    = new Float32Array(52);
    data.set(view,    0);
    data.set(proj,   16);
    data.set(invProj,32);
    data[48] = camera.near;
    data[49] = camera.far;
    data[50] = canvas.width;
    data[51] = canvas.height;
    this.wgpu.writeBuffer(this.cameraBuf, data);
  }

  async _buildClusterPipelines() {
    const { device } = this.wgpu;

    const clusterBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    this.clusterBG = device.createBindGroup({
      layout: clusterBGL,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuf } },
        { binding: 1, resource: { buffer: this.clusterBuf } },
      ],
    });
    this.clusterPipeline = device.createComputePipeline({
      layout:  device.createPipelineLayout({ bindGroupLayouts: [clusterBGL] }),
      compute: { module: this.wgpu.createShaderModule(this.shaders.cluster), entryPoint: 'cs' },
    });

    const assignBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    this.assignBG = device.createBindGroup({
      layout: assignBGL,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuf } },
        { binding: 1, resource: { buffer: this.clusterBuf } },
        { binding: 2, resource: { buffer: this.lightsBuf } },
        { binding: 3, resource: { buffer: this.lightCountBuf } },
        { binding: 4, resource: { buffer: this.lightGridBuf } },
        { binding: 5, resource: { buffer: this.lightListBuf } },
      ],
    });
    this.assignPipeline = device.createComputePipeline({
      layout:  device.createPipelineLayout({ bindGroupLayouts: [assignBGL] }),
      compute: { module: this.wgpu.createShaderModule(this.shaders.lightAssign), entryPoint: 'cs' },
    });

    this.fragLightBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    this.fragLightBG = device.createBindGroup({
      layout: this.fragLightBGL,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuf } },
        { binding: 1, resource: { buffer: this.lightsBuf } },
        { binding: 2, resource: { buffer: this.lightCountBuf } },
        { binding: 3, resource: { buffer: this.lightGridBuf } },
        { binding: 4, resource: { buffer: this.lightListBuf } },
        { binding: 5, resource: { buffer: this.debugModeBuf } },
      ],
    });
  }

  extractEmissiveLights() {
    const lights = [];

    for (const { node } of this.nodeRanges) {
      const factor = node.mesh.emissiveFactor;
      if (!factor || (factor[0] === 0 && factor[1] === 0 && factor[2] === 0)) continue;

      // Compute world-space bounding box from vertex positions
      const verts = node.mesh.vertices;
      const wm    = node.worldMatrix();

      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      for (const v of verts) {
        const [lx, ly, lz] = v.position;
        // Transform to world space
        const wx = wm[0]*lx + wm[4]*ly + wm[8]*lz  + wm[12];
        const wy = wm[1]*lx + wm[5]*ly + wm[9]*lz  + wm[13];
        const wz = wm[2]*lx + wm[6]*ly + wm[10]*lz + wm[14];
        if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
        if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
        if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
      }

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const cz = (minZ + maxZ) / 2;

      // Radius = half diagonal of bounding box + padding so light reaches surroundings
      const dx = maxX - minX, dy = maxY - minY, dz = maxZ - minZ;
      const meshRadius   = Math.sqrt(dx*dx + dy*dy + dz*dz) / 2;
      const lightRadius  = meshRadius + 15.0; // how far the light reaches beyond the mesh

      const intensity = 0.01;
      const color = [factor[0], factor[1], factor[2]];

      // For long thin fixtures, spawn multiple point lights along the length
      const longestAxis = dx > dy && dx > dz ? 0 : dy > dz ? 1 : 2;
      const span = [dx, dy, dz][longestAxis];
      const numSamples = Math.max(1, Math.round(span / 4.0)); // one light every ~2 units

      for (let s = 0; s < numSamples; s++) {
        const t = numSamples === 1 ? 0.5 : s / (numSamples - 1);
        const pos = [cx, cy, cz];
        if (longestAxis === 0) pos[0] = minX + t * dx;
        if (longestAxis === 1) pos[1] = minY + t * dy;
        if (longestAxis === 2) pos[2] = minZ + t * dz;

        lights.push({
          position: [...pos, lightRadius], // .w = radius used by cluster culling!
          color:    [...color, intensity], // .w = intensity used by frag shader!
          attn:     [1.0, 0.8, 0.18, 0.0],
        });
      }
    }

    return lights;
  }

  async loadMesh(meshNodes) {
    const { wgpu } = this;

    this.meshNodes = meshNodes;

    let totalVerts = 0;
    meshNodes.forEach(n => totalVerts += n.mesh.vertexCount);

    const posAll = new Float32Array(totalVerts * 3);
    const norAll = new Float32Array(totalVerts * 3);
    const uvAll  = new Float32Array(totalVerts * 2);
    this.nodeRanges = [];
    let offset = 0;

    for (const node of meshNodes) {
      const verts = node.mesh.vertices;
      verts.forEach((v, i) => {
        posAll.set(v.position, (offset + i) * 3);
        norAll.set(v.normal,   (offset + i) * 3);
        uvAll.set(v.uv,        (offset + i) * 2);
      });
      this.nodeRanges.push({ node, start: offset, count: verts.length });
      offset += verts.length;
    }

    this.posBuf = wgpu.createBuffer(posAll, GPUBufferUsage.STORAGE);
    this.norBuf = wgpu.createBuffer(norAll, GPUBufferUsage.STORAGE);
    this.uvBuf  = wgpu.createBuffer(uvAll,  GPUBufferUsage.STORAGE);

    this.uniformBufs = meshNodes.map(() =>
      wgpu.createEmptyBuffer(224, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST)
    );

    this.texFlagBufs = meshNodes.map(() =>
      wgpu.createEmptyBuffer(4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST)
    );

    this.emissiveFlagBufs = meshNodes.map(() =>
      wgpu.createEmptyBuffer(4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST)
    );

    this.instanceBufs = meshNodes.map((node) => {
      const matrices = node.instanceMatrices ?? Transform.identity();
      return wgpu.createBuffer(matrices, GPUBufferUsage.STORAGE);
    });

    this.gpuTextures = await Promise.all(meshNodes.map(async (node) => {
      const img = node.mesh.images?.[0];
      return img ? wgpu.createTextureFromBitmap(img) : null;
    }));

    this.emissiveTextures = await Promise.all(meshNodes.map(async (node) => {
      const img = node.mesh.emissiveImage;
      return img ? wgpu.createTextureFromBitmap(img) : null;
    }));

    await this._buildMeshPipeline();
  }

  async _buildMeshPipeline() {
    const { device, format } = this.wgpu;

    const vertModule = this.wgpu.createShaderModule(this.shaders.vert);
    const fragModule = this.wgpu.createShaderModule(this.shaders.frag);

    this.bgl = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 6, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 8, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 9, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });

    this.bindGroups = this.uniformBufs.map((uniformBuf, i) => {
      const albedoTex   = this.gpuTextures[i]      ?? this.fallbackTexture;
      const emissiveTex = this.emissiveTextures[i] ?? this.fallbackBlackTexture;
      const hasAlbedo   = this.gpuTextures[i]      ? 1 : 0;
      const hasEmissive = this.emissiveTextures[i] ? 1 : 0;

      this.wgpu.writeBuffer(this.texFlagBufs[i],      new Uint32Array([hasAlbedo]));
      this.wgpu.writeBuffer(this.emissiveFlagBufs[i], new Uint32Array([hasEmissive]));

      return device.createBindGroup({
        layout: this.bgl,
        entries: [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: { buffer: this.posBuf } },
          { binding: 2, resource: { buffer: this.norBuf } },
          { binding: 3, resource: { buffer: this.uvBuf  } },
          { binding: 4, resource: albedoTex.createView()   },
          { binding: 5, resource: this.sampler             },
          { binding: 6, resource: { buffer: this.texFlagBufs[i] } },
          { binding: 7, resource: emissiveTex.createView() },
          { binding: 8, resource: { buffer: this.emissiveFlagBufs[i] } },
          { binding: 9, resource: { buffer: this.instanceBufs[i] } },
        ],
      });
    });

    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bgl, this.fragLightBGL],
      }),
      vertex: { module: vertModule, entryPoint: 'vs' },
      fragment: {
        module: fragModule,
        entryPoint: 'fs',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one',       dstFactor: 'zero',                operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' },
    });
  }

  writeNodeUniform(uniformBuf, modelMatrix, emissiveFactor, camera, player) {
    const data = new Float32Array(56);
    data.set(modelMatrix,                         0);
    data.set(camera.viewMatrixFromPlayer(player), 16);
    data.set(camera.projectionMatrixF32(),        32);
    data.set(emissiveFactor,                      48);
    data[51] = 0.0;
    this.wgpu.writeBuffer(uniformBuf, data);
  }

  frame(camera, player, colliderDebug) {
    if (!this.pipeline || !this.nodeRanges.length) return;

    const { wgpu }   = this;
    const { device } = wgpu;

    this.nodeRanges.forEach(({ node }, i) => {
      this.writeNodeUniform(
        this.uniformBufs[i],
        node.worldMatrix(),
        node.mesh.emissiveFactor ?? [0, 0, 0],
        camera,
        player,
      );
    });

    const encoder = device.createCommandEncoder();

    const clusterPass = encoder.beginComputePass();
    clusterPass.setPipeline(this.clusterPipeline);
    clusterPass.setBindGroup(0, this.clusterBG);
    clusterPass.dispatchWorkgroups(
      Renderer.CLUSTER_X,
      Renderer.CLUSTER_Y,
      Renderer.CLUSTER_Z
    );
    clusterPass.end();

    const assignPass = encoder.beginComputePass();
    assignPass.setPipeline(this.assignPipeline);
    assignPass.setBindGroup(0, this.assignBG);
    assignPass.dispatchWorkgroups(
      Renderer.CLUSTER_X,
      Renderer.CLUSTER_Y,
      Renderer.CLUSTER_Z
    );
    assignPass.end();

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view:       wgpu.currentTextureView(),
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1 },
        loadOp:     'clear',
        storeOp:    'store',
      }],
      depthStencilAttachment: {
        view:            wgpu.depthTextureView(),
        depthClearValue: 1.0,
        depthLoadOp:     'clear',
        depthStoreOp:    'store',
      },
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(1, this.fragLightBG);
    this.nodeRanges.forEach(({ node, start, count }, i) => {
      const instanceCount = node.instanceCount ?? 1;
      pass.setBindGroup(0, this.bindGroups[i]);
      pass.draw(count, instanceCount, start, 0);
    });

    colliderDebug.draw(pass);

    pass.end();
    wgpu.submit(encoder);
  }

  static collectMeshNodes(node, list = []) {
    if (node.mesh) list.push(node);
    for (const child of node.children) Renderer.collectMeshNodes(child, list);
    return list;
  }
}
