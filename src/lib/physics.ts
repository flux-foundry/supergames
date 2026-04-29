/**
 * Game constants and physics logic.
 */

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const GROUND_HEIGHT = 100;
export const BIRD_X = 150;
export const BIRD_SIZE = 28;
export const PIPE_WIDTH = 80;
export const PIPE_GAP = 140;
export const PIPE_SPAWN_DIST = 350;
export const GRAVITY = 0.25;
export const JUMP_VELOCITY = -6;
export const MAX_FALL_VELOCITY = 10;
export const TERMINAL_ROTATION = Math.PI / 2;

export interface BirdState {
  x: number;
  y: number;
  velocity: number;
  rotation: number;
  isDead: boolean;
  score: number;
}

export interface Pipe {
  x: number;
  openingY: number;
  baseY: number;
  gap: number;
  isMoving: boolean;
  phase: number;
  passed: boolean;
  id: string;
}

export interface GameState {
  player1: BirdState;
  player2: BirdState;
  pipes: Pipe[];
  gameStarted: boolean;
  gameOver: boolean;
  distance: number;
  countdown: number;
  paused: boolean;
  seed: number;
}

export const createInitialState = (seed?: number): GameState => ({
  player1: { x: BIRD_X, y: GAME_HEIGHT / 2, velocity: 0, rotation: 0, isDead: false, score: 0 },
  player2: { x: BIRD_X, y: GAME_HEIGHT / 2, velocity: 0, rotation: 0, isDead: false, score: 0 },
  pipes: [],
  gameStarted: false,
  gameOver: false,
  distance: 0,
  countdown: 0,
  paused: false,
  seed: seed ?? Math.floor(Math.random() * 1000000),
});

export const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

export const updateBird = (bird: BirdState, speed: number = 3) => {
  if (bird.isDead) {
    if (bird.y < GAME_HEIGHT - GROUND_HEIGHT - BIRD_SIZE/2) {
      bird.velocity += GRAVITY;
      bird.y += bird.velocity;
      bird.rotation = Math.min(TERMINAL_ROTATION, bird.rotation + 0.1);
    }
    bird.x -= speed;
    return;
  }

  bird.velocity += GRAVITY;
  bird.velocity = Math.min(bird.velocity, MAX_FALL_VELOCITY);
  bird.y += bird.velocity;

  // Rotation based on velocity
  if (bird.velocity < 0) {
    bird.rotation = -Math.PI / 6;
  } else {
    bird.rotation = Math.min(TERMINAL_ROTATION, bird.rotation + 0.05);
  }

  // Ground collision
  if (bird.y > GAME_HEIGHT - GROUND_HEIGHT - BIRD_SIZE / 2) {
    bird.y = GAME_HEIGHT - GROUND_HEIGHT - BIRD_SIZE / 2;
    bird.isDead = true;
  }
  
  // Sky ceiling
  if (bird.y < 0) {
    bird.y = 0;
    bird.velocity = 0;
  }
};

export const checkCollision = (bird: BirdState, pipe: Pipe): boolean => {
  if (bird.isDead) return false;

  const bxLeft = bird.x - BIRD_SIZE / 2;
  const bxRight = bird.x + BIRD_SIZE / 2;
  const byTop = bird.y - BIRD_SIZE / 2 + 4; // Add a small hitbox leniency
  const byBottom = bird.y + BIRD_SIZE / 2 - 4;

  const pxLeft = pipe.x;
  const pxRight = pipe.x + PIPE_WIDTH;
  
  // Basic AABB check
  if (bxRight > pxLeft && bxLeft < pxRight) {
    if (byTop < pipe.openingY || byBottom > pipe.openingY + pipe.gap) {
      return true;
    }
  }

  return false;
};

export const flap = (bird: BirdState) => {
  if (bird.isDead) return;
  bird.velocity = JUMP_VELOCITY;
};
