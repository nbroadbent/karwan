# Photo library

Photos shown in the left-hand place panel. Files here are used before anything
from the internet, so the game works fully offline.

## Naming

`<slug>-<n>.jpg` where the slug is the square name in lower case, accents
removed, spaces as dashes:

    erbil-1.jpg  erbil-2.jpg  diyarbakir-1.jpg  dukan-dam-power-1.jpg
    ibrahim-khalil-1.jpg  free-parking-1.jpg  go-1.jpg  newroz-1.jpg  diwan-1.jpg

JPEG, PNG and WebP all work. Up to three or four per place is plenty; the panel
shows a thumbnail strip when there is more than one.

## Add your own pictures

1. Save pictures into this folder with the naming above (you can rename
   whatever you download).
2. Run `python3 images/build.py` to rebuild `manifest.js`, then reload the game.
3. Optional: add a credit for each file in `credits.json` (title, author,
   license, source) so it shows under the photo.

Mind the rights of anything you add: the photos that ship with the game are
freely licensed (Creative Commons / public domain) from Wikimedia Commons, with
credits in `credits.json`. Pictures saved from a Google Images search are
usually copyrighted — fine for your own table, not for publishing.

## Refresh from Wikimedia Commons

`python3 images/build.py --fetch` downloads up to three freely licensed photos
for every square that has none yet (`--refresh` to redo all).
