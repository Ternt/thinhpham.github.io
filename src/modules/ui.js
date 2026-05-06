
export default class UI {
  init() {
    // Initialize and append root UI container
    const main = document.getElementById('page-content');
    this.root = document.createElement('div');
    this.root.id = 'ui-container';
    this.root.className = 'ui-container';
    main.appendChild(this.root);

    // Count for every element in the system in order to 
    // auto-generate ids for each type of ui element.
    this.dropdownCount = 0;
    this.sliderCount = 0;
    this.buttonCount = 0;
    this.textboxCount = 0;
    this.textCount = 0;
    this.sliderCount = 0;

    // Value map. This holds all the values that each ui 
    // element is manipulating.
    this.values = {};

    // Parent stack.
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

  textbox({ text, id, classOverrides } = {}) {
    this.textboxCount += 1;
    const div = document.createElement('div');
    div.id = id ?? `textbox-${this.textboxCount}`;
    div.className = classOverrides ?? 'ui-element ui-textbox';
    div.textContent = text;
    this.currentParent().appendChild(div);
  }

  text({ text, id, classOverrides } = {}) {
    this.textCount += 1;
    const p = document.createElement('p');
    p.id = id ?? `text-${this.textboxCount}`;
    p.className = classOverrides ?? 'ui-element ui-text';
    p.textContent = text;
    this.currentParent().appendChild(p);
    return p; // add this
  }

  link({ text, href, id, classOverrides } = {}) {
    this.textCount += 1;
    const a = document.createElement('a');
    a.id = id ?? `text-${this.textboxCount}`;
    a.className = classOverrides ?? 'ui-element ui-link';
    a.href = href;
    a.textContent = text;
    this.currentParent().appendChild(a);
    return a; // add this
  }

  slider({ label, range, cb, id, classOverrides } = { 
    range: { min: 0.0, max: 1.0, step: 0.1 } 
  }) {
    this.sliderCount += 1;
    const elementId = id ?? `slider-${this.sliderCount}`;

    const sigFigs = range?.sigFigs ?? 2;
    const fmt = (v) => parseFloat(v).toPrecision(sigFigs);

    const commit = (raw) => {
      const v = Math.min(range?.max ?? 1.0, Math.max(range?.min ?? 0.0, parseFloat(raw)));
      if (isNaN(v)) return;
      sliderInput.value = v;
      sliderValue.textContent = fmt(v);
      this.values[elementId] = v;
      if (cb) cb(v, this);
    };

    const sliderDiv = document.createElement('div');
    sliderDiv.id = elementId;
    sliderDiv.className = classOverrides?.root ?? 'ui-element ui-slider';

    const sliderLabel = document.createElement('label');
    sliderLabel.textContent = label ?? '';
    sliderLabel.htmlFor = `${elementId}-input`;
    sliderLabel.className = classOverrides?.label ?? 'ui-slider-label';

    const sliderInput = document.createElement('input');
    sliderInput.type = 'range';
    sliderInput.id = `${elementId}-input`;
    sliderInput.className = classOverrides?.input ?? 'ui-slider-input';
    sliderInput.min   = range?.min  ?? 0.0;
    sliderInput.max   = range?.max  ?? 1.0;
    sliderInput.step  = range?.step ?? ((range.max - range.min) * 0.1);
    sliderInput.value = range?.value ?? range?.min ?? 0.0;

    const sliderValue = document.createElement('label');
    sliderValue.htmlFor = `${elementId}-input`;
    sliderValue.className = classOverrides?.value ?? 'ui-slider-value';
    sliderValue.textContent = fmt(sliderInput.value);

    this.values[elementId] = sliderInput.value;

    // inline edit on sliderValue click
    sliderValue.addEventListener('click', () => {
      const inlineInput = document.createElement('input');
      inlineInput.type = 'text';
      inlineInput.value = this.values[elementId];
      inlineInput.className = 'ui-slider-inline-input';
      sliderValue.replaceWith(inlineInput);
      inlineInput.focus();
      inlineInput.select();

      const finish = () => {
        commit(inlineInput.value);
        inlineInput.replaceWith(sliderValue);
      };
      inlineInput.addEventListener('blur', finish);
      inlineInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { inlineInput.blur(); }
        if (e.key === 'Escape') { inlineInput.replaceWith(sliderValue); }
      });
    });

    // popup input on right click
    sliderDiv.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      const popup = document.createElement('input');
      popup.type = 'text';
      popup.value = this.values[elementId];
      popup.className = 'ui-slider-popup-input';
      popup.style.position = 'fixed';
      popup.style.left = `${e.clientX}px`;
      popup.style.top  = `${e.clientY}px`;
      document.body.appendChild(popup);
      popup.focus();
      popup.select();

      const dismiss = () => {
        commit(popup.value);
        popup.remove();
      };
      popup.addEventListener('blur', dismiss);
      popup.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { popup.blur(); }
        if (e.key === 'Escape') { popup.remove(); }
      });
    });

    sliderInput.addEventListener('input', (e) => {
      this.values[elementId] = e.target.value;
      sliderValue.textContent = fmt(e.target.value);
      if (cb) cb(e.target.value, this);
    });

    sliderDiv.appendChild(sliderLabel);
    sliderDiv.appendChild(sliderInput);
    sliderDiv.appendChild(sliderValue);
    this.currentParent().appendChild(sliderDiv);
  }

  button({ label = 'Button', id, cb, classOverrides } = {}) {
    this.buttonCount += 1;
    const elementId = id ?? `button-${this.buttonCount}`;

    const button = document.createElement('button');
    button.id = elementId;
    button.className = classOverrides ?? 'ui-element ui-button';
    button.textContent = label;

    button.addEventListener('click', () => {
      if (cb) { cb(this); }
    });

    this.currentParent().appendChild(button);
    return button;
  }

  fileUpload({ label = 'Upload File', id, cb, accept, classOverrides } = {}) {
    this.buttonCount += 1;
    const elementId = id ?? `file-upload-${this.buttonCount}`;

    // hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.id = elementId;
    input.accept = accept ?? '*/*';
    input.style.display = 'none';

    // visible button that triggers the input
    const button = document.createElement('button');
    button.className = classOverrides ?? 'ui-element ui-button';
    button.textContent = label;

    button.addEventListener('click', () => input.click());

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      this.values[elementId] = file;
      if (cb) cb(file, this);
    });

    this.currentParent().appendChild(input);
    this.currentParent().appendChild(button);

    return { button, input };
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
