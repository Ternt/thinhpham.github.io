import UI            from '../modules/ui.js';
import WGPU          from '../modules/wgpu.js';
import Renderer      from './engine/renderer.js';
import Transform     from './engine/transform.js';
import SceneGraph    from './engine/sceneGraph.js';
import ModelLoader   from './engine/loader.js';
import Player        from './engine/player.js';
import Camera        from './engine/camera.js';
import Physics       from './engine/physics.js';
import ColliderDebug from './engine/collider_debug.js';

function _capsuleWireframe(halfHeight, radius) {
  const verts = [];
  const segs  = 12;

  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    verts.push(Math.cos(a0) * radius,  halfHeight, Math.sin(a0) * radius);
    verts.push(Math.cos(a1) * radius,  halfHeight, Math.sin(a1) * radius);
  }
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    verts.push(Math.cos(a0) * radius, -halfHeight, Math.sin(a0) * radius);
    verts.push(Math.cos(a1) * radius, -halfHeight, Math.sin(a1) * radius);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    verts.push(Math.cos(a) * radius,  halfHeight, Math.sin(a) * radius);
    verts.push(Math.cos(a) * radius, -halfHeight, Math.sin(a) * radius);
  }
  return new Float32Array(verts);
}

class App {
  async init() {
    this.ui = new UI().init();

    this.wgpu = new WGPU();
    await this.wgpu.init(document.querySelector('canvas.project-canvas'));

    this.wgpu.onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
    };

    const [vertSrc, fragSrc, clusterSrc, lightAssignSrc, debugSrc, bloomSrc] = await Promise.all([
      fetch('./shaders/vert.wgsl').then(r => r.text()),
      fetch('./shaders/frag.wgsl').then(r => r.text()),
      fetch('./shaders/cluster.wgsl').then(r => r.text()),
      fetch('./shaders/light_assign.wgsl').then(r => r.text()),
      fetch('./shaders/collider_debug.wgsl').then(r => r.text()),
      fetch('./shaders/bloom.wgsl').then(r => r.text()),
    ]);

    this._debugSrc = debugSrc;
    this._shaders  = { vert: vertSrc, frag: fragSrc, cluster: clusterSrc, lightAssign: lightAssignSrc, bloom: bloomSrc };

