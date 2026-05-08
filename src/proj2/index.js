import { default as gulls } from 'https://cbcdn.githack.com/charlieroberts/gulls/raw/branch/main/gulls.js'
import UI from '../modules/ui.js';

class App {
  async init(title) {
    this.ui     = new UI().init();
    this.sg     = await gulls.init(true);
    this.frag   = await gulls.import('./frag.wgsl');
    this.shader = gulls.constants.vertex + this.frag;

    // Audio state — null until a file is loaded
    this.audio   = null;
    this.playing = false;

    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'page-project-title';
      titleEl.textContent = title;
      document.body.appendChild(titleEl);
    }
  }

  // Load a File object as the audio source and arm the play/pause button.
  loadAudio(file) {
    // Revoke any previous object URL to avoid memory leaks
    if (this.audio) {
      this.audio.pause();
      URL.revokeObjectURL(this.audio.src);
    }
    const url    = URL.createObjectURL(file);
    this.audio   = new Audio(url);
    this.playing = false;

    // Arm the play/pause button now that audio is ready
    this._playBtn.disabled = false;
    this._playBtn.classList.remove('ui-button--disabled');
    this._updatePlayLabel();
  }

  // Toggle play / pause on the loaded audio element and sync the button label.
  togglePlayback() {
    if (!this.audio) return;
    if (this.playing) {
      this.audio.pause();
      this.playing = false;
    } else {
      this.audio.play();
      this.playing = true;
    }
    this._updatePlayLabel();
  }

  _updatePlayLabel() {
    if (this._playBtn) {
      this._playBtn.textContent = this.playing ? 'Pause' : 'Play';
    }
  }

  async run() {
    const back = new Float32Array(this.sg.width * this.sg.height * 4);
    const feedback_t = this.sg.texture(back);
    const frameUniform = this.sg.uniform(0);
    const mouseUniform = this.sg.uniform([0, 0, 0]);
    const audioUniform = this.sg.uniform([0, 0, 0]);

    const render_pass = await this.sg.render({
      shader: this.shader,
      data: [
        this.sg.uniform([this.sg.width, this.sg.height]), // res         binding 0
        frameUniform,                                     // frame       binding 1
        mouseUniform,                                     // mouse       binding 2
        audioUniform,                                     // audio       binding 3
        this.sg.sampler(),                                // backSampler binding 4
        feedback_t,                                       // backBuffer  binding 5
      ],
      copy: feedback_t,
    });

    let frameCount = 0;
    const loop = async (timestamp) => {
      frameUniform.value = frameCount++;
      await this.sg.once(render_pass);
      window.requestAnimationFrame(loop);
    };

    window.requestAnimationFrame(loop);
  }
}

const app = new App();
await app.init('Audio Visualizer');

app.ui.parentPush({ id: 'tool-bar', classOverrides: 'ui-toolbar' });
{
  app.ui.textbox({
    text: "This little animation requires the track 'Hide (CS01 Version)' by Dorian Concept. If you have the MP3, upload it here then press play.",
    classOverrides: "page-notice",
  });

  app.ui.fileUpload({
    label: 'Load Audio',
    id: 'audio-file',
    accept: 'audio/*',
    cb: (file) => {
      app.loadAudio(file);
    },
  });

  // Play/Pause button — disabled and visually faded until audio is loaded.
  // loadAudio() removes the disabled state and class once a file is ready.
  app._playBtn = app.ui.button({
    label: 'Play',
    id:    'play-pause-btn',
    cb:    () => app.togglePlayback(),
  });
  app._playBtn.disabled = true;
  app._playBtn.classList.add('ui-button--disabled');
}
app.ui.parentPop();

await app.run();
