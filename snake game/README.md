# Snake Maze

A browser-based puzzle game combining Snake and Pac-Man mechanics. Navigate a maze, collect colored dots to grow your trail, and avoid patrolling ghosts.

## How to Run

Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).

For local file serving (recommended for full functionality):

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000`.

## How to Play

**Goal:** Collect all colored dots in the maze while avoiding ghosts and your own trail.

### Controls

| Input | Action |
|-------|--------|
| `W` / `↑` | Move up |
| `S` / `↓` | Move down |
| `A` / `←` | Move left |
| `D` / `→` | Move right |

- On mobile: use the on-screen D-pad or swipe on the canvas.
- Direction changes are buffered and applied at the next intersection.
- You cannot reverse direction (just like Snake).

### Colored Dots

| Color | Points | Trail Growth |
|-------|--------|--------------|
| Red | +10 | +4 segments |
| Blue | +20 | +4 segments |
| Cyan | +30 | +4 segments |

Collecting a dot changes your trail color to match.

### Trail

- Your movement leaves a colored trail on the tiles you walk over.
- The trail grows each time you collect a dot.
- You **cannot** move onto your own trail (self-collision = lose a life).
- Plan your routes carefully to avoid getting trapped!

### Ghosts

- 4 ghosts patrol fixed routes through the maze.
- When you get within range, they switch to chase mode and pursue you.
- Ghosts can walk through your trail — only you are blocked by it.
- Collision with a ghost = lose a life.

### Lives & Levels

- Start with 3 lives.
- Lose a life from: ghost collision, self-collision, or getting trapped.
- Collect all dots to complete the level.
- Next level: more dots, faster ghosts, shorter detection range.

## File Structure

```
snake game/
├── index.html          # Landing page
├── game.html           # Game page
├── css/
│   └── style.css       # All styles
├── js/
│   └── game.js         # Game logic
└── README.md
```

## Tech Stack

- HTML5 Canvas for rendering
- Vanilla JavaScript (no frameworks)
- CSS3 for styling and responsive design
- localStorage for high score persistence
