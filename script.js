document.addEventListener('DOMContentLoaded', () => {
    // Game settings
    const VISIBLE_BOARD_SIZE = 20; // The visible board size stays the same
    const VIRTUAL_BOARD_SIZE = 30; // The virtual board is larger (5 cells on each side)
    const OFFSET = (VIRTUAL_BOARD_SIZE - VISIBLE_BOARD_SIZE) / 2; // The offset for the virtual board
    const GAME_SPEED = 150; // Main game loop interval in ms
    const INITIAL_SNAKE_LENGTH = 3;
    const BONUS_FOOD_POINTS = 5;
    // Removing BIRD_PENALTY_POINTS constant since we're now using half the player's score
    const AI_DECISION_QUALITY = 0.999; // 99.9% chance of making optimal decision
    const MIN_SNAKE_LENGTH = 3; // Minimum snake length allowed
    
    // Movement timing (now controlled by counters in main loop instead of separate intervals)
    const BONUS_FOOD_MOVE_FREQ = 6; // Move bonus food every 6 game ticks (approximately 900ms)
    const BIRD_MOVE_FREQ = 5; // Move bird every 5 game ticks (approximately 750ms)
    
    // Game elements
    const titleScreen = document.getElementById('title-screen');
    const multiplayerScreen = document.getElementById('multiplayer-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameBoard = document.getElementById('game-board');
    const scoreP1Element = document.getElementById('score-p1');
    const scoreP2Element = document.getElementById('score-p2');
    const player2ScoreContainer = document.querySelector('.player2-score');
    const gameOverElement = document.getElementById('game-over');
    const singlePlayerResult = document.getElementById('single-player-result');
    const multiplayerResult = document.getElementById('multiplayer-result');
    const finalScoreP1Element = document.getElementById('final-score-p1');
    const finalScoreP2Element = document.getElementById('final-score-p2');
    const winnerTextElement = document.getElementById('winner-text');
    
    // Score containers for flash effect
    const scoreContainerP1 = document.querySelector('.score-container:nth-child(1)');
    const scoreContainerP2 = document.querySelector('.score-container:nth-child(2)');
    
    // Menu buttons
    const onePlayerButton = document.getElementById('one-player-button');
    const twoPlayerButton = document.getElementById('two-player-button');
    const localButton = document.getElementById('local-button');
    const cpuButton = document.getElementById('cpu-button');
    const backButton = document.getElementById('back-button');
    const playAgainButton = document.getElementById('play-again-button');
    const mainMenuButton = document.getElementById('main-menu-button');
    
    // Mobile controls
    const upButton = document.getElementById('up-button');
    const downButton = document.getElementById('down-button');
    const leftButton = document.getElementById('left-button');
    const rightButton = document.getElementById('right-button');
    
    // Game mode variables
    let gameMode = 'single'; // 'single', 'local', 'cpu'
    
    // Game variables
    let snake1 = [];
    let snake2 = [];
    let food = {};
    let bonusFood = null;
    let bird = null;  // The bird enemy
    let direction1 = 'right';
    let nextDirection1 = 'right';
    let direction2 = 'left';
    let nextDirection2 = 'left';
    let score1 = 0;
    let score2 = 0;
    let gameInterval;
    let isGameRunning = false;
    
    // Timing counters for unified game loop
    let bonusFoodMoveCounter = 0;
    let birdMoveCounter = 0;
    let bonusFoodSpawnTimer = 0;  // Countdown to spawn bonus food
    let birdSpawnTimer = 0;       // Countdown to spawn bird
    
    // Helper functions
    function checkCollision(obj1, obj2) {
        return obj1.row === obj2.row && obj1.col === obj2.col;
    }
    
    function checkSnakeCollision(obj, snake) {
        return snake.some(part => checkCollision(part, obj));
    }
    
    // Function to flash the score container
    function flashScoreContainer(playerNum, isGold = false) {
        const container = playerNum === 1 ? scoreContainerP1 : scoreContainerP2;
        
        // Remove any existing flash classes
        container.classList.remove('score-flash', 'score-gold-flash');
        
        // Force a reflow to restart the animation
        void container.offsetWidth;
        
        // Add the appropriate class to start the animation
        if (isGold) {
            container.classList.add('score-gold-flash');
        } else {
            container.classList.add('score-flash');
        }
        
        // Remove the class after the animation completes
        setTimeout(() => {
            container.classList.remove('score-flash', 'score-gold-flash');
        }, 250); // 250ms = animation duration
    }
    
    // Initialize game board
    function initBoard() {
        gameBoard.innerHTML = '';
        
        for (let row = 0; row < VISIBLE_BOARD_SIZE; row++) {
            for (let col = 0; col < VISIBLE_BOARD_SIZE; col++) {
                const cell = document.createElement('div');
                cell.setAttribute('data-row', row);
                cell.setAttribute('data-col', col);
                gameBoard.appendChild(cell);
            }
        }
    }
    
    // Get cell element at specific position
    function getCellAt(row, col) {
        // Only return cells that are within the visible bounds of the game board
        if (row < OFFSET || row >= VIRTUAL_BOARD_SIZE - OFFSET || col < OFFSET || col >= VIRTUAL_BOARD_SIZE - OFFSET) {
            return null;
        }
        // Adjust for the offset to map virtual coordinates to visible board coordinates
        const visibleRow = row - OFFSET;
        const visibleCol = col - OFFSET;
        return gameBoard.querySelector(`[data-row="${visibleRow}"][data-col="${visibleCol}"]`);
    }
    
    // Initialize snakes
    function initSnakes() {
        // Initialize player 1 snake (green)
        snake1 = [];
        const middleRow = Math.floor(VIRTUAL_BOARD_SIZE / 2);
        
        if (gameMode === 'single') {
            // Single player - snake starts in middle heading right
            for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
                snake1.push({
                    row: middleRow,
                    col: Math.floor(VIRTUAL_BOARD_SIZE / 2) - i
                });
            }
            direction1 = 'right';
            nextDirection1 = 'right';
        } else {
            // Multiplayer - snake1 starts in top left corner heading right
            const player1Row = Math.floor(VIRTUAL_BOARD_SIZE / 4) + OFFSET;
            for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
                snake1.push({
                    row: player1Row,
                    col: Math.floor(VIRTUAL_BOARD_SIZE / 4) - i + OFFSET
                });
            }
            direction1 = 'right';
            nextDirection1 = 'right';
        }
        
        // Initialize player 2 snake if in multiplayer mode (purple)
        if (gameMode !== 'single') {
            snake2 = [];
            const player2Row = Math.floor(VIRTUAL_BOARD_SIZE * 3 / 4) - OFFSET;
            
            // Snake 2 starts in bottom right corner heading left
            for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
                snake2.push({
                    row: player2Row,
                    col: Math.floor(VIRTUAL_BOARD_SIZE * 3 / 4) + i - OFFSET
                });
            }
            direction2 = 'left';
            nextDirection2 = 'left';
        }
        
        // Draw initial snakes
        updateVisuals();
    }
    
    // Update visuals - centralized rendering function
    function updateVisuals() {
        // Clear previous visuals
        clearAllVisuals();
        
        // Draw player 1 snake (green)
        snake1.forEach(part => {
            const cell = getCellAt(part.row, part.col);
            if (cell) {
                cell.classList.add('snake-part');
            }
        });
        
        // Draw player 2 snake (purple) if in multiplayer mode
        if (gameMode !== 'single' && snake2) {
            snake2.forEach(part => {
                const cell = getCellAt(part.row, part.col);
                if (cell) {
                    cell.classList.add('snake-part-p2');
                }
            });
        }
        
        // Draw food
        if (food) {
            const foodCell = getCellAt(food.row, food.col);
            if (foodCell) {
                foodCell.classList.add('food');
            }
        }
        
        // Draw bonus food only if on screen
        if (bonusFood && isOnScreen(bonusFood)) {
            const bonusFoodCell = getCellAt(bonusFood.row, bonusFood.col);
            if (bonusFoodCell) {
                bonusFoodCell.classList.add('bonus-food');
            }
        }
        
        // Draw bird only if on screen
        if (bird && isOnScreen(bird)) {
            const birdCell = getCellAt(bird.row, bird.col);
            if (birdCell) {
                birdCell.classList.add('bird');
            }
        }
    }
    
    // Clear all visual elements
    function clearAllVisuals() {
        const allCells = gameBoard.querySelectorAll('.snake-part, .snake-part-p2, .food, .bonus-food, .bird');
        allCells.forEach(cell => {
            cell.classList.remove('snake-part', 'snake-part-p2', 'food', 'bonus-food', 'bird');
        });
    }
    
    // Place food at random position (red dot - does NOT move)
   function placeFood() {
       // Find empty positions
       let availablePositions = [];
       
       // Only consider positions in the visible area
       for (let row = OFFSET; row < VIRTUAL_BOARD_SIZE - OFFSET; row++) {
           for (let col = OFFSET; col < VIRTUAL_BOARD_SIZE - OFFSET; col++) {
               const isOccupiedBySnake1 = snake1.some(part => part.row === row && part.col === col);
               const isOccupiedBySnake2 = gameMode !== 'single' && snake2 && snake2.some(part => part.row === row && part.col === col);
               const isBonusFood = bonusFood && isOnScreen(bonusFood) && bonusFood.row === row && bonusFood.col === col;
               const isBird = bird && isOnScreen(bird) && bird.row === row && bird.col === col;
               
               if (!isOccupiedBySnake1 && !isOccupiedBySnake2 && !isBonusFood && !isBird) {
                   availablePositions.push({ row, col });
               }
           }
       }
       
       // Place food at random empty position
       if (availablePositions.length > 0) {
           const randomIndex = Math.floor(Math.random() * availablePositions.length);
           food = availablePositions[randomIndex];
           
           // Update visuals with new food
           updateVisuals();
       }
   }
   
   // Get random direction (up, down, left, right)
   function getRandomDirection() {
       const directions = ['up', 'down', 'left', 'right'];
       return directions[Math.floor(Math.random() * directions.length)];
   }
   
   // Get start position and direction for a moving object
   function getStartPositionAndDirection() {
       const direction = getRandomDirection();
       let row, col;
       
       switch (direction) {
           case 'up':
               // Start from bottom (beyond the virtual board), move up
               row = VIRTUAL_BOARD_SIZE - 1;
               col = Math.floor(Math.random() * (VIRTUAL_BOARD_SIZE - 2 * OFFSET)) + OFFSET;
               break;
           case 'down':
               // Start from top (beyond the virtual board), move down
               row = 0;
               col = Math.floor(Math.random() * (VIRTUAL_BOARD_SIZE - 2 * OFFSET)) + OFFSET;
               break;
           case 'left':
               // Start from right (beyond the virtual board), move left
               row = Math.floor(Math.random() * (VIRTUAL_BOARD_SIZE - 2 * OFFSET)) + OFFSET;
               col = VIRTUAL_BOARD_SIZE - 1;
               break;
           case 'right':
               // Start from left (beyond the virtual board), move right
               row = Math.floor(Math.random() * (VIRTUAL_BOARD_SIZE - 2 * OFFSET)) + OFFSET;
               col = 0;
               break;
       }
       
       return { 
           row, 
           col, 
           direction,
           hasEnteredScreen: false,
           completedCrossing: false
       };
   }
   
   // Move object according to its direction
   function moveObject(obj) {
       switch (obj.direction) {
           case 'up':
               obj.row--;
               break;
           case 'down':
               obj.row++;
               break;
           case 'left':
               obj.col--;
               break;
           case 'right':
               obj.col++;
               break;
       }
   }
   
   // Check if object is off screen
   function isOffScreen(obj) {
       return (
           obj.row < OFFSET || 
           obj.row >= VIRTUAL_BOARD_SIZE - OFFSET || 
           obj.col < OFFSET || 
           obj.col >= VIRTUAL_BOARD_SIZE - OFFSET
       );
   }
   
   // Is object visible on screen (fully on screen)
   function isOnScreen(obj) {
       return (
           obj.row >= OFFSET && 
           obj.row < VIRTUAL_BOARD_SIZE - OFFSET && 
           obj.col >= OFFSET && 
           obj.col < VIRTUAL_BOARD_SIZE - OFFSET
       );
   }
   
   // Has object completely crossed the screen (reached opposite side)
   function hasCompletedCrossing(obj) {
       return (
           (obj.direction === 'right' && obj.col >= VIRTUAL_BOARD_SIZE) || 
           (obj.direction === 'left' && obj.col < 0) ||
           (obj.direction === 'up' && obj.row < 0) ||
           (obj.direction === 'down' && obj.row >= VIRTUAL_BOARD_SIZE)
       );
   }
   
   // Spawn a new bonus food
   function spawnBonusFood() {
       console.log("Spawning new bonus food");
       bonusFood = getStartPositionAndDirection();
       bonusFoodMoveCounter = 0; // Reset the move counter
   }
   
   // Spawn a new bird
   function spawnBird() {
       console.log("Spawning new bird");
       bird = getStartPositionAndDirection();
       birdMoveCounter = 0; // Reset the move counter
   }
   
   // Move bonus food as part of the main game loop
   function updateBonusFood() {
       if (!bonusFood) return;
       
       // Move the bonus food
       const prevRow = bonusFood.row;
       const prevCol = bonusFood.col;
       moveObject(bonusFood);
       console.log(`Bonus food moved from (${prevRow}, ${prevCol}) to (${bonusFood.row}, ${bonusFood.col})`);
       
       // Track when bonus food enters screen (only once)
       if (!bonusFood.hasEnteredScreen && isOnScreen(bonusFood)) {
           bonusFood.hasEnteredScreen = true;
           console.log("Bonus food has entered the screen");
       }
       
       // If bonus food has crossed the screen completely after entering it, remove it
       if (bonusFood.hasEnteredScreen && hasCompletedCrossing(bonusFood)) {
           console.log("Bonus food has completed crossing the screen");
           bonusFood = null;
           bonusFoodSpawnTimer = Math.floor(Math.random() * 40) + 20; // Random 20-60 ticks (3-9 seconds)
       }
   }
   
   // Move bird as part of the main game loop
   function updateBird() {
       if (!bird) return;
       
       // Move the bird
       const prevRow = bird.row;
       const prevCol = bird.col;
       moveObject(bird);
       console.log(`Bird moved from (${prevRow}, ${prevCol}) to (${bird.row}, ${bird.col})`);
       
       // Track when bird enters screen (only once)
       if (!bird.hasEnteredScreen && isOnScreen(bird)) {
           bird.hasEnteredScreen = true;
           console.log("Bird has entered the screen");
       }
       
       // If bird has crossed the screen completely after entering it, remove it
       if (bird.hasEnteredScreen && hasCompletedCrossing(bird)) {
           console.log("Bird has completed crossing the screen");
           bird = null;
           birdSpawnTimer = Math.floor(Math.random() * 40) + 40; // Random 40-80 ticks (6-12 seconds)
       }
   }
   
   // Check for collision with bonus food
   function checkBonusFoodCollisions() {
       if (!bonusFood || !isOnScreen(bonusFood)) return false;
       
       // Helper function to handle bonus food collection
       function handleBonusFoodCollection(playerNum) {
           console.log(`Player ${playerNum} collected bonus food!`);
           
           // Increase score for the correct player
           if (playerNum === 1) {
               score1 += BONUS_FOOD_POINTS;
               scoreP1Element.textContent = score1;
               
               // Add TWO extra units to make snake grow by 3 total (1 from food collection + 2 extra)
               const lastPart = { ...snake1[snake1.length - 1] };
               snake1.push(lastPart);
               snake1.push({...lastPart}); // Add a second segment
               
               // Flash gold animation for Player 1
               flashScoreContainer(1, true);
           } else {
               score2 += BONUS_FOOD_POINTS;
               scoreP2Element.textContent = score2;
               
               // Add TWO extra units to make snake grow by 3 total (1 from food collection + 2 extra)
               const lastPart = { ...snake2[snake2.length - 1] };
               snake2.push(lastPart);
               snake2.push({...lastPart}); // Add a second segment
               
               // Flash gold animation for Player 2
               flashScoreContainer(2, true);
           }
           
           // Remove bonus food
           bonusFood = null;
           
           // Schedule next bonus food
           bonusFoodSpawnTimer = Math.floor(Math.random() * 40) + 20; // Random 20-60 ticks (3-9 seconds)
       }
       
       // Check collision with player 1 snake (first 2 segments)
       for (let i = 0; i < Math.min(2, snake1.length); i++) {
           if (checkCollision(snake1[i], bonusFood)) {
               handleBonusFoodCollection(1);
               return true;
           }
       }
       
       // Check collision with player 2 snake (first 2 segments) if in multiplayer
       if (gameMode !== 'single' && snake2) {
           for (let i = 0; i < Math.min(2, snake2.length); i++) {
               if (checkCollision(snake2[i], bonusFood)) {
                   handleBonusFoodCollection(2);
                   return true;
               }
           }
       }
       
       return false;
   }
   
   // Check for collision with the bird
   function checkBirdCollisions() {
       if (!bird || !isOnScreen(bird)) return false;
       
       // Helper function for direct collision check
       function isDirectCollision(segment, birdObj) {
           return segment.row === birdObj.row && segment.col === birdObj.col;
       }
       
       // Check collision with player 1 snake
       for (let i = 0; i < snake1.length; i++) {
           if (isDirectCollision(snake1[i], bird)) {
               console.log(`Bird collision with player 1 snake at segment ${i}!`);
               
               // Calculate penalty (half of current score)
               const penaltyPoints = Math.ceil(score1 / 2);
               score1 = Math.max(0, score1 - penaltyPoints);
               scoreP1Element.textContent = score1;
               
               // Flash the score display
               flashScoreContainer(1);
               
               // Handle snake length based on current length
               if (snake1.length <= MIN_SNAKE_LENGTH) {
                   console.log('Player 1 snake has minimum length - game over!');
                   bird = null;
                   
                   if (gameMode === 'single') {
                       gameOver();
                   } else {
                       gameOverPlayer(1);
                   }
                   return true;
               } else {
                   // Cut snake in half but ensure it doesn't go below minimum length
                   const newLength = Math.max(MIN_SNAKE_LENGTH, Math.floor(snake1.length / 2));
                   console.log(`Reducing player 1 snake from ${snake1.length} to ${newLength} units`);
                   
                   // Keep the head and remove from the tail
                   while (snake1.length > newLength) {
                       snake1.pop();
                   }
                   
                   // Remove bird and schedule next one
                   bird = null;
                   birdSpawnTimer = Math.floor(Math.random() * 40) + 40; // Random 40-80 ticks (6-12 seconds)
                   
                   return true;
               }
           }
       }
       
       // Check for collision with player 2 snake in multiplayer modes
       if (gameMode !== 'single' && snake2) {
           for (let i = 0; i < snake2.length; i++) {
               if (isDirectCollision(snake2[i], bird)) {
                   console.log(`Bird collision with player 2 snake at segment ${i}!`);
                   
                   // Calculate penalty (half of current score)
                   const penaltyPoints = Math.ceil(score2 / 2);
                   score2 = Math.max(0, score2 - penaltyPoints);
                   scoreP2Element.textContent = score2;
                   
                   // Flash the score display
                   flashScoreContainer(2);
                   
                   // Handle snake length based on current length
                   if (snake2.length <= MIN_SNAKE_LENGTH) {
                       console.log('Player 2 snake has minimum length - game over!');
                       bird = null;
                       gameOverPlayer(2);
                       return true;
                   } else {
                       // Cut snake in half but ensure it doesn't go below minimum length
                       const newLength = Math.max(MIN_SNAKE_LENGTH, Math.floor(snake2.length / 2));
                       console.log(`Reducing player 2 snake from ${snake2.length} to ${newLength} units`);
                       
                       // Keep the head and remove from the tail
                       while (snake2.length > newLength) {
                           snake2.pop();
                       }
                       
                       // Remove bird and schedule next one
                       bird = null;
                       birdSpawnTimer = Math.floor(Math.random() * 40) + 40; // Random 40-80 ticks (6-12 seconds)
                       
                       return true;
                   }
               }
           }
       }
       
       return false;
   }
   
   // AI opponent logic
   function getAIDirection() {
       if (!isGameRunning || gameMode !== 'cpu' || Math.random() > AI_DECISION_QUALITY) {
           // Random move 0.1% of the time
           const directions = ['up', 'down', 'left', 'right'];
           const validDirections = directions.filter(dir => {
               if (dir === 'up' && direction2 === 'down') return false;
               if (dir === 'down' && direction2 === 'up') return false;
               if (dir === 'left' && direction2 === 'right') return false;
               if (dir === 'right' && direction2 === 'left') return false;
               return true;
           });
           
           return validDirections[Math.floor(Math.random() * validDirections.length)];
       }
       
       // Smart move 99.9% of the time
       const head = snake2[0];
       
       // Check possible moves
       const moves = [
           { dir: 'up', newRow: head.row - 1, newCol: head.col },
           { dir: 'down', newRow: head.row + 1, newCol: head.col },
           { dir: 'left', newRow: head.row, newCol: head.col - 1 },
           { dir: 'right', newRow: head.row, newCol: head.col + 1 }
       ];
       
       // Filter invalid moves
       const validMoves = moves.filter(move => {
           // Can't go opposite direction
           if (move.dir === 'up' && direction2 === 'down') return false;
           if (move.dir === 'down' && direction2 === 'up') return false;
           if (move.dir === 'left' && direction2 === 'right') return false;
           if (move.dir === 'right' && direction2 === 'left') return false;
           
           // Can't hit wall (using visible boundaries)
           if (move.newRow < OFFSET || move.newRow >= VIRTUAL_BOARD_SIZE - OFFSET || 
               move.newCol < OFFSET || move.newCol >= VIRTUAL_BOARD_SIZE - OFFSET) 
               return false;
           
           // Can't hit self
           if (snake2.some((part, index) => index > 0 && part.row === move.newRow && part.col === move.newCol))
               return false;
           
           // Can't hit player 1's snake
           if (snake1.some(part => part.row === move.newRow && part.col === move.newCol))
               return false;
           
           return true;
       });
       
       if (validMoves.length === 0) {
           return direction2;
       }
       
       // Score each move
       const scoredMoves = validMoves.map(move => {
           let score = 0;
           
           // Prefer moves toward food
           const distToFood = Math.abs(move.newRow - food.row) + Math.abs(move.newCol - food.col);
           score -= distToFood * 2; // Lower distance = higher score
           
           // Prefer bonus food
           if (bonusFood && isOnScreen(bonusFood)) {
               const distToBonus = Math.abs(move.newRow - bonusFood.row) + Math.abs(move.newCol - bonusFood.col);
               score -= distToBonus * 3; // Higher priority than regular food
           }
           
           // Avoid bird if it exists
           if (bird && isOnScreen(bird)) {
               const distToBird = Math.abs(move.newRow - bird.row) + Math.abs(move.newCol - bird.col);
               if (distToBird < 3) {
                   score -= 65; // Strongly avoid bird if close
               }
           }
           
           // Avoid walls - prefer center
           const distToCenter = Math.abs(move.newRow - (VIRTUAL_BOARD_SIZE / 2)) + 
                            Math.abs(move.newCol - (VIRTUAL_BOARD_SIZE / 2));
           score -= distToCenter * 0.02; // Small penalty for being far from center
           
           // NEW: Detect if move leads to a trap (only one exit)
           let trapPenalty = 0;
           let exits = 0;
           const checkDirections = [[-1, 0], [1, 0], [0, -1], [0, 1]];
           
           // Skip the direction we came from
           const skipDir = {
               'up': 1, // Index of [1, 0] (down)
               'down': 0, // Index of [-1, 0] (up)
               'left': 3, // Index of [0, 1] (right)
               'right': 2 // Index of [0, -1] (left)
           };
           
           // Check in all directions except the one we came from
           for (let i = 0; i < checkDirections.length; i++) {
               if (i === skipDir[move.dir]) continue;
               
               const [dr, dc] = checkDirections[i];
               const checkRow = move.newRow + dr;
               const checkCol = move.newCol + dc;
               
               // Check if this direction is blocked
               const hitWall = checkRow < OFFSET || checkRow >= VIRTUAL_BOARD_SIZE - OFFSET || 
                             checkCol < OFFSET || checkCol >= VIRTUAL_BOARD_SIZE - OFFSET;
               
               const hitSnake1 = snake1.some(part => part.row === checkRow && part.col === checkCol);
               
               const hitSelf = snake2.some((part, index) => index > 0 && 
                              part.row === checkRow && part.col === checkCol);
               
               // If not blocked, it's an exit
               if (!hitWall && !hitSnake1 && !hitSelf) {
                   exits++;
               }
           }
           
           // Heavy penalty if there's only one exit (potential trap)
           if (exits < 1) {
               trapPenalty = 40;
           }
           
           // NEW: Body coiling penalty - avoid moving close to own body
           let bodyPenalty = 0;
           let nearbySegments = 0;
           
           // Check snake body segments within a small radius (2 cells)
           for (let r = -2; r <= 2; r++) {
               for (let c = -2; c <= 2; c++) {
                   if (r === 0 && c === 0) continue; // Skip the move position itself
                   
                   const checkRow = move.newRow + r;
                   const checkCol = move.newCol + c;
                   
                   // Count nearby snake segments
                   snake2.forEach((part, index) => {
                       if (index > 0 && part.row === checkRow && part.col === checkCol) {
                           nearbySegments++;
                       }
                   });
               }
           }
           
           // Penalty based on nearby segment count
           bodyPenalty = nearbySegments * 1;
           
           // Apply the new penalties
           score -= trapPenalty;
           score -= bodyPenalty;
           
           return { dir: move.dir, score };
       });
       
       // Sort by score (highest first)
       scoredMoves.sort((a, b) => b.score - a.score);
       
       // Return best move
       return scoredMoves[0].dir;
   }
   
   // Move snakes
   function moveSnakes() {
       // Move player 1 snake
       direction1 = nextDirection1;
       moveSnake(snake1, direction1, 1);
       
       // Move player 2 snake if in multiplayer mode
       if (gameMode !== 'single' && snake2) {
           // In CPU mode, let AI decide direction
           if (gameMode === 'cpu') {
               nextDirection2 = getAIDirection();
           }
           
           direction2 = nextDirection2;
           moveSnake(snake2, direction2, 2);
       }
   }
   
   // Move a specific snake
   function moveSnake(snake, direction, playerNum) {
       // Calculate new head position
       const head = { ...snake[0] };
       
       switch (direction) {
           case 'up':
               head.row--;
               break;
           case 'down':
               head.row++;
               break;
           case 'left':
               head.col--;
               break;
           case 'right':
               head.col++;
               break;
       }
       
       // Check collision with walls (using visible board boundaries)
       if (head.row < OFFSET || head.row >= VIRTUAL_BOARD_SIZE - OFFSET || 
           head.col < OFFSET || head.col >= VIRTUAL_BOARD_SIZE - OFFSET) {
           if (gameMode === 'single') {
               gameOver();
           } else {
               gameOverPlayer(playerNum);
           }
           return;
       }
       
       // Check collision with itself (but skip the tail if not eating food)
       const snakeWithoutTail = snake.slice(0, -1);
       if (snakeWithoutTail.some(part => checkCollision(part, head))) {
           if (gameMode === 'single') {
               gameOver();
           } else {
               gameOverPlayer(playerNum);
           }
          return;
      }
      
      // Check collision with other snake (in multiplayer modes)
      if (gameMode !== 'single') {
          const otherSnake = playerNum === 1 ? snake2 : snake1;
          if (otherSnake && otherSnake.some(part => checkCollision(part, head))) {
              if (gameMode === 'single') {
                  gameOver();
              } else {
                  gameOverPlayer(playerNum);
              }
              return;
          }
      }
      
      // Add new head
      snake.unshift(head);
      
      // Check if food is eaten
      if (checkCollision(head, food)) {
          // Increase score
          if (playerNum === 1) {
              score1++;
              scoreP1Element.textContent = score1;
          } else {
              score2++;
              scoreP2Element.textContent = score2;
          }
          
          // Place new food
          placeFood();
      } 
      // If no food was eaten, remove tail (bonus food is handled separately)
      else {
          snake.pop();
      }
  }
  
  // Game over handler for a specific player
  function gameOverPlayer(playerNum) {
      console.log(`Game over for player ${playerNum}`);
      clearInterval(gameInterval);
      isGameRunning = false;
     
      // Show game over screen with appropriate message
      finalScoreP1Element.textContent = score1;
      finalScoreP2Element.textContent = score2;
     
      // Determine winner
      if (playerNum === 1) {
          winnerTextElement.textContent = "Player 2 wins!";
      } else {
          winnerTextElement.textContent = "Player 1 wins!";
      }
     
      // Show multiplayer result
      singlePlayerResult.classList.add('hidden');
      multiplayerResult.classList.remove('hidden');
      gameOverElement.classList.remove('hidden');
  }
 
  // Game over handler
  function gameOver() {
      console.log('Game over');
      clearInterval(gameInterval);
      isGameRunning = false;
     
      // Show appropriate game over screen
      if (gameMode === 'single') {
          document.getElementById('final-score').textContent = score1;
          singlePlayerResult.classList.remove('hidden');
          multiplayerResult.classList.add('hidden');
      } else {
          finalScoreP1Element.textContent = score1;
          finalScoreP2Element.textContent = score2;
         
          // Determine winner
          if (score1 > score2) {
              winnerTextElement.textContent = "Player 1 wins!";
          } else if (score2 > score1) {
              winnerTextElement.textContent = "Player 2 wins!";
          } else {
              winnerTextElement.textContent = "It's a tie!";
          }
          
          singlePlayerResult.classList.add('hidden');
          multiplayerResult.classList.remove('hidden');
      }
     
      gameOverElement.classList.remove('hidden');
  }
 
  // Main game update function - the heart of the unified game loop
  function updateGame() {
      // Update snakes
      moveSnakes();
     
      // Spawn new bonus food if none exists and timer is up
      if (!bonusFood && bonusFoodSpawnTimer <= 0) {
          spawnBonusFood();
      } else if (!bonusFood && bonusFoodSpawnTimer > 0) {
          bonusFoodSpawnTimer--;
      }
    
      // Update bonus food (every BONUS_FOOD_MOVE_FREQ ticks)
      bonusFoodMoveCounter++;
      if (bonusFoodMoveCounter >= BONUS_FOOD_MOVE_FREQ) {
          bonusFoodMoveCounter = 0;
          if (bonusFood) {
              updateBonusFood();
          }
      }
    
      // Spawn new bird if none exists and timer is up
      if (!bird && birdSpawnTimer <= 0) {
          spawnBird();
      } else if (!bird && birdSpawnTimer > 0) {
          birdSpawnTimer--;
      }
    
      // Update bird (every BIRD_MOVE_FREQ ticks)
      birdMoveCounter++;
      if (birdMoveCounter >= BIRD_MOVE_FREQ) {
          birdMoveCounter = 0;
          if (bird) {
              updateBird();
          }
      }
    
      // Check ALL collisions
      checkAllCollisions();
    
      // Update visuals
      updateVisuals();
  }

  // Centralized collision detection
  function checkAllCollisions() {
      // Check for bonus food collisions
      checkBonusFoodCollisions();
    
      // Check for bird collisions
      checkBirdCollisions();
  }

  // Start Game
  function startGame() {
      console.log(`Starting game in ${gameMode} mode`);
    
      // Reset scores
      score1 = 0;
      score2 = 0;
      scoreP1Element.textContent = '0';
      scoreP2Element.textContent = '0';
    
      // Initialize board
      initBoard();
    
      // Initialize snake(s)
      initSnakes();
    
      // Place initial food
      placeFood();
    
      // Show/hide player 2 score based on game mode
      if (gameMode === 'single') {
          player2ScoreContainer.classList.add('hidden');
      } else {
          player2ScoreContainer.classList.remove('hidden');
      }
    
      // Hide game over screen
      gameOverElement.classList.add('hidden');
    
      // Initialize timers for bonus food and bird
      bonusFood = null;
      bird = null;
      bonusFoodSpawnTimer = Math.floor(Math.random() * 20) + 10; // 10-30 ticks initial delay
      birdSpawnTimer = Math.floor(Math.random() * 30) + 20; // 20-50 ticks initial delay
    
      // Reset counters
      bonusFoodMoveCounter = 0;
      birdMoveCounter = 0;
    
      // Start game loop
      isGameRunning = true;
      gameInterval = setInterval(updateGame, GAME_SPEED);
  }

  // Keyboard controls
  document.addEventListener('keydown', (event) => {
      if (!isGameRunning) return;
    
      // Player 1 controls (Arrow keys)
      switch (event.key) {
          case 'ArrowUp':
              if (direction1 !== 'down') {
                  nextDirection1 = 'up';
              }
              break;
          case 'ArrowDown':
              if (direction1 !== 'up') {
                  nextDirection1 = 'down';
              }
              break;
          case 'ArrowLeft':
              if (direction1 !== 'right') {
                  nextDirection1 = 'left';
              }
              break;
          case 'ArrowRight':
              if (direction1 !== 'left') {
                  nextDirection1 = 'right';
              }
              break;
      }
    
      // Player 2 controls (WASD) - only in local multiplayer
      if (gameMode === 'local') {
          switch (event.key.toLowerCase()) {
              case 'w':
                  if (direction2 !== 'down') {
                      nextDirection2 = 'up';
                  }
                  break;
              case 's':
                  if (direction2 !== 'up') {
                      nextDirection2 = 'down';
                  }
                  break;
              case 'a':
                  if (direction2 !== 'right') {
                      nextDirection2 = 'left';
                  }
                  break;
              case 'd':
                  if (direction2 !== 'left') {
                      nextDirection2 = 'right';
                  }
                  break;
          }
      }
  });

  // Mobile controls
  if (upButton) {
      upButton.addEventListener('click', () => {
          if (isGameRunning && direction1 !== 'down') {
              nextDirection1 = 'up';
          }
      });
  }

  if (downButton) {
      downButton.addEventListener('click', () => {
          if (isGameRunning && direction1 !== 'up') {
              nextDirection1 = 'down';
          }
      });
  }

  if (leftButton) {
      leftButton.addEventListener('click', () => {
          if (isGameRunning && direction1 !== 'right') {
              nextDirection1 = 'left';
          }
      });
  }

  if (rightButton) {
      rightButton.addEventListener('click', () => {
          if (isGameRunning && direction1 !== 'left') {
              nextDirection1 = 'right';
          }
      });
  }

  // Menu buttons
  onePlayerButton.addEventListener('click', () => {
      gameMode = 'single';
      titleScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
      startGame();
  });

  twoPlayerButton.addEventListener('click', () => {
      titleScreen.classList.add('hidden');
      multiplayerScreen.classList.remove('hidden');
  });

  localButton.addEventListener('click', () => {
      gameMode = 'local';
      multiplayerScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
      startGame();
  });

  cpuButton.addEventListener('click', () => {
      gameMode = 'cpu';
      multiplayerScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
      startGame();
  });

  backButton.addEventListener('click', () => {
      multiplayerScreen.classList.add('hidden');
      titleScreen.classList.remove('hidden');
  });

  playAgainButton.addEventListener('click', () => {
      gameOverElement.classList.add('hidden');
      startGame();
  });

  mainMenuButton.addEventListener('click', () => {
      gameOverElement.classList.add('hidden');
      gameScreen.classList.add('hidden');
      titleScreen.classList.remove('hidden');
  });

  // Initialize title screen on page load
  titleScreen.classList.remove('hidden');
  gameScreen.classList.add('hidden');
  multiplayerScreen.classList.add('hidden');
  gameOverElement.classList.add('hidden');
});