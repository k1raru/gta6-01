// Keyboard + mouse input with edge detection (pressed this frame).
const down = new Set();
const pressedSet = new Set();
let mouseX = 0;
let mouseY = 0;
let mousePressed = false;

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!e.repeat) {
      down.add(e.code);
      pressedSet.add(e.code);
    }
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mousePressed = true;
  });
}

export function isDown(code) {
  return down.has(code);
}

export function wasPressed(code) {
  return pressedSet.has(code);
}

export function consumeMousePress() {
  const p = mousePressed;
  mousePressed = false;
  return p;
}

export function mousePos() {
  return { x: mouseX, y: mouseY };
}

export function endFrame() {
  pressedSet.clear();
  mousePressed = false;
}

export function axis() {
  let x = 0;
  let y = 0;
  if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
  if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
  if (isDown('KeyW') || isDown('ArrowUp')) y -= 1;
  if (isDown('KeyS') || isDown('ArrowDown')) y += 1;
  return { x, y };
}
