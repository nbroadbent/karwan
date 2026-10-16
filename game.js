// Kurdistan Monopoly — game engine + UI (hot-seat, local play)
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => CURRENCY + Math.round(n).toLocaleString();
  const SAVE_KEY = 'kurdistan-monopoly-save';
  const JAIL = 10, GO_SALARY = 200, JAIL_FINE = 50;

  let state = null;
  let busy = false;

  // =====================================================================
  // Setup screen
  // =====================================================================
  let playerCount = 3;

  function applyThemeToDom() {
    document.title = THEME.title;
    $('#setup-title').textContent = THEME.title;
    $('#setup-tagline').textContent = THEME.tagline;
    $('#panel-title').textContent = THEME.title;
    $('#discover-title').textContent = THEME.discover;
    $('#discover-text').textContent = THEME.discoverText;
    document.querySelectorAll('.theme-card').forEach((c) => c.classList.toggle('active', c.dataset.theme === THEME.id));
    if (typeof Audio_ !== 'undefined' && Audio_.setTheme) Audio_.setTheme(THEME);
  }
  function chooseTheme(id) {
    applyTheme(id);
    localStorage.setItem('kurdistan-monopoly-theme', id);
    applyThemeToDom();
    setupTokens.length = 0;
    renderPlayerRows();
  }
  function renderThemePick() {
    const wrap = $('#theme-pick');
    wrap.innerHTML = THEME_IDS.map((id) => {
      const t = THEMES[id];
      const strip = `background: ${id === 'kurdish' ? 'repeating-linear-gradient(90deg,#ed2024 0 10px,#fff 10px 20px,#278e43 20px 30px,#febd11 30px 40px)' : 'repeating-linear-gradient(90deg,#1b3b8a 0 10px,#2ab7b0 10px 20px,#e0b341 20px 30px,#c0392b 30px 40px)'}`;
      return `<button class="theme-card" data-theme="${id}"><div class="tc-strip" style="${strip}"></div><div class="tc-name">${t.name} <span class="muted" style="font-weight:400;font-size:12px">· ${t.center.script}</span></div><div class="tc-sub">${t.tagline}</div><div class="tc-tokens">${t.tokens.slice(0, 6).join('')}</div></button>`;
    }).join('');
    wrap.querySelectorAll('.theme-card').forEach((b) => b.onclick = () => chooseTheme(b.dataset.theme));
  }

  function initSetup() {
    renderThemePick();
    applyThemeToDom();
    if (localStorage.getItem(SAVE_KEY)) $('#resume-box').classList.remove('hidden');
    $('#resume-btn').onclick = () => {
      Audio_.init();
      try {
        state = JSON.parse(localStorage.getItem(SAVE_KEY));
        applyTheme(state.theme || 'kurdish');
        localStorage.setItem('kurdistan-monopoly-theme', THEME.id);
        applyThemeToDom();
        startGameScreen();
      } catch (e) {
        alert('Saved game could not be loaded.');
        localStorage.removeItem(SAVE_KEY);
      }
    };
    $('#player-count').querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        playerCount = +b.dataset.n;
        $('#player-count').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        renderPlayerRows();
      };
    });
    $('#start-btn').onclick = startFromSetup;
    renderPlayerRows();
  }

  const setupTokens = [];
  function renderPlayerRows() {
    const wrap = $('#player-rows');
    wrap.innerHTML = '';
    for (let i = 0; i < playerCount; i++) {
      if (setupTokens[i] == null) setupTokens[i] = i;
      const row = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML = `
        <span class="swatch" style="background:${PLAYER_COLORS[i]}"></span>
        <input type="text" placeholder="Player ${i + 1}" maxlength="14" data-i="${i}">
        <div class="token-pick" data-i="${i}">
          ${TOKENS.map((t, ti) => `<button data-t="${ti}" title="Pick token">${t}</button>`).join('')}
        </div>`;
      wrap.appendChild(row);
    }
    refreshTokenPicks();
    wrap.querySelectorAll('.token-pick button').forEach((b) => {
      b.onclick = () => {
        setupTokens[+b.parentElement.dataset.i] = +b.dataset.t;
        refreshTokenPicks();
      };
    });
  }
  function refreshTokenPicks() {
    document.querySelectorAll('.token-pick').forEach((pick) => {
      const i = +pick.dataset.i;
      pick.querySelectorAll('button').forEach((b) => {
        const t = +b.dataset.t;
        b.classList.toggle('active', setupTokens[i] === t);
        b.disabled = setupTokens.slice(0, playerCount).some((x, j) => j !== i && x === t);
      });
    });
  }

  function startFromSetup() {
    Audio_.init();
    const players = [];
    for (let i = 0; i < playerCount; i++) {
      const input = document.querySelector(`#player-rows input[data-i="${i}"]`);
      players.push({
        name: input.value.trim() || `Player ${i + 1}`,
        token: TOKENS[setupTokens[i]],
        color: PLAYER_COLORS[i],
        money: 1500, pos: 0, inJail: false, jailTurns: 0, jailCards: 0, bankrupt: false,
      });
    }
    state = {
      theme: THEME.id,
      players,
      owners: SQUARES.map((s) => (['property', 'railroad', 'utility'].includes(s.type) ? { owner: null, houses: 0, mortgaged: false } : null)),
      turn: 0,
      phase: 'roll',
      dice: [1, 1],
      doubles: 0,
      chance: shuffle([...CHANCE_CARDS.keys()]),
      chest: shuffle([...CHEST_CARDS.keys()]),
      debt: null,
      pot: 0,
      log: [],
      opts: { auction: $('#opt-auction').checked, parking: $('#opt-parking').checked },
    };
    log(`A new game begins with ${players.map((p) => p.name).join(', ')}. ${players[0].name} goes first.`, true);
    startGameScreen();
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function startGameScreen() {
    $('#setup').classList.add('hidden');
    $('#game').classList.remove('hidden');
    buildBoard();
    stable();
    if (state.phase === 'roll' && !state.debt) { setBusy(true); await turnBanner(cur()); setBusy(false); }
  }

  // =====================================================================
  // Helpers
  // =====================================================================
  const cur = () => state.players[state.turn];
  const alive = () => state.players.filter((p) => !p.bankrupt);
  const diceTotal = () => state.dice[0] + state.dice[1];
  const ownable = (i) => state.owners[i] != null;
  const pIdx = (p) => state.players.indexOf(p);

  function log(msg, hi = false) {
    state.log.push({ msg, hi });
    if (state.log.length > 300) state.log.shift();
    renderLog();
  }
  function renderLog() {
    const lg = $('#log');
    if (!lg || !state) return;
    lg.innerHTML = state.log.slice(-80).map((l) => `<div class="${l.hi ? 'hi' : ''}">${l.msg}</div>`).join('');
    lg.scrollTop = lg.scrollHeight;
  }
  function save() { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, moving: false })); }
  function stable() { render(); save(); }

  function groupSquares(group) {
    return SQUARES.map((s, i) => (s.group === group ? i : -1)).filter((i) => i >= 0);
  }
  function ownsGroup(pi, group) {
    return groupSquares(group).every((i) => state.owners[i].owner === pi);
  }
  function countType(pi, type) {
    return SQUARES.filter((s, i) => s.type === type && state.owners[i].owner === pi).length;
  }
  function propertiesOf(pi) {
    return SQUARES.map((s, i) => i).filter((i) => ownable(i) && state.owners[i].owner === pi);
  }
  function groupHasHouses(group) {
    return groupSquares(group).some((i) => state.owners[i].houses > 0);
  }

  function rentFor(i, opts = {}) {
    const s = SQUARES[i], o = state.owners[i];
    if (o.owner == null || o.mortgaged) return 0;
    if (s.type === 'property') {
      if (o.houses > 0) return s.rent[o.houses];
      return ownsGroup(o.owner, s.group) ? s.rent[0] * 2 : s.rent[0];
    }
    if (s.type === 'railroad') {
      return 25 * 2 ** (countType(o.owner, 'railroad') - 1) * (opts.rrMult || 1);
    }
    if (s.type === 'utility') {
      const mult = opts.utilMult || (countType(o.owner, 'utility') === 2 ? 10 : 4);
      return mult * (opts.dice || diceTotal());
    }
    return 0;
  }

  function netWorth(pi) {
    let total = state.players[pi].money;
    for (const i of propertiesOf(pi)) {
      const s = SQUARES[i], o = state.owners[i];
      total += o.mortgaged ? 0 : s.price / 2;
      if (s.houseCost) total += o.houses * s.houseCost / 2;
    }
    return total;
  }

  // =====================================================================
  // Modal
  // =====================================================================
  let modalDismiss = null; // called when the user clicks outside, presses Escape or the ✕
  function openModal(html, wide = false, onDismiss = null) {
    const card = $('#modal-card');
    card.className = wide ? 'wide' : '';
    card.innerHTML = `<div class="modal-body">${html}</div>`;
    // Pin the action row to the bottom so it never scrolls out of view.
    const actions = card.querySelector('.modal-actions');
    if (actions) { const foot = document.createElement('div'); foot.className = 'modal-foot'; foot.appendChild(actions); card.appendChild(foot); }
    modalDismiss = onDismiss;
    if (onDismiss) {
      const x = document.createElement('button');
      x.className = 'modal-x'; x.title = 'Close'; x.textContent = '✕';
      x.onclick = () => modalDismiss && modalDismiss();
      card.appendChild(x);
    }
    $('#modal').classList.remove('hidden');
    card.querySelector('.modal-body').scrollTop = 0;
    return card;
  }
  function closeModal() { $('#modal').classList.add('hidden'); modalDismiss = null; }
  $('#modal').addEventListener('mousedown', (e) => { if (e.target === e.currentTarget && modalDismiss) modalDismiss(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalDismiss && !$('#modal').classList.contains('hidden')) modalDismiss(); });

  function ask(title, body, buttons, opts = {}) {
    return new Promise((resolve) => {
      const single = buttons.length === 1 ? () => { closeModal(); resolve(buttons[0].value); } : null;
      const card = openModal(`<h3>${title}</h3>${body}<div class="modal-actions">${buttons
        .map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`)
        .join('')}</div>`, opts.wide, single);
      card.querySelectorAll('.modal-actions button').forEach((btn) => {
        btn.onclick = () => { closeModal(); resolve(buttons[+btn.dataset.i].value); };
      });
    });
  }
  const notify = (title, body, label = 'OK') => ask(title, body, [{ label, value: true, cls: 'primary' }]);

  // ---------- On-board banners & toasts ----------
  const STEP_MS = 260;
  let bannerSkip = null;
  function showBanner(html, ms, cls = '') {
    const el = $('#banner');
    el.className = `show ${cls}`;
    el.innerHTML = html;
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; bannerSkip = null; el.classList.remove('show'); setTimeout(resolve, 180); };
      bannerSkip = finish;
      el.onclick = finish;
      setTimeout(finish, ms);
    });
  }
  let toastTimer = null;
  function toast(html, ms = 1400) {
    const el = $('#toast');
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  const dieHtml = (v) => `<div class="die" data-v="${v}">${'<span></span>'.repeat(9)}</div>`;
  function turnBanner(p) {
    return showBanner(`<div class="b-token" style="--pc:${p.color}">${p.token}</div><div class="b-title">${p.name}'s turn</div><div class="b-sub">${p.inJail ? 'In jail — roll doubles, pay the fine or use a card' : 'Click the dice or press Space to roll'}</div>`, 1300, 'turn');
  }
  function diceBanner(p) {
    const [a, b] = state.dice;
    return showBanner(`<div class="b-sub">${p.token} ${p.name} rolls</div><div class="b-dice">${dieHtml(a)}${dieHtml(b)}</div><div class="b-title">${a + b}</div>${a === b ? '<div class="b-sub b-hot">Doubles! Roll again after this move</div>' : ''}`, 1150, 'dice');
  }
  function landingBanner(p, i) {
    const s = SQUARES[i];
    const color = s.group ? GROUPS[s.group].color : s.type === 'railroad' ? '#333' : s.type === 'utility' ? '#777' : 'var(--yellow)';
    const o = state.owners[i];
    let note = '';
    if (o) note = o.owner == null ? `For sale · ${fmt(s.price)}` : o.owner === state.turn ? 'Your own property' : `Owned by ${state.players[o.owner].token} ${state.players[o.owner].name}${o.mortgaged ? ' · mortgaged' : ''}`;
    else if (s.type === 'tax') note = `Pay ${fmt(s.amount)}`;
    else if (s.type === 'chance') note = `Draw a ${THEME.chance.name} card`;
    else if (s.type === 'chest') note = `Draw a ${THEME.chest.name} card`;
    else if (s.type === 'gotojail') note = 'Straight to jail!';
    else if (s.type === 'parking') note = state.opts.parking && state.pot ? `Collect the ${fmt(state.pot)} pot` : 'Free rest';
    else if (s.type === 'jail') note = 'Just visiting';
    else if (s.type === 'go') note = `Collect ${fmt(GO_SALARY)}`;
    return showBanner(`<div class="b-sub">${p.token} ${p.name} lands on</div><div class="b-title" style="color:${color === 'var(--yellow)' ? '#fff' : '#fff'}"><span class="b-swatch" style="background:${color}"></span>${s.name}</div><div class="b-sub">${s.kurdish && s.type === 'property' ? s.kurdish + ' · ' : ''}${note}</div>`, 1000, 'land');
  }
  function flashSquare(i, cls, ms) {
    const el = document.querySelector(`.sq[data-i="${i}"]`);
    if (!el) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  const mapLink = (name) => (mapUrl(name) ? `<a class="map-link" href="${mapUrl(name)}" target="_blank" rel="noopener">📍 View ${name} on Google Maps</a>` : '');

  function deedHtml(i) {
    const s = SQUARES[i], o = state.owners[i];
    const color = s.group ? GROUPS[s.group].color : s.type === 'railroad' ? '#333' : '#777';
    let rows = '';
    if (s.type === 'property') {
      const full = o.owner != null && ownsGroup(o.owner, s.group);
      const labels = ['Rent', 'With 1 house', 'With 2 houses', 'With 3 houses', 'With 4 houses', 'With HOTEL'];
      rows = labels.map((l, k) => {
        const curRow = o.owner != null && ((o.houses === 0 && k === 0) || o.houses === k);
        return `<tr class="${curRow ? 'cur' : ''}"><td>${l}</td><td>${fmt(s.rent[k])}</td></tr>`;
      }).join('');
      rows += `<tr class="${full && o.houses === 0 ? 'cur' : ''}"><td>Rent with full region</td><td>${fmt(s.rent[0] * 2)}</td></tr>`;
      rows += `<tr><td>House / hotel cost</td><td>${fmt(s.houseCost)} each</td></tr>`;
    } else if (s.type === 'railroad') {
      rows = [25, 50, 100, 200].map((r, k) => `<tr><td>Toll with ${k + 1} crossing${k ? 's' : ''}</td><td>${fmt(r)}</td></tr>`).join('');
    } else {
      rows = `<tr><td>If one utility owned</td><td>4 × dice</td></tr><tr><td>If both utilities owned</td><td>10 × dice</td></tr>`;
    }
    const ownerText = o.owner == null ? 'Unowned' : `Owned by ${state.players[o.owner].token} ${state.players[o.owner].name}${o.mortgaged ? ' (mortgaged)' : ''}`;
    return `<div class="deed" style="--bar:${color}">
      <div class="deed-head"><div class="name">${s.name}</div><div class="kname">${s.kurdish || ''}${s.region ? ' · ' + s.region : ''}</div></div>
      <div class="kilim-strip"></div>
      <div class="deed-body"><table>${rows}</table></div>
      <div class="deed-foot">Price ${fmt(s.price)} · Mortgage value ${fmt(s.price / 2)} · ${ownerText}</div>
      ${mapLink(s.name)}
    </div>`;
  }

  // =====================================================================
  // Board DOM
  // =====================================================================
  function squarePos(i) {
    if (i <= 10) return { row: 11, col: 11 - i, side: 'bottom' };
    if (i <= 20) return { row: 11 - (i - 10), col: 1, side: 'left' };
    if (i <= 30) return { row: 1, col: 1 + (i - 20), side: 'top' };
    return { row: 1 + (i - 30), col: 11, side: 'right' };
  }
  const ICONS = new Proxy({}, { get: (_, k) => (k === 'chance' ? THEME.chance.icon : k === 'chest' ? THEME.chest.icon : (THEME.icons || {})[k] || { go: '➜', tax: '💰', railroad: '🛂', utility: '⚡', jail: '🔒', parking: '🌳', gotojail: '👮' }[k]) });

  function buildBoard() {
    const board = $('#board');
    board.innerHTML = '';
    SQUARES.forEach((s, i) => {
      const { row, col, side } = squarePos(i);
      const el = document.createElement('div');
      const corner = i % 10 === 0;
      el.className = `sq side-${side} ${corner ? 'corner' : ''} ${s.type}`;
      el.style.gridArea = `${row} / ${col}`;
      el.dataset.i = i;
      let body = '';
      const nameCls = s.name.length > 12 ? 'name xlong' : s.name.length > 8 ? 'name long' : 'name';
      if (s.type === 'property') {
        el.style.setProperty('--bar', GROUPS[s.group].color);
        body = `<div class="bar"><div class="houses"></div></div>
          <div class="body"><div><div class="${nameCls}">${s.name}</div><div class="kname">${s.kurdish}</div></div><div class="price">${fmt(s.price)}</div></div>`;
      } else if (s.type === 'railroad' || s.type === 'utility') {
        const icon = s.type === 'railroad' ? ICONS.railroad : (s.name.includes('Power') ? '⚡' : '💧');
        body = `<div class="body"><div class="${nameCls}">${s.name}</div><div class="icon">${icon}</div><div class="price">${fmt(s.price)}</div></div>`;
      } else if (s.type === 'tax') {
        body = `<div class="body"><div class="name">${s.name}</div><div class="icon">${ICONS.tax}</div><div class="price">Pay ${fmt(s.amount)}</div></div>`;
      } else if (s.type === 'chance' || s.type === 'chest') {
        body = `<div class="body"><div class="name">${s.name}</div><div class="icon">${ICONS[s.type]}</div><div class="kname">${s.type === 'chance' ? THEME.chance.sub : THEME.chest.sub}</div></div>`;
      } else if (s.type === 'go') {
        body = `<div class="body"><div class="kname">Collect ${fmt(GO_SALARY)}</div><div class="name">GO</div><div class="icon">${ICONS.go}</div><div class="kname">${s.kurdish}</div></div>`;
      } else {
        body = `<div class="body"><div class="name">${s.name}</div><div class="icon">${ICONS[s.type]}</div><div class="kname">${s.kurdish || ''}</div></div>`;
      }
      el.innerHTML = body + `<div class="owner-tag"></div>${['property', 'railroad', 'utility'].includes(s.type) ? '<div class="owner-strip"></div>' : ''}<div class="tokens"></div>`;
      el.onclick = () => showSquareInfo(i);
      board.appendChild(el);
    });
    const center = document.createElement('div');
    center.id = 'center';
    const C = THEME.center, M = C.mountains;
    center.innerHTML = `<div class="flag" style="background:${C.bands}">
        <div class="ornament tl"></div><div class="ornament tr"></div>
        <div class="title">${C.title}</div><div class="title-ku">${C.script}</div>
        <div class="${C.emblem === 'star' ? 'star' : 'sun'}"></div>
        <svg class="mountains" viewBox="0 0 400 90" preserveAspectRatio="none">
          <path d="M0 90 L0 62 L30 40 L55 55 L90 22 L120 48 L150 30 L175 44 L205 12 L240 42 L270 28 L300 50 L330 24 L360 46 L400 30 L400 90 Z" fill="${M.back}"/>
          <path d="M0 90 L0 75 L40 60 L80 72 L120 58 L160 70 L200 52 L250 68 L290 56 L340 70 L400 58 L400 90 Z" fill="${M.front}"/>
          <path d="M205 12 L195 24 L215 24 Z M90 22 L82 32 L98 32 Z M330 24 L322 34 L338 34 Z" fill="${M.snow}" opacity=".9"/>
        </svg>
        <div class="subtitle">${C.subtitle}</div>
      </div>
      <div id="dice"><div class="die" data-v="1">${'<span></span>'.repeat(9)}</div><div class="die" data-v="1">${'<span></span>'.repeat(9)}</div></div>
      <div id="dice-hint"></div>`;
    board.appendChild(center);
    const banner = document.createElement('div'); banner.id = 'banner'; board.appendChild(banner);
    const toastEl = document.createElement('div'); toastEl.id = 'toast'; board.appendChild(toastEl);
    const diceEl = $('#dice');
    diceEl.onclick = (e) => { e.stopPropagation(); primaryAction(); };
    // Space / Enter = roll or end turn (ignored while a dialog is open or when typing)
    document.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      if (!$('#modal').classList.contains('hidden')) return;
      if ($('#game').classList.contains('hidden')) return;
      if (e.key === ' ') e.preventDefault();
      if (bannerSkip) { bannerSkip(); return; }
      primaryAction();
    });
    $('#toggle-left').onclick = () => setPanel('left', !ui.leftCollapsed);
    $('#toggle-right').onclick = () => setPanel('right', !ui.rightCollapsed);
    applyPanels();
    const sfxBtn = $('#sfx-btn'), musicBtn = $('#music-btn');
    const mpToggle = $('#mp-toggle'), mpTitle = $('#mp-title');
    const paint = () => {
      sfxBtn.classList.toggle('off', !Audio_.prefs.sfx);
      musicBtn.classList.toggle('off', !Audio_.prefs.music);
      const t = Audio_.music.current();
      const on = Audio_.prefs.music;
      const name = t ? (t.title || t.name) : 'Music';
      const sub = !t ? 'Open the music menu' : t.source === 'youtube' ? (t.author || t.sub || 'YouTube') + ' · YouTube' : t.source === 'synth' ? 'Built-in soundtrack' : (t.sub || 'Your song');
      mpTitle.innerHTML = `<span class="t1">${on ? '♪ ' : ''}${name}</span><span class="t2">${on ? sub : 'Paused · ' + sub}</span>`;
      mpToggle.textContent = on ? '❚❚' : '▶';
      mpToggle.title = on ? 'Pause' : 'Play';
      mpToggle.classList.toggle('paused', !on);
      $('#yt-wrap').classList.toggle('hidden', !Audio_.music.isYouTubeActive());
    };
    sfxBtn.onclick = () => { Audio_.init(); Audio_.toggleSfx(); paint(); };
    musicBtn.onclick = () => { Audio_.init(); openMusicMenu(); };
    mpTitle.onclick = musicBtn.onclick;
    mpToggle.onclick = () => { Audio_.init(); Audio_.music.toggle(); paint(); };
    $('#mp-next').onclick = () => { Audio_.init(); Audio_.music.next(); };
    $('#mp-prev').onclick = () => { Audio_.init(); Audio_.music.prev(); };
    Audio_.music.onChange(paint);
    paint();
    // Drag and drop songs anywhere on the page
    let dragDepth = 0;
    document.addEventListener('dragenter', (e) => { if ([...e.dataTransfer.types].includes('Files')) { dragDepth++; document.body.classList.add('dragging-audio'); } });
    document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging-audio'); } });
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', async (e) => {
      e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging-audio');
      if (!e.dataTransfer.files.length) return;
      Audio_.init();
      const n = await Audio_.music.addFiles(e.dataTransfer.files);
      if (n) { log(`${n} song${n > 1 ? 's' : ''} added to the music library.`); render(); }
    });
    $('#new-game-btn').onclick = async () => {
      if (await ask('Start a new game?', '<p>The current game will be erased.</p>', [{ label: 'Cancel', value: false }, { label: 'New game', value: true, cls: 'danger' }])) {
        localStorage.removeItem(SAVE_KEY);
        location.reload();
      }
    };
  }

  // ---------- Place panel (photo + story, left side) ----------
  const wikiCache = JSON.parse(localStorage.getItem('kurdistan-monopoly-wiki') || '{}');
  let placeToken = 0;
  function placePanelVisible() { const p = $('#place-panel'); return p && getComputedStyle(p).display !== 'none'; }
  // ---------- Collapsible side panels ----------
  const UI_KEY = 'kurdistan-monopoly-ui';
  const ui = Object.assign({ leftCollapsed: false, rightCollapsed: false }, JSON.parse(localStorage.getItem(UI_KEY) || '{}'));
  function applyPanels() {
    $('#game').classList.toggle('left-collapsed', ui.leftCollapsed);
    $('#game').classList.toggle('right-collapsed', ui.rightCollapsed);
    $('#toggle-left').textContent = ui.leftCollapsed ? '▶' : '◀';
    $('#toggle-left').title = ui.leftCollapsed ? 'Show place panel' : 'Collapse place panel';
    $('#toggle-right').textContent = ui.rightCollapsed ? '◀' : '▶';
    $('#toggle-right').title = ui.rightCollapsed ? 'Show game panel' : 'Collapse game panel';
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  }
  function setPanel(side, collapsed) { ui[side + 'Collapsed'] = collapsed; applyPanels(); }
  async function fetchWiki(name) {
    const title = WIKI_TITLES[name];
    if (!title) return null;
    if (wikiCache[title]) return wikiCache[title];
    const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')));
    if (!r.ok) throw new Error('wiki ' + r.status);
    const j = await r.json();
    const small = j.thumbnail && j.thumbnail.source ? j.thumbnail.source : null;
    const large = small ? small.replace(/\/(\d+)px-/, (m, n) => (+n < 640 ? '/640px-' : m)) : null;
    const original = j.originalimage && j.originalimage.source ? j.originalimage.source : null;
    // try a 640px thumbnail first, then the API's own thumbnail, then the original file
    const sources = [...new Set([large, small, original].filter(Boolean))];
    const entry = { extract: j.extract || '', thumb: sources[0] || null, sources, page: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || wikiUrl(name), title: j.title };
    wikiCache[title] = entry;
    try { localStorage.setItem('kurdistan-monopoly-wiki', JSON.stringify(wikiCache)); } catch (e) { /* storage full — fine */ }
    return entry;
  }
  // Optional: photo gallery through Google's Custom Search JSON API (user supplies a free key)
  const GOOGLE_KEY = 'kurdistan-monopoly-google';
  const googleCfg = () => JSON.parse(localStorage.getItem(GOOGLE_KEY) || 'null');
  const googleCache = JSON.parse(localStorage.getItem(GOOGLE_KEY + '-cache') || '{}');
  async function fetchGooglePhotos(name) {
    const cfg = googleCfg();
    if (!cfg || !cfg.key || !cfg.cx) return null;
    if (googleCache[name]) return googleCache[name];
    const q = (MAP_PLACES[name] || name) + ' Kurdistan';
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(cfg.key)}&cx=${encodeURIComponent(cfg.cx)}&searchType=image&num=6&safe=active&imgSize=large&q=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    if (!r.ok) { let msg = 'Google API error ' + r.status; try { const j = await r.json(); if (j.error && j.error.message) msg = j.error.message; } catch (e) { /* ignore */ } throw new Error(msg); }
    const j = await r.json();
    const photos = (j.items || []).map((it) => ({ src: it.link, thumb: it.image && it.image.thumbnailLink, page: it.image && it.image.contextLink, title: it.title })).filter((p) => p.src);
    googleCache[name] = photos;
    try { localStorage.setItem(GOOGLE_KEY + '-cache', JSON.stringify(googleCache)); } catch (e) { /* ignore */ }
    return photos;
  }
  function openPhotoSettings() {
    const cfg = googleCfg() || { key: '', cx: '' };
    const card = openModal(`<h3>Photo source</h3>
      <p>Photos come first from the local library in the <code>images/</code> folder (drop your own pictures there — see <code>images/README.md</code>), then from Wikipedia. To show a gallery of <b>Google Images</b> results for places without local photos, add a free Google API key — the game then uses Google's official Custom Search API (100 searches a day free). Your key stays in this browser.</p>
      <ol style="font-size:13px;line-height:1.5;padding-left:20px">
        <li>Go to <a href="https://programmablesearchengine.google.com/controlpanel/create" target="_blank" rel="noopener">programmablesearchengine.google.com</a>, create a search engine that searches the <b>entire web</b>, turn on <b>Image search</b>, and copy its <b>Search engine ID</b>.</li>
        <li>Go to <a href="https://developers.google.com/custom-search/v1/overview" target="_blank" rel="noopener">developers.google.com/custom-search</a>, click <b>Get a key</b>, and copy the <b>API key</b>.</li>
        <li>Paste both below.</li>
      </ol>
      <label class="field"><span class="muted" style="font-size:12px">API key</span><input id="g-key" type="text" value="${cfg.key || ''}" placeholder="AIza…" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:8px"></label>
      <label class="field"><span class="muted" style="font-size:12px">Search engine ID (cx)</span><input id="g-cx" type="text" value="${cfg.cx || ''}" placeholder="0123456789abcdef0:xyz" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:8px"></label>
      <div class="modal-actions"><button class="btn" id="g-remove">Use Wikipedia only</button><button class="btn primary" id="g-save">Save</button></div>`, false, () => { closeModal(); });
    card.querySelector('#g-save').onclick = () => {
      const key = card.querySelector('#g-key').value.trim(), cx = card.querySelector('#g-cx').value.trim();
      if (key && cx) localStorage.setItem(GOOGLE_KEY, JSON.stringify({ key, cx })); else localStorage.removeItem(GOOGLE_KEY);
      for (const k of Object.keys(googleCache)) delete googleCache[k];
      localStorage.removeItem(GOOGLE_KEY + '-cache');
      closeModal();
      if (lastPlace != null) showPlace(lastPlace);
    };
    card.querySelector('#g-remove').onclick = () => { localStorage.removeItem(GOOGLE_KEY); localStorage.removeItem(GOOGLE_KEY + '-cache'); closeModal(); if (lastPlace != null) showPlace(lastPlace); };
  }
  let lastPlace = null;

  function showPlace(i) {
    const s = SQUARES[i];
    const token = ++placeToken;
    lastPlace = i;
    document.querySelectorAll('.sq.selected').forEach((e) => e.classList.remove('selected'));
    const sqEl = document.querySelector(`.sq[data-i="${i}"]`); if (sqEl) sqEl.classList.add('selected');
    const color = s.group ? GROUPS[s.group].color : s.type === 'railroad' ? '#333' : s.type === 'utility' ? '#777' : 'var(--yellow)';
    const o = state.owners[i];
    const region = s.region || (s.type === 'railroad' ? (s.kurdish || 'Crossing') : s.type === 'utility' ? 'Utility' : THEME.name);
    let facts = '';
    if (o) {
      const ownerTxt = o.owner == null ? 'Unowned' : `${state.players[o.owner].token} ${state.players[o.owner].name}`;
      const rentNow = o.owner == null ? '—' : fmt(rentFor(i, { dice: 7 }));
      facts = `<div class="place-facts"><div class="fact">Price<b>${fmt(s.price)}</b></div><div class="fact">Owner<b>${ownerTxt}</b></div><div class="fact">Rent now<b>${rentNow}${s.type === 'utility' && o.owner != null ? ' <small>(roll of 7)</small>' : ''}</b></div><div class="fact">Status<b>${o.mortgaged ? 'Mortgaged' : o.houses === 5 ? 'Hotel' : o.houses ? o.houses + ' house' + (o.houses > 1 ? 's' : '') : 'No buildings'}</b></div></div>`;
    }
    const wiki = wikiUrl(s.name);
    $('#place-empty').classList.add('hidden');
    const el = $('#place-content');
    el.classList.remove('hidden');
    el.innerHTML = `
      <div class="place-photo"><div class="ph-fallback"><span>Loading photo…</span></div><img alt="${s.name}"><div class="ph-region">${region}</div></div>
      <div class="place-head"><div class="ph-bar" style="--c:${color}"></div><div><h2>${s.name}</h2><div class="ph-k">${s.kurdish || ''}</div></div></div>
      <div class="place-about loading">${ABOUT[s.name] || ''}</div>
      <div class="place-source"></div>
      ${facts}
      <div class="place-links">${mapUrl(s.name) ? `<a class="btn" href="${mapUrl(s.name)}" target="_blank" rel="noopener">📍 Google Maps</a>` : ''}<a class="btn" href="${googleImagesUrl(s.name)}" target="_blank" rel="noopener">🖼 Google Images</a>${wiki ? `<a class="btn" href="${wiki}" target="_blank" rel="noopener">📖 Wikipedia</a>` : ''}</div>
      ${o ? `<div class="place-deed">${deedHtml(i)}</div>` : ''}`;
    el.scrollTop = 0;
    $('#place-panel').scrollTop = 0;
    const img = el.querySelector('.place-photo img');
    const fb = el.querySelector('.ph-fallback');
    const settingsLink = ` · <a href="#" class="photo-settings">photo source</a>`;
    const setPhoto = (src, onFail) => {
      img.classList.remove('loaded');
      img.onload = () => { img.classList.add('loaded'); if (fb.isConnected) fb.remove(); };
      img.onerror = onFail;
      img.src = src;
    };
    let googleShown = false, localShown = false;
    const useGoogle = !!googleCfg();
    const wikiPromise = fetchWiki(s.name);

    // Gallery: main photo + thumbnail strip + caption linking to the source
    const showGallery = (photos) => {
      if (photos.length > 1) {
        const strip = document.createElement('div');
        strip.className = 'ph-thumbs';
        strip.innerHTML = photos.map((p, k) => `<img src="${p.thumb || p.src}" data-k="${k}" class="${k === 0 ? 'on' : ''}" alt="">`).join('');
        el.querySelector('.place-photo').appendChild(strip);
        strip.onclick = (e) => { const t = e.target.closest('img'); if (t) pick(+t.dataset.k); };
        var thumbs = strip;
      }
      const cap = document.createElement('a');
      cap.className = 'ph-caption'; cap.target = '_blank'; cap.rel = 'noopener';
      el.querySelector('.place-photo').appendChild(cap);
      const pick = (k) => {
        const p = photos[k];
        if (thumbs) thumbs.querySelectorAll('img').forEach((t) => t.classList.toggle('on', +t.dataset.k === k));
        cap.textContent = p.caption || p.title || 'Source'; cap.href = p.page || p.src; cap.title = p.caption || p.title || '';
        if (!p.page) cap.removeAttribute('href');
        setPhoto(p.src, () => { if (k + 1 < photos.length) pick(k + 1); else fb.innerHTML = '<span>Photos could not be loaded</span>'; });
      };
      pick(0);
    };

    // 1) Local photos from the images/ folder win (work offline)
    const local = ((window.LOCAL_IMAGES || {})[THEME.id] || {})[s.name];
    if (local && local.length) {
      localShown = true;
      showGallery(local.map((p) => ({ src: p.file, thumb: p.file, page: p.source, title: p.title, caption: p.author ? `${p.author}${p.license ? ' · ' + p.license : ''}` : p.title })));
    }

    // 2) Optional Google gallery (official API, user key)
    const googlePromise = useGoogle && !localShown ? fetchGooglePhotos(s.name).then((photos) => {
      if (token !== placeToken || !photos || !photos.length) return;
      googleShown = true;
      showGallery(photos);
    }).catch((err) => { if (token === placeToken) el.querySelector('.place-source').insertAdjacentHTML('beforeend', `<div class="muted" style="color:var(--red)">Google photos: ${err.message}. Showing Wikipedia instead.</div>`); }) : Promise.resolve();

    Promise.all([wikiPromise.catch(() => null), googlePromise]).then(([w]) => {
      if (token !== placeToken) return;
      const about = el.querySelector('.place-about');
      about.classList.remove('loading');
      const src = el.querySelector('.place-source');
      if (w && w.extract) about.textContent = w.extract;
      if (localShown) {
        src.insertAdjacentHTML('afterbegin', `Photos from the local library (see <code>images/</code>)${w ? ` · text from <a href="${w.page}" target="_blank" rel="noopener">Wikipedia</a> (CC BY-SA)` : ''}${settingsLink}`);
      } else if (googleShown) {
        src.insertAdjacentHTML('afterbegin', `Photos via Google Images${w ? ` · text from <a href="${w.page}" target="_blank" rel="noopener">Wikipedia</a> (CC BY-SA)` : ''}${settingsLink}`);
      } else if (w) {
        src.insertAdjacentHTML('afterbegin', `Text${w.thumb ? ' & photo' : ''} from <a href="${w.page}" target="_blank" rel="noopener">Wikipedia</a> · CC BY-SA${settingsLink}`);
        if (w.thumb) {
          const srcs = w.sources || [w.thumb];
          const tryAt = (k) => { if (k >= srcs.length) { fb.innerHTML = '<span>Photo unavailable</span>'; return; } setPhoto(srcs[k], () => tryAt(k + 1)); };
          tryAt(0);
        } else fb.innerHTML = '<span>No photo on Wikipedia for this place</span>';
      } else {
        src.insertAdjacentHTML('afterbegin', `Offline — showing built-in notes${settingsLink}`);
        fb.innerHTML = '<span>Photo needs an internet connection</span>';
      }
      const sl = el.querySelector('.photo-settings'); if (sl) sl.onclick = (e) => { e.preventDefault(); openPhotoSettings(); };
    });
  }

  function showSquareInfo(i) {
    if (placePanelVisible()) { if (ui.leftCollapsed) setPanel('left', false); showPlace(i); return; }
    if (busy && !$('#modal').classList.contains('hidden')) return;
    const s = SQUARES[i];
    if (ownable(i)) return notify(s.name, deedHtml(i), 'Close');
    const desc = {
      go: `Collect ${fmt(GO_SALARY)} salary each time you pass GO.`,
      jail: 'Just visiting — unless you were sent here!',
      parking: state.opts.parking ? `Land here to collect the pot. Currently ${fmt(state.pot)}.` : 'A free rest in the mountains.',
      gotojail: 'Go directly to Jail. Do not pass GO.',
      tax: `Pay ${fmt(s.amount || 0)} to the bank.`,
      chance: `Draw a ${THEME.chance.name} card.`,
      chest: `Draw a ${THEME.chest.name} card.`,
    }[s.type] || '';
    notify(s.name, `<p>${desc}</p>${mapLink(s.name)}`, 'Close');
  }

  // =====================================================================
  // Render
  // =====================================================================
  function render() {
    // board squares
    SQUARES.forEach((s, i) => {
      const el = document.querySelector(`.sq[data-i="${i}"]`);
      const o = state.owners[i];
      const tag = el.querySelector('.owner-tag');
      if (o) {
        const owner = o.owner == null ? null : state.players[o.owner];
        tag.style.borderColor = owner ? owner.color : 'transparent';
        el.classList.toggle('owned', !!owner);
        el.classList.toggle('mortgaged', o.mortgaged);
        const strip = el.querySelector('.owner-strip');
        strip.style.setProperty('--pc', owner ? owner.color : 'transparent');
        const side = squarePos(i).side;
        const narrow = side === 'left' || side === 'right';
        strip.innerHTML = owner ? `<span class="ot">${owner.token}</span>${narrow ? '' : `<span class="on">${o.mortgaged ? '🔒 ' : ''}${owner.name}</span>`}` : '';
        strip.title = owner ? `Owned by ${owner.name}${o.mortgaged ? ' (mortgaged)' : ''}` : '';
        const hs = el.querySelector('.houses');
        if (hs) hs.innerHTML = o.houses === 5 ? '<div class="hotel"></div>' : '<div class="house"></div>'.repeat(o.houses);
      }
      const tokens = state.players
        .map((p, pi) => ({ p, pi }))
        .filter(({ p }) => !p.bankrupt && p.pos === i)
        .map(({ p, pi }) => `<div class="token ${pi === state.turn ? 'active' : ''} ${pi === state.turn && state.moving ? 'moving' : ''}" style="--pc:${p.color}" title="${p.name}">${p.token}</div>`)
        .join('');
      el.querySelector('.tokens').innerHTML = tokens;
    });
    document.querySelectorAll('.die').forEach((d, k) => d.dataset.v = state.dice[k]);
    const canRoll = !busy && !state.debt && state.phase === 'roll';
    const canEnd = !busy && !state.debt && state.phase === 'end';
    const dice = $('#dice');
    dice.classList.toggle('rollable', canRoll);
    dice.classList.toggle('endable', canEnd);
    dice.title = canRoll ? 'Click to roll (or press Space)' : canEnd ? 'Click to end turn (or press Space)' : '';
    $('#dice-hint').textContent = canRoll ? (cur().inJail ? 'Click to roll for doubles · Space' : 'Click to roll · Space') : canEnd ? `Click to end ${cur().name}'s turn · Space` : '';

    // the game panel must be visible when a decision needs its buttons
    if (ui.rightCollapsed && (state.debt || (state.phase === 'roll' && cur().inJail) || state.phase === 'over')) setPanel('right', false);

    // turn box
    const p = cur();
    const tb = $('#turn-box');
    tb.style.setProperty('--pc', p.color);
    let status = '';
    if (state.debt) status = `<div class="debt">Owes ${fmt(state.debt.amount)} to ${state.debt.creditor == null ? 'the bank' : state.players[state.debt.creditor].name}. Mortgage or sell to raise funds, or declare bankruptcy.</div>`;
    else if (state.phase === 'roll' && p.inJail) status = `<div class="status">In jail (attempt ${p.jailTurns + 1} of 3). Roll doubles, pay the fine, or use a card.</div>`;
    else if (state.phase === 'roll' && state.doubles > 0) status = `<div class="status">Doubles! Roll again.</div>`;
    else if (state.phase === 'roll') status = `<div class="status">Roll the dice — click them or press Space.</div>`;
    else if (state.phase === 'end') status = `<div class="status">Build or trade, then end your turn — click the dice or press Space.</div>`;
    else if (state.phase === 'over') status = `<div class="status">Game over.</div>`;
    else status = `<div class="status">…</div>`;
    tb.innerHTML = `<div class="who"><span>${p.token}</span>${p.name}'s turn</div><div class="cash">${fmt(p.money)}</div>${status}`;

    // actions
    const act = $('#actions');
    act.innerHTML = '';
    const btn = (label, cls, fn, disabled = false) => {
      const b = document.createElement('button');
      b.className = `btn ${cls}`;
      b.textContent = label;
      b.disabled = disabled || busy;
      b.onclick = fn;
      act.appendChild(b);
    };
    if (state.debt) {
      btn(`Pay ${fmt(state.debt.amount)}`, 'primary', resolveDebt, p.money < state.debt.amount);
      btn('Manage properties', '', openManage);
      btn('Trade', '', openTrade);
      btn('Declare bankruptcy', 'danger', declareBankruptcy);
    } else if (state.phase === 'roll') {
      if (p.inJail) {
        btn('Roll for doubles', 'primary', rollDice);
        btn(`Pay ${fmt(JAIL_FINE)} fine`, 'warn', payJailFine, p.money < JAIL_FINE);
        if (p.jailCards > 0) btn('Use Get Out of Jail card', 'warn', useJailCard);
      } else {
        btn('Roll dice', 'primary', rollDice);
      }
      btn('Manage properties', '', openManage);
      btn('Trade', '', openTrade);
    } else if (state.phase === 'end') {
      btn('End turn', 'primary', endTurn);
      btn('Manage properties', '', openManage);
      btn('Trade', '', openTrade);
    }

    // players
    $('#players').innerHTML = state.players.map((pl, pi) => {
      const chips = propertiesOf(pi).map((i) => {
        const s = SQUARES[i], o = state.owners[i];
        const cls = s.type === 'railroad' ? 'rr' : s.type === 'utility' ? 'ut' : '';
        const c = s.group ? GROUPS[s.group].color : '';
        const h = o.houses === 5 ? 'H' : o.houses || '';
        return `<span class="chip ${cls} ${o.mortgaged ? 'mort' : ''}" style="--c:${c}" title="${s.name}">${h}</span>`;
      }).join('');
      const extras = [];
      if (pl.inJail) extras.push('in jail');
      if (pl.jailCards) extras.push(`${pl.jailCards} jail card${pl.jailCards > 1 ? 's' : ''}`);
      extras.push(`worth ${fmt(netWorth(pi))}`);
      return `<div class="pcard ${pi === state.turn ? 'current' : ''} ${pl.bankrupt ? 'bankrupt' : ''}" style="--pc:${pl.color}">
        <div class="top"><span class="pname">${pl.token} ${pl.name}</span><span class="pmoney">${fmt(pl.money)}</span></div>
        <div class="chips">${chips || '<span class="muted">no properties</span>'}</div>
        <div class="extra">${pl.bankrupt ? 'bankrupt' : extras.join(' · ')}</div>
      </div>`;
    }).join('');

    renderLog();
  }

  function setBusy(v) { busy = v; render(); }

  /** What the dice (and Space/Enter) do right now: roll, or end the turn. */
  function primaryAction() {
    if (busy || state.debt || state.phase === 'over') return;
    if (state.phase === 'roll') rollDice();
    else if (state.phase === 'end') endTurn();
  }

  // =====================================================================
  // Money
  // =====================================================================
  function give(pi, amount) { state.players[pi].money += amount; }

  /** Charge `amount` from player `pi`. Creditor null = bank. Returns true if fully paid now. */
  function charge(pi, amount, creditor = null, opts = {}) {
    const p = state.players[pi];
    if (p.money >= amount) {
      p.money -= amount;
      if (creditor != null) give(creditor, amount);
      else if (opts.toPot && state.opts.parking) state.pot += amount;
      if (opts.each) for (const q of alive()) if (pIdx(q) !== pi) q.money += opts.each;
      return true;
    }
    state.debt = { payer: pi, amount, creditor, toPot: !!opts.toPot, each: opts.each || 0 };
    log(`${p.name} cannot pay ${fmt(amount)} and must raise funds or go bankrupt.`, true);
    return false;
  }

  function resolveDebt() {
    const d = state.debt;
    if (!d) return;
    const p = state.players[d.payer];
    if (p.money < d.amount) return;
    state.debt = null;
    charge(d.payer, d.amount, d.creditor, { toPot: d.toPot, each: d.each });
    log(`${p.name} pays the ${fmt(d.amount)} owed.`);
    afterResolution();
  }

  // =====================================================================
  // Turn flow
  // =====================================================================
  async function rollDice() {
    if (busy || state.phase !== 'roll') return;
    setBusy(true);
    const p = cur();
    document.querySelectorAll('.die').forEach((d) => d.classList.add('rolling'));
    Audio_.play('dice');
    await sleep(500);
    document.querySelectorAll('.die').forEach((d) => d.classList.remove('rolling'));
    state.dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    const isDouble = state.dice[0] === state.dice[1];
    render();
    log(`${p.name} rolls ${state.dice[0]} + ${state.dice[1]} = ${diceTotal()}${isDouble ? ' (doubles!)' : ''}.`);
    await diceBanner(p);

    if (p.inJail) {
      if (isDouble) {
        p.inJail = false; p.jailTurns = 0;
        log(`${p.name} rolls doubles and leaves jail.`);
        state.doubles = 0;
        await moveBy(diceTotal());
        await landOn(p.pos);
        if (!state.debt) state.phase = 'end';
      } else {
        p.jailTurns++;
        if (p.jailTurns >= 3) {
          log(`${p.name} has failed three times and must pay the ${fmt(JAIL_FINE)} fine.`);
          p.inJail = false; p.jailTurns = 0;
          if (charge(state.turn, JAIL_FINE, null, { toPot: true })) {
            await moveBy(diceTotal());
            await landOn(p.pos);
          } else {
            state.pendingMove = diceTotal();
          }
          if (!state.debt) state.phase = 'end';
        } else {
          log(`${p.name} stays in jail.`);
          toast(`🔒 No doubles — ${p.name} stays in jail (attempt ${p.jailTurns} of 3)`);
          state.phase = 'end';
        }
      }
      finishAction();
      return;
    }

    if (isDouble) {
      state.doubles++;
      if (state.doubles === 3) {
        log(`${p.name} rolled doubles three times — straight to jail!`, true);
        await showBanner(`<div class="b-token">👮</div><div class="b-title">Three doubles!</div><div class="b-sub">${p.name} goes straight to jail</div>`, 1300, 'jail');
        await sendToJail(state.turn);
        finishAction();
        return;
      }
    } else {
      state.doubles = 0;
    }

    await moveBy(diceTotal());
    await landOn(p.pos);
    if (!state.debt && !p.inJail) state.phase = isDouble ? 'roll' : 'end';
    else if (!state.debt) state.phase = 'end';
    if (state.phase === 'roll' && !state.debt) toast(`🎲 Doubles — ${p.name} rolls again`);
    finishAction();
  }

  function finishAction() {
    setBusy(false);
    save();
    checkWinner();
  }

  /** Called after a debt is resolved (via payment) to continue the turn. */
  async function afterResolution() {
    const p = cur();
    if (state.pendingMove) {
      const n = state.pendingMove;
      state.pendingMove = 0;
      setBusy(true);
      await moveBy(n);
      await landOn(p.pos);
    }
    if (!state.debt) state.phase = p.inJail ? 'end' : (state.doubles > 0 ? 'roll' : 'end');
    finishAction();
  }

  async function payJailFine() {
    if (busy) return;
    const p = cur();
    if (p.money < JAIL_FINE) return;
    charge(state.turn, JAIL_FINE, null, { toPot: true });
    Audio_.play('pay');
    p.inJail = false; p.jailTurns = 0;
    log(`${p.name} pays the ${fmt(JAIL_FINE)} fine and leaves jail.`);
    stable();
  }

  function useJailCard() {
    if (busy) return;
    const p = cur();
    if (p.jailCards <= 0) return;
    p.jailCards--;
    p.inJail = false; p.jailTurns = 0;
    log(`${p.name} uses a Get Out of Jail Free card.`);
    stable();
  }

  async function endTurn() {
    if (busy || state.phase !== 'end' || state.debt) return;
    state.doubles = 0;
    nextPlayer();
    log(`— ${cur().name}'s turn —`, true);
    stable();
    setBusy(true);
    await turnBanner(cur());
    setBusy(false);
  }

  function nextPlayer() {
    let n = 0;
    do {
      state.turn = (state.turn + 1) % state.players.length;
      n++;
    } while (state.players[state.turn].bankrupt && n <= state.players.length);
    state.phase = 'roll';
    state.doubles = 0;
  }

  async function moveBy(n) {
    const p = cur();
    state.moving = true;
    for (let k = 0; k < n; k++) {
      p.pos = (p.pos + 1) % 40;
      Audio_.play('step');
      if (p.pos === 0) {
        p.money += GO_SALARY;
        Audio_.play('coin');
        log(`${p.name} passes GO and collects ${fmt(GO_SALARY)}.`);
        toast(`➜ ${p.name} passes GO · <b>+${fmt(GO_SALARY)}</b>`);
      }
      render();
      flashSquare(p.pos, 'trail', 700);
      await sleep(STEP_MS);
    }
    state.moving = false;
    render();
    flashSquare(p.pos, 'landed', 2600);
    await landingBanner(p, p.pos);
  }
  async function moveTo(target) {
    const p = cur();
    await moveBy((target - p.pos + 40) % 40);
  }

  async function sendToJail(pi) {
    const p = state.players[pi];
    p.pos = JAIL; p.inJail = true; p.jailTurns = 0;
    state.doubles = 0;
    state.phase = 'end';
    Audio_.play('jail');
    render();
    await notify('Go to Jail', `<p>${p.token} ${p.name} is sent directly to jail. Do not pass GO, do not collect ${fmt(GO_SALARY)}.</p>`);
  }

  // =====================================================================
  // Landing
  // =====================================================================
  async function landOn(i, opts = {}) {
    const p = cur(), pi = state.turn, s = SQUARES[i];
    log(`${p.name} lands on ${s.name}.`);
    if (placePanelVisible()) showPlace(i);
    switch (s.type) {
      case 'property': case 'railroad': case 'utility': {
        const o = state.owners[i];
        if (o.owner == null) return offerPurchase(i);
        if (o.owner === pi) return;
        if (o.mortgaged) { log(`${s.name} is mortgaged — no rent due.`); return; }
        if (opts.utilMult) {
          state.dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
          render();
          log(`${p.name} rolls ${diceTotal()} for the utility charge.`);
        }
        const rent = rentFor(i, opts);
        const owner = state.players[o.owner];
        log(`${p.name} pays ${fmt(rent)} rent to ${owner.name} for ${s.name}.`);
        await notify('Rent due', `${deedHtml(i)}<p>${p.name} owes <b>${fmt(rent)}</b> to ${owner.token} ${owner.name}.</p>`, 'Pay');
        if (charge(pi, rent, o.owner)) Audio_.play('pay');
        return;
      }
      case 'tax': {
        log(`${p.name} pays ${fmt(s.amount)} ${s.name.toLowerCase()}.`);
        await notify(s.name, `<p>Pay <b>${fmt(s.amount)}</b> to the bank${state.opts.parking ? ' (goes to the Free Parking pot)' : ''}.</p>`, 'Pay');
        if (charge(pi, s.amount, null, { toPot: true })) Audio_.play('pay');
        return;
      }
      case 'chance': return drawCard('chance');
      case 'chest': return drawCard('chest');
      case 'gotojail': return sendToJail(pi);
      case 'parking': {
        if (state.opts.parking && state.pot > 0) {
          log(`${p.name} collects the ${fmt(state.pot)} Free Parking pot!`, true);
          p.money += state.pot;
          Audio_.play('cash');
          await notify('Newroz Picnic', `<p>${p.name} collects the Free Parking pot of <b>${fmt(state.pot)}</b>!</p>`);
          state.pot = 0;
        }
        return;
      }
      default: return;
    }
  }

  async function offerPurchase(i) {
    const p = cur(), pi = state.turn, s = SQUARES[i];
    const canAfford = p.money >= s.price;
    const buttons = [
      { label: state.opts.auction ? 'Decline (auction)' : 'Decline', value: 'no' },
      { label: `Buy for ${fmt(s.price)}`, value: 'yes', cls: 'primary', disabled: !canAfford },
    ];
    const r = await ask(`${s.name} is for sale`, `${deedHtml(i)}<p>${p.token} ${p.name} has ${fmt(p.money)}.</p>`, buttons);
    if (r === 'yes') {
      p.money -= s.price;
      state.owners[i].owner = pi;
      Audio_.play('cash');
      log(`${p.name} buys ${s.name} for ${fmt(s.price)}.`, true);
      render();
    } else {
      log(`${p.name} declines to buy ${s.name}.`);
      if (state.opts.auction) await runAuction(i);
    }
  }

  async function runAuction(i) {
    const s = SQUARES[i];
    const order = [];
    for (let k = 1; k <= state.players.length; k++) {
      const pi = (state.turn + k) % state.players.length;
      if (!state.players[pi].bankrupt) order.push(pi);
    }
    let active = [...order];
    let bid = 0, high = null, t = 0;
    while (active.length > 0) {
      if (active.length === 1 && high === active[0]) break;
      const pi = active[t % active.length];
      const p = state.players[pi];
      const steps = [1, 10, 50, 100];
      const body = `${deedHtml(i)}<div class="auction-box">
        <div class="bid">${fmt(bid)}</div>
        <div class="bidder">${high == null ? 'No bids yet' : `High bidder: ${state.players[high].token} ${state.players[high].name}`}</div>
        <p><b>${p.token} ${p.name}</b>, your bid? (you have ${fmt(p.money)})</p></div>`;
      const buttons = steps.map((st) => ({ label: `+${fmt(st)}`, value: st, cls: 'primary', disabled: bid + st > p.money }));
      buttons.push({ label: 'Pass', value: 'pass', cls: 'ghost' });
      const r = await ask(`Auction: ${s.name}`, body, buttons);
      if (r === 'pass') {
        active.splice(t % active.length, 1);
        log(`${p.name} passes.`);
        if (t >= active.length) t = 0;
      } else {
        bid += r; high = pi;
        Audio_.play('bid');
        log(`${p.name} bids ${fmt(bid)}.`);
        t = (t + 1) % active.length;
      }
    }
    if (high != null && bid > 0) {
      const w = state.players[high];
      w.money -= bid;
      state.owners[i].owner = high;
      Audio_.play('cash');
      log(`${w.name} wins the auction for ${s.name} at ${fmt(bid)}.`, true);
      await notify('Auction won', `<p>${w.token} ${w.name} wins <b>${s.name}</b> for ${fmt(bid)}.</p>`);
    } else {
      log(`Nobody bids on ${s.name}. It stays with the bank.`);
    }
    render();
  }

  // =====================================================================
  // Cards
  // =====================================================================
  async function drawCard(kind) {
    const deck = kind === 'chance' ? state.chance : state.chest;
    const cards = kind === 'chance' ? CHANCE_CARDS : CHEST_CARDS;
    const idx = deck.shift();
    const card = cards[idx];
    if (card.action !== 'jailCard') deck.push(idx); else state[kind + 'Held'] = (state[kind + 'Held'] || 0) + 1;
    const p = cur(), pi = state.turn;
    const deckInfo = kind === 'chance' ? THEME.chance : THEME.chest;
    const colors = deckInfo.colors;
    log(`${p.name} draws a ${deckInfo.name} card: “${card.text}”`);
    Audio_.play('card');
    await notify(`${deckInfo.name} card`,
      `<div class="drawn-card" style="--c1:${colors[0]};--c2:${colors[1]}"><div class="kind">${deckInfo.name} · ${deckInfo.sub}</div><div class="ctext">${card.text}</div></div>`);

    switch (card.action) {
      case 'moveTo': await moveTo(card.target); return landOn(p.pos);
      case 'moveBack': {
        for (let k = 0; k < card.amount; k++) { p.pos = (p.pos - 1 + 40) % 40; Audio_.play('step'); render(); flashSquare(p.pos, 'trail', 700); await sleep(STEP_MS); }
        flashSquare(p.pos, 'landed', 2600);
        await landingBanner(p, p.pos);
        return landOn(p.pos);
      }
      case 'goToJail': return sendToJail(pi);
      case 'collect': p.money += card.amount; Audio_.play('cash'); return;
      case 'pay': if (charge(pi, card.amount, null, { toPot: true })) Audio_.play('pay'); return;
      case 'collectEach': {
        for (const q of alive()) if (pIdx(q) !== pi) { const amt = Math.min(q.money, card.amount); q.money -= amt; p.money += amt; }
        return;
      }
      case 'payEach': {
        const n = alive().length - 1;
        charge(pi, card.amount * n, null, { each: card.amount });
        return;
      }
      case 'jailCard': p.jailCards++; return;
      case 'repairs': {
        let houses = 0, hotels = 0;
        for (const i of propertiesOf(pi)) { const h = state.owners[i].houses; if (h === 5) hotels++; else houses += h; }
        const total = houses * card.house + hotels * card.hotel;
        log(`${p.name} owes ${fmt(total)} for repairs (${houses} houses, ${hotels} hotels).`);
        if (total > 0) charge(pi, total, null, { toPot: true });
        return;
      }
      case 'nearestRailroad': {
        const target = [5, 15, 25, 35].find((r) => r > p.pos) ?? 5;
        await moveTo(target);
        return landOn(p.pos, { rrMult: 2 });
      }
      case 'nearestUtility': {
        const target = p.pos < 12 || p.pos >= 28 ? 12 : 28;
        await moveTo(target);
        return landOn(p.pos, { utilMult: 10 });
      }
    }
  }

  // =====================================================================
  // Manage properties (build / sell / mortgage)
  // =====================================================================
  function canBuild(i, pi) {
    const s = SQUARES[i], o = state.owners[i];
    if (s.type !== 'property' || o.owner !== pi || o.houses >= 5) return false;
    const g = groupSquares(s.group);
    if (!g.every((j) => state.owners[j].owner === pi && !state.owners[j].mortgaged)) return false;
    const min = Math.min(...g.map((j) => state.owners[j].houses));
    return o.houses === min && state.players[pi].money >= s.houseCost;
  }
  function canSellHouse(i) {
    const s = SQUARES[i], o = state.owners[i];
    if (o.houses === 0) return false;
    const max = Math.max(...groupSquares(s.group).map((j) => state.owners[j].houses));
    return o.houses === max;
  }
  function canMortgage(i) {
    const s = SQUARES[i], o = state.owners[i];
    if (o.mortgaged) return false;
    return s.type !== 'property' || !groupHasHouses(s.group);
  }
  const unmortgageCost = (i) => Math.ceil(SQUARES[i].price * 0.55);

  function openManage() {
    if (busy && !state.debt) return;
    const pi = state.turn, p = cur();
    const render_ = () => {
      const props = propertiesOf(pi);
      const rows = props.map((i) => {
        const s = SQUARES[i], o = state.owners[i];
        const c = s.group ? GROUPS[s.group].color : s.type === 'railroad' ? '#333' : '#777';
        const status = o.mortgaged ? 'Mortgaged' : o.houses === 5 ? 'Hotel' : o.houses ? `${o.houses} house${o.houses > 1 ? 's' : ''}` : (s.type === 'property' && ownsGroup(pi, s.group) ? 'Full region' : '');
        const btns = [];
        if (s.type === 'property' && canBuild(i, pi)) btns.push(`<button class="btn primary" data-a="build" data-i="${i}">${o.houses === 4 ? 'Hotel' : 'House'} ${fmt(s.houseCost)}</button>`);
        if (s.type === 'property' && canSellHouse(i)) btns.push(`<button class="btn" data-a="sell" data-i="${i}">Sell ${o.houses === 5 ? 'hotel' : 'house'} +${fmt(s.houseCost / 2)}</button>`);
        if (canMortgage(i)) btns.push(`<button class="btn warn" data-a="mortgage" data-i="${i}">Mortgage +${fmt(s.price / 2)}</button>`);
        if (o.mortgaged) btns.push(`<button class="btn" data-a="unmortgage" data-i="${i}" ${p.money < unmortgageCost(i) ? 'disabled' : ''}>Unmortgage ${fmt(unmortgageCost(i))}</button>`);
        return `<div class="prow"><span class="sw" style="--c:${c}"></span><span class="pn">${s.name}<small>${s.kurdish || ''} ${status ? '· ' + status : ''}</small></span>${btns.join('')}</div>`;
      }).join('');
      const card = openModal(`<h3>${p.token} ${p.name} — properties</h3>
        <p class="muted">Cash: <b>${fmt(p.money)}</b>${state.debt ? ` · Owed: <b style="color:var(--red)">${fmt(state.debt.amount)}</b>` : ''}</p>
        <div class="plist">${rows || '<p class="muted">You own nothing yet.</p>'}</div>
        <div class="modal-actions"><button class="btn primary" id="mclose">Done</button></div>`, false, () => { closeModal(); afterManage(); });
      card.querySelectorAll('[data-a]').forEach((b) => {
        b.onclick = () => {
          const i = +b.dataset.i, s = SQUARES[i], o = state.owners[i];
          switch (b.dataset.a) {
            case 'build': Audio_.play('build'); p.money -= s.houseCost; o.houses++; log(`${p.name} builds a ${o.houses === 5 ? 'hotel' : 'house'} on ${s.name}.`); break;
            case 'sell': p.money += s.houseCost / 2; o.houses--; log(`${p.name} sells a building on ${s.name} for ${fmt(s.houseCost / 2)}.`); break;
            case 'mortgage': Audio_.play('coin'); p.money += s.price / 2; o.mortgaged = true; log(`${p.name} mortgages ${s.name} for ${fmt(s.price / 2)}.`); break;
            case 'unmortgage': p.money -= unmortgageCost(i); o.mortgaged = false; log(`${p.name} lifts the mortgage on ${s.name} for ${fmt(unmortgageCost(i))}.`); break;
          }
          render();
          render_();
        };
      });
      card.querySelector('#mclose').onclick = () => { closeModal(); afterManage(); };
    };
    render_();
  }

  function afterManage() {
    if (state.debt && cur().money >= state.debt.amount) resolveDebt();
    else stable();
  }

  // =====================================================================
  // Trading
  // =====================================================================
  function tradable(i) {
    const s = SQUARES[i];
    return s.type !== 'property' || !groupHasHouses(s.group);
  }

  async function openTrade() {
    if (busy && !state.debt) return;
    const me = state.turn, p = cur();
    const others = state.players.map((q, qi) => qi).filter((qi) => qi !== me && !state.players[qi].bankrupt);
    if (others.length === 0) return;
    let partner = others[0];

    const render_ = () => {
      const q = state.players[partner];
      const col = (pi, side) => {
        const pl = state.players[pi];
        const items = propertiesOf(pi).map((i) => {
          const s = SQUARES[i], o = state.owners[i];
          const ok = tradable(i);
          const c = s.group ? GROUPS[s.group].color : s.type === 'railroad' ? '#333' : '#777';
          return `<label class="item"><input type="checkbox" data-side="${side}" data-i="${i}" ${ok ? '' : 'disabled'}><span class="sw" style="--c:${c};width:10px;height:16px;border-radius:2px;background:${c};display:inline-block"></span>${s.name}${o.mortgaged ? ' (mortgaged)' : ''}${ok ? '' : ' — has buildings'}</label>`;
        }).join('');
        return `<div class="trade-col"><h4>${pl.token} ${pl.name} gives</h4>${items || '<span class="muted">no properties</span>'}
          ${pl.jailCards ? `<label class="item"><input type="checkbox" data-side="${side}" data-card="1">Get Out of Jail Free card</label>` : ''}
          <input type="number" min="0" max="${pl.money}" step="1" value="0" data-side="${side}" data-cash placeholder="Cash"> <span class="muted">cash (has ${fmt(pl.money)})</span></div>`;
      };
      const card = openModal(`<h3>Trade</h3>
        <p>${p.token} ${p.name} trades with
          <select id="trade-partner">${others.map((qi) => `<option value="${qi}" ${qi === partner ? 'selected' : ''}>${state.players[qi].token} ${state.players[qi].name}</option>`).join('')}</select></p>
        <div class="trade-cols">${col(me, 'a')}${col(partner, 'b')}</div>
        <div class="modal-actions"><button class="btn" id="tcancel">Cancel</button><button class="btn primary" id="tpropose">Propose trade</button></div>`, true, () => { closeModal(); render(); });
      card.querySelector('#trade-partner').onchange = (e) => { partner = +e.target.value; render_(); };
      card.querySelector('#tcancel').onclick = () => { closeModal(); render(); };
      card.querySelector('#tpropose').onclick = async () => {
        const pick = (side) => ({
          props: [...card.querySelectorAll(`input[data-side="${side}"][data-i]:checked`)].map((x) => +x.dataset.i),
          card: !!card.querySelector(`input[data-side="${side}"][data-card]:checked`),
          cash: Math.max(0, Math.floor(+card.querySelector(`input[data-side="${side}"][data-cash]`).value || 0)),
        });
        const a = pick('a'), b = pick('b');
        if (a.cash > p.money || b.cash > q.money) return alert('Not enough cash for that offer.');
        if (!a.props.length && !b.props.length && !a.cash && !b.cash && !a.card && !b.card) return alert('Nothing is being traded.');
        closeModal();
        const desc = (pl, o) => {
          const parts = o.props.map((i) => SQUARES[i].name);
          if (o.card) parts.push('Get Out of Jail Free card');
          if (o.cash) parts.push(fmt(o.cash));
          return `<p><b>${pl.token} ${pl.name}</b> gives: ${parts.join(', ') || 'nothing'}</p>`;
        };
        const ok = await ask(`${q.token} ${q.name}, do you accept?`, desc(p, a) + desc(q, b), [
          { label: 'Decline', value: false }, { label: 'Accept trade', value: true, cls: 'primary' }]);
        if (ok) {
          for (const i of a.props) state.owners[i].owner = partner;
          for (const i of b.props) state.owners[i].owner = me;
          p.money += b.cash - a.cash; q.money += a.cash - b.cash;
          if (a.card) { p.jailCards--; q.jailCards++; }
          if (b.card) { q.jailCards--; p.jailCards++; }
          Audio_.play('cash');
          log(`${p.name} and ${q.name} complete a trade.`, true);
          afterManage();
        } else {
          log(`${q.name} declines the trade.`);
          render();
        }
      };
    };
    render_();
  }

  // =====================================================================
  // Music menu
  // =====================================================================
  let musicMenuOpen = false, musicMenuSig = '', musicMenuTyped = '';
  function musicMenuSignature() {
    const cur = Audio_.music.current();
    return JSON.stringify([Audio_.prefs.music, cur && cur.id, Audio_.music.tracks().map((t) => [t.id, t.name, t.title, t.author, t.error, t.sub])]);
  }
  function closeMusicMenu() { musicMenuOpen = false; musicMenuSig = ''; musicMenuTyped = ''; closeModal(); render(); }
  function openMusicMenu() {
    if (musicMenuOpen) return;
    if (!$('#modal').classList.contains('hidden')) return; // don't stack on top of a game prompt
    musicMenuOpen = true;
    musicMenuSig = '';
    drawMusicMenu();
  }
  // Redraw only when something visible changed, so buttons are never swapped out under a click.
  Audio_.music.onChange(() => { if (musicMenuOpen && musicMenuSignature() !== musicMenuSig) drawMusicMenu(); });

  function drawMusicMenu() {
    if (!musicMenuOpen) return;
    const prev = $('#yt-url'); if (prev) musicMenuTyped = prev.value;
    const prevBody = $('#modal-card .modal-body'); const keepScroll = prevBody ? prevBody.scrollTop : 0;
    musicMenuSig = musicMenuSignature();
    const cur = Audio_.music.current();
    const on = Audio_.prefs.music;
    const row = (t) => {
      const isCur = cur && cur.id === t.id;
      const err = t.error === true ? 'Could not play this file' : (typeof t.error === 'string' ? t.error : '');
      const name = t.source === 'youtube' && t.title ? t.title : t.name;
      const sub = t.source === 'youtube' && t.author && !t.preset ? t.author : t.sub || '';
      return `<button class="track ${isCur ? 'active' : ''} ${err ? 'error' : ''}" data-play="${t.id}">
        <span class="tplay">${isCur && on ? '▶' : '♪'}</span>
        <span class="tinfo"><span class="tname">${name}${t.source === 'youtube' ? '<span class="yt-badge">YouTube</span>' : ''}</span><span class="tsub ${err ? 'err' : ''}">${err || sub}</span></span>
        ${t.source === 'library' ? `<span class="tdel" data-del="${t.id}" title="Remove from library">✕</span>` : ''}
        ${t.source === 'youtube' && !t.preset ? `<span class="tdel" data-ytdel="${t.id}" title="Remove">✕</span>` : ''}
      </button>`;
    };
    const tracks = Audio_.music.tracks();
    const synth = tracks.filter((t) => t.source === 'synth'), mine = tracks.filter((t) => t.source === 'library' || t.source === 'folder'), yts = tracks.filter((t) => t.source === 'youtube');
    const card = openModal(`<div class="music-menu"><h3>🎵 Music</h3>
      <div class="music-controls">
        <button class="btn ${on ? '' : 'primary'}" id="m-toggle">${on ? '⏸ Pause music' : '▶ Play music'}</button>
        <button class="btn" id="m-next" ${on ? '' : 'disabled'}>⏭ Next</button>
        <span class="muted">Volume</span><input type="range" id="m-vol" min="0" max="1" step="0.05" value="${Audio_.prefs.volume}">
      </div>
      <div class="section">Built-in soundtracks (synthesized)</div>
      <div class="tracks">${synth.map(row).join('')}</div>
      <div class="section">Real songs from YouTube</div>
      ${Audio_.music.ytOnFile ? '<p class="yt-note warn">YouTube only plays when the game is served from localhost. Quit this tab and double-click <b>play.command</b> in the game folder, which starts a tiny local server and opens the game.</p>' : '<p class="yt-note">Streams through YouTube\'s own player (needs internet). Paste any YouTube video or playlist link to add it.</p>'}
      <div class="yt-add"><input id="yt-url" type="text" placeholder="Paste a YouTube link or playlist link…"><button class="btn primary" id="yt-addbtn">Add</button></div>
      <div class="tracks">${yts.map(row).join('')}</div>
      <div class="section">Your songs</div>
      <div class="tracks">${mine.map(row).join('') || '<p class="muted" style="margin:0 0 6px">No local files yet. Add MP3s or other audio from your own collection.</p>'}</div>
      <div class="add-songs" id="m-drop">
        <button class="btn primary" id="m-add">＋ Add songs from your Mac</button>
        <input type="file" id="m-file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.wav,.flac" multiple hidden>
        <div>or drag MP3 / M4A / WAV files anywhere onto the game. Songs are stored in this browser and never leave your computer.</div>
      </div>
      <div class="modal-actions"><button class="btn primary" id="m-close">Done</button></div></div>`, false, closeMusicMenu);
    card.querySelector('.modal-body').scrollTop = keepScroll;
    card.querySelector('#m-close').onclick = closeMusicMenu;
    card.querySelector('#m-toggle').onclick = () => Audio_.music.setEnabled(!Audio_.prefs.music);
    card.querySelector('#m-next').onclick = () => Audio_.music.next();
    card.querySelector('#m-vol').oninput = (e) => Audio_.music.setVolume(+e.target.value);
    const ytInput = card.querySelector('#yt-url');
    ytInput.value = musicMenuTyped;
    const addYt = async () => {
      const val = ytInput.value;
      if (!Audio_.music.parseYouTube(val)) { ytInput.style.borderColor = 'var(--red)'; ytInput.placeholder = 'That does not look like a YouTube link'; ytInput.value = ''; return; }
      ytInput.value = ''; musicMenuTyped = '';
      const t = await Audio_.music.addYouTube(val);
      if (t) { if (!Audio_.prefs.music) Audio_.music.setEnabled(true); Audio_.music.choose(t.id); log(`YouTube track added: ${t.name}.`); }
    };
    card.querySelector('#yt-addbtn').onclick = addYt;
    ytInput.onkeydown = (e) => { if (e.key === 'Enter') addYt(); };
    card.querySelectorAll('[data-ytdel]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); Audio_.music.removeYouTube(b.dataset.ytdel); });
    card.querySelectorAll('[data-play]').forEach((b) => b.onclick = (e) => {
      if (e.target.closest('[data-del],[data-ytdel]')) return;
      if (!Audio_.prefs.music) Audio_.music.setEnabled(true);
      Audio_.music.choose(b.dataset.play);
    });
    card.querySelectorAll('[data-del]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); Audio_.music.removeSong(b.dataset.del); });
    const fileInput = card.querySelector('#m-file');
    card.querySelector('#m-add').onclick = () => fileInput.click();
    fileInput.onchange = async () => { const n = await Audio_.music.addFiles(fileInput.files); if (n) log(`${n} song${n > 1 ? 's' : ''} added to the music library.`); };
  }

  // =====================================================================
  // Bankruptcy & winning
  // =====================================================================
  async function declareBankruptcy() {
    const d = state.debt;
    if (!d) return;
    const pi = d.payer, p = state.players[pi];
    const creditorName = d.creditor == null ? 'the bank' : state.players[d.creditor].name;
    const ok = await ask('Declare bankruptcy?', `<p>${p.token} ${p.name} will leave the game. Everything they own goes to ${creditorName}.</p>`,
      [{ label: 'Cancel', value: false }, { label: 'Declare bankruptcy', value: true, cls: 'danger' }]);
    if (!ok) return;

    // Buildings are sold back to the bank at half price first.
    for (const i of propertiesOf(pi)) {
      const s = SQUARES[i], o = state.owners[i];
      if (o.houses) { p.money += o.houses * s.houseCost / 2; o.houses = 0; }
    }
    if (d.creditor != null) {
      const c = state.players[d.creditor];
      c.money += p.money;
      c.jailCards += p.jailCards;
      for (const i of propertiesOf(pi)) state.owners[i].owner = d.creditor;
      log(`${p.name} is bankrupt. ${c.name} receives all of their assets.`, true);
    } else {
      for (const i of propertiesOf(pi)) { state.owners[i].owner = null; state.owners[i].mortgaged = false; }
      log(`${p.name} is bankrupt. Their properties return to the bank.`, true);
    }
    p.money = 0; p.jailCards = 0; p.bankrupt = true;
    state.debt = null;
    state.pendingMove = 0;
    if (alive().length > 1) {
      nextPlayer();
      log(`— ${cur().name}'s turn —`, true);
      stable(); // persist the bankruptcy before the hand-off banner
      setBusy(true);
      await turnBanner(cur());
    }
    finishAction();
  }

  function checkWinner() {
    const a = alive();
    if (a.length !== 1 || state.players.length < 2) return;
    const w = a[0];
    state.phase = 'over';
    Audio_.play('win');
    render();
    openModal(`<div class="winner"><div class="trophy">🏆</div><h3>${w.token} ${w.name} ${THEME.winText}</h3>
      <p>Final worth: ${fmt(netWorth(pIdx(w)))}</p>
      <div class="modal-actions" style="justify-content:center"><button class="btn primary" id="wnew">New game</button></div></div>`);
    $('#wnew').onclick = () => { localStorage.removeItem(SAVE_KEY); location.reload(); };
  }

  // =====================================================================
  // Boot
  // =====================================================================
  initSetup();
})();
