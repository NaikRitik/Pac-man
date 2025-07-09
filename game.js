class Game {
    constructor() {
        // Get DOM elements
        this.startScreen = document.getElementById('start-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.scoreElement = document.getElementById('score');
        this.highScoreElement = document.getElementById('high-score');
        this.finalScoreElement = document.getElementById('final-score');
        this.finalHighScoreElement = document.getElementById('final-high-score');
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Set canvas dimensions
        this.canvas.width = GRID_WIDTH * CELL_SIZE;
        this.canvas.height = GRID_HEIGHT * CELL_SIZE;

        // Initialize game state
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('pacmanHighScore')) || 0;
        this.updateScore(0);

        // Initialize game objects
        this.initializeGame();

        // Initialize sound manager with better error handling
        this.sounds = {};
        this.soundsLoaded = false;
        this.currentlyPlayingSounds = new Set();

        // Sound priorities (higher number = higher priority)
        this.soundPriorities = {
            death: 5,
            ghostEaten: 4,
            powerPellet: 3,
            chomp: 1,
            ghostSiren: 0
        };

        // List of sound files to load
        const soundFiles = {
            chomp: 'sounds/chomp.wav',
            powerPellet: 'sounds/power_pellet.wav',
            ghostEaten: 'sounds/ghost_eaten.wav',
            death: 'sounds/death.wav',
            ghostSiren: 'sounds/ghost_siren.wav'
        };

        // Load all sounds
        Promise.all(Object.entries(soundFiles).map(([name, path]) => {
            return new Promise((resolve, reject) => {
                const audio = new Audio(path);
                audio.addEventListener('canplaythrough', () => {
                    this.sounds[name] = audio;
                    resolve();
                }, { once: true });
                audio.addEventListener('error', (e) => {
                    console.warn(`Failed to load sound ${name}: ${e.message}`);
                    resolve(); // Resolve anyway to not block the game
                });
                if (name === 'ghostSiren') {
                    audio.loop = true;
                }
                audio.load();
            });
        })).then(() => {
            this.soundsLoaded = true;
            console.log('All sounds loaded successfully');
        }).catch(error => {
            console.warn('Some sounds failed to load:', error);
        });

        // Configure sound volumes
        this.soundVolumes = {
            chomp: 0.5,
            powerPellet: 0.6,
            ghostEaten: 0.8,
            death: 0.7,
            ghostSiren: 0.3
        };

        // Keep track of sound states
        this.isChompPlaying = false;
        this.lastChompTime = 0;

        // Add pause state
        this.isPaused = false;
        this.pausedSounds = new Set();

        // Add audio state
        this.isSoundEnabled = true;

        // Create pause menu
        this.pauseOverlay = document.createElement('div');
        this.pauseOverlay.style.position = 'absolute';
        this.pauseOverlay.style.top = '50%';
        this.pauseOverlay.style.left = '50%';
        this.pauseOverlay.style.transform = 'translate(-50%, -50%)';
        this.pauseOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        this.pauseOverlay.style.color = 'white';
        this.pauseOverlay.style.padding = '30px';
        this.pauseOverlay.style.borderRadius = '15px';
        this.pauseOverlay.style.textAlign = 'center';
        this.pauseOverlay.style.minWidth = '200px';
        this.pauseOverlay.style.display = 'none';

        // Create pause menu title
        const pauseTitle = document.createElement('div');
        pauseTitle.textContent = 'PAUSED';
        pauseTitle.style.fontSize = '28px';
        pauseTitle.style.fontFamily = 'Arial, sans-serif';
        pauseTitle.style.marginBottom = '20px';
        pauseTitle.style.fontWeight = 'bold';
        this.pauseOverlay.appendChild(pauseTitle);

        // Create sound toggle button
        this.soundToggleBtn = document.createElement('button');
        this.updateSoundButtonText();
        this.soundToggleBtn.style.backgroundColor = '#4CAF50';
        this.soundToggleBtn.style.border = 'none';
        this.soundToggleBtn.style.color = 'white';
        this.soundToggleBtn.style.padding = '10px 20px';
        this.soundToggleBtn.style.fontSize = '16px';
        this.soundToggleBtn.style.margin = '10px';
        this.soundToggleBtn.style.cursor = 'pointer';
        this.soundToggleBtn.style.borderRadius = '5px';
        this.soundToggleBtn.style.width = '150px';

        // Add hover effect
        this.soundToggleBtn.addEventListener('mouseover', () => {
            this.soundToggleBtn.style.backgroundColor = '#45a049';
        });
        this.soundToggleBtn.addEventListener('mouseout', () => {
            this.soundToggleBtn.style.backgroundColor = '#4CAF50';
        });

        // Add click handler
        this.soundToggleBtn.addEventListener('click', () => this.toggleSound());
        this.pauseOverlay.appendChild(this.soundToggleBtn);

        // Create resume button
        const resumeBtn = document.createElement('button');
        resumeBtn.textContent = 'Resume Game';
        resumeBtn.style.backgroundColor = '#2196F3';
        resumeBtn.style.border = 'none';
        resumeBtn.style.color = 'white';
        resumeBtn.style.padding = '10px 20px';
        resumeBtn.style.fontSize = '16px';
        resumeBtn.style.margin = '10px';
        resumeBtn.style.cursor = 'pointer';
        resumeBtn.style.borderRadius = '5px';
        resumeBtn.style.width = '150px';

        // Add hover effect
        resumeBtn.addEventListener('mouseover', () => {
            resumeBtn.style.backgroundColor = '#1976D2';
        });
        resumeBtn.addEventListener('mouseout', () => {
            resumeBtn.style.backgroundColor = '#2196F3';
        });

        // Add click handler
        resumeBtn.addEventListener('click', () => this.togglePause());
        this.pauseOverlay.appendChild(resumeBtn);

        // Add instruction text
        const instruction = document.createElement('div');
        instruction.textContent = 'Press P to resume';
        instruction.style.fontSize = '14px';
        instruction.style.marginTop = '15px';
        instruction.style.color = '#888';
        this.pauseOverlay.appendChild(instruction);

        this.gameScreen.appendChild(this.pauseOverlay);

        // Bind event listeners
        document.getElementById('start-button').addEventListener('click', () => this.startGame());
        document.getElementById('restart-button').addEventListener('click', () => this.startGame());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));

        // Track current screen
        this.currentScreen = 'start'; // 'start', 'game', or 'gameOver'
    }

    initializeGame() {
        // Initialize Pac-Man
        this.pacman = {
            x: 14 * CELL_SIZE,
            y: 17 * CELL_SIZE,
            direction: { x: -1, y: 0 },
            nextDirection: { x: -1, y: 0 },
            angle: Math.PI,
            mouthOpen: 0,
            mouthDir: 1
        };

        // Initialize ghosts with more aggressive properties
        this.ghosts = [
            {
                x: 14 * CELL_SIZE,
                y: 14 * CELL_SIZE,
                color: COLORS.GHOST_RED,
                direction: { x: 0, y: -1 },
                lastDirection: { x: 0, y: -1 },
                lastIntersection: null,
                canReverse: false,
                behavior: 'chase',
                scatterTarget: { x: GRID_WIDTH - 1, y: 0 },
                homePosition: { x: 14, y: 14 },
                exitDelay: 0,
                aggressionFactor: 1.0,
                isBlinking: false,
                blinkStart: 0,
                blinkDuration: 2000  // 2 seconds of blinking
            },
            {
                x: 13 * CELL_SIZE,
                y: 14 * CELL_SIZE,
                color: COLORS.GHOST_PINK,
                direction: { x: 0, y: -1 },
                lastDirection: { x: 0, y: -1 },
                lastIntersection: null,
                canReverse: false,
                behavior: 'ambush',
                scatterTarget: { x: 0, y: 0 },
                homePosition: { x: 13, y: 14 },
                exitDelay: 500,
                aggressionFactor: 0.9,
                isBlinking: false,
                blinkStart: 0,
                blinkDuration: 2000
            },
            {
                x: 14 * CELL_SIZE,
                y: 15 * CELL_SIZE,
                color: COLORS.GHOST_CYAN,
                direction: { x: 0, y: -1 },
                lastDirection: { x: 0, y: -1 },
                lastIntersection: null,
                canReverse: false,
                behavior: 'random',
                scatterTarget: { x: GRID_WIDTH - 1, y: GRID_HEIGHT - 1 },
                homePosition: { x: 14, y: 15 },
                exitDelay: 1000,
                aggressionFactor: 0.8,
                isBlinking: false,
                blinkStart: 0,
                blinkDuration: 2000
            },
            {
                x: 15 * CELL_SIZE,
                y: 14 * CELL_SIZE,
                color: COLORS.GHOST_ORANGE,
                direction: { x: 0, y: -1 },
                lastDirection: { x: 0, y: -1 },
                lastIntersection: null,
                canReverse: false,
                behavior: 'patrol',
                scatterTarget: { x: 0, y: GRID_HEIGHT - 1 },
                homePosition: { x: 15, y: 14 },
                exitDelay: 1500,
                aggressionFactor: 0.7,
                isBlinking: false,
                blinkStart: 0,
                blinkDuration: 2000
            }
        ];

        // Modify ghost mode timing for more aggression
        this.ghostMode = 'chase';  // Start in chase mode
        this.ghostModeTime = 0;
        this.ghostModeDuration = {
            scatter: 3000,  // Reduced scatter time (3 seconds)
            chase: 20000    // Extended chase time (20 seconds)
        };

        // Add game start time
        this.gameStartTime = Date.now();

        // Initialize dots and power pellets
        this.dots = [];
        this.powerPellets = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (MAZE_LAYOUT[y][x] === 2) {
                    this.dots.push({ x: x * CELL_SIZE + CELL_SIZE / 2, y: y * CELL_SIZE + CELL_SIZE / 2 });
                } else if (MAZE_LAYOUT[y][x] === 3) {
                    this.powerPellets.push({ x: x * CELL_SIZE + CELL_SIZE / 2, y: y * CELL_SIZE + CELL_SIZE / 2 });
                }
            }
        }

        // Game state
        this.isPoweredUp = false;
        this.isGameOver = false;
        this.animationId = null;
        this.lastFrameTime = 0;
    }

    startGame() {
        this.startScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        this.pauseOverlay.style.display = 'none';
        this.isPaused = false;
        this.initializeGame();

        // Stop any existing sounds first
        this.stopAllSounds();

        // Start ghost siren sound if loaded and sound is enabled
        if (this.soundsLoaded && this.isSoundEnabled) {
            this.playSound('ghostSiren');
        }

        this.currentScreen = 'game';
        this.gameLoop();
    }

    handleKeyPress(event) {
        // Handle Enter key for start and game over screens
        if (event.key === 'Enter') {
            if (this.currentScreen === 'start' || this.currentScreen === 'gameOver') {
                this.startGame();
                return;
            }
        }

        // Only handle game controls if we're in the game screen
        if (this.currentScreen !== 'game' || this.isGameOver) return;

        switch (event.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.pacman.nextDirection = { x: -1, y: 0 };
                this.pacman.angle = Math.PI;
                break;

            case 'ArrowRight':
            case 'd':
            case 'D':
                this.pacman.nextDirection = { x: 1, y: 0 };
                this.pacman.angle = 0;
                break;

            case 'ArrowUp':
            case 'w':
            case 'W':
                this.pacman.nextDirection = { x: 0, y: -1 };
                this.pacman.angle = -Math.PI / 2;
                break;

            case 'ArrowDown':
            case 's':
            case 'S':
                this.pacman.nextDirection = { x: 0, y: 1 };
                this.pacman.angle = Math.PI / 2;
                break;

            case 'p':
            case 'P':
            case 'Escape': // Pause
                this.togglePause();
                break;
        }

    }

    togglePause() {
        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            // Store currently playing sounds and pause them
            this.pausedSounds = new Set(this.currentlyPlayingSounds);
            this.stopAllSounds();

            // Show pause overlay
            this.pauseOverlay.style.display = 'block';

            // Cancel the animation frame
            cancelAnimationFrame(this.animationId);
        } else {
            // Resume sounds that were playing if sound is enabled
            if (this.isSoundEnabled) {
                for (const soundName of this.pausedSounds) {
                    this.playSound(soundName);
                }
            }
            this.pausedSounds.clear();

            // Hide pause overlay
            this.pauseOverlay.style.display = 'none';

            // Resume the game loop
            this.lastFrameTime = performance.now();
            this.gameLoop();
        }
    }

    checkCollision(x, y) {
        // Get the corners of the character's bounding box
        const left = Math.floor(x / CELL_SIZE);
        const right = Math.floor((x + CELL_SIZE - 1) / CELL_SIZE);
        const top = Math.floor(y / CELL_SIZE);
        const bottom = Math.floor((y + CELL_SIZE - 1) / CELL_SIZE);

        // Check if any corner is out of bounds
        if (top < 0 || bottom >= GRID_HEIGHT || left < 0 || right >= GRID_WIDTH) {
            // Allow wrapping at tunnel
            if (y >= 14 * CELL_SIZE && y <= 15 * CELL_SIZE) { // Tunnel Y position
                return false;
            }
            return true;
        }

        // Allow ghosts to move through the ghost house door
        const isGhostHouseDoor = (top === 12 || bottom === 12) && // Ghost house door Y position
            (left >= 13 && right <= 15); // Ghost house X range

        if (isGhostHouseDoor) {
            return false;
        }

        // Check all cells that the character might overlap with
        return MAZE_LAYOUT[top][left] === 1 ||
            MAZE_LAYOUT[top][right] === 1 ||
            MAZE_LAYOUT[bottom][left] === 1 ||
            MAZE_LAYOUT[bottom][right] === 1;
    }

    updatePacman(deltaTime) {
        let isActuallyMoving = false;
        // Try to change direction if there's a queued direction
        if (this.pacman.nextDirection.x !== this.pacman.direction.x ||
            this.pacman.nextDirection.y !== this.pacman.direction.y) {

            // Check if we're close enough to a grid cell center to turn
            const centerX = Math.round(this.pacman.x / CELL_SIZE) * CELL_SIZE;
            const centerY = Math.round(this.pacman.y / CELL_SIZE) * CELL_SIZE;
            const distanceX = Math.abs(this.pacman.x - centerX);
            const distanceY = Math.abs(this.pacman.y - centerY);

            if (distanceX <= PACMAN_SPEED && distanceY <= PACMAN_SPEED) {
                // Snap to grid
                this.pacman.x = centerX;
                this.pacman.y = centerY;

                // Check if we can turn
                const nextX = centerX + this.pacman.nextDirection.x * CELL_SIZE;
                const nextY = centerY + this.pacman.nextDirection.y * CELL_SIZE;

                if (!this.checkCollision(nextX, nextY)) {
                    this.pacman.direction = this.pacman.nextDirection;
                }
            }
        }

        // Move in current direction
        const newX = this.pacman.x + this.pacman.direction.x * PACMAN_SPEED;
        const newY = this.pacman.y + this.pacman.direction.y * PACMAN_SPEED;

        // Handle tunnel wrapping before collision check
        let wrappedX = newX;
        if (newX < -CELL_SIZE && this.pacman.y >= 14 * CELL_SIZE && this.pacman.y <= 15 * CELL_SIZE) {
            wrappedX = GRID_WIDTH * CELL_SIZE;
        } else if (newX > GRID_WIDTH * CELL_SIZE && this.pacman.y >= 14 * CELL_SIZE && this.pacman.y <= 15 * CELL_SIZE) {
            wrappedX = -CELL_SIZE;
        }

        // Check collision with walls
        if (!this.checkCollision(wrappedX, newY)) {
            this.pacman.x = wrappedX;
            this.pacman.y = newY;
            isActuallyMoving = true;

            // Update mouth animation
            this.pacman.mouthOpen += 0.2 * this.pacman.mouthDir;
            if (this.pacman.mouthOpen >= 0.5) {
                this.pacman.mouthDir = -1;
            } else if (this.pacman.mouthOpen <= 0) {
                this.pacman.mouthDir = 1;
            }
        } else {
            // Align to grid when hitting a wall
            this.pacman.x = Math.round(this.pacman.x / CELL_SIZE) * CELL_SIZE;
            this.pacman.y = Math.round(this.pacman.y / CELL_SIZE) * CELL_SIZE;
        }

        // Play chomp sound only when actually moving and not already playing
        if (!this.isGameOver && isActuallyMoving) {
            this.playSound('chomp');
        }
    }

    updateGhosts() {
        const currentTime = Date.now() - this.gameStartTime;

        this.ghosts.forEach(ghost => {
            try {
                this.updateGhost(ghost, currentTime);
            } catch (error) {
                console.error('Ghost update error:', error);
                // Attempt to recover ghost state
                ghost.x = Math.round(ghost.x / CELL_SIZE) * CELL_SIZE;
                ghost.y = Math.round(ghost.y / CELL_SIZE) * CELL_SIZE;
            }
        });
    }

    updateGhost(ghost, currentTime) {
        // Check if ghost should still be waiting
        if (currentTime < ghost.exitDelay) {
            return;
        }

        if (this.isPoweredUp) {
            this.updateScaredGhost(ghost);
            return;
        }

        const speed = GHOST_SPEED;

        // Get current grid position
        const currentGridX = Math.floor(ghost.x / CELL_SIZE);
        const currentGridY = Math.floor(ghost.y / CELL_SIZE);

        // Check if ghost is in the ghost house
        const inGhostHouse =
            ghost.y >= 14 * CELL_SIZE &&
            ghost.y <= 15 * CELL_SIZE &&
            ghost.x >= 13 * CELL_SIZE &&
            ghost.x <= 15 * CELL_SIZE;

        if (inGhostHouse) {
            this.handleGhostHouseMovement(ghost, currentGridX, currentGridY, speed);
            return;
        }

        // Handle normal ghost movement
        this.handleNormalGhostMovement(ghost, currentGridX, currentGridY, speed);
    }

    handleGhostHouseMovement(ghost, currentGridX, currentGridY, speed) {
        // Snap to grid
        ghost.x = currentGridX * CELL_SIZE;
        ghost.y = currentGridY * CELL_SIZE;
        ghost.direction = { x: 0, y: -1 };
        ghost.lastDirection = ghost.direction;
        ghost.lastIntersection = { x: currentGridX, y: currentGridY };

        const newY = ghost.y + ghost.direction.y * speed;
        if (!this.checkCollision(ghost.x, newY)) {
            ghost.y = newY;
        } else {
            const centerX = 14 * CELL_SIZE;
            if (ghost.x < centerX) {
                ghost.direction = { x: 1, y: 0 };
                ghost.lastDirection = ghost.direction;
                ghost.x += speed;
            } else if (ghost.x > centerX) {
                ghost.direction = { x: -1, y: 0 };
                ghost.lastDirection = ghost.direction;
                ghost.x -= speed;
            }
        }
    }

    handleNormalGhostMovement(ghost, currentGridX, currentGridY, speed) {
        // Check if ghost is exactly at a grid center (for precise intersection detection)
        const atGridCenter =
            Math.abs(ghost.x - (currentGridX * CELL_SIZE)) < 1 &&
            Math.abs(ghost.y - (currentGridY * CELL_SIZE)) < 1;

        // Get valid directions and analyze the intersection
        const validDirections = this.getValidDirections(currentGridX, currentGridY);
        const isAtIntersection = validDirections.length > 2; // More than 2 paths = intersection
        const currentDirectionBlocked = !validDirections.some(dir =>
            dir.x === ghost.direction.x && dir.y === ghost.direction.y
        );

        // Only make a new decision if:
        // 1. At an intersection and centered on the grid, or
        // 2. Current path is blocked
        const needNewDirection =
            (atGridCenter && isAtIntersection) ||
            currentDirectionBlocked;

        if (needNewDirection) {
            // Snap to grid for precise movement
            ghost.x = currentGridX * CELL_SIZE;
            ghost.y = currentGridY * CELL_SIZE;

            this.chooseNewDirection(ghost, validDirections, currentGridX, currentGridY);
        }

        // Move ghost
        this.moveGhost(ghost, speed);
    }

    chooseNewDirection(ghost, validDirections, gridX, gridY) {
        const target = this.getGhostTarget(ghost, gridX, gridY);
        const hasLOS = this.hasLineOfSight(ghost);

        // Filter out reverse direction unless it's the only option
        const allowedDirections = validDirections.filter(dir => {
            const isReversal = dir.x === -ghost.lastDirection.x && dir.y === -ghost.lastDirection.y;
            return !isReversal ||
                validDirections.length === 1 || // Only option available
                (hasLOS && Math.random() < ghost.aggressionFactor * 0.2) || // Small chance to reverse if has LOS
                (this.isPoweredUp); // Can reverse when scared
        });

        if (allowedDirections.length > 0) {
            const directionScores = allowedDirections.map(dir => {
                const newX = gridX * CELL_SIZE + dir.x * CELL_SIZE;
                const newY = gridY * CELL_SIZE + dir.y * CELL_SIZE;

                const distanceToTarget = Math.sqrt(
                    Math.pow(newX - target.x, 2) +
                    Math.pow(newY - target.y, 2)
                );

                let score = 0;

                // Heavily prioritize continuing in the same direction if possible
                if (dir.x === ghost.direction.x && dir.y === ghost.direction.y) {
                    score += CELL_SIZE * 8; // Much higher priority for current direction
                }

                // Increase chase tendency based on aggression factor
                score -= distanceToTarget * (1 - ghost.aggressionFactor * 0.5);

                // Very small random factor to break ties
                score += Math.random() * (CELL_SIZE / 128);

                return { direction: dir, score };
            }).sort((a, b) => b.score - a.score);

            // Store the last direction before updating
            ghost.lastDirection = ghost.direction;
            ghost.direction = directionScores[0].direction;
        }
    }

    getValidDirections(gridX, gridY) {
        const directions = [
            { x: 1, y: 0 },   // right
            { x: -1, y: 0 },  // left
            { x: 0, y: 1 },   // down
            { x: 0, y: -1 }   // up
        ];

        // Filter valid directions and sort them by priority
        return directions.filter(dir => {
            const newX = gridX * CELL_SIZE + dir.x * CELL_SIZE;
            const newY = gridY * CELL_SIZE + dir.y * CELL_SIZE;
            return !this.checkCollision(newX, newY);
        });
    }

    getGhostTarget(ghost, gridX, gridY) {
        // If ghost has line of sight to Pacman, chase directly with high priority
        if (!this.isPoweredUp && this.hasLineOfSight(ghost)) {
            return {
                x: this.pacman.x,
                y: this.pacman.y
            };
        }

        // Even in scatter mode, have a chance to chase based on aggression factor
        if (this.ghostMode === 'scatter' && Math.random() < ghost.aggressionFactor) {
            return {
                x: this.pacman.x,
                y: this.pacman.y
            };
        }

        switch (ghost.behavior) {
            case 'chase':
                return {
                    x: this.pacman.x,
                    y: this.pacman.y
                };
            case 'ambush':
                // Predict further ahead based on aggression
                const multiplier = this.hasLineOfSight(ghost) ? 4 : 2;
                const targetX = this.pacman.x + (this.pacman.direction.x * multiplier * CELL_SIZE);
                const targetY = this.pacman.y + (this.pacman.direction.y * multiplier * CELL_SIZE);
                return this.isValidPosition(targetX, targetY) ?
                    { x: targetX, y: targetY } :
                    { x: this.pacman.x, y: this.pacman.y };
            case 'random':
                // More likely to chase when aggressive
                if (Math.random() < ghost.aggressionFactor || this.hasLineOfSight(ghost)) {
                    return {
                        x: this.pacman.x,
                        y: this.pacman.y
                    };
                }
                if (!ghost.randomTarget || Math.random() < 0.1) {
                    ghost.randomTarget = this.getRandomTarget(gridX, gridY);
                }
                return ghost.randomTarget;
            case 'patrol':
                const distanceToPacman = Math.sqrt(
                    Math.pow(ghost.x - this.pacman.x, 2) +
                    Math.pow(ghost.y - this.pacman.y, 2)
                );
                // More aggressive chase range
                if (this.hasLineOfSight(ghost) || distanceToPacman <= 8 * CELL_SIZE) {
                    return {
                        x: this.pacman.x,
                        y: this.pacman.y
                    };
                }
                return distanceToPacman > 6 * CELL_SIZE ?
                    { x: this.pacman.x, y: this.pacman.y } :
                    { x: ghost.scatterTarget.x * CELL_SIZE, y: ghost.scatterTarget.y * CELL_SIZE };
        }
    }

    moveGhost(ghost, speed) {
        const newX = ghost.x + ghost.direction.x * speed;
        const newY = ghost.y + ghost.direction.y * speed;

        // Handle tunnel wrapping
        let wrappedX = newX;
        if (newX < -CELL_SIZE && ghost.y >= 14 * CELL_SIZE && ghost.y <= 15 * CELL_SIZE) {
            wrappedX = GRID_WIDTH * CELL_SIZE;
        } else if (newX > GRID_WIDTH * CELL_SIZE && ghost.y >= 14 * CELL_SIZE && ghost.y <= 15 * CELL_SIZE) {
            wrappedX = -CELL_SIZE;
        }

        // Apply movement if valid
        if (!this.checkCollision(wrappedX, newY)) {
            ghost.x = wrappedX;
            ghost.y = newY;
        } else {
            // If movement is blocked, snap to grid
            ghost.x = Math.round(ghost.x / CELL_SIZE) * CELL_SIZE;
            ghost.y = Math.round(ghost.y / CELL_SIZE) * CELL_SIZE;
        }
    }

    // Helper method to check if a position is valid
    isValidPosition(x, y) {
        const gridX = Math.floor(x / CELL_SIZE);
        const gridY = Math.floor(y / CELL_SIZE);
        return gridX >= 0 && gridX < GRID_WIDTH &&
            gridY >= 0 && gridY < GRID_HEIGHT &&
            MAZE_LAYOUT[gridY][gridX] !== 1;
    }

    // Helper method to get a random valid target
    getRandomTarget(currentX, currentY) {
        const maxDistance = 8;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            const offsetX = Math.floor(Math.random() * maxDistance * 2 - maxDistance);
            const offsetY = Math.floor(Math.random() * maxDistance * 2 - maxDistance);
            const targetX = (currentX + offsetX) * CELL_SIZE;
            const targetY = (currentY + offsetY) * CELL_SIZE;

            if (this.isValidPosition(targetX, targetY)) {
                return { x: targetX, y: targetY };
            }
            attempts++;
        }

        // Fallback to current position if no valid target found
        return { x: currentX * CELL_SIZE, y: currentY * CELL_SIZE };
    }

    updateScaredGhost(ghost) {
        const speed = GHOST_SCARED_SPEED;

        // Get current grid position
        const currentGridX = Math.floor(ghost.x / CELL_SIZE);
        const currentGridY = Math.floor(ghost.y / CELL_SIZE);

        // Check if ghost is exactly at a grid center (for precise intersection detection)
        const atGridCenter =
            Math.abs(ghost.x - (currentGridX * CELL_SIZE)) < 1 &&
            Math.abs(ghost.y - (currentGridY * CELL_SIZE)) < 1;

        // Get valid directions and count paths
        const validDirections = this.getValidDirections(currentGridX, currentGridY);

        // Count actual paths (excluding current direction)
        const pathCount = validDirections.filter(dir =>
            !(dir.x === ghost.direction.x && dir.y === ghost.direction.y)
        ).length;

        // Check if current direction is blocked
        const currentDirectionBlocked = !validDirections.some(dir =>
            dir.x === ghost.direction.x && dir.y === ghost.direction.y
        );

        // Determine if we need to make a decision
        const needNewDirection =
            (atGridCenter && pathCount > 1) || // At a real intersection with multiple choices
            currentDirectionBlocked; // Current path is blocked

        if (needNewDirection) {
            // Snap to grid for precise movement
            ghost.x = currentGridX * CELL_SIZE;
            ghost.y = currentGridY * CELL_SIZE;

            // Filter out reverse direction unless it's the only option
            const allowedDirections = validDirections.filter(dir => {
                const isReversal = dir.x === -ghost.lastDirection.x && dir.y === -ghost.lastDirection.y;
                return !isReversal || validDirections.length === 1;
            });

            if (allowedDirections.length > 0) {
                // Score each possible direction
                const directionScores = allowedDirections.map(dir => {
                    const newX = currentGridX * CELL_SIZE + dir.x * CELL_SIZE;
                    const newY = currentGridY * CELL_SIZE + dir.y * CELL_SIZE;

                    // Calculate distance to Pacman
                    const distanceToPacman = Math.sqrt(
                        Math.pow(newX - this.pacman.x, 2) +
                        Math.pow(newY - this.pacman.y, 2)
                    );

                    let score = 0;

                    // Heavily prioritize continuing in the same direction
                    if (dir.x === ghost.direction.x && dir.y === ghost.direction.y) {
                        score += CELL_SIZE * 4;
                    }

                    // Prioritize directions that lead away from Pacman
                    score += distanceToPacman;

                    // Small random factor to break ties
                    score += Math.random() * (CELL_SIZE / 16);

                    return { direction: dir, score };
                }).sort((a, b) => b.score - a.score);

                // Update ghost direction
                ghost.lastDirection = ghost.direction;
                ghost.direction = directionScores[0].direction;
            }
        }

        // Move ghost
        this.moveGhost(ghost, speed);
    }

    checkDotCollision() {
        let dotEaten = false;
        for (let i = this.dots.length - 1; i >= 0; i--) {
            const dot = this.dots[i];
            const dx = dot.x - (this.pacman.x + CELL_SIZE / 2);
            const dy = dot.y - (this.pacman.y + CELL_SIZE / 2);
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < CELL_SIZE / 2) {
                this.dots.splice(i, 1);
                this.updateScore(this.score + SCORES.DOT);
                dotEaten = true;
            }
        }
        if (dotEaten) {
            this.playSound('chomp', true);
        }
    }

    checkPowerPelletCollision() {
        for (let i = this.powerPellets.length - 1; i >= 0; i--) {
            const pellet = this.powerPellets[i];
            const dx = pellet.x - (this.pacman.x + CELL_SIZE / 2);
            const dy = pellet.y - (this.pacman.y + CELL_SIZE / 2);
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < CELL_SIZE / 2) {
                this.powerPellets.splice(i, 1);
                this.updateScore(this.score + SCORES.POWER_PELLET);
                this.isPoweredUp = true;

                // Play power pellet sound
                this.playSound('powerPellet');

                // Stop ghost siren and restart when power-up ends
                this.stopSound('ghostSiren');

                setTimeout(() => {
                    this.isPoweredUp = false;
                    if (!this.isGameOver) {
                        this.playSound('ghostSiren');
                    }
                }, POWER_PELLET_DURATION);
            }
        }
    }

    checkGhostCollision() {
        this.ghosts.forEach(ghost => {
            const dx = ghost.x - this.pacman.x;
            const dy = ghost.y - this.pacman.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < CELL_SIZE) {
                if (this.isPoweredUp) {
                    // Stop all currently playing sounds except death
                    this.stopAllSounds();

                    // Play ghost eaten sound
                    this.playSound('ghostEaten');

                    // Update score and reset ghost position
                    this.updateScore(this.score + SCORES.GHOST);
                    ghost.x = 14 * CELL_SIZE;
                    ghost.y = 14 * CELL_SIZE;

                    // Resume ghost siren after a delay
                    setTimeout(() => {
                        if (!this.isGameOver && this.isPoweredUp) {
                            this.playSound('ghostSiren');
                        }
                    }, 400);
                } else {
                    this.gameOver();
                }
            }
        });
    }

    updateScore(newScore) {
        this.score = newScore;
        this.scoreElement.textContent = `Score: ${this.score}`;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('pacmanHighScore', this.highScore);
            this.highScoreElement.textContent = `High Score: ${this.highScore}`;
        }
    }

    gameOver() {
        this.isGameOver = true;
        cancelAnimationFrame(this.animationId);

        // Stop all sounds and play death sound
        this.stopAllSounds();

        // Ensure death sound plays with proper volume and timing
        if (!this.isPoweredUp && this.sounds['death']) {
            this.playSound('death');
        }

        // Wait for the full death animation and sound (1.5 seconds)
        setTimeout(() => {
            this.gameScreen.classList.add('hidden');
            this.gameOverScreen.classList.remove('hidden');
            this.finalScoreElement.textContent = this.score;
            this.finalHighScoreElement.textContent = this.highScore;
            this.currentScreen = 'gameOver';
        }, 1500);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw maze
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (MAZE_LAYOUT[y][x] === 1) {
                    this.ctx.fillStyle = COLORS.WALL;
                    this.ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

                    // Draw inner wall highlight
                    this.ctx.fillStyle = COLORS.WALL_INNER;
                    this.ctx.fillRect(
                        x * CELL_SIZE + 2,
                        y * CELL_SIZE + 2,
                        CELL_SIZE - 4,
                        CELL_SIZE - 4
                    );
                }
            }
        }

        // Draw dots
        this.ctx.fillStyle = COLORS.DOT;
        this.dots.forEach(dot => {
            this.ctx.beginPath();
            this.ctx.arc(dot.x, dot.y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw power pellets
        this.ctx.fillStyle = COLORS.POWER_PELLET;
        this.powerPellets.forEach(pellet => {
            this.ctx.beginPath();
            this.ctx.arc(pellet.x, pellet.y, 6, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw Pac-Man
        this.ctx.save();
        this.ctx.translate(this.pacman.x + CELL_SIZE / 2, this.pacman.y + CELL_SIZE / 2);
        this.ctx.rotate(this.pacman.angle);
        this.ctx.fillStyle = COLORS.PACMAN;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, CELL_SIZE / 2, this.pacman.mouthOpen * Math.PI,
            (2 - this.pacman.mouthOpen) * Math.PI);
        this.ctx.lineTo(0, 0);
        this.ctx.fill();
        this.ctx.restore();

        // Draw ghosts with improved design
        this.ghosts.forEach(ghost => {
            const centerX = ghost.x + CELL_SIZE / 2;
            const centerY = ghost.y + CELL_SIZE / 2;

            // Handle blinking effect
            let ghostColor;
            if (ghost.isBlinking) {
                const timeSinceBlinkStart = Date.now() - ghost.blinkStart;
                if (timeSinceBlinkStart >= ghost.blinkDuration) {
                    ghost.isBlinking = false;
                } else {
                    // Blink every 500ms (slower, more visible blink)
                    const shouldShow = Math.floor(timeSinceBlinkStart / 500) % 2 === 0;
                    // Make the transition more dramatic by using contrasting colors
                    ghostColor = shouldShow ?
                        (this.isPoweredUp ? COLORS.GHOST_SCARED : ghost.color) :
                        (this.ghostMode === 'scatter' ? '#FFFFFF' : '#FFB8B8');  // Light colors for better contrast
                }
            } else {
                ghostColor = this.isPoweredUp ? COLORS.GHOST_SCARED : ghost.color;
            }

            this.ctx.fillStyle = ghostColor;

            // Draw ghost body (full circle for head)
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, CELL_SIZE / 2, Math.PI, 0, false);

            // Draw rectangular bottom
            this.ctx.lineTo(ghost.x + CELL_SIZE, ghost.y + CELL_SIZE);

            // Draw wavy bottom
            const waveHeight = 4;
            const segments = 3;
            const segmentWidth = CELL_SIZE / segments;

            for (let i = segments; i >= 0; i--) {
                const waveX = ghost.x + i * segmentWidth;
                const waveY = ghost.y + CELL_SIZE + (i % 2 === 0 ? waveHeight : 0);
                this.ctx.lineTo(waveX, waveY);
            }

            this.ctx.lineTo(ghost.x, ghost.y + CELL_SIZE);
            this.ctx.lineTo(ghost.x, centerY);
            this.ctx.fill();

            // Draw eyes
            const eyeRadius = 3;
            const eyeOffsetX = 6;
            const eyeOffsetY = -2;

            // White part of eyes
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(centerX - eyeOffsetX, centerY + eyeOffsetY, eyeRadius, 0, Math.PI * 2);
            this.ctx.arc(centerX + eyeOffsetX, centerY + eyeOffsetY, eyeRadius, 0, Math.PI * 2);
            this.ctx.fill();

            if (!this.isPoweredUp) {
                // Blue pupils
                this.ctx.fillStyle = '#0000FF';
                const pupilOffset = 1.5;
                const pupilRadius = 1.5;

                // Calculate pupil position based on ghost's direction
                const pupilOffsetX = ghost.direction.x * pupilOffset;
                const pupilOffsetY = ghost.direction.y * pupilOffset;

                this.ctx.beginPath();
                this.ctx.arc(centerX - eyeOffsetX + pupilOffsetX,
                    centerY + eyeOffsetY + pupilOffsetY,
                    pupilRadius, 0, Math.PI * 2);
                this.ctx.arc(centerX + eyeOffsetX + pupilOffsetX,
                    centerY + eyeOffsetY + pupilOffsetY,
                    pupilRadius, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                // Scared ghost eyes
                this.ctx.fillStyle = '#FF0000';
                this.ctx.beginPath();
                this.ctx.arc(centerX - eyeOffsetX, centerY + eyeOffsetY, 2, 0, Math.PI * 2);
                this.ctx.arc(centerX + eyeOffsetX, centerY + eyeOffsetY, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
    }

    gameLoop(currentTime = 0) {
        // Calculate delta time in milliseconds and cap it
        const deltaTime = Math.min(currentTime - this.lastFrameTime, 50);
        this.lastFrameTime = currentTime;

        if (!this.isGameOver && !this.isPaused) {
            try {
                // Use requestAnimationFrame first to optimize frame timing
                this.animationId = requestAnimationFrame((time) => this.gameLoop(time));

                // Then update game state
                this.updateGameState(deltaTime);
            } catch (error) {
                console.error('Game loop error:', error);
                // Attempt to recover from error
                this.lastFrameTime = currentTime;
                this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
            }
        }
    }

    updateGameState(deltaTime) {
        // Cache frequently accessed properties
        const pacmanX = this.pacman.x;
        const pacmanY = this.pacman.y;

        // Update ghost mode timing with deltaTime
        this.ghostModeTime += deltaTime;
        if (this.ghostModeTime >= this.ghostModeDuration[this.ghostMode]) {
            // Start blinking before mode change
            const warningTime = 2000; // 2 seconds warning
            if (!this.ghosts[0].isBlinking && this.ghostModeTime >= this.ghostModeDuration[this.ghostMode] - warningTime) {
                this.ghosts.forEach(ghost => {
                    ghost.isBlinking = true;
                    ghost.blinkStart = Date.now();
                });
            }

            // Actually change mode after warning period
            if (this.ghostModeTime >= this.ghostModeDuration[this.ghostMode]) {
                this.ghostMode = this.ghostMode === 'scatter' ? 'chase' : 'scatter';
                this.ghostModeTime = 0;

                // When mode changes, allow ghosts to reverse direction and reset blinking
                this.ghosts.forEach(ghost => {
                    ghost.canReverse = true;
                    ghost.isBlinking = false;
                });
            }
        }

        // Update game entities
        this.updatePacman(deltaTime / 1000); // Convert to seconds for Pacman

        // Batch ghost updates
        if (!this.isGameOver) {
            this.updateGhosts();
        }

        // Batch collision checks
        if (!this.isGameOver) {
            this.checkDotCollision();
            this.checkPowerPelletCollision();
            this.checkGhostCollision();
        }

        // Draw frame only if game is still running
        if (!this.isGameOver) {
            this.draw();
        }

        // Check win condition
        if (this.dots.length === 0 && this.powerPellets.length === 0) {
            this.gameOver();
        }
    }

    hasLineOfSight(ghost) {
        const ghostGridX = Math.floor(ghost.x / CELL_SIZE);
        const ghostGridY = Math.floor(ghost.y / CELL_SIZE);
        const pacmanGridX = Math.floor(this.pacman.x / CELL_SIZE);
        const pacmanGridY = Math.floor(this.pacman.y / CELL_SIZE);

        // Check if ghost and pacman are in the same row or column
        if (ghostGridX === pacmanGridX || ghostGridY === pacmanGridY) {
            const startX = Math.min(ghostGridX, pacmanGridX);
            const endX = Math.max(ghostGridX, pacmanGridX);
            const startY = Math.min(ghostGridY, pacmanGridY);
            const endY = Math.max(ghostGridY, pacmanGridY);

            // Check horizontal line of sight
            if (ghostGridY === pacmanGridY) {
                for (let x = startX + 1; x < endX; x++) {
                    if (MAZE_LAYOUT[ghostGridY][x] === 1) {
                        return false;
                    }
                }
                return true;
            }

            // Check vertical line of sight
            if (ghostGridX === pacmanGridX) {
                for (let y = startY + 1; y < endY; y++) {
                    if (MAZE_LAYOUT[y][ghostGridX] === 1) {
                        return false;
                    }
                }
                return true;
            }
        }
        return false;
    }

    playSound(soundName, force = false) {
        if (!this.soundsLoaded || !this.sounds[soundName] || !this.isSoundEnabled) return;

        try {
            const sound = this.sounds[soundName];
            const priority = this.soundPriorities[soundName] || 0;

            // Special handling for chomp sound to prevent too frequent replay
            if (soundName === 'chomp') {
                const now = Date.now();
                if (!force && (now - this.lastChompTime < 100)) return;
                this.lastChompTime = now;
            }

            // Check if we should play this sound based on priority
            for (const playingSound of this.currentlyPlayingSounds) {
                if (this.soundPriorities[playingSound] > priority) {
                    // A higher priority sound is playing, don't play this one
                    return;
                }
            }

            // For non-looping sounds, stop other sounds with lower or equal priority
            if (soundName !== 'ghostSiren') {
                for (const playingSound of this.currentlyPlayingSounds) {
                    if (this.soundPriorities[playingSound] <= priority) {
                        this.stopSound(playingSound);
                    }
                }
            }

            // Set the volume
            sound.volume = this.soundVolumes[soundName] || 0.5;

            // Play the sound
            if (sound.paused || soundName === 'chomp') {
                sound.currentTime = 0;
                const playPromise = sound.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            this.currentlyPlayingSounds.add(soundName);
                            // Remove non-looping sounds from playing list when they end
                            if (soundName !== 'ghostSiren') {
                                sound.addEventListener('ended', () => {
                                    this.currentlyPlayingSounds.delete(soundName);
                                }, { once: true });
                            }
                        })
                        .catch(e => {
                            console.warn(`Sound play prevented: ${soundName}`, e);
                        });
                }
            }
        } catch (e) {
            console.warn(`Error playing sound ${soundName}:`, e);
        }
    }

    stopSound(soundName) {
        if (!this.soundsLoaded || !this.sounds[soundName]) return;

        try {
            const sound = this.sounds[soundName];
            sound.pause();
            sound.currentTime = 0;
            this.currentlyPlayingSounds.delete(soundName);
        } catch (e) {
            console.warn(`Error stopping sound ${soundName}:`, e);
        }
    }

    stopAllSounds() {
        if (!this.soundsLoaded) return;

        for (const soundName of Object.keys(this.sounds)) {
            this.stopSound(soundName);
        }
        this.currentlyPlayingSounds.clear();
    }

    updateSoundButtonText() {
        if (this.soundToggleBtn) {
            this.soundToggleBtn.textContent = this.isSoundEnabled ? 'Sound: ON' : 'Sound: OFF';
            this.soundToggleBtn.style.backgroundColor = this.isSoundEnabled ? '#4CAF50' : '#f44336';
        }
    }

    toggleSound() {
        this.isSoundEnabled = !this.isSoundEnabled;
        this.updateSoundButtonText();

        if (!this.isSoundEnabled) {
            // Stop all current sounds
            this.stopAllSounds();
        } else if (!this.isPaused) {
            // Resume necessary sounds if game is not paused
            this.playSound('ghostSiren');
        }
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
}); 