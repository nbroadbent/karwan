// Kurdistan Monopoly — theme loader.
// Each theme (themes/*.js) supplies its board, cards, tokens, currency, places,
// Wikipedia titles and blurbs. applyTheme() exposes the active theme's tables
// as the globals the game engine uses.

var THEME, SQUARES, GROUPS, CHANCE_CARDS, CHEST_CARDS, TOKENS, PLAYER_COLORS, CURRENCY, IDX, MAP_PLACES, WIKI_TITLES, ABOUT;
const THEME_IDS = Object.keys(window.THEMES || {});

function applyTheme(id) {
  THEME = THEMES[id] || THEMES[THEME_IDS[0]];
  SQUARES = THEME.squares;
  GROUPS = THEME.groups;
  TOKENS = THEME.tokens;
  PLAYER_COLORS = THEME.playerColors;
  CURRENCY = THEME.currency;
  MAP_PLACES = THEME.mapPlaces;
  WIKI_TITLES = THEME.wikiTitles;
  ABOUT = THEME.about;
  IDX = {};
  SQUARES.forEach((s, i) => { if (s.name) IDX[s.name] = i; });
  // card targets may be given as square names
  const resolve = (cards) => cards.map((c) => (typeof c.target === 'string' ? { ...c, target: IDX[c.target] ?? 0 } : c));
  CHANCE_CARDS = resolve(THEME.chanceCards);
  CHEST_CARDS = resolve(THEME.chestCards);
  document.body.dataset.theme = THEME.id;
  return THEME;
}

const mapUrl = (name) => (MAP_PLACES[name] ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(MAP_PLACES[name]) : null);
const googleImagesUrl = (name) => 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent((MAP_PLACES[name] || name) + ' ' + THEME.name);
const wikiUrl = (name) => (WIKI_TITLES[name] ? 'https://en.wikipedia.org/wiki/' + encodeURIComponent(WIKI_TITLES[name].replace(/ /g, '_')) : null);

applyTheme(localStorage.getItem('kurdistan-monopoly-theme') || 'kurdish');
