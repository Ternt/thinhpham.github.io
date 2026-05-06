import { default as gulls } from 'https://cbcdn.githack.com/charlieroberts/gulls/raw/branch/main/gulls.js'
import UI from '../modules/ui.js';

class App {
  async init(title) {
    this.ui = new UI().init();
    this.sg = await gulls.init();
    this.render_shader = await gulls.import('./frag.wgsl');
    this.compute_shader = await gulls.import('./compute.wgsl');

    this.NUM_PARTICLES = 1024;
    this.NUM_PROPERTIES = 4;

    const state = new Float32Array(this.NUM_PARTICLES * this.NUM_PROPERTIES);
    for(let i = 0; i < this.NUM_PARTICLES * this.NUM_PROPERTIES; i+= this.NUM_PROPERTIES) {
      state[ i ] = -1 + Math.random() * 2;
      state[ i + 1 ] = -1 + Math.random() * 2;
      state[ i + 2 ] = Math.random() * 10;
    }

    this.state = this.sg.buffer(state);
    this.frame = this.sg.uniform(0);
    this.res   = this.sg.uniform([this.sg.width, this.sg.height]);

    if (title) {
      const titleEl = document.createElement("div");
      titleEl.className = "page-project-title";
      titleEl.textContent = title;
      document.body.appendChild(titleEl);
    }
  }

  async run() {
    const render = await this.sg.render({
      shader: this.render_shader,
      data: [
        this.frame,
        this.res,
        this.state,
      ],
      onframe: () => { this.frame.value++; },
      count: this.NUM_PARTICLES,
      blend: true,
    });

    const dc = Math.ceil(this.NUM_PARTICLES / 64);

    const compute = this.sg.compute({
      shader: this.compute_shader,
      data: [
        this.res,
        this.state,
      ],
      dispatchCount: [dc, dc, 1],
    });

    this.sg.run(compute, render);
  }
}

const app = new App();
await app.init("Particles");
app.ui.parentPush({ id: "tool-bar", classOverrides: "ui-toolbar" });
app.ui.parentPop();
await app.run();
