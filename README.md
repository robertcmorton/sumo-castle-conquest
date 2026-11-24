# Leo's Games

Browser games designed by an 8-year-old named Leo and built with Claude.

## Play

Open [`index.html`](index.html) in any modern browser, or visit the deployed version. It's a game picker that links to every game. Each game has an **All games** button to get back to it.

## The games

- [`soccer-shoot.html`](soccer-shoot.html): **Soccer Shoot.** Leo wrote this one down on paper. Each level is a 5-a-side soccer match (stick or arrow keys, SHOOT and PASS, or tap the pitch to kick there). Win it for money ($1,000 on level 1, $100 more every level), then build a hut out of cubes around Leo and blast zombies with poison arrows, dynamite and TNT for more money. Stronger cubes unlock as the levels go up. Spend the money in the shop on real football stars, from Unai Simón ($5,000) to Lamine Yamal ($10,000, the hardest to get); your best five play. 1000 levels that look more realistic as you go. Saves under `leo_soccer_`.
- [`lava-block.html`](lava-block.html): **Lava Block.** The floor is lava! Climb an obstacle course of trampolines, air fans, water jumps and monsters. On the climb, 🔫 FIRE (or F) zaps monsters, and ✨ TELEPORT (or T) then a tap takes you to that spot. At the top you get 3 minutes to build a hut out of cubes, with machines that shoot bombs, fire and poison darts, and cameras and a TV. Building is in 3-D (three.js from cdnjs, with the flat view as a backup if it can't load), and the ◀ ▲ 🎥 ▼ ▶ buttons or arrow keys turn the camera. Tap a camera cube to see a close-up. Monsters attack on even levels, and your base stays and grows every level.
- [`great-wall-getaway.html`](great-wall-getaway.html): **Great Wall Getaway.** Drive your super car, rob banks and escape the police, then fight a war with them at the Great Wall of China: send your crew over the wall and throw bombs, poison darts and TNT. 1000 levels that look more realistic as you go.
- [`barrier-battle.html`](barrier-battle.html): **Barrier Battle: Blue vs Red.** Chop trees to build your wall, fight off giant animals, and smash the red barrier across 1000 levels.
- [`sumo-castle.html`](sumo-castle.html): **Sumo Castle Conquest.** Click your tower, then another tower, to send a wave of sumos. A tower at 0 HP becomes yours. Capture the Red Castle to win, and don't let your Blue Castle fall. 100 levels from baby-easy to brutal.
- [`sumo-smash.html`](sumo-smash.html): **Sumo & Ninja.** Punch, kick and move to knock your opponent out of the ring.
- [`spelling-bee.html`](spelling-bee.html): **Spelling Bee.** Listen to a word and spell it.

Progress in every game saves automatically in the browser.

## Lily's games and Dad's game

The menu also has a **Lily's games** section and a **Dad's game** section. They open through `play.html?g=<id>`, which adds a 🏠 Games button.

| Game | Where it comes from |
|---|---|
| 🚀 Launch! | `lily/launch/` (copied from `../Lilys App`) |
| 🏅 Sport 4 Life | `lily/sport/` (copied from `../Lily's Party Sports`) |
| 🍕 Lily's Pizzeria, 🏨 Sparkle Suites, 🛝 Splash Slides, 🗺️ Colour the World, 🌋 Lava Leap | `lily/play/` (copied from `../Lilys Games/play`) |
| 🛒 Crew Kart | its own website, https://magliner-kart.vercel.app (so its best-times board keeps working) |

Lily's games are **copies**. Changes made in her folders don't appear here until they are copied again:

```bash
rsync -a --exclude='.*' "../Lilys App/index.html" "../Lilys App/css" "../Lilys App/js" lily/launch/
rsync -a --exclude='.*' "../Lily's Party Sports/index.html" "../Lily's Party Sports/css" "../Lily's Party Sports/js" lily/sport/
rsync -a --exclude='.*' "../Lilys Games/play/" lily/play/
```

Open House isn't here, because it needs its own server for maps and multiplayer. Lily's Spelling Bee is the same game as Leo's 🐝 Spelling Bee.

**Saves stay separate.** Every game keeps its scores and levels under its own name on the device:
- Leo's games: `leo_lava_…`, `leo_getaway_…`, `leo_barrier_…`, `leo_castle_…`, `sumoNinjaSave_v1`, `spelling-bee-leo-v1`
- Lily's games: `lilys-math-quest-v2` (Launch!), `lps:…` (Sport 4 Life), `lily-fun-park-v1` (the five `play/` games, which share one wallet of coins)
- Crew Kart: saves on its own website

## Adding a game

Put the new game's `.html` file in this folder, then add an entry to the `GAMES` list near the bottom of `index.html`.
