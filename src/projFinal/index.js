import { default as gulls } from "https://cbcdn.githack.com/charlieroberts/gulls/raw/branch/main/gulls.js";
import UI from "../modules/ui.js";

class App {
  async init(title) {
    this.ui = new UI().init();
    this.sg = await gulls.init(true);
    this.frag = await gulls.import("./frag.wgsl");
    this.shader = gulls.constants.vertex + this.frag;

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
await app.init("Ray Marching Clouds");
app.ui.parentPush({ id: "tool-bar", classOverrides: "ui-toolbar" });
app.ui.parentPop();
await app.run();
