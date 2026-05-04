import { default as gulls } from 'https://cbcdn.githack.com/charlieroberts/gulls/raw/branch/main/gulls.js'
import { default as Video } from 'https://cbcdn.githack.com/charlieroberts/gulls/raw/branch/main/helpers/video.js'

class UI {
  init() {
    // initialize and append root UI container
    const main = document.getElementById('page-content');
    this.root = document.createElement('div');
    this.root.id = 'ui-container';
    this.root.className = 'ui-container';
    main.appendChild(this.root);

    // state of ui system in order to auto-generate ui element ids.
    this.dropdownCount = 0;
    this.sliderCount = 0;
    this.buttonCount = 0;
    this.textboxCount = 0;

    // initialize value map. This holds all the values that each ui 
    // element is manipulating.
    this.values = {};

    // initialize the parent stack.
    this.parentStack = [];

    return this;
  }

  currentParent() {
    return this.parentStack.length > 0 
      ? this.parentStack[this.parentStack.length - 1] 
      : this.root;
  }

  parentPush({ id, classOverrides } = {}) {
    const div = document.createElement('div');
    div.id = id ?? `parent-${this.parentStack.length}`;
    div.className = classOverrides ?? 'ui-element ui-parent';
    this.currentParent().appendChild(div);
    this.parentStack.push(div);
  }

  parentPop() {
    if (this.parentStack.length > 0) {
      this.parentStack.pop();
    }
  }

  dropdown({ options = [], id, cb, classOverrides } = {}) {
    this.dropdownCount += 1;
    const elementId = id ?? `dropdown-${this.dropdownCount}`;

    const select = document.createElement('select');
    select.id = elementId;
    select.className = classOverrides ?? 'ui-element ui-dropdown';

    options.forEach(({ name, value }) => {
      const option = document.createElement('option');
      option.textContent = name;
      option.value = value;
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      this.values[elementId] = e.target.value;
      if (cb) cb(e.target.value, this);
    });

    this.currentParent().appendChild(select);
  }

  setDropdownOptions({ id, options = [] } = {}) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '';
    options.forEach(({ name, value }) => {
      const option = document.createElement('option');
      option.textContent = name;
      option.value = value;
      select.appendChild(option);
    });
    this.values[id] = select.value;
  }

  destroy() {
  }
};

class App {
  async init(title) {
    this.ui     = new UI().init();
    this.sg     = await gulls.init(true);
    this.frag   = await gulls.import('./frag.wgsl');
    this.shader = gulls.constants.vertex + this.frag;

    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'page-project-title';
      titleEl.textContent = title;
      document.body.appendChild(titleEl);
    }
  }

  async run() {
    await Video.init();

    const controls = this.sg.uniform([0, 0, 0, 0], Uint32Array);

    const render_pass = await this.sg.render({
      shader: this.shader,
      data: [
        this.sg.uniform([this.sg.width, this.sg.height]),
        this.sg.sampler(),
        controls,
        this.sg.video(Video.element),
      ],
    });

    const loop = async () => {
      controls.value = [
        Number(this.ui.values['algorithm']     ?? 0),
        Number(this.ui.values['algorithmView'] ?? 0),
        0, 0
      ];
      await this.sg.once(render_pass);
      window.requestAnimationFrame(loop);
    };

    window.requestAnimationFrame(loop);
  }
}

const app = new App();
await app.init('Edge Detection Algorithms');

app.ui.parentPush({ id: 'tool-bar', classOverrides: 'ui-toolbar' });
  const viewOptions = {
    0: [{ name: 'None', value: 0 }],
    1: [
      { name: 'Edges Only',  value: 0 },
      { name: 'Convolution', value: 1 },
    ],
    2: [
      { name: 'Edges Only',  value: 0 },
      { name: 'Convolution', value: 1 },
    ],
  };
  app.ui.dropdown({
    options: [
      { name: 'None',  value: 0 },
      { name: 'Sobel', value: 1 },
      { name: 'Prewitt', value: 2 },
    ],
    id: 'algorithm',
    cb: (val, ui) => { ui.setDropdownOptions({ id: 'algorithmView', options: viewOptions[val] }); }
  });
  app.ui.dropdown({ options: viewOptions[0], id: 'algorithmView' });
app.ui.parentPop();

await app.run();
