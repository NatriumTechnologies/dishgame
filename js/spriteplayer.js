/* spriteplayer.js
   Manages the Player Sprite: movement, axis-separated sprite collisions,
   8-directional animation frames, and held dish stack.
*/

export class SpritePlayer {
  constructor(game = null) {
    this.game = game;
    this.element = document.getElementById('player');
    if (this.element) {
      // Rendered directly on canvas for pixel-accurate alignment & depth sorting
      this.element.style.display = 'none';
    }

    // Logical position in 800x600 space
    this.x = 370;
    this.y = 380;

    // Sprite draw dimensions (matches 32x48 native pixel art at 1.75x)
    this.width = 56;
    this.height = 84;

    // Movement & progression stats
    this.pixelPerSecond = 195;
    this.washingSpeed = 1;
    this.carryCapacity = 1;
    this.score = 0;
    this.heldItems = [];
    this.isWashing = false;

    // Animation state
    this.direction = 'SOUTH';
    this.currentFrame = 0;
    this.frameTime = 0;
    this.frameDuration = 0.095;
    this.isMoving = false;

    this.frames = {
      'NORTH': {
        walking: [
          './assets/sprite/NORTHFRAME1.png', './assets/sprite/NORTHFRAME2.png',
          './assets/sprite/NORTHFRAME3.png', './assets/sprite/NORTHFRAME4.png',
          './assets/sprite/NORTHFRAME5.png', './assets/sprite/NORTHFRAME6.png',
          './assets/sprite/NORTHFRAME7.png', './assets/sprite/NORTHFRAME8.png'
        ],
        standing: ['./assets/sprite/STANDING-NORTH-FRAME.png']
      },
      'SOUTH': {
        walking: [
          './assets/sprite/SOUTHFRAME1.png', './assets/sprite/SOUTHFRAME2.png',
          './assets/sprite/SOUTHFRAME3.png', './assets/sprite/SOUTHFRAME4.png',
          './assets/sprite/SOUTHFRAME5.png', './assets/sprite/SOUTHFRAME6.png',
          './assets/sprite/SOUTHFRAME7.png', './assets/sprite/SOUTHFRAME8.png'
        ],
        standing: ['./assets/sprite/STANDING-SOUTH-FRAME.png']
      },
      'EAST': {
        walking: [
          './assets/sprite/EASTFRAME1.png', './assets/sprite/EASTFRAME2.png',
          './assets/sprite/EASTFRAME3.png', './assets/sprite/EASTFRAME4.png',
          './assets/sprite/EASTFRAME5.png', './assets/sprite/EASTFRAME6.png',
          './assets/sprite/EASTFRAME7.png', './assets/sprite/EASTFRAME8.png'
        ],
        standing: ['./assets/sprite/STANDING-EAST-FRAME.png']
      },
      'WEST': {
        walking: [
          './assets/sprite/WESTFRAME1.png', './assets/sprite/WESTFRAME2.png',
          './assets/sprite/WESTFRAME3.png', './assets/sprite/WESTFRAME4.png',
          './assets/sprite/WESTFRAME5.png', './assets/sprite/WESTFRAME6.png',
          './assets/sprite/WESTFRAME7.png', './assets/sprite/WESTFRAME8.png'
        ],
        standing: ['./assets/sprite/STANDING-WEST-FRAME.png']
      },
      'NORTH-EAST': {
        walking: [
          './assets/sprite/NORTH-EAST-FRAME1.png', './assets/sprite/NORTH-EAST-FRAME2.png',
          './assets/sprite/NORTH-EAST-FRAME3.png', './assets/sprite/NORTH-EAST-FRAME4.png',
          './assets/sprite/NORTH-EAST-FRAME5.png', './assets/sprite/NORTH-EAST-FRAME6.png',
          './assets/sprite/NORTH-EAST-FRAME7.png', './assets/sprite/NORTH-EAST-FRAME8.png'
        ],
        standing: ['./assets/sprite/STANDING-NORTH-EAST-FRAME.png']
      },
      'NORTH-WEST': {
        walking: [
          './assets/sprite/NORTH-WEST-FRAME1.png', './assets/sprite/NORTH-WEST-FRAME2.png',
          './assets/sprite/NORTH-WEST-FRAME3.png', './assets/sprite/NORTH-WEST-FRAME4.png',
          './assets/sprite/NORTH-WEST-FRAME5.png', './assets/sprite/NORTH-WEST-FRAME6.png',
          './assets/sprite/NORTH-WEST-FRAME7.png', './assets/sprite/NORTH-WEST-FRAME8.png'
        ],
        standing: ['./assets/sprite/STANDING-NORTH-WEST-FRAME.png']
      },
      'SOUTH-EAST': {
        walking: [
          './assets/sprite/SOUTH-EAST-FRAME1.png', './assets/sprite/SOUTH-EAST-FRAME2.png',
          './assets/sprite/SOUTH-EAST-FRAME3.png', './assets/sprite/SOUTH-EAST-FRAME4.png',
          './assets/sprite/SOUTH-EAST-FRAME5.png', './assets/sprite/SOUTH-EAST-FRAME6.png',
          './assets/sprite/SOUTH-EAST-FRAME7.png', './assets/sprite/SOUTH-EAST-FRAME8.png'
        ],
        standing: ['./assets/sprite/STANDING-SOUTH-EAST-FRAME.png']
      },
      'SOUTH-WEST': {
        walking: [
          './assets/sprite/SOUTH-WEST-FRAME1.png', './assets/sprite/SOUTH-WEST-FRAME2.png',
          './assets/sprite/SOUTH-WEST-FRAME3.png', './assets/sprite/SOUTH-WEST-FRAME4.png',
          './assets/sprite/SOUTH-WEST-FRAME5.png', './assets/sprite/SOUTH-WEST-FRAME6.png',
          './assets/sprite/SOUTH-WEST-FRAME7.png', './assets/sprite/SOUTH-WEST-FRAME8.png'
        ],
        standing: ['./assets/sprite/STANDING-SOUTH-WEST-FRAME.png']
      }
    };

    this.loadedFrames = {};
    this.currentSpriteUrl = this.frames.SOUTH.standing[0];
    this.preloadImages();
  }

