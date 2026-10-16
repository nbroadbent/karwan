# Kurdistan Monopoly

A Monopoly-style board game set across Kurdistan — Bashur (Iraq), Rojava (Syria),
Rojhelat (Iran) and Bakur (Turkey). Plays entirely in your browser, on one
computer, passing the mouse between players (hot-seat). No install, no server.

## Play

Double-click `play.command`. It starts a tiny local web server (`serve.py`,
Python, no dependencies) and opens the game at http://localhost:8765/. The server is
needed for YouTube music; everything else also works by opening `index.html`
directly:

```sh
open index.html
```

Saved games and added songs live in the browser and are kept per origin, so a
game saved from `index.html` is not visible at the localhost address and vice
versa.

2–6 players. Your game is saved automatically in the browser, so you can close
the tab and pick it up later from the start screen.

## Controls

- Click the dice in the centre of the board (or press **Space** / **Enter**) to
  roll. After your move the same click or key ends your turn.
- Banners announce whose turn it is, the dice roll and where you landed; click a
  banner or press Space to skip it.
- Click any square and the left panel shows photos and the story of that place,
  its deed details, and buttons for Google Maps, Google Images and Wikipedia.
  The panel also follows each player as they land. Photos come from the local
  `images/` folder (freely licensed pictures from Wikimedia Commons ship with
  the game, and you can add your own — see `images/README.md`), the text from
  Wikipedia with built-in notes for offline play. Optionally, *photo source*
  under the text lets you add a free Google Custom Search API key to show
  Google Images results for places without local photos.
- Both side panels fold away with the small arrow tab on their inner edge, so
  the board can take the whole window; the choice is remembered.
- The player bar under the side panel's video has Previous, Play/Pause and Next
  for whatever music is playing.

## The board

| Group | Region | Places |
|---|---|---|
| Brown | Towns | Halabja (Helebce), Kobani (Kobanê) |
| Light blue | Rojava · Syria | Afrin, Amuda, Qamishli |
| Pink | Rojhelat · Iran | Mahabad, Saqqez, Ilam |
| Orange | Bakur · Turkey | Hakkari (Colemêrg), Mardin, Van (Wan) |
| Red | Bashur · Iraq | Zakho, Amedi, Duhok |
| Yellow | Rojhelat · Iran | Urmia, Kermanshah, Sanandaj (Sine) |
| Green | Cities | Hasakah, Kirkuk, Sulaymaniyah |
| Dark blue | Capitals | Diyarbakir (Amed), Erbil (Hewlêr) |

Border crossings (Ibrahim Khalil, Semalka, Haji Omaran, Bashmaq) take the place
of railroads. Dukan Dam Power and Tigris Waterworks are the utilities.
Chance cards are **Newroz** cards and Community Chest cards are **Dîwan** cards.
Currency is the dinar (Ð).

## Sound and music

Sound effects are synthesized in the browser with the Web Audio API: dice,
footsteps, cash, cards, building, bidding, jail and a victory fanfare. Toggle
them with 🔊 in the side panel.

The 🎵 button opens the music menu, which has three sections:

- **Built-in soundtracks** — five looping pieces synthesized live in traditional
  Kurdish modes and dance forms: *Govend* (line dance, Maqam Kurd), *Delîlo*
  (swaying 6/8, Hijaz), *Dengbêj* (slow lament on bowed kemençe), *Halparke*
  (fast festival dance with zurna) and *Newroz* (bright Rast tune on flute).
  These are original compositions in the style, not transcriptions of specific songs.
- **Real songs from YouTube** — streams through YouTube's own embedded player,
  so it needs an internet connection and the game served from localhost (use
  `play.command`). A starter list of Kurdish classics is included, and you can
  paste any YouTube video or playlist link to add it. Some uploads have embedding
  disabled by their owner; the menu says so and skips to the next track.
- **Your songs** — real Kurdish music from your own files. Click *Add songs from
  your Mac* or drag MP3 / M4A / WAV / FLAC files onto the game. Songs are stored
  in the browser (IndexedDB) and persist between sessions; nothing is uploaded.
  You can also drop files into the `music/` folder and run
  `./music/make-playlist.sh` (see `music/README.md`).

Pause, skip, set the volume and remove songs from the same menu. The chosen
track and volume are remembered. No recordings are bundled with the game; real
songs stream from YouTube or come from your own collection.

## Rules implemented

- Standard rents, full-region double rent, houses and hotels with the even-build rule
- Mortgage / unmortgage (10% interest), selling buildings at half price
- Auctions when a player declines to buy (toggle at setup)
- Jail: roll doubles, pay Ð50, or use a Get Out of Jail Free card; three doubles sends you to jail
- Trading properties, cash and jail cards between players
- Debt handling and bankruptcy (assets go to the creditor or back to the bank), last player standing wins
- Optional house rule: taxes and fines collect under Free Parking

## Files

- `index.html` – page structure
- `style.css` – board and UI styling
- `data.js` – squares, rents, card text
- `audio.js` – sound effects, built-in soundtracks, song library
- `serve.py` / `play.command` – local no-cache web server and launcher
- `images/` – photo library for the place panel, with `build.py` to rebuild or refetch it
- `music/` – optional folder for your own audio files and the playlist helper
- `game.js` – rules engine and UI
