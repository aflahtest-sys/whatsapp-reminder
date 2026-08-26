(function () {
    var canvas = document.getElementById('gameCanvas');
    var ctx = canvas.getContext('2d');
    var scoreEl = document.getElementById('score');
    var livesEl = document.getElementById('lives');
    var levelEl = document.getElementById('level');
    var trailLenEl = document.getElementById('trailLen');
    var finalScoreEl = document.getElementById('finalScore');
    var winScoreEl = document.getElementById('winScore');
    var startOverlay = document.getElementById('startOverlay');
    var gameOverOverlay = document.getElementById('gameOverOverlay');
    var winOverlay = document.getElementById('winOverlay');
    var startBtn = document.getElementById('startBtn');
    var restartBtn = document.getElementById('restartBtn');
    var nextLevelBtn = document.getElementById('nextLevelBtn');

    var TILE = 16;

    var MAZE_TEMPLATE = [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
        [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
        [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0],
        [0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0],
        [0,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0],
        [0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,0,0,1,1,1,1,1,1,1,1,1,1,0,0,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,0,0,1,0,0,0,1,1,0,0,0,1,0,0,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,0,0,1,0,1,1,1,1,1,1,0,1,0,0,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,1,0,0,1,0,1,1,1,1,1,1,0,1,0,0,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,0,0,1,1,1,1,1,1,1,1,1,1,0,0,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
        [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
        [0,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,0],
        [0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0],
        [0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0],
        [0,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0],
        [0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0],
        [0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ];

    var DOT_COLORS = {
        2: { color: '#e94560', points: 10, label: 'red' },
        3: { color: '#4da8da', points: 20, label: 'blue' },
        4: { color: '#4ecca3', points: 30, label: 'cyan' }
    };

    var GHOST_COLORS = ['#e94560', '#ff6b81', '#4da8da', '#ffb347'];
    var GHOST_PATROLS = [
        [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 5 }, { x: 1, y: 5 }],
        [{ x: 26, y: 1 }, { x: 21, y: 1 }, { x: 21, y: 5 }, { x: 26, y: 5 }],
        [{ x: 1, y: 29 }, { x: 6, y: 29 }, { x: 6, y: 26 }, { x: 1, y: 26 }],
        [{ x: 26, y: 29 }, { x: 21, y: 29 }, { x: 21, y: 26 }, { x: 26, y: 26 }]
    ];

    var cols, rows, cellSize;
    var maze, player, trail, ghosts, score, lives, level, running;
    var animFrame, lastTime, accumulator;
    var currentTrailColor;
    var trailMaxLength;
    var highScore;

    highScore = parseInt(localStorage.getItem('snakeMazeHighScore')) || 0;

    function resize() {
        var maxW = window.innerWidth - 32;
        var maxH = window.innerHeight - 180;
        cols = MAZE_TEMPLATE[0].length;
        rows = MAZE_TEMPLATE.length;
        var maxCols = Math.floor(maxW / TILE);
        var maxRows = Math.floor(maxH / TILE);
        var scale = Math.min(maxCols / cols, maxRows / rows, 2.5);
        cellSize = Math.floor(TILE * scale);
        if (cellSize < 8) cellSize = 8;
        canvas.width = cols * cellSize;
        canvas.height = rows * cellSize;
        canvas.style.width = canvas.width + 'px';
        canvas.style.height = canvas.height + 'px';
    }

    function deepCopy(arr) {
        return arr.map(function (r) { return r.slice(); });
    }

    function dist(x1, y1, x2, y2) {
        return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
    }

    function isWalkable(x, y) {
        if (x < 0 || x >= cols || y < 0 || y >= rows) {
            if (y === 14 && (x < 0 || x >= cols)) return true;
            return false;
        }
        return maze[y][x] !== 0;
    }

    function isCentered() {
        return Math.abs(player.xOff) < 0.05 && Math.abs(player.yOff) < 0.05;
    }

    function isTrailAt(x, y) {
        for (var i = 0; i < trail.length; i++) {
            if (trail[i].x === x && trail[i].y === y) return true;
        }
        return false;
    }

    function hasDotValue(x, y) {
        if (x < 0 || x >= cols || y < 0 || y >= rows) return false;
        return maze[y][x] === 2 || maze[y][x] === 3 || maze[y][x] === 4;
    }

    function countDots() {
        var c = 0;
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                if (maze[y][x] === 2 || maze[y][x] === 3 || maze[y][x] === 4) c++;
            }
        }
        return c;
    }

    function placeDots() {
        var candidates = [];
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                if (maze[y][x] === 1) {
                    if (dist(x, y, player.x, player.y) > 3) {
                        var nearGhost = false;
                        for (var g = 0; g < GHOST_PATROLS.length; g++) {
                            var wp = GHOST_PATROLS[g][0];
                            if (dist(x, y, wp.x, wp.y) < 3) nearGhost = true;
                        }
                        if (!nearGhost) candidates.push({ x: x, y: y });
                    }
                }
            }
        }

        var dotCount = Math.min(candidates.length, 40 + (level - 1) * 8);
        for (var i = candidates.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = candidates[i];
            candidates[i] = candidates[j];
            candidates[j] = tmp;
        }

        for (var d = 0; d < dotCount; d++) {
            var pos = candidates[d];
            var r = Math.random();
            var dotType = r < 0.4 ? 2 : r < 0.75 ? 3 : 4;
            maze[pos.y][pos.x] = dotType;
        }
    }

    function initPlayer() {
        player = {
            x: 13, y: 23, xOff: 0, yOff: 0,
            dir: 'right', nextDir: 'right',
            speed: 0.12 + Math.min(level - 1, 5) * 0.01
        };
    }

    function initTrail() {
        trail = [];
        trailMaxLength = 3;
        currentTrailColor = '#4ecca3';
    }

    function initGhosts() {
        ghosts = [];
        for (var i = 0; i < 4; i++) {
            var wp = GHOST_PATROLS[i][0];
            ghosts.push({
                x: wp.x, y: wp.y, xOff: 0, yOff: 0,
                dir: 'right', speed: 0.07 + Math.min(level - 1, 5) * 0.008,
                color: GHOST_COLORS[i],
                patrol: GHOST_PATROLS[i],
                patrolIdx: 0,
                mode: 'patrol',
                detectionRange: Math.max(6, 10 - Math.floor(level / 2)),
                modeTimer: 0,
                active: i === 0,
                releaseTimer: i * 1500
            });
        }
    }

    function init() {
        resize();
        score = 0;
        lives = 3;
        level = 1;
        maze = deepCopy(MAZE_TEMPLATE);
        initPlayer();
        initTrail();
        initGhosts();
        placeDots();
        updateHUD();
    }

    function initLevel() {
        maze = deepCopy(MAZE_TEMPLATE);
        initPlayer();
        initTrail();
        initGhosts();
        placeDots();
    }

    // ========== PLAYER MOVEMENT ==========
    var DIRS = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
    var OPPOSITE = { right: 'left', left: 'right', up: 'down', down: 'up' };

    function setDirection(newDir) {
        if (newDir === OPPOSITE[player.dir]) return;
        player.nextDir = newDir;
    }

    function updatePlayer() {
        if (!isCentered()) {
            player.xOff += DIRS[player.dir][0] * player.speed;
            player.yOff += DIRS[player.dir][1] * player.speed;

            if (player.xOff >= 1) { player.xOff = 0; player.x++; }
            else if (player.xOff <= -1) { player.xOff = 0; player.x--; }
            if (player.yOff >= 1) { player.yOff = 0; player.y++; }
            else if (player.yOff <= -1) { player.yOff = 0; player.y--; }

            if (player.x < -1) { player.x = cols - 1; player.xOff = 0; }
            else if (player.x >= cols) { player.x = 0; player.xOff = 0; }

            return;
        }

        if (player.nextDir !== player.dir) {
            var nd = DIRS[player.nextDir];
            if (isWalkable(player.x + nd[0], player.y + nd[1]) && !isTrailAt(player.x + nd[0], player.y + nd[1])) {
                player.dir = player.nextDir;
            }
        }

        var d = DIRS[player.dir];
        var nx = player.x + d[0];
        var ny = player.y + d[1];

        if (isWalkable(nx, ny) && !isTrailAt(nx, ny)) {
            var prevX = player.x;
            var prevY = player.y;
            player.xOff += d[0] * player.speed;
            player.yOff += d[1] * player.speed;

            if (player.xOff >= 1) { player.xOff = 0; player.x++; }
            else if (player.xOff <= -1) { player.xOff = 0; player.x--; }
            if (player.yOff >= 1) { player.yOff = 0; player.y++; }
            else if (player.yOff <= -1) { player.yOff = 0; player.y--; }

            if (player.x < -1) { player.x = cols - 1; player.xOff = 0; }
            else if (player.x >= cols) { player.x = 0; player.xOff = 0; }

            if ((player.x !== prevX || player.y !== prevY) && !isCentered()) {
                addTrailSegment(prevX, prevY);
            }
        }

        checkDotCollection();
    }

    // ========== TRAIL ==========
    function addTrailSegment(x, y) {
        trail.push({ x: x, y: y, color: currentTrailColor });
        while (trail.length > trailMaxLength) {
            trail.shift();
        }
    }

    function checkDotCollection() {
        if (!isCentered()) return;
        var tile = maze[player.y] && maze[player.y][player.x];
        if (tile === 2 || tile === 3 || tile === 4) {
            var dot = DOT_COLORS[tile];
            maze[player.y][player.x] = 1;
            score += dot.points;
            trailMaxLength += 4;
            currentTrailColor = dot.color;
            addTrailSegment(player.x, player.y);
            updateHUD();
        }
    }

    function checkTrapped() {
        var d = ['up', 'down', 'left', 'right'];
        for (var i = 0; i < d.length; i++) {
            var nd = DIRS[d[i]];
            var nx = player.x + nd[0];
            var ny = player.y + nd[1];
            if (isWalkable(nx, ny) && !isTrailAt(nx, ny)) return false;
        }
        return true;
    }

    // ========== GHOSTS ==========
    function updateGhosts(dt) {
        for (var i = 0; i < ghosts.length; i++) {
            var g = ghosts[i];

            if (!g.active) {
                g.releaseTimer -= dt;
                if (g.releaseTimer <= 0) {
                    g.active = true;
                }
                continue;
            }

            if (!isCenteredGhost(g)) {
                g.xOff += DIRS[g.dir][0] * g.speed;
                g.yOff += DIRS[g.dir][1] * g.speed;
                if (g.xOff >= 1) { g.xOff = 0; g.x++; }
                else if (g.xOff <= -1) { g.xOff = 0; g.x--; }
                if (g.yOff >= 1) { g.yOff = 0; g.y++; }
                else if (g.yOff <= -1) { g.yOff = 0; g.y--; }
                if (g.x < 0) { g.x = cols - 1; g.xOff = 0; }
                else if (g.x >= cols) { g.x = 0; g.xOff = 0; }
                continue;
            }

            var playerDist = dist(g.x, g.y, player.x, player.y);

            if (g.mode === 'patrol' && playerDist < g.detectionRange) {
                g.mode = 'chase';
                g.modeTimer = 0;
            } else if (g.mode === 'chase' && playerDist > g.detectionRange + 4) {
                g.mode = 'return';
            }

            if (g.mode === 'patrol') {
                var target = g.patrol[g.patrolIdx];
                if (g.x === target.x && g.y === target.y) {
                    g.patrolIdx = (g.patrolIdx + 1) % g.patrol.length;
                    target = g.patrol[g.patrolIdx];
                }
                g.dir = chooseDir(g, target.x, target.y);
            } else if (g.mode === 'chase') {
                g.dir = chooseDir(g, player.x, player.y);
            } else {
                var nearest = g.patrol[0];
                var nearDist = dist(g.x, g.y, nearest.x, nearest.y);
                for (var p = 1; p < g.patrol.length; p++) {
                    var dd = dist(g.x, g.y, g.patrol[p].x, g.patrol[p].y);
                    if (dd < nearDist) { nearDist = dd; nearest = g.patrol[p]; }
                }
                if (g.x === nearest.x && g.y === nearest.y) {
                    g.mode = 'patrol';
                    g.patrolIdx = g.patrol.indexOf(nearest);
                } else {
                    g.dir = chooseDir(g, nearest.x, nearest.y);
                }
            }

            g.xOff += DIRS[g.dir][0] * g.speed;
            g.yOff += DIRS[g.dir][1] * g.speed;
            if (g.xOff >= 1) { g.xOff = 0; g.x++; }
            else if (g.xOff <= -1) { g.xOff = 0; g.x--; }
            if (g.yOff >= 1) { g.yOff = 0; g.y++; }
            else if (g.yOff <= -1) { g.yOff = 0; g.y--; }
            if (g.x < 0) { g.x = cols - 1; g.xOff = 0; }
            else if (g.x >= cols) { g.x = 0; g.xOff = 0; }
        }
    }

    function isCenteredGhost(g) {
        return Math.abs(g.xOff) < 0.05 && Math.abs(g.yOff) < 0.05;
    }

    function chooseDir(ghost, tx, ty) {
        var possible = ['up', 'down', 'left', 'right'];
        var opposite = OPPOSITE[ghost.dir];
        var valid = [];
        for (var i = 0; i < possible.length; i++) {
            var d = possible[i];
            if (d === opposite) continue;
            var nd = DIRS[d];
            var nx = ghost.x + nd[0];
            var ny = ghost.y + nd[1];
            if (isWalkable(nx, ny)) {
                valid.push(d);
            }
        }
        if (valid.length === 0) valid.push(opposite);

        var best = valid[0];
        var bestDist = Infinity;
        for (var j = 0; j < valid.length; j++) {
            var dd = DIRS[valid[j]];
            var bx = ghost.x + dd[0];
            var by = ghost.y + dd[1];
            var d2 = dist(bx, by, tx, ty);
            if (d2 < bestDist) { bestDist = d2; best = valid[j]; }
        }
        return best;
    }

    // ========== COLLISIONS ==========
    function checkCollisions() {
        for (var i = 0; i < ghosts.length; i++) {
            var g = ghosts[i];
            if (!g.active) continue;
            if (g.x === player.x && g.y === player.y &&
                Math.abs(g.xOff) < 0.3 && Math.abs(g.yOff) < 0.3) {
                loseLife();
                return;
            }
        }

        if (checkTrapped()) {
            loseLife();
            return;
        }
    }

    function loseLife() {
        lives--;
        updateHUD();
        if (lives <= 0) {
            running = false;
            cancelAnimationFrame(animFrame);
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('snakeMazeHighScore', highScore);
            }
            finalScoreEl.textContent = score;
            gameOverOverlay.style.display = 'flex';
        } else {
            resetPositions();
        }
    }

    function resetPositions() {
        player.x = 13;
        player.y = 23;
        player.xOff = 0;
        player.yOff = 0;
        player.dir = 'right';
        player.nextDir = 'right';

        trail = [];
        trailMaxLength = 3;
        currentTrailColor = '#4ecca3';

        for (var i = 0; i < ghosts.length; i++) {
            var wp = GHOST_PATROLS[i][0];
            ghosts[i].x = wp.x;
            ghosts[i].y = wp.y;
            ghosts[i].xOff = 0;
            ghosts[i].yOff = 0;
            ghosts[i].dir = 'up';
            ghosts[i].mode = 'patrol';
            ghosts[i].patrolIdx = 0;
            ghosts[i].active = i === 0;
            ghosts[i].releaseTimer = i * 1500;
        }
    }

    // ========== RENDERING ==========
    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                var tile = maze[y][x];
                var px = x * cellSize;
                var py = y * cellSize;

                if (tile === 0) {
                    drawWall(x, y, px, py);
                } else if (tile === 2 || tile === 3 || tile === 4) {
                    drawDot(px, py, tile);
                }
            }
        }

        drawTrail();
        drawPlayer();

        for (var i = 0; i < ghosts.length; i++) {
            if (ghosts[i].active) drawGhost(ghosts[i]);
        }
    }

    function drawWall(x, y, px, py) {
        ctx.fillStyle = '#1a1a5e';
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.fillStyle = '#2a2a7e';
        ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);

        var s = cellSize;
        ctx.fillStyle = '#4a4aff';
        if (y > 0 && maze[y - 1][x] !== 0) ctx.fillRect(px, py, s, 1);
        if (y < rows - 1 && maze[y + 1][x] !== 0) ctx.fillRect(px, py + s - 1, s, 1);
        if (x > 0 && maze[y][x - 1] !== 0) ctx.fillRect(px, py, 1, s);
        if (x < cols - 1 && maze[y][x + 1] !== 0) ctx.fillRect(px + s - 1, py, 1, s);
    }

    function drawDot(px, py, type) {
        var dot = DOT_COLORS[type];
        var pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);
        ctx.fillStyle = dot.color;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(px + cellSize / 2, py + cellSize / 2, cellSize * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function drawTrail() {
        for (var i = 0; i < trail.length; i++) {
            var seg = trail[i];
            var fade = 0.4 + 0.6 * (i / trail.length);
            ctx.fillStyle = seg.color;
            ctx.globalAlpha = fade * 0.7;
            ctx.fillRect(
                seg.x * cellSize + 1,
                seg.y * cellSize + 1,
                cellSize - 2,
                cellSize - 2
            );
            ctx.globalAlpha = 1;
        }
    }

    function drawPlayer() {
        var px = (player.x + player.xOff) * cellSize + cellSize / 2;
        var py = (player.y + player.yOff) * cellSize + cellSize / 2;
        var r = cellSize * 0.4;

        ctx.fillStyle = '#f5e642';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();

        var eyeR = r * 0.2;
        var eyeOff = r * 0.3;
        var ed = DIRS[player.dir];
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(px + ed[0] * eyeOff - ed[1] * eyeOff * 0.5, py + ed[1] * eyeOff + ed[0] * eyeOff * 0.5, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px + ed[0] * eyeOff + ed[1] * eyeOff * 0.5, py + ed[1] * eyeOff - ed[0] * eyeOff * 0.5, eyeR, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawGhost(ghost) {
        var px = (ghost.x + ghost.xOff) * cellSize + cellSize / 2;
        var py = (ghost.y + ghost.yOff) * cellSize + cellSize / 2;
        var r = cellSize * 0.42;

        ctx.fillStyle = ghost.color;
        ctx.beginPath();
        ctx.arc(px, py - r * 0.15, r, Math.PI, 0);
        ctx.lineTo(px + r, py + r * 0.7);
        for (var i = 0; i < 3; i++) {
            var bx = px + r - (i + 0.5) * (r * 2 / 3);
            ctx.quadraticCurveTo(
                bx + r * 0.3, py + r * 0.3 + Math.sin(Date.now() / 150 + i) * 2,
                bx, py + r * 0.7
            );
            bx = px + r - (i + 1) * (r * 2 / 3);
            ctx.lineTo(bx, py + r * 0.7);
        }
        ctx.closePath();
        ctx.fill();

        drawGhostEyes(px, py, r);
    }

    function drawGhostEyes(px, py, r) {
        var ed = DIRS[player.dir];
        var ex = ed[0] * r * 0.15;
        var ey = ed[1] * r * 0.15;

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(px - r * 0.3, py - r * 0.25, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(px + r * 0.3, py - r * 0.25, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(px - r * 0.3 + ex, py - r * 0.25 + ey, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px + r * 0.3 + ex, py - r * 0.25 + ey, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
    }

    // ========== GAME LOOP ==========
    function gameLoop(timestamp) {
        if (!running) return;
        if (!lastTime) lastTime = timestamp;
        var dt = timestamp - lastTime;
        lastTime = timestamp;
        accumulator += dt;

        var step = 16;
        while (accumulator >= step) {
            updatePlayer();
            updateGhosts(step);
            checkCollisions();
            accumulator -= step;
        }

        draw();

        if (countDots() === 0) {
            running = false;
            cancelAnimationFrame(animFrame);
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('snakeMazeHighScore', highScore);
            }
            winScoreEl.textContent = score;
            winOverlay.style.display = 'flex';
            return;
        }

        animFrame = requestAnimationFrame(gameLoop);
    }

    // ========== HUD ==========
    function updateHUD() {
        scoreEl.textContent = score;
        var hearts = '';
        for (var i = 0; i < lives; i++) hearts += '♥';
        livesEl.textContent = hearts || '—';
        levelEl.textContent = level;
        trailLenEl.textContent = trail.length;
    }

    // ========== GAME STATE ==========
    function startGame() {
        startOverlay.style.display = 'none';
        gameOverOverlay.style.display = 'none';
        winOverlay.style.display = 'none';
        init();
        running = true;
        draw();
        lastTime = 0;
        accumulator = 0;
        animFrame = requestAnimationFrame(gameLoop);
    }

    function nextLevel() {
        winOverlay.style.display = 'none';
        level++;
        initLevel();
        running = true;
        draw();
        lastTime = 0;
        accumulator = 0;
        animFrame = requestAnimationFrame(gameLoop);
    }

    // ========== INPUT ==========
    document.addEventListener('keydown', function (e) {
        if (!running) return;
        var keyMap = {
            ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
            w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right'
        };
        if (keyMap[e.key]) {
            e.preventDefault();
            setDirection(keyMap[e.key]);
        }
    });

    document.querySelectorAll('.touch-btn').forEach(function (btn) {
        btn.addEventListener('touchstart', function (e) {
            e.preventDefault();
            if (running) setDirection(this.dataset.dir);
        });
        btn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            if (running) setDirection(this.dataset.dir);
        });
    });

    var touchStartX, touchStartY;
    canvas.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    canvas.addEventListener('touchend', function (e) {
        if (!touchStartX || !touchStartY) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        var dy = e.changedTouches[0].clientY - touchStartY;
        var absDx = Math.abs(dx);
        var absDy = Math.abs(dy);
        if (Math.max(absDx, absDy) < 20) return;
        if (absDx > absDy) {
            setDirection(dx > 0 ? 'right' : 'left');
        } else {
            setDirection(dy > 0 ? 'down' : 'up');
        }
    }, { passive: true });

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    nextLevelBtn.addEventListener('click', nextLevel);
    window.addEventListener('resize', function () {
        resize();
        if (running) draw();
    });
})();
