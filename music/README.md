# Music folder

Two ways to play real Kurdish songs in the game:

1. **In the game** (easiest): open the 🎵 menu and click *Add songs from your
   Mac*, or drag audio files onto the game window. Songs are stored inside the
   browser (IndexedDB) and persist between sessions. Nothing is uploaded anywhere.

2. **This folder**: copy MP3 / M4A / WAV / FLAC files here, then run

       ./music/make-playlist.sh

   and reload the game. Name files `Artist - Title.mp3` to get artist and title
   split automatically. Audio files in this folder are git-ignored by default so
   personal music collections are not pushed to GitHub.
