import { default as gulls } from 'https://cbcdn.githack.com/charlieroberts/gulls/raw/branch/main/gulls.js'
import UI from '../modules/ui.js';

class App {
  async init(title) {
    this.ui = new UI().init();
    this.sg = await gulls.init();
    this.render_shader = await gulls.import('./frag.wgsl');

    this.frame = this.sg.uniform(0);
    this.res   = this.sg.uniform([this.sg.width, this.sg.height]);

    if (title) {
      const titleEl = document.createElement("div");
      titleEl.className = "page-project-title";
      titleEl.textContent = title;
      document.body.appendChild(titleEl);
    }
  }

  async run() {}
}

const app = new App();
await app.init("Vants");
app.ui.parentPush({ id: "tool-bar", classOverrides: "ui-toolbar" });
app.ui.parentPop();
await app.run();
