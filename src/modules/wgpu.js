
/**
 * WGPU - raw WebGPU bootstrap and resource helpers.
 *
 * Owns:
 *   • adapter / device acquisition
 *   • canvas + GPUCanvasContext configuration
 *   • depth texture (created & recreated on resize)
 *   • generic buffer / texture / sampler factories
 *
 * Everything here is deliberately renderer-agnostic; no pipeline or
 * scene knowledge lives in this class.
 */
export default class WGPU {
  constructor() {
    this.adapter       = null;
    this.device        = null;
    this.canvas        = null;
    this.context       = null;
    this.format        = null;
    this.depthTexture  = null;
  }

  async init(canvas) {
    if (!navigator.gpu) throw new Error('WebGPU not supported in this browser.');

    this.adapter = await navigator.gpu.requestAdapter();
    if (!this.adapter) throw new Error('No suitable GPU adapter found.');
    this.device  = await this.adapter.requestDevice();

    this.canvas        = canvas;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;

    this.context = canvas.getContext('webgpu');
    this.format  = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device: this.device, format: this.format });

    this.depthTexture = this._newDepthTexture();

    window.addEventListener('resize', () => this._onResize());

    return this;
  }

  _onResize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.depthTexture) {
      this.depthTexture.destroy();
      this.depthTexture = this._newDepthTexture();
    }
    /** Optional callback set by the owner (e.g. App) */
    this.onResize?.();
  }

  _newDepthTexture() {
    return this.device.createTexture({
      size:   [this.canvas.width, this.canvas.height],
      format: 'depth32float',
      usage:  GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  /**
   * Create a GPU buffer, upload `data`, and return it.
   * @param {TypedArray} data
   * @param {GPUBufferUsageFlags} usage  — COPY_DST is always OR'd in.
   */
  createBuffer(data, usage) {
    const buf = this.device.createBuffer({
      size:  data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(buf, 0, data);
    return buf;
  }

  /**
   * Create an empty GPU buffer of `size` bytes.
   * @param {number} size
   * @param {GPUBufferUsageFlags} usage
   */
  createEmptyBuffer(size, usage) {
    return this.device.createBuffer({ size, usage });
  }

  /**
   * Write typed data into an existing buffer.
   * @param {GPUBuffer} buf
   * @param {TypedArray} data
   * @param {number} [offset=0]  byte offset into the buffer
   */
  writeBuffer(buf, data, offset = 0) {
    this.device.queue.writeBuffer(buf, offset, data);
  }

  /**
   * Upload an ImageBitmap to a GPU texture.
   * @param {ImageBitmap} imageBitmap
   * @returns {GPUTexture}
   */
  createTextureFromBitmap(imageBitmap) {
    const tex = this.device.createTexture({
      size:   [imageBitmap.width, imageBitmap.height, 1],
      format: 'rgba8unorm',
      usage:  GPUTextureUsage.TEXTURE_BINDING  |
              GPUTextureUsage.COPY_DST          |
              GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: tex },
      [imageBitmap.width, imageBitmap.height],
    );
    return tex;
  }

  /**
   * Create a 1×1 white fallback texture (rgba8unorm).
   * @returns {GPUTexture}
   */
  createFallbackTexture() {
    const tex = this.device.createTexture({
      size:   [1, 1, 1],
      format: 'rgba8unorm',
      usage:  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.device.queue.writeTexture(
      { texture: tex },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      [1, 1],
    );
    return tex;
  }

  /**
   * Create a linear mip-mapped sampler.
   * @param {GPUSamplerDescriptor} [desc]
   * @returns {GPUSampler}
   */
  createSampler(desc = {}) {
    return this.device.createSampler({
      magFilter:    'linear',
      minFilter:    'linear',
      mipmapFilter: 'linear',
      ...desc,
    });
  }

  /**
   * Compile a WGSL source string into a GPUShaderModule.
   * @param {string} code
   * @returns {GPUShaderModule}
   */
  createShaderModule(code) {
    return this.device.createShaderModule({ code });
  }

  /** Return the current swap-chain texture view. */
  currentTextureView() {
    return this.context.getCurrentTexture().createView();
  }

  /** Return the depth texture view. */
  depthTextureView() {
    return this.depthTexture.createView();
  }

  /** Encode and submit a list of command buffers. */
  submit(encoderOrBuffers) {
    if (Array.isArray(encoderOrBuffers)) {
      this.device.queue.submit(encoderOrBuffers);
    } else {
      this.device.queue.submit([encoderOrBuffers.finish()]);
    }
  }
}
