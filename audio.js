// Kurdistan Monopoly — synthesized audio (no sound files needed)
// Sound effects + a looping soundtrack: daf rhythm, tembûr-style drone and a
// melody in Maqam Kurd (Phrygian on D), the scale of many Kurdish folk songs.
const Audio_ = (() => {
  const PREF_KEY = 'kurdistan-monopoly-audio';
  const prefs = Object.assign({ sfx: true, music: true }, JSON.parse(localStorage.getItem(PREF_KEY) || '{}'));
  let ctx = null, master, sfxGain, musicGain;
  let musicTimer = null, nextBeat = 0, beatIndex = 0;

  function savePrefs() { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = prefs.sfx ? 1 : 0; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = prefs.music ? 0.32 : 0; musicGain.connect(master);
    if (prefs.music) startMusic();
  }

  // ---------- primitives ----------
  function tone(freq, { type = 'sine', dur = 0.2, vol = 0.3, attack = 0.005, decay, dest = sfxGain, when = 0, slideTo, filter } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (decay || dur));
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; f.Q.value = filter.q || 1; o.connect(f); node = f; }
    node.connect(g); g.connect(dest);
    o.start(t); o.stop(t + (decay || dur) + 0.05);
  }
  let noiseBuf = null;
  function noise({ dur = 0.1, vol = 0.3, hp = 1000, lp = 8000, when = 0, dest = sfxGain, decay } = {}) {
    if (!ctx) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
    const l = ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (decay || dur));
    s.connect(h); h.connect(l); l.connect(g); g.connect(dest);
    s.start(t); s.stop(t + (decay || dur) + 0.02);
  }

  // ---------- sound effects ----------
  const sfx = {
    dice() { for (let i = 0; i < 7; i++) { noise({ dur: 0.05, vol: 0.25, hp: 2500, lp: 9000, when: i * 0.07 }); tone(900 + Math.random() * 700, { type: 'square', dur: 0.03, vol: 0.05, when: i * 0.07 }); } },
    step() { tone(1800, { type: 'triangle', dur: 0.05, vol: 0.12, slideTo: 900 }); },
    cash() { tone(880, { dur: 0.12, vol: 0.25 }); tone(1320, { dur: 0.25, vol: 0.25, when: 0.09 }); },
    coin() { tone(1568, { type: 'triangle', dur: 0.18, vol: 0.18 }); },
    pay() { tone(600, { type: 'triangle', dur: 0.15, vol: 0.22 }); tone(420, { type: 'triangle', dur: 0.3, vol: 0.2, when: 0.12 }); },
    card() { noise({ dur: 0.25, vol: 0.2, hp: 800, lp: 6000 }); tone(500, { type: 'sine', dur: 0.25, vol: 0.08, slideTo: 1400 }); },
    jail() { tone(140, { type: 'sawtooth', dur: 0.8, vol: 0.25, filter: { freq: 500 } }); tone(100, { type: 'square', dur: 0.8, vol: 0.12, when: 0.05, filter: { freq: 300 } }); noise({ dur: 0.4, vol: 0.2, hp: 200, lp: 1200 }); },
    build() { for (let i = 0; i < 3; i++) { tone(220, { type: 'square', dur: 0.06, vol: 0.2, when: i * 0.13, filter: { freq: 900 } }); noise({ dur: 0.05, vol: 0.15, hp: 1500, lp: 5000, when: i * 0.13 }); } },
    click() { tone(1200, { type: 'sine', dur: 0.04, vol: 0.08 }); },
    bid() { tone(700, { dur: 0.1, vol: 0.18 }); tone(1050, { dur: 0.15, vol: 0.15, when: 0.06 }); },
    win() {
      const notes = [293.66, 349.23, 440, 587.33, 440, 587.33, 698.46, 880];
      notes.forEach((f, i) => { tone(f, { type: 'triangle', dur: 0.35, vol: 0.28, when: i * 0.14 }); tone(f / 2, { type: 'sine', dur: 0.4, vol: 0.15, when: i * 0.14 }); });
      for (let i = 0; i < 8; i++) daf(i % 2 === 0 ? 'dum' : 'tek', i * 0.14, sfxGain);
    },
  };
  function play(name) { if (ctx && prefs.sfx && sfx[name]) sfx[name](); }

  // ---------- music ----------
  // Maqam Kurd on D: D Eb F G A Bb C
  const N = { C3: 130.81, D3: 146.83, A3: 220, C4: 261.63, D4: 293.66, Eb4: 311.13, F4: 349.23, G4: 392, A4: 440, Bb4: 466.16, C5: 523.25, D5: 587.33, Eb5: 622.25 };
  const MELODY = [ // eighth notes, 8 bars of 8; null = rest, '-' = tie/hold
    'D4', 'Eb4', 'F4', 'G4', 'A4', 'G4', 'F4', 'Eb4',
    'D4', 'D4', 'F4', 'A4', 'G4', 'F4', 'Eb4', 'D4',
    'A4', 'Bb4', 'A4', 'G4', 'F4', 'G4', 'A4', null,
    'G4', 'F4', 'Eb4', 'D4', 'Eb4', 'D4', 'C4', 'D4',
    'D5', 'C5', 'Bb4', 'A4', 'Bb4', 'A4', 'G4', 'F4',
    'G4', 'A4', 'Bb4', 'A4', 'G4', 'F4', 'Eb4', 'D4',
    'F4', 'G4', 'A4', 'G4', 'F4', 'Eb4', 'D4', 'Eb4',
    'D4', null, 'A3', null, 'D4', null, null, null,
  ];
  const RHYTHM = 'D.ttD.t.'; // govend-style daf pattern per bar (eighths)
  const EIGHTH = 60 / 104 / 2; // 104 bpm

  function daf(kind, when, dest) {
    if (!ctx) return;
    if (kind === 'dum') {
      tone(150, { type: 'sine', dur: 0.25, vol: 0.9, slideTo: 55, dest, when });
      noise({ dur: 0.04, vol: 0.2, hp: 100, lp: 900, dest, when });
    } else {
      noise({ dur: 0.07, vol: 0.45, hp: 2500, lp: 9000, dest, when });
      tone(1100, { type: 'triangle', dur: 0.05, vol: 0.12, dest, when });
    }
  }
  function pluck(freq, when, vol = 0.5) { // tembûr-ish pluck
    tone(freq, { type: 'triangle', dur: 0.5, vol, attack: 0.004, dest: musicGain, when, filter: { freq: 2200, q: 0.7 } });
    tone(freq * 2, { type: 'sine', dur: 0.2, vol: vol * 0.25, dest: musicGain, when });
  }
  function drone(when) {
    tone(N.D3, { type: 'sawtooth', dur: EIGHTH * 8, vol: 0.14, attack: 0.3, dest: musicGain, when, filter: { freq: 420, q: 2 } });
    tone(N.A3, { type: 'sawtooth', dur: EIGHTH * 8, vol: 0.06, attack: 0.3, dest: musicGain, when, filter: { freq: 500, q: 2 } });
  }

  function scheduler() {
    if (!ctx) return;
    while (nextBeat < ctx.currentTime + 0.4) {
      const when = nextBeat - ctx.currentTime;
      const i = beatIndex % MELODY.length;
      if (i % 8 === 0) drone(when);
      const r = RHYTHM[i % 8];
      if (r === 'D') daf('dum', when, musicGain);
      if (r === 't') daf('tek', when, musicGain);
      const n = MELODY[i];
      if (n) pluck(N[n], when, i % 4 === 0 ? 0.55 : 0.4);
      nextBeat += EIGHTH;
      beatIndex++;
    }
  }
  function startMusic() {
    if (!ctx || musicTimer) return;
    nextBeat = ctx.currentTime + 0.1; beatIndex = 0;
    musicTimer = setInterval(scheduler, 100);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

  // ---------- toggles ----------
  function toggleSfx() { prefs.sfx = !prefs.sfx; if (sfxGain) sfxGain.gain.value = prefs.sfx ? 1 : 0; savePrefs(); if (prefs.sfx) play('click'); return prefs.sfx; }
  function toggleMusic() {
    prefs.music = !prefs.music; savePrefs();
    if (ctx) { musicGain.gain.value = prefs.music ? 0.32 : 0; if (prefs.music) startMusic(); else stopMusic(); }
    return prefs.music;
  }

  return { init, play, toggleSfx, toggleMusic, prefs };
})();
