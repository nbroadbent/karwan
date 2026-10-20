// Pazar — audio: synthesized sound effects, a jukebox of
// built-in Kurdish-style soundtracks, and a library of the player's own songs.
//
// Built-in tracks are synthesized with the Web Audio API in traditional Kurdish
// modes (Maqam Kurd, Hijaz, Rast) and dance rhythms (govend, delîlo, halparke).
// Real recordings can be added from local files; they are kept in IndexedDB so
// they survive reloads, or listed in music/playlist.js.
const Audio_ = (() => {
  const PREF_KEY = 'pazar-audio';
  const prefs = Object.assign({ sfx: true, music: true, track: 'govend', volume: 0.6 }, JSON.parse(localStorage.getItem(PREF_KEY) || '{}'));
  const YT_KEY = 'pazar-youtube';
  let ctx = null, master, sfxGain, musicGain;
  const listeners = [];
  function savePrefs() { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }
  function emit() { listeners.forEach((f) => f()); }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = prefs.sfx ? 1 : 0; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = synthVol(); musicGain.connect(master);
    loadUserSongs().then(() => {
      if (!allTracks().some((t) => t.id === prefs.track)) { prefs.track = 'govend'; savePrefs(); }
      if (prefs.music) playTrack(prefs.track, false);
    });
  }
  const synthVol = () => (prefs.music ? 0.55 * prefs.volume : 0);

  // =====================================================================
  // Synth primitives
  // =====================================================================
  function noteFreq(name) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(name);
    if (!m) return 440;
    const base = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * 2 ** ((base + (+m[3] - 4) * 12) / 12);
  }
  function tone(freq, { type = 'sine', dur = 0.2, vol = 0.3, attack = 0.005, release, dest = sfxGain, when = 0, slideTo, filter, vibrato } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = vibrato.rate || 5.5; lg.gain.value = freq * (vibrato.depth || 0.008);
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.3);
    }
    const g = ctx.createGain();
    const rel = release ?? Math.min(0.08, dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    if (release != null) { g.gain.setValueAtTime(vol, t + Math.max(attack, dur - rel)); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; f.Q.value = filter.q || 1; o.connect(f); node = f; }
    node.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.3);
  }
  let noiseBuf = null;
  function noise({ dur = 0.1, vol = 0.3, hp = 1000, lp = 8000, when = 0, dest = sfxGain } = {}) {
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
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(h); h.connect(l); l.connect(g); g.connect(dest);
    s.start(t); s.stop(t + dur + 0.02);
  }
  function daf(kind, when, dest, vol = 1) { // frame drum: dum (centre) / tek (rim)
    if (kind === 'dum') {
      tone(150, { type: 'sine', dur: 0.25, vol: 0.9 * vol, slideTo: 55, dest, when });
      noise({ dur: 0.04, vol: 0.2 * vol, hp: 100, lp: 900, dest, when });
    } else {
      noise({ dur: 0.07, vol: 0.45 * vol, hp: 2500, lp: 9000, dest, when });
      tone(1100, { type: 'triangle', dur: 0.05, vol: 0.12 * vol, dest, when });
    }
  }
  const INSTRUMENTS = {
    pluck(freq, when, dur, vol) { // tembûr / saz
      tone(freq, { type: 'triangle', dur: Math.max(0.45, dur), vol, attack: 0.004, dest: musicGain, when, filter: { freq: 2200, q: 0.7 } });
      tone(freq * 2, { type: 'sine', dur: 0.2, vol: vol * 0.25, dest: musicGain, when });
    },
    bow(freq, when, dur, vol) { // kemençe-like bowed string
      tone(freq, { type: 'sawtooth', dur, vol: vol * 0.55, attack: 0.09, release: 0.12, dest: musicGain, when, filter: { freq: 1500, q: 1.2 }, vibrato: { rate: 5.2, depth: 0.007 } });
      tone(freq, { type: 'triangle', dur, vol: vol * 0.25, attack: 0.09, release: 0.12, dest: musicGain, when, vibrato: { rate: 5.2, depth: 0.007 } });
    },
    reed(freq, when, dur, vol) { // zurna-like double reed
      tone(freq, { type: 'sawtooth', dur, vol: vol * 0.5, attack: 0.025, release: 0.06, dest: musicGain, when, filter: { freq: 1900, q: 3 }, vibrato: { rate: 6.5, depth: 0.006 } });
      tone(freq, { type: 'square', dur, vol: vol * 0.12, attack: 0.025, release: 0.06, dest: musicGain, when, filter: { freq: 1200, q: 1 } });
    },
    flute(freq, when, dur, vol) { // bilûr / shepherd's flute
      tone(freq, { type: 'sine', dur, vol: vol * 0.7, attack: 0.06, release: 0.1, dest: musicGain, when, vibrato: { rate: 5, depth: 0.005 } });
      tone(freq * 2, { type: 'sine', dur, vol: vol * 0.12, attack: 0.06, release: 0.1, dest: musicGain, when });
      noise({ dur: Math.min(0.12, dur), vol: 0.03, hp: 2000, lp: 6000, dest: musicGain, when });
    },
  };

  // =====================================================================
  // Built-in soundtracks (slot = one note position; '-' holds, null rests)
  // =====================================================================
  const SYNTH_TRACKS = [
    {
      id: 'govend', name: 'Govend', sub: 'Line-dance tune · Maqam Kurd · daf and tembûr',
      slot: 60 / 104 / 2, bar: 8, rhythm: 'D.ttD.t.', lead: 'pluck', leadVol: 0.5,
      drone: ['D3', 'A3'],
      melody: [
        'D4', 'Eb4', 'F4', 'G4', 'A4', 'G4', 'F4', 'Eb4',
        'D4', 'D4', 'F4', 'A4', 'G4', 'F4', 'Eb4', 'D4',
        'A4', 'Bb4', 'A4', 'G4', 'F4', 'G4', 'A4', null,
        'G4', 'F4', 'Eb4', 'D4', 'Eb4', 'D4', 'C4', 'D4',
        'D5', 'C5', 'Bb4', 'A4', 'Bb4', 'A4', 'G4', 'F4',
        'G4', 'A4', 'Bb4', 'A4', 'G4', 'F4', 'Eb4', 'D4',
        'F4', 'G4', 'A4', 'G4', 'F4', 'Eb4', 'D4', 'Eb4',
        'D4', null, 'A3', null, 'D4', null, null, null],
    },
    {
      id: 'delilo', name: 'Delîlo', sub: 'Swaying 6/8 dance · Hijaz · daf and tembûr',
      slot: 0.175, bar: 6, rhythm: 'D.tDt.', lead: 'pluck', leadVol: 0.5,
      drone: ['D3', 'A3'],
      melody: [
        'D4', 'F#4', 'G4', 'A4', '-', '-',
        'Bb4', 'A4', 'G4', 'F#4', '-', '-',
        'G4', 'A4', 'Bb4', 'A4', 'G4', 'F#4',
        'Eb4', 'F#4', 'D4', '-', '-', '-',
        'A4', 'Bb4', 'C5', 'Bb4', 'A4', 'G4',
        'F#4', 'G4', 'A4', 'G4', 'F#4', 'Eb4',
        'D4', 'Eb4', 'F#4', 'G4', 'F#4', 'Eb4',
        'D4', '-', '-', 'A3', '-', '-'],
    },
    {
      id: 'dengbej', name: 'Dengbêj', sub: 'Slow mountain lament · Maqam Kurd · bowed kemençe over a drone',
      slot: 0.42, bar: 4, rhythm: '', lead: 'bow', leadVol: 0.55,
      drone: ['D3', 'D4'], droneVol: 0.5,
      melody: [
        'A4', '-', 'Bb4', 'A4', 'G4', '-', 'F4', '-',
        'Eb4', 'F4', 'G4', 'F4', 'Eb4', '-', 'D4', '-',
        'F4', '-', 'G4', 'A4', 'Bb4', '-', 'A4', 'G4',
        'F4', 'Eb4', 'D4', 'Eb4', 'D4', '-', '-', '-',
        'C5', '-', 'Bb4', 'A4', 'Bb4', '-', 'A4', '-',
        'G4', 'A4', 'G4', 'F4', 'Eb4', '-', 'F4', '-',
        'G4', '-', 'F4', 'Eb4', 'D4', '-', 'Eb4', 'D4',
        'C4', '-', 'D4', '-', '-', '-', null, null],
    },
    {
      id: 'halparke', name: 'Halparke', sub: 'Fast festival dance · Hijaz · zurna and driving daf',
      slot: 60 / 132 / 2, bar: 8, rhythm: 'D.tDt.tt', lead: 'reed', leadVol: 0.42,
      drone: ['D3'],
      melody: [
        'D5', 'C5', 'Bb4', 'A4', 'Bb4', 'A4', 'G4', 'F#4',
        'G4', 'A4', 'Bb4', 'A4', 'G4', 'F#4', 'Eb4', 'D4',
        'F#4', 'G4', 'A4', '-', 'A4', 'Bb4', 'A4', 'G4',
        'F#4', 'Eb4', 'D4', 'Eb4', 'F#4', '-', '-', '-',
        'A4', 'A4', 'Bb4', 'C5', 'D5', '-', 'C5', 'Bb4',
        'A4', 'G4', 'F#4', 'G4', 'A4', '-', '-', '-',
        'Bb4', 'A4', 'G4', 'F#4', 'Eb4', 'F#4', 'G4', 'F#4',
        'Eb4', 'D4', '-', '-', 'D4', '-', '-', '-'],
    },
    {
      id: 'newroz', name: 'Newroz', sub: 'Bright spring festival tune · Rast · flute, tembûr and daf',
      slot: 60 / 112 / 2, bar: 8, rhythm: 'D.t.Dt.t', lead: 'flute', leadVol: 0.5, second: 'pluck',
      drone: ['D3', 'A3'],
      melody: [
        'D4', 'E4', 'F#4', 'G4', 'A4', '-', 'F#4', 'A4',
        'B4', 'A4', 'G4', 'F#4', 'E4', '-', 'D4', '-',
        'F#4', 'G4', 'A4', 'B4', 'C5', 'B4', 'A4', 'G4',
        'A4', '-', 'F#4', '-', 'D4', '-', '-', '-',
        'A4', 'B4', 'C5', 'B4', 'A4', 'G4', 'F#4', 'G4',
        'A4', '-', 'G4', 'F#4', 'E4', '-', 'D4', 'E4',
        'F#4', 'A4', 'G4', 'F#4', 'E4', 'D4', 'E4', 'F#4',
        'D4', '-', '-', '-', 'A3', '-', 'D4', '-'],
    },
    {
      id: 'shur', name: 'Shur', sub: 'Persian · Dastgah-e Shur lament · kamancheh and tar over a drone',
      slot: 0.36, bar: 6, rhythm: 'D....t', lead: 'bow', leadVol: 0.5, second: 'pluck',
      drone: ['D3', 'A3'], droneVol: 0.7,
      melody: [
        'A4', '-', 'Bb4', 'A4', 'G4', '-',
        'F4', '-', 'G4', 'A4', 'G4', 'F4',
        'Eb4', 'F4', 'G4', '-', 'F4', 'Eb4',
        'D4', '-', '-', 'C4', 'D4', '-',
        'F4', 'G4', 'A4', '-', 'Bb4', 'A4',
        'C5', '-', 'Bb4', 'A4', 'G4', 'F4',
        'G4', '-', 'F4', 'Eb4', 'D4', 'Eb4',
        'D4', '-', '-', '-', null, null],
    },
    {
      id: 'bandari', name: 'Bandari', sub: 'Persian Gulf dance · 6/8 · ney-anban reed and tombak',
      slot: 0.165, bar: 6, rhythm: 'DtDtDt', lead: 'reed', leadVol: 0.4,
      drone: ['D3'],
      melody: [
        'D4', 'Eb4', 'F#4', 'G4', 'A4', '-',
        'G4', 'F#4', 'Eb4', 'D4', '-', '-',
        'A4', 'Bb4', 'A4', 'G4', 'F#4', 'G4',
        'A4', '-', '-', 'G4', 'F#4', 'Eb4',
        'D4', 'F#4', 'A4', 'D5', 'C5', 'Bb4',
        'A4', 'G4', 'F#4', 'G4', 'A4', '-',
        'Bb4', 'A4', 'G4', 'F#4', 'Eb4', 'F#4',
        'D4', '-', '-', 'D4', '-', '-'],
    },
  ];

  let synthTimer = null, nextSlot = 0, slotIndex = 0, synthTrack = null;
  function scheduleSynth() {
    if (!ctx || !synthTrack) return;
    const T = synthTrack;
    while (nextSlot < ctx.currentTime + 0.45) {
      const when = nextSlot - ctx.currentTime;
      const i = slotIndex % T.melody.length;
      if (i % (T.bar * 2) === 0 && T.drone) {
        const dur = T.slot * T.bar * 2;
        T.drone.forEach((n, k) => tone(noteFreq(n), { type: 'sawtooth', dur, vol: (k ? 0.06 : 0.14) * (T.droneVol || 1), attack: 0.3, release: 0.4, dest: musicGain, when, filter: { freq: 420, q: 2 } }));
      }
      if (T.rhythm) {
        const r = T.rhythm[i % T.rhythm.length];
        if (r === 'D') daf('dum', when, musicGain);
        if (r === 't') daf('tek', when, musicGain);
      }
      const n = T.melody[i];
      if (n && n !== '-') {
        let len = 1;
        while (T.melody[(i + len) % T.melody.length] === '-' && len < 16) len++;
        const dur = T.slot * len;
        const accent = i % T.bar === 0 ? 1.1 : 0.85;
        INSTRUMENTS[T.lead](noteFreq(n), when, dur, T.leadVol * accent);
        if (T.second && i % 2 === 0) INSTRUMENTS[T.second](noteFreq(n) / 2, when, dur, 0.25);
      }
      nextSlot += T.slot;
      slotIndex++;
    }
  }
  function startSynth(track) {
    stopSynth();
    synthTrack = track;
    nextSlot = ctx.currentTime + 0.1; slotIndex = 0;
    synthTimer = setInterval(scheduleSynth, 100);
  }
  function stopSynth() { clearInterval(synthTimer); synthTimer = null; synthTrack = null; }

  // =====================================================================
  // User songs: IndexedDB library + music/playlist.js
  // =====================================================================
  let userSongs = []; // { id, name, url, source: 'library' | 'folder' }
  let db = null;
  function openNamedDb(name) {
    return new Promise((resolve) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('songs', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }
  async function openDb() {
    if (db) return db;
    if (!window.indexedDB) return null;
    db = await openNamedDb('pazar');
    // one-time migration of songs saved under the game's earlier names
    try {
      const dbs = indexedDB.databases ? await indexedDB.databases() : [];
      for (const oldName of ['karwan', 'kurdistan-monopoly']) {
        if (!db || !dbs.some((d) => d.name === oldName)) continue;
        const old = await openNamedDb(oldName);
        if (old) {
          const rows = await new Promise((resolve) => { const r = old.transaction('songs').objectStore('songs').getAll(); r.onsuccess = () => resolve(r.result || []); r.onerror = () => resolve([]); });
          await new Promise((resolve) => { const tx = db.transaction('songs', 'readwrite'); rows.forEach((row) => tx.objectStore('songs').put(row)); tx.oncomplete = resolve; tx.onerror = resolve; });
          old.close();
          indexedDB.deleteDatabase(oldName);
        }
      }
    } catch (e) { /* migration is best-effort */ }
    return db;
  }
  async function loadUserSongs() {
    userSongs.forEach((s) => s.source === 'library' && URL.revokeObjectURL(s.url));
    userSongs = (window.USER_PLAYLIST || []).map((t, k) => ({ id: 'folder-' + k, name: t.title || t.file, sub: t.artist || 'From music folder', url: 'music/' + t.file, source: 'folder' }));
    const d = await openDb();
    if (d) {
      const rows = await new Promise((resolve) => {
        const r = d.transaction('songs').objectStore('songs').getAll();
        r.onsuccess = () => resolve(r.result || []); r.onerror = () => resolve([]);
      });
      rows.sort((a, b) => a.added - b.added);
      rows.forEach((row) => userSongs.push({ id: row.id, name: row.name, sub: 'Your library', url: URL.createObjectURL(row.blob), source: 'library' }));
    }
    emit();
  }
  async function addFiles(files) {
    const d = await openDb();
    const list = [...files].filter((f) => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|ogg|oga|wav|flac|opus)$/i.test(f.name));
    if (!list.length) return 0;
    let firstId = null;
    for (const f of list) {
      const id = 'song-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      firstId = firstId || id;
      const name = f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
      if (d) await new Promise((resolve) => { const tx = d.transaction('songs', 'readwrite'); tx.objectStore('songs').put({ id, name, blob: f, added: Date.now() }); tx.oncomplete = resolve; tx.onerror = resolve; });
      else userSongs.push({ id, name, sub: 'This session only', url: URL.createObjectURL(f), source: 'library' });
    }
    if (d) await loadUserSongs(); else emit();
    return list.length;
  }
  async function removeSong(id) {
    const d = await openDb();
    if (d) await new Promise((resolve) => { const tx = d.transaction('songs', 'readwrite'); tx.objectStore('songs').delete(id); tx.oncomplete = resolve; tx.onerror = resolve; });
    if (current && current.id === id) { stopElement(); prefs.track = 'govend'; savePrefs(); if (prefs.music) playTrack(prefs.track, false); }
    await loadUserSongs();
  }

  // =====================================================================
  // YouTube: stream real songs through YouTube's embedded player
  // =====================================================================
  // YouTube starter list comes from the active theme (see themes/*.js)
  let YT_PRESETS = [];
  function setTheme(theme) {
    YT_PRESETS = theme.youtube || [];
    for (const k of Object.keys(ytCache)) if (ytCache[k].preset) delete ytCache[k];
    const ids = allTracks().map((t) => t.id);
    const isLibrary = /^(song-|folder-)/.test(prefs.track || ''); // own songs load later, don't discard them here
    // follow the theme's soundtrack unless the player picked a track themselves
    if ((!ids.includes(prefs.track) && !isLibrary) || !prefs.trackChosen) {
      prefs.track = theme.defaultTrack || 'govend'; savePrefs();
      if (prefs.music && ctx && current && current.id !== prefs.track) playTrack(prefs.track, false);
    }
    emit();
  }
  function choose(id) { prefs.trackChosen = true; playTrack(id); }
  let ytUser = JSON.parse(localStorage.getItem(YT_KEY) || '[]');
  const saveYt = () => localStorage.setItem(YT_KEY, JSON.stringify(ytUser));
  const ytId = (t) => 'yt-' + (t.list ? 'list-' + t.list : t.v);
  function ytTracks() {
    return [...YT_PRESETS.map((t) => ({ ...t, id: ytId(t), source: 'youtube', preset: true })),
      ...ytUser.map((t) => ({ ...t, id: ytId(t), source: 'youtube' }))];
  }
  const ytOnFile = location.protocol === 'file:';
  let yt = null, ytReady = false, ytApiRequested = false, ytPending = null, ytActive = false, ytErrorTimer = null;
  function parseYouTube(str) {
    str = (str || '').trim();
    if (!str) return null;
    let m;
    if ((m = /[?&]list=([A-Za-z0-9_-]+)/.exec(str))) return { list: m[1] };
    if ((m = /(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/.exec(str))) return { v: m[1] };
    if (/^[A-Za-z0-9_-]{11}$/.test(str)) return { v: str };
    if (/^(PL|UU|OL|RD|FL)[A-Za-z0-9_-]{10,}$/.test(str)) return { list: str };
    return null;
  }
  function ensureYtApi() {
    if (ytApiRequested) return;
    ytApiRequested = true;
    window.onYouTubeIframeAPIReady = () => {
      const host = document.getElementById('yt-player');
      if (!host) return;
      yt = new YT.Player('yt-player', {
        width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin === 'null' ? undefined : location.origin },
        events: {
          onReady: () => { ytReady = true; yt.setVolume(Math.round(prefs.volume * 100)); if (ytPending) { const p = ytPending; ytPending = null; ytLoad(p); } },
          onStateChange: (e) => {
            if (!current || current.source !== 'youtube') return;
            if (e.data === YT.PlayerState.PLAYING) {
              const d = yt.getVideoData && yt.getVideoData();
              if (d && d.title) { current.title = d.title; current.author = d.author; current.error = null; }
              if (!prefs.music) { prefs.music = true; savePrefs(); } // resumed from inside the YouTube player
              emit();
            } else if (e.data === YT.PlayerState.PAUSED) {
              if (prefs.music) { prefs.music = false; savePrefs(); } // paused from inside the YouTube player
              emit();
            } else if (e.data === YT.PlayerState.ENDED) {
              if (current.list) return; // playlists advance by themselves
              next();
            } else emit();
          },
          onError: (e) => {
            if (!current || current.source !== 'youtube') return;
            current.error = { 2: 'Invalid video link', 5: 'Player error', 100: 'Video not found or private', 101: 'Owner does not allow embedding', 150: 'Owner does not allow embedding', 153: 'YouTube refused to play on a file:// page. Open the game via play.command (localhost).' }[e.data] || ('YouTube error ' + e.data);
            emit();
            clearTimeout(ytErrorTimer);
            if (!current.list && !ytOnFile) ytErrorTimer = setTimeout(() => { if (current && current.error) next(); }, 2500);
          },
        },
      });
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { if (current && current.source === 'youtube') { current.error = 'YouTube needs an internet connection'; emit(); } };
    document.head.appendChild(s);
  }
  function ytLoad(track) {
    if (!ytReady) { ytPending = track; ensureYtApi(); return; }
    if (track.list) yt.loadPlaylist({ list: track.list, listType: 'playlist' });
    else yt.loadVideoById(track.v);
    yt.setVolume(Math.round(prefs.volume * 100));
  }
  function ytStop() {
    ytPending = null; clearTimeout(ytErrorTimer);
    if (ytActive) { ytActive = false; if (ytReady && yt.stopVideo) try { yt.stopVideo(); } catch (e) { /* ignore */ } }
  }
  async function addYouTube(input) {
    const parsed = parseYouTube(input);
    if (!parsed) return null;
    if (ytTracks().some((t) => (parsed.list ? t.list === parsed.list : t.v === parsed.v))) return ytTracks().find((t) => (parsed.list ? t.list === parsed.list : t.v === parsed.v));
    const entry = { ...parsed, name: parsed.list ? 'YouTube playlist' : 'YouTube video', sub: parsed.list ? 'Playlist ' + parsed.list : 'Added by you' };
    ytUser.push(entry); saveYt(); emit();
    // Try to fetch the title (may be blocked by CORS on some setups — the player fills it in on play anyway).
    if (parsed.v) {
      try {
        const r = await fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + parsed.v + '&format=json');
        if (r.ok) { const j = await r.json(); entry.name = j.title; entry.sub = j.author_name; saveYt(); emit(); }
      } catch (e) { /* fine */ }
    }
    return { ...entry, id: ytId(entry), source: 'youtube' };
  }
  function removeYouTube(id) {
    ytUser = ytUser.filter((t) => ytId(t) !== id); saveYt();
    if (current && current.id === id) { ytStop(); prefs.track = 'govend'; savePrefs(); if (prefs.music) playTrack(prefs.track, false); }
    emit();
  }

  // =====================================================================
  // Playback control
  // =====================================================================
  let el = null, current = null;
  function stopElement() {
    if (!el) return;
    const old = el; el = null;
    old.onended = null; old.onerror = null; // clearing src fires a spurious error event otherwise
    old.pause(); old.removeAttribute('src'); old.load();
  }
  const synthList = SYNTH_TRACKS.map((t) => ({ id: t.id, name: t.name, sub: t.sub, source: 'synth' }));
  const ytCache = {}; // keep one object per id so error/title state survives re-renders
  function allTracks() {
    const yts = ytTracks().map((t) => { if (!ytCache[t.id]) ytCache[t.id] = t; else Object.assign(ytCache[t.id], { name: t.name, sub: t.sub }); return ytCache[t.id]; });
    return [...synthList, ...yts, ...userSongs];
  }
  function playTrack(id, save = true) {
    const track = allTracks().find((t) => t.id === id) || allTracks()[0];
    current = track;
    track.error = false;
    prefs.track = track.id;
    if (save) savePrefs();
    stopSynth(); stopElement(); ytStop();
    if (!prefs.music || !ctx) { emit(); return; }
    if (track.source === 'synth') {
      startSynth(SYNTH_TRACKS.find((t) => t.id === track.id));
    } else if (track.source === 'youtube') {
      ytActive = true;
      ytLoad(track);
    } else {
      el = new window.Audio(track.url);
      el.volume = prefs.volume;
      el.onended = () => next();
      el.onerror = () => { current.error = true; emit(); };
      el.play().catch(() => {});
    }
    emit();
  }
  function step(dir) {
    const list = allTracks();
    if (!current) return playTrack(prefs.track);
    // stay within the same family: YouTube advances through YouTube, songs through songs, synth through synth
    const fam = list.filter((t) => t.source === current.source);
    const j = fam.findIndex((t) => t.id === current.id);
    const pick = fam.length ? fam[(j + dir + fam.length) % fam.length] : list[0];
    if (!prefs.music) { prefs.music = true; savePrefs(); if (musicGain) musicGain.gain.value = synthVol(); }
    playTrack(pick.id);
  }
  const next = () => step(1);
  const prev = () => step(-1);
  /** Pause / resume without losing the place in the current track. */
  function setMusic(on) {
    prefs.music = on; savePrefs();
    if (musicGain) musicGain.gain.value = synthVol();
    if (on) {
      if (current && current.source === 'youtube' && ytActive && ytReady) { try { yt.playVideo(); } catch (e) { playTrack(prefs.track, false); } }
      else if (current && current.source !== 'synth' && el) el.play().catch(() => {});
      else playTrack(prefs.track, false);
    } else {
      if (ytActive && ytReady) try { yt.pauseVideo(); } catch (e) { /* ignore */ }
      if (el) el.pause();
      stopSynth();
    }
    emit();
  }
  function setVolume(v) {
    prefs.volume = Math.max(0, Math.min(1, v)); savePrefs();
    if (musicGain) musicGain.gain.value = synthVol();
    if (el) el.volume = prefs.volume;
    if (ytReady && ytActive) yt.setVolume(Math.round(prefs.volume * 100));
  }

  // =====================================================================
  // Sound effects
  // =====================================================================
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
  function toggleSfx() { prefs.sfx = !prefs.sfx; if (sfxGain) sfxGain.gain.value = prefs.sfx ? 1 : 0; savePrefs(); if (prefs.sfx) play('click'); emit(); return prefs.sfx; }

  return {
    init, play, toggleSfx, prefs, setTheme,
    music: {
      tracks: allTracks, current: () => current, play: playTrack, choose, next, prev, setEnabled: setMusic, toggle: () => setMusic(!prefs.music), setVolume,
      ytState: () => (ytReady && yt.getPlayerState ? yt.getPlayerState() : null),
      ytTime: () => (ytReady && yt.getCurrentTime ? yt.getCurrentTime() : null),
      addFiles, removeSong, onChange: (f) => listeners.push(f),
      addYouTube, removeYouTube, parseYouTube, ytOnFile,
      isYouTubeActive: () => ytActive,
      isPlaying: () => prefs.music && !!(synthTimer || (el && !el.paused) || (ytActive && ytReady && yt.getPlayerState && yt.getPlayerState() === 1)),
    },
  };
})();