    this.renderer = new Renderer(this.wgpu, this._shaders);
    await this.renderer.init();
    await this._resetScene();
    this._initFPS();
  }

  async _resetScene() {
    if (this.physics) this.physics = null;
    if (this.colliderDebug) this.colliderDebug.clear();

    this.scene = new SceneGraph();
    this.player = new Player('player');
    this.player.transform.position = [0, 5, 5];
    this.scene.root.children.push(this.player);
    this.player.parent = this.scene.root;
    this.camera = new Camera('camera');
    this.camera.transform.position = [0, this.player.eyeHeight, 0];

    this.physics = await new Physics().init();
    this.player.physicsBody = this.physics.addKinematic(this.player);
    if (!this.colliderDebug) {
      const debugSrc = this._debugSrc;
      this.colliderDebug = new ColliderDebug(
        this.wgpu.device,
        this.wgpu.format,
        this.renderer.cameraBuf,
      );
      await this.colliderDebug.init(debugSrc);
    }
    this._addPlayerDebug();
  }

  _addPlayerDebug() {
    this.playerDebugHandle = this.colliderDebug.addCollider(
      _capsuleWireframe(this.player.capsuleHalfHeight, this.player.capsuleRadius),
      Transform.identity(),
      [0.0, 0.5, 1.0],
      true,
    );
  }

  async loadModel(file) {
    const rootNode = await ModelLoader.fromFile(file);
    const meshNodes = Renderer.collectMeshNodes(rootNode);
    const total = meshNodes.reduce((s, n) => s + n.mesh.vertexCount, 0);
    console.log(`Loaded: ${file.name} - ${total} vertices across ${meshNodes.length} mesh node(s)`);

    await this._resetScene();
    await this.renderer.loadMesh(meshNodes);

    const emissiveLights = this.renderer.extractEmissiveLights();
    if (emissiveLights.length > 0) {
      this.renderer.setLights(emissiveLights);
      console.log(`Auto-generated ${emissiveLights.length} emissive point light(s)`);
    }

    for (const node of meshNodes) {
      this.physics.addStatic(node);
      const verts = new Float32Array(node.mesh.vertices.length * 3);
      node.mesh.vertices.forEach((v, i) => verts.set(v.position, i * 3));
      this.colliderDebug.addCollider(verts, node.worldMatrix(), [0.0, 1.0, 0.0]);
    }
  }

  _initFPS() {
    this._fpsEl = this.ui.text({ text: '-- fps', id: 'fps-counter' });
    this._fpsRing = new Float64Array(60);
    this._fpsHead = 0;
    this._fpsFull = false;
  }

  _updateFPS(dt) {
    this._fpsRing[this._fpsHead] = dt;
    this._fpsHead = (this._fpsHead + 1) % this._fpsRing.length;
    if (this._fpsHead === 0) this._fpsFull = true;

    const len = this._fpsFull ? this._fpsRing.length : this._fpsHead;
    let sum = 0;
    for (let i = 0; i < len; i++) sum += this._fpsRing[i];
    const avgFps = len / sum;

    if ((this._fpsHead % 15) === 0) {
      this._fpsEl.textContent = `${avgFps.toFixed(0)} fps`;
    }
  }

  run() {
    let last = performance.now();

    const frame = () => {
      const now = performance.now();
      const dt  = (now - last) / 1000;
      last      = now;

      this.physics.step(dt);
      this.player.update(dt, this.physics);

      this._updateFPS(dt);
      this.renderer.writeCameraUniform(this.camera, this.player, this.wgpu.canvas);

      if (this.playerDebugHandle) {
        const pos = this.player.transform.position;
        const m   = new Float32Array(Transform.identity());
        m[12] = pos[0]; m[13] = pos[1]; m[14] = pos[2];
        this.colliderDebug.updateModel(this.playerDebugHandle, m);
      }

      this.renderer.frame(this.camera, this.player, this.colliderDebug);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

const app = new App();
await app.init();

const DEBUG_MODES = [
  { name: 'None',          value: 0 },
  { name: 'Cluster Grid',  value: 1 },
  { name: 'Light Heatmap', value: 2 },
  { name: 'Z Slices',      value: 3 },
];

app.ui.parentPush({ id: 'debug-menu', classOverrides: 'app-params-menu' });
  app.ui.parentPush({ classOverrides: 'app-preset-dropdown' });
    app.ui.text({ text: 'Debug:' });
    app.ui.dropdown({
      options: DEBUG_MODES,
      cb: (val) => {
        app.renderer.setDebugMode(parseInt(val));
      }
    });
  app.ui.parentPop();
app.ui.parentPop();

app.ui.parentPush({ id: 'app-project-title-root', classOverrides: 'app-project-title-root' });
  app.ui.textbox({
    text: "Clustered Forward Renderer",
    classOverrides: "app-project-title",
  });
  app.ui.parentPush({ id: 'app-credit-menu-root', classOverrides: 'app-credit-menu-root' });
    app.ui.text({
      text: "The models used were from\u00A0",
      classOverrides: "app-credit",
      inline: true,
    });
    app.ui.link({
      text: "https://thisisbranden.itch.io/spaceship-modules",
      href: "https://thisisbranden.itch.io/spaceship-modules",
      classOverrides: "app-credit app-credit-link",
    });
    app.ui.text({
      text: ", with slight modifications in blender.",
      classOverrides: "app-credit",
      inline: true,
    });
  app.ui.parentPop();
app.ui.parentPop();

const canvas = document.querySelector('canvas.project-canvas');
const modelPath = canvas.dataset.model;
if (modelPath) {
  try {
    const res  = await fetch(modelPath);
    const blob = await res.blob();
    const file = new File([blob], modelPath.split('/').pop());
    await app.loadModel(file);
  } catch (e) {
    console.error('Failed to load model:', e);
  }
}

app.run();
