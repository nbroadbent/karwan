// Kurdistan Monopoly — board & card data
// Regions: Bashur (Iraqi Kurdistan), Rojava (Syrian Kurdistan),
//          Rojhelat (Iranian Kurdistan), Bakur (Turkish Kurdistan)

const CURRENCY = 'Ð'; // dinar

const GROUPS = {
  brown:     { color: '#8b5a2b', label: 'Towns' },
  lightblue: { color: '#7fc8e8', label: 'Rojava' },
  pink:      { color: '#d63a8a', label: 'Rojhelat' },
  orange:    { color: '#f28c28', label: 'Bakur' },
  red:       { color: '#ed2024', label: 'Bashur' },
  yellow:    { color: '#febd11', label: 'Rojhelat' },
  green:     { color: '#278e43', label: 'Cities' },
  darkblue:  { color: '#1d3f8f', label: 'Capitals' },
};

function prop(name, kurdish, region, group, price, rent, houseCost) {
  return { type: 'property', name, kurdish, region, group, price, rent, houseCost };
}
function crossing(name, sub) {
  return { type: 'railroad', name, kurdish: sub, price: 200 };
}
function utility(name, sub) {
  return { type: 'utility', name, kurdish: sub, price: 150 };
}

const SQUARES = [
  { type: 'go', name: 'GO', kurdish: 'Dest pê bike' },
  prop('Halabja', 'Helebce', 'Bashur · Iraq', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { type: 'chest', name: 'Dîwan' },
  prop('Kobani', 'Kobanê', 'Rojava · Syria', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { type: 'tax', name: 'Income Tax', amount: 200 },
  crossing('Ibrahim Khalil', 'Iraq–Turkey crossing'),
  prop('Afrin', 'Efrîn', 'Rojava · Syria', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  { type: 'chance', name: 'Newroz' },
  prop('Amuda', 'Amûdê', 'Rojava · Syria', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  prop('Qamishli', 'Qamişlo', 'Rojava · Syria', 'lightblue', 120, [8, 40, 100, 300, 450, 600], 50),
  { type: 'jail', name: 'Jail', kurdish: 'Just Visiting' },
  prop('Mahabad', 'Mehabad', 'Rojhelat · Iran', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  utility('Dukan Dam Power', 'Hydroelectric'),
  prop('Saqqez', 'Seqiz', 'Rojhelat · Iran', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  prop('Ilam', 'Îlam', 'Rojhelat · Iran', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  crossing('Semalka', 'Iraq–Syria crossing'),
  prop('Hakkari', 'Colemêrg', 'Bakur · Turkey', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { type: 'chest', name: 'Dîwan' },
  prop('Mardin', 'Mêrdîn', 'Bakur · Turkey', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  prop('Van', 'Wan', 'Bakur · Turkey', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
  { type: 'parking', name: 'Free Parking', kurdish: 'Newroz Picnic' },
  prop('Zakho', 'Zaxo', 'Bashur · Iraq', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { type: 'chance', name: 'Newroz' },
  prop('Amedi', 'Amêdî', 'Bashur · Iraq', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  prop('Duhok', 'Dihok', 'Bashur · Iraq', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  crossing('Haji Omaran', 'Iraq–Iran crossing'),
  prop('Urmia', 'Wirmê', 'Rojhelat · Iran', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  prop('Kermanshah', 'Kirmaşan', 'Rojhelat · Iran', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  utility('Tigris Waterworks', 'Water'),
  prop('Sanandaj', 'Sine', 'Rojhelat · Iran', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { type: 'gotojail', name: 'Go To Jail' },
  prop('Hasakah', 'Hesekê', 'Rojava · Syria', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  prop('Kirkuk', 'Kerkûk', 'Bashur · Iraq', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { type: 'chest', name: 'Dîwan' },
  prop('Sulaymaniyah', 'Silêmanî', 'Bashur · Iraq', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  crossing('Bashmaq', 'Iraq–Iran crossing'),
  { type: 'chance', name: 'Newroz' },
  prop('Diyarbakir', 'Amed', 'Bakur · Turkey', 'darkblue', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { type: 'tax', name: 'Luxury Tax', amount: 100 },
  prop('Erbil', 'Hewlêr', 'Bashur · Iraq', 'darkblue', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

// Where each place is, for the "View on Google Maps" button on its card.
const MAP_PLACES = {
  'Halabja': 'Halabja, Iraq', 'Kobani': 'Kobani (Ayn al-Arab), Syria',
  'Afrin': 'Afrin, Syria', 'Amuda': 'Amuda, Al-Hasakah, Syria', 'Qamishli': 'Qamishli, Syria',
  'Mahabad': 'Mahabad, West Azerbaijan, Iran', 'Saqqez': 'Saqqez, Kurdistan Province, Iran', 'Ilam': 'Ilam, Iran',
  'Hakkari': 'Hakkari, Turkey', 'Mardin': 'Mardin, Turkey', 'Van': 'Van, Turkey',
  'Zakho': 'Zakho, Iraq', 'Amedi': 'Amadiya, Duhok, Iraq', 'Duhok': 'Duhok, Iraq',
  'Urmia': 'Urmia, Iran', 'Kermanshah': 'Kermanshah, Iran', 'Sanandaj': 'Sanandaj, Iran',
  'Hasakah': 'Al-Hasakah, Syria', 'Kirkuk': 'Kirkuk, Iraq', 'Sulaymaniyah': 'Sulaymaniyah, Iraq',
  'Diyarbakir': 'Diyarbakır, Turkey', 'Erbil': 'Erbil Citadel, Erbil, Iraq',
  'Ibrahim Khalil': 'Ibrahim Khalil Border Crossing, Zakho, Iraq', 'Semalka': 'Semalka Border Crossing, Faysh Khabur, Iraq',
  'Haji Omaran': 'Haji Omaran Border Crossing, Iraq', 'Bashmaq': 'Bashmakh Border Crossing, Penjwen, Iraq',
  'Dukan Dam Power': 'Dukan Dam, Iraq', 'Tigris Waterworks': 'Tigris River, Mosul, Iraq',
  'Jail': 'Amna Suraka Museum, Sulaymaniyah, Iraq', 'Free Parking': 'Mount Judi, Şırnak, Turkey', 'GO': 'Kurdistan',
};
const mapUrl = (name) => MAP_PLACES[name] ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(MAP_PLACES[name]) : null;

const IDX = {};
SQUARES.forEach((s, i) => { if (s.name) IDX[s.name] = i; });

// Newroz cards (Chance)
const CHANCE_CARDS = [
  { text: 'Newroz fires are lit on the mountains. Advance to GO and collect Ð200.', action: 'moveTo', target: 0 },
  { text: 'Travel to Hewlêr (Erbil), the citadel city. If you pass GO, collect Ð200.', action: 'moveTo', target: IDX['Erbil'] },
  { text: 'Journey to Amed (Diyarbakir) and walk its black basalt walls. If you pass GO, collect Ð200.', action: 'moveTo', target: IDX['Diyarbakir'] },
  { text: 'Take the road to Wan (Van) and see the lake. If you pass GO, collect Ð200.', action: 'moveTo', target: IDX['Van'] },
  { text: 'Head to the Ibrahim Khalil crossing. If you pass GO, collect Ð200.', action: 'moveTo', target: IDX['Ibrahim Khalil'] },
  { text: 'Advance to the nearest border crossing. If owned, pay the owner double the usual toll.', action: 'nearestRailroad' },
  { text: 'Advance to the nearest utility. If owned, roll the dice and pay 10× the total.', action: 'nearestUtility' },
  { text: 'Your dengbêj recording sells out across the bazaar. Bank pays you Ð50.', action: 'collect', amount: 50 },
  { text: 'A friend in the Asayish owes you a favour. Get Out of Jail Free — keep this card until used.', action: 'jailCard' },
  { text: 'Your donkey strays. Go back 3 spaces.', action: 'moveBack', amount: 3 },
  { text: 'Caught smuggling tea over the pass. Go directly to Jail. Do not pass GO, do not collect Ð200.', action: 'goToJail' },
  { text: 'Repair the qanats and mudbrick walls: pay Ð25 per house and Ð100 per hotel you own.', action: 'repairs', house: 25, hotel: 100 },
  { text: 'Pay Ð15 for tea and sunflower seeds at the çayxane.', action: 'pay', amount: 15 },
  { text: 'You are elected chair of the village council. Pay each player Ð50.', action: 'payEach', amount: 50 },
  { text: 'Your Kurdish kilim wins first prize at the Mardin bazaar. Collect Ð100.', action: 'collect', amount: 100 },
  { text: 'Your pomegranate orchard in Halabja has a bumper harvest. Collect Ð150.', action: 'collect', amount: 150 },
];

// Dîwan cards (Community Chest)
const CHEST_CARDS = [
  { text: 'Advance to GO and collect Ð200.', action: 'moveTo', target: 0 },
  { text: 'Bank error in your favour. Collect Ð200.', action: 'collect', amount: 200 },
  { text: "Doctor's fee at the Silêmanî clinic. Pay Ð50.", action: 'pay', amount: 50 },
  { text: 'You sell your saffron harvest. Collect Ð50.', action: 'collect', amount: 50 },
  { text: 'The elders vouch for you. Get Out of Jail Free — keep this card until used.', action: 'jailCard' },
  { text: 'Go directly to Jail. Do not pass GO, do not collect Ð200.', action: 'goToJail' },
  { text: 'It is Newroz! Everyone brings a dish to your picnic. Collect Ð10 from every player.', action: 'collectEach', amount: 10 },
  { text: 'Your wedding dowry fund matures. Collect Ð100.', action: 'collect', amount: 100 },
  { text: 'Income tax refund. Collect Ð20.', action: 'collect', amount: 20 },
  { text: 'It is your birthday. Collect Ð10 from every player.', action: 'collectEach', amount: 10 },
  { text: 'Life insurance matures. Collect Ð100.', action: 'collect', amount: 100 },
  { text: 'Hospital fees in Hewlêr. Pay Ð100.', action: 'pay', amount: 100 },
  { text: 'School fees for the Kurdish-language academy. Pay Ð50.', action: 'pay', amount: 50 },
  { text: 'You receive a consultancy fee. Collect Ð25.', action: 'collect', amount: 25 },
  { text: 'You are assessed for street repairs: Ð40 per house, Ð115 per hotel.', action: 'repairs', house: 40, hotel: 115 },
  { text: 'You win second prize in the Hewlêr poetry contest. Collect Ð10.', action: 'collect', amount: 10 },
  { text: 'You inherit a vineyard near Zaxo. Collect Ð100.', action: 'collect', amount: 100 },
];

const TOKENS = ['☀️', '🦅', '🐎', '🌹', '🏔️', '🫖', '🎻', '🐑'];
const PLAYER_COLORS = ['#ed2024', '#278e43', '#1d3f8f', '#febd11', '#8e44ad', '#16a085', '#e67e22', '#7f8c8d'];
