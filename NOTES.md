# Bolonki — JavaScript port notes

Source: `BOL02.OBJ` (Microsoft QuickBASIC 4.5, original source path
`C:\QB45\GARE\BOL02.BAS`), decompiled by `qb45dec` to `../BOL02.bas`.
EAGLE Software 1993 — program and graphics Adrian J. Garelik, level design
Ruben A. Altman and Adrian J. Garelik.

## Taken unchanged from the object file

Everything below comes straight out of the `DATA` statements and is checked by
`python3 js/verify.py`, which re-parses `BOL02.bas` and compares value by value:

| asset | detail |
|---|---|
| 18 level maps | 10 x 20 tile codes each, in the original `DATA` order |
| 18 spawn tails | `colour, column, row, direction/speed` per level |
| 30 level codes | `ATUN`, `PAPANATAS`, … `THEEND` |
| 25 sprites | 24x24, 4-plane EGA `GET` arrays, re-encoded and compared bit for bit |
| all screen text | menu, status bar, Info screen, ending — verbatim, accents included |
| layout | `SCREEN 9` (640x350), 24 px cells at `col*24-22, row*24-22`, `LOCATE row,col` on the 8x14 text grid, EGA palette indices |

`verify.py` also confirms each level block begins exactly on one of the
original's 18 `RESTORE` labels (`L6CC5` … `L71D1`), so the map boundaries are
the program's own, not a guess about where one level ends and the next begins.

## Tile table

Read off the level-drawing routine at `L499A`, which selects the sprite per
tile code, and off the collision handlers:

| code | sprite | behaviour |
|---|---|---|
| 0 | — | empty |
| 1 / 2 / 3 | blue / red / green block | breaks only when `code + 3 == ball colour`; scores `speed x 10` |
| 4 / 5 / 6 | blue / red / green block with an X | repaints the ball to that colour, and bounces it |
| 7 | skull | death: burst animation, screen wipe, level restarts |
| 8 | brick wall | bounces vertically, blocks sideways |
| 9 | crossed flags | erases every skull on the board, then is consumed |
| 10 | gold coin | +1 gold; every 50 gold pays a 10000 point bonus |

Colour 4 = blue, 5 = red, 6 = green, shown by the indicator box at `(61,288)`.
Level 1 starts with colour 0, so nothing can be broken until a paint tile is hit.

## Reconstructed

A `.OBJ` holds no variable names, no line numbers and no block structure, and
`qb45dec` could not recover two things that the port needs. Neither touches
level content.

1. **Comparison operands.** The decompiler prints folded conditions as
   `IF ((0) AND (0)) THEN`, having lost which values were compared. The
   surrounding statements pin every one of them down — e.g. at `L1BE9` the
   guard sits between `n14! = 1` and `n26! = 0` with a bound check on
   `n23! >= 20`, so it is "target cell empty and column < 20". Same for the
   `n28! <= 0 / n28! >= 4` pairs bracketing `GOSUB L35D8`, which are the
   `1..3` and `4..6` tile ranges.
2. **Array subscripts.** Recovered as bare `arr28!` / `n28!`. Two 264-single
   arrays exist in `BC_DATA` (at `+0x0582` and `+0x09A2`), read as
   `(column, row)`; `n28!` is always the tile at the cell being probed. The
   stores that clear a consumed cell were lost with their subscripts, but they
   must exist: after a death the level is redrawn by `L499A` from the array
   and recounts the remaining blocks, so destroyed blocks and collected gold
   have to be zeroed there. The port zeroes them.

## Deliberate differences

- **`BOLONKI.DIB` and `END.DIB` are not in the object file**, and the routines
  that read them lost their width/height initialisation. The title and ending
  logos are stand-ins; everything else on those screens is the original.
- **Frame timing.** The original paced itself with `FOR n2! = 1 TO 50 / speed`
  around an `INKEY$` and a `PUT`, so its speed depended on the PC. `TICK_MS`
  in `game.js` is set to 2.4 ms per iteration, i.e. about 120 ms per cell at
  speed 1 and 29 ms at speed 4 — roughly a 386. Change that one constant to
  taste.
- **Queued sound.** `SOUND` blocks in QuickBASIC once its note buffer fills.
  Here notes are scheduled on a Web Audio square wave and dropped if more than
  0.45 s is already queued, which is close to the 32-note DOS buffer.
- **The trapped-ball loop.** `L5B31` reads only the arrow keys, so a ball with
  no sideways escape locked the original up for good. The port also honours
  ESC, S and C there, so the level can be restarted.
- **`S` (Salir al DOS)** shows a farewell screen and returns to the menu
  instead of calling `END`, and **Backspace** works while typing a code.
- **Level codes shown in the panel.** The original increments its level counter
  but keeps indexing the code list by it, so levels 15-18 display `CAMPANA`,
  `CARPA`, `ANCLA`, `MONOPATIN` while the codes that actually load them are
  `COLORADO`, `CATETO`, `PIO`, `THEEND`. The port shows the code that works.
- **Square pixels.** A real EGA monitor stretched 640x350 to 4:3, about 1.371
  vertically. The sprites were drawn on a square 24x24 grid, so they are shown
  as drawn; set `STRETCH = 1.371` in `game.js` for the CRT geometry. Upscaling
  is nearest-neighbour in half steps, which are exact device pixels at
  devicePixelRatio 2; `ZOOM_STEPS` and the Zoom chip override it.
- **Touch controls** are an addition, obviously: an overlay on the screen in
  landscape, a pad under it in portrait, and a hidden input field that raises
  the phone keyboard for the level-code screen. They all funnel into the same
  `pushKey` queue the keyboard uses, so the game logic still only sees `INKEY$`
  values and nothing about the original's behaviour changes. Holding a
  direction repeats at 80 ms after a 220 ms delay, which stands in for DOS
  typematic repeat; the one-move-per-drop rule (`n26!`) still limits it to a
  single sideways step per fall, exactly as a held arrow key did in 1993.
  The landscape overlay is placed in percentages of the canvas so it lands on
  the same game pixels at any scale, below the playfield and clear of the
  colour indicator at x=60..85 — it only crosses the static `Color:` label.
- Rendering is incremental, as in the original (cells are blacked out with
  `LINE ... BF` and only redrawn on a level load), so a `PUT` over a
  colour-0 pixel behaves like the original's `OR`.
