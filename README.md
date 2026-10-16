# Kurdistan Monopoly

A Monopoly-style board game set across Kurdistan — Bashur (Iraq), Rojava (Syria),
Rojhelat (Iran) and Bakur (Turkey). Plays entirely in your browser, on one
computer, passing the mouse between players (hot-seat). No install, no server.

## Play

Double-click `play.command`, or open `index.html` in any browser:

```sh
open index.html
```

2–6 players. Your game is saved automatically in the browser, so you can close
the tab and pick it up later from the start screen.

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

## Sound

All audio is synthesized in the browser with the Web Audio API, so there are no
sound files. Dice, footsteps, cash, cards, building and jail each have their own
effect, and a looping soundtrack plays a daf rhythm with a tembûr-style drone and
a melody in Maqam Kurd. Toggle effects (🔊) and music (🎵) from the side panel;
the choice is remembered.

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
- `audio.js` – synthesized sound effects and soundtrack
- `game.js` – rules engine and UI
