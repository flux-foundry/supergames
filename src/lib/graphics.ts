/**
 * Procedural pixel-art rendering using Canvas API.
 */

export const drawBird = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number,
  frame: number,
  color: string = '#f8d020', // Classic yellow
  isDead: boolean = false
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  
  // Scale bird up for higher res
  ctx.scale(1.5, 1.5);

  const wingOffset = isDead ? 0 : [0, -2, 2][frame % 3];

  // Body Main
  ctx.fillStyle = color;
  ctx.fillRect(-12, -8, 24, 16);
  
  // Belly
  ctx.fillStyle = '#fffabb';
  ctx.fillRect(-10, 0, 16, 6);

  // Eye
  ctx.fillStyle = 'white';
  ctx.fillRect(4, -6, 6, 6);
  if (isDead) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(5, -5); ctx.lineTo(9, -1);
    ctx.moveTo(9, -5); ctx.lineTo(5, -1);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'black';
    ctx.fillRect(8, -4, 2, 2);
  }

  // Beak
  ctx.fillStyle = '#f07000';
  ctx.fillRect(10, -2, 8, 4);
  ctx.fillRect(10, 2, 6, 2);

  // Wing
  ctx.fillStyle = 'white';
  ctx.fillRect(-8, -2 + wingOffset, 10, 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.strokeRect(-8, -2 + wingOffset, 10, 6);

  // Outlines
  ctx.strokeStyle = '#303030';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.strokeRect(-12, -8, 24, 16);

  ctx.restore();
};

export const drawPipe = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  isTop: boolean
) => {
  const rimHeight = 32;
  const rimOverhang = 6;

  ctx.save();
  
  const pipeMainColor = '#73bf2e';
  const pipeDarkColor = '#558022';
  const pipeLightColor = '#9de64e';

  // Draw main body
  ctx.fillStyle = pipeMainColor;
  ctx.fillRect(x, isTop ? 0 : y, width, isTop ? y - rimHeight : height - y);
  
  // Highlight
  ctx.fillStyle = pipeLightColor;
  ctx.fillRect(x + 4, isTop ? 0 : y, 8, isTop ? y - rimHeight : height - y);
  ctx.fillStyle = pipeDarkColor;
  ctx.fillRect(x + width - 12, isTop ? 0 : y, 8, isTop ? y - rimHeight : height - y);

  // Draw rim
  const rimY = isTop ? y - rimHeight : y;
  ctx.fillStyle = pipeMainColor;
  ctx.fillRect(x - rimOverhang, rimY, width + rimOverhang * 2, rimHeight);
  
  // Rim highlights
  ctx.fillStyle = pipeLightColor;
  ctx.fillRect(x - rimOverhang + 4, rimY + 4, 8, rimHeight - 8);
  ctx.fillStyle = pipeDarkColor;
  ctx.fillRect(x + width + rimOverhang - 12, rimY + 4, 8, rimHeight - 8);

  // Outlines
  ctx.strokeStyle = '#303030';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, isTop ? 0 : y, width, isTop ? y - rimHeight : height - y);
  ctx.strokeRect(x - rimOverhang, rimY, width + rimOverhang * 2, rimHeight);

  ctx.restore();
};

export const drawFrog = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vy: number = 0,
  isCrouched: boolean = false,
  color: string = '#10b981' // green by default
) => {
  ctx.save();
  ctx.translate(x + 12, y + 16); // center

  if (isCrouched) {
    ctx.scale(1.1, 0.8);
  }

  // Frog pixel body
  ctx.fillStyle = color;
  ctx.fillRect(-10, -6, 20, 12);
  
  // Belly
  ctx.fillStyle = '#a7f3d0';
  ctx.fillRect(-6, 2, 12, 4);

  // Eyes
  ctx.fillStyle = 'white';
  ctx.fillRect(-8, -12, 6, 6);
  ctx.fillRect(2, -12, 6, 6);
  
  // Pupils
  ctx.fillStyle = 'black';
  ctx.fillRect(-6, -10, 2, 2);
  ctx.fillRect(4, -10, 2, 2);

  // Legs and Arms
  ctx.fillStyle = color;
  if (Math.abs(vy) > 1) { // Jumping
    // Extended legs
    ctx.fillRect(-12, 6, 4, 6);
    ctx.fillRect(8, 6, 4, 6);
    // Arms
    ctx.fillRect(-12, -4, 4, 6);
    ctx.fillRect(8, -4, 4, 6);
  } else { // Crouched
    ctx.fillRect(-12, 2, 6, 4);
    ctx.fillRect(6, 2, 6, 4);
  }

  // Outline for the body
  ctx.strokeStyle = '#064e3b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-10, -6, 20, 12);

  ctx.restore();
};

export const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, offsetX: number = 0) => {
  // Sky
  ctx.fillStyle = '#70c5ce';
  ctx.fillRect(0, 0, width, height);

  // Parallax clouds
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 15; i++) {
    const cx = ((i * 150) - (offsetX * 0.2)) % (width + 200);
    const resolvedCx = cx < -200 ? cx + width + 400 : cx;
    ctx.fillRect(resolvedCx, height - 200, 80, 50);
    ctx.fillRect(resolvedCx + 30, height - 230, 50, 80);
    ctx.fillRect(resolvedCx - 20, height - 170, 120, 60);
  }
};

export const drawGround = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetX: number
) => {
  const groundHeight = 100;
  const y = height - groundHeight;

  // Ground base
  ctx.fillStyle = '#ded895';
  ctx.fillRect(0, y, width, groundHeight);

  // Grass
  ctx.fillStyle = '#73bf2e';
  ctx.fillRect(0, y, width, 8);

  // Lines
  ctx.strokeStyle = '#558022';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = -offsetX % 30; i < width + 30; i += 30) {
    ctx.moveTo(i, y);
    ctx.lineTo(i - 15, y + 15);
  }
  ctx.stroke();

  // Dirt dots
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = -offsetX % 60; i < width + 60; i += 60) {
    ctx.fillRect(i + 15, y + 30, 15, 8);
    ctx.fillRect(i + 40, y + 60, 8, 8);
    ctx.fillRect(i + -10, y + 80, 20, 10);
  }
};