  // Backward-compatible getter/setter for top held item
  get heldItem() {
    return this.heldItems.length > 0 ? this.heldItems[this.heldItems.length - 1] : null;
  }

  set heldItem(val) {
    if (val === null) {
      this.heldItems = [];
    } else if (this.heldItems.length === 0) {
      this.heldItems = [val];
    } else {
      this.heldItems[this.heldItems.length - 1] = val;
    }
  }

  canPickUp() {
    return this.heldItems.length < this.carryCapacity;
  }

  pushItem(item) {
    if (this.heldItems.length < this.carryCapacity) {
      this.heldItems.push(item);
      return true;
    }
    return false;
  }

  popItem() {
    return this.heldItems.pop() || null;
  }

  async preloadImages() {
    const allDirs = Object.keys(this.frames);
    let allUrls = [];
    for (const dir of allDirs) {
      allUrls.push(...this.frames[dir].walking, ...this.frames[dir].standing);
    }
    allUrls = [...new Set(allUrls)];

    await Promise.all(allUrls.map(url => new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        this.loadedFrames[url] = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    })));
  }

  /**
   * Tight solid collision box matching the actual non-transparent pixel body/feet
   * of the 32x48 sprite (normBBox x: 0.22..0.78, lower torso/feet y: 0.42..0.92).
   */
  getHitbox(x = this.x, y = this.y) {
    return {
      x: x + 13,
      y: y + 36,
      width: 30,
      height: 42
    };
  }

  /**
   * Interaction box slightly wider than the solid body so standing flush
   * against any counter/sink/shelf/staircase reliably triggers interaction.
   */
  getInteractBox(x = this.x, y = this.y) {
    return {
      x: x + 6,
      y: y + 14,
      width: this.width - 12,
      height: this.height - 16
    };
  }

  update(deltaMs, inputKeys) {
    const moveAmt = this.pixelPerSecond * (deltaMs / 1000);
    let dx = 0;
    let dy = 0;
    if (inputKeys.up)    dy -= 1;
    if (inputKeys.down)  dy += 1;
    if (inputKeys.left)  dx -= 1;
    if (inputKeys.right) dx += 1;

    // Normalize diagonal movement so diagonal speed is identical to cardinal speed
    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }

    dx *= moveAmt;
    dy *= moveAmt;

    this.isMoving = (dx !== 0 || dy !== 0);
    if (this.isMoving) {
      const newDir = this.computeDirection(inputKeys);
      if (newDir !== this.direction) {
        this.direction = newDir;
        this.currentFrame = 0;
        this.frameTime = 0;
      }
    }

    const maxW = this.game ? this.game.GAME_WIDTH : 800;
    const maxH = this.game ? this.game.GAME_HEIGHT : 600;
    const obstacles = this.game ? this.game.getCurrentObstacles() : [];

    // 1. Move along X axis and resolve X collisions independently (allows smooth wall/sprite sliding)
    const oldX = this.x;
    this.x += dx;
    const hbX = this.getHitbox(this.x, this.y);
    if (hbX.x < 8) {
      this.x += (8 - hbX.x);
    } else if (hbX.x + hbX.width > maxW - 8) {
      this.x -= (hbX.x + hbX.width - (maxW - 8));
    }
    const hbAfterClampX = this.getHitbox(this.x, this.y);
    for (const obs of obstacles) {
      if (this.game.checkCollision(hbAfterClampX, obs)) {
        this.x = oldX;
        break;
      }
    }

    // 2. Move along Y axis and resolve Y collisions independently
    const oldY = this.y;
    this.y += dy;
    const hbY = this.getHitbox(this.x, this.y);
    if (hbY.y < 8) {
      this.y += (8 - hbY.y);
    } else if (hbY.y + hbY.height > maxH - 8) {
      this.y -= (hbY.y + hbY.height - (maxH - 8));
    }
    const hbAfterClampY = this.getHitbox(this.x, this.y);
    for (const obs of obstacles) {
      if (this.game.checkCollision(hbAfterClampY, obs)) {
        this.y = oldY;
        break;
      }
    }

    this.animate(deltaMs);
  }

  computeDirection(keys) {
    const { up, down, left, right } = keys;
    if (up && right)   return 'NORTH-EAST';
    if (up && left)    return 'NORTH-WEST';
    if (down && right) return 'SOUTH-EAST';
    if (down && left)  return 'SOUTH-WEST';
    if (up)            return 'NORTH';
    if (down)          return 'SOUTH';
    if (left)          return 'WEST';
    if (right)         return 'EAST';
    return this.direction || 'SOUTH';
  }

  animate(deltaMs) {
    const dirSet = this.frames[this.direction] || this.frames.SOUTH;
    if (this.isMoving && dirSet.walking.length > 0) {
      this.frameTime += deltaMs / 1000;
      if (this.frameTime >= this.frameDuration) {
        this.currentFrame = (this.currentFrame + 1) % dirSet.walking.length;
        this.frameTime = 0;
      }
      this.currentSpriteUrl = dirSet.walking[this.currentFrame];
    } else {
      this.currentSpriteUrl = dirSet.standing[0];
      this.currentFrame = 0;
      this.frameTime = 0;
    }
  }

  getCurrentImage() {
    return this.loadedFrames[this.currentSpriteUrl] || null;
  }
}
