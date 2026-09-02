# Bolonki (1993) in JavaScript

A port of the QuickBASIC 4.5 game recovered from `BOL02.OBJ`. The level maps,
sprites, level codes and screen text are the originals; see `NOTES.md` for what
had to be reconstructed and why.

## Play

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8731 --directory js
```

## Keys

| | |
|---|---|
| left / right | move one column (one step per drop) |
| up / down | speed 1 – 4 (higher speed scores more per block) |
| P | pause |
| ESC | restart the level |
| E / C / I / S | start / level code / info / quit |

## On a phone

Touch controls show up only on a phone-sized screen driven by a finger
(`pointer: coarse` and a viewport whose short side is 600 px or less). Desktop
is keyboard-only. There is no web API that reports whether a physical keyboard
is attached, so the port watches for one being used instead: the first
keystroke carrying a real `KeyboardEvent.code` can only have come from
hardware — phone keyboards report an empty code or `Unidentified` — and the
touch controls stand down when one arrives. The *Controles tactiles* button in
the footer overrides the decision either way.

**Landscape** puts two semitransparent arrows in the bottom corners of the
screen itself and the rest as small buttons in the strip under the status bar,
so the page keeps no furniture at all and the game gets the whole viewport.
Their sizes are percentages of the canvas, so they land on the same game pixels
at any scale: the playfield (which ends at y=243 of 350) and the status bar,
score and colour indicator all stay clear.

**Portrait** puts a pad under the screen with large thumb buttons, and says
that turning the phone gives the screen a lot more room.

Sound needs one tap before iOS will allow it, so the *Sonido* chip says
`ON (toca para activar)` until the audio context is actually running — if it
still says that after you have tapped, audio is being blocked rather than
merely silent. On iOS the page claims a `playback` audio session so the ringer
switch does not mute the game; on iOS before 16.4 it falls back to a looping
silent element, which has the same effect.

Either way: left/right repeat while held, up/down change speed, and the row of
letters is the menu — E, C, I, S, P, ESC, an OK for confirming level codes, and
a sound toggle in landscape. Pressing C raises the phone keyboard so a code can
be typed into the original's own code screen. Tapping the screen counts as
"press any key", which is what gets you past the title and Info screens.

## How it plays

The ball never stops bouncing between the ceiling and the floor. A plain block
breaks only if it matches your current colour, shown in the box at the bottom
left; blocks marked with an X repaint you and bounce you back. Clear every
plain block to finish the level. Skulls kill, brick walls bounce, the crossed
flags wipe every skull off the board, and each 50 gold coins pay a bonus.

## Verify the assets

```bash
python3 js/verify.py
```

Re-reads every `DATA` statement in `../BOL02.bas` and compares it with
`assets.js`: the 18 maps and spawn points, the 30 codes, and all 25 sprites
re-encoded back to the original 16-bit integers.

## Files

| file | |
|---|---|
| `index.html` | page shell |
| `game.js` | the port; QuickBASIC labels are kept in comments (`GOSUB L26CA`, …) |
| `assets.js` | sprites, level maps and codes decoded from the object file |
| `verify.py` | asset equality check |
| `NOTES.md` | original vs reconstructed, tile table, deviations |

## Size on screen

`Zoom: auto` takes the largest size that fits the window, in half steps — whole
steps alone jump straight from 640 to 1280 wide, so a window with room for 1.9x
would have been stuck at 1x. Halves land on exact device pixels at
devicePixelRatio 2 and stay close enough at 1 that the 24 px tiles and the 8x14
text hold up. Typical results:

| window | canvas |
|---|---|
| 1366 x 768 | 960 x 525 (1.5x) |
| 1440 x 900 | 1280 x 700 (2x) |
| 1920 x 1080 | 1600 x 875 (2.5x) |

The chip cycles auto, 1x, 1.5x, 2x and up, offering only the sizes the window
can actually show, and remembers the choice. Below 1x — a phone in portrait —
the scale is free so the canvas fills whatever room there is. It re-fits on
rotation, when the touch pad appears and when the phone keyboard slides in.
