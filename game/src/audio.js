// Synthesized sound: engine hum, sirens, blips and booms, all generated with WebAudio.
// No audio files are loaded, so the game stays fully offline.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.musicGain = null;
    this.musicOn = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;

    // Engine: two detuned saws through a lowpass, gain by speed.
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'sawtooth';
    this.engineOsc2.frequency.value = 82;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc.start();
    this.engineOsc2.start();

    // Siren: a square wave that alternates tone.
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 750;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(ctx.destination);
    this.sirenOsc.start();

    // Music bed: a quiet bass pad.
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.05;
    this.musicGain.connect(ctx.destination);
  }

  setMuted(m) {
    this.muted = m;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
  }

  setEngine(speed01, driving) {
    if (!this.ctx || this.muted) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      return;
    }
    const f = 50 + speed01 * 130;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(f * 1.5 + 3, this.ctx.currentTime, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, this.ctx.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(driving ? 0.045 + speed01 * 0.05 : 0.012, this.ctx.currentTime, 0.1);
  }

  setSiren(on, dt) {
    if (!this.ctx) return;
    if (!on || this.muted) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    this.sirenTimer += dt;
    if (this.sirenTimer > 0.42) {
      this.sirenTimer = 0;
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.value = this.sirenHigh ? 950 : 700;
    }
    this.sirenGain.gain.setTargetAtTime(0.02, this.ctx.currentTime, 0.1);
  }

  // A tiny bassline: A minor groove, one note per step.
  updateMusic(dt, playing) {
    if (!this.ctx) return;
    this.musicTimer += dt;
    const stepDur = 60 / 132 / 2;
    if (this.musicTimer < stepDur) return;
    this.musicTimer -= stepDur;
    this.musicStep = (this.musicStep + 1) % 16;
    if (!playing || this.muted) return;
    const bass = [55, 0, 55, 65.4, 55, 0, 49, 55, 55, 0, 55, 65.4, 82.4, 73.4, 65.4, 49];
    const f = bass[this.musicStep];
    if (!f) return;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + stepDur * 0.95);
    o.connect(g);
    g.connect(this.musicGain);
    o.start();
    o.stop(this.ctx.currentTime + stepDur);
  }

  blip(freq = 880) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + 0.18);
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + 0.15);
  }

  boom() {
    if (!this.ctx || this.muted) return;
    const dur = 0.7;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.ctx.destination);
    src.start();
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(28, this.ctx.currentTime + 0.5);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.4, this.ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.55);
    o.connect(g2);
    g2.connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + 0.6);
  }
}
