/* game.js
   Core Game Logic — Multi-Floor (Upstairs Bar/Kitchen + Top-Right Staircase + Downstairs Basement & Buffet)
   with Tight Sprite Collisions, Y-Sorted Canvas Rendering, and Retro WebAudio SFX.
*/

import { SpritePlayer } from './spriteplayer.js';

export const Game = {
  initialized: false,
  player: null,
  canvas: null,
  ctx: null,
  inputKeys: { up: false, down: false, left: false, right: false, e: false },
  gameStarted: false,
  gamePaused: false,

  // Current floor: 'upstairs' (Bar & Dishwashing Kitchen) | 'basement' (Cellar & Buffet on other side of wall)
  currentFloor: 'upstairs',
  stairCooldownUntil: 0,
  floorBannerText: '',
  floorBannerUntil: 0,

  // Stats & counters
  totalCleanedDishes: 0,
  totalBuffetServed: 0,

  // Upstairs shelf storage
  storedDishes: { bowl: 0, plate: 0, cup: 0 },
  lastDishRemoval: { bowl: Date.now(), plate: Date.now(), cup: Date.now() },

  // Downstairs buffet storage (on the other side of the basement wall)
  buffetDishes: { bowl: 1, plate: 1, cup: 1 },
  lastBuffetConsumption: { bowl: Date.now(), plate: Date.now(), cup: Date.now() },
  buffetHotItem: 'plate',

  // Dirty dish queues in the Bar Bus Tub (upstairs) and Buffet Bus Tub (downstairs)
  barDirtyQueue: ['plate', 'bowl', 'cup', 'plate'],
  buffetDirtyQueue: ['bowl', 'plate', 'cup'],
  lastDirtySpawn: Date.now(),

  // Center table staging slots (upstairs & basement tables)
  upstairsTableItems: [],
  basementTableItems: [],

  MAX_DISHES_PER_TYPE: 5,
  MIN_DISHES_BEFORE_REMOVAL: 2,
  DISH_REMOVAL_INTERVAL: 7000,

  // Shop upgrade levels & costs
  upgradeLevels: { speed: 1, washing: 1, storage: 1, carry: 1 },
  upgradeCosts: { speed: 100, washing: 150, storage: 200, carry: 175 },

  // Washing progress & bubble particles
  washingProgress: 0,
  washingRateBase: 32,
  bubbles: [],
  floatingTexts: [],

  // Assets & Audio
  images: {},
  bgMusic: null,
  audioCtx: null,
  bgmVolume: 50,
  sfxVolume: 50,

  // Logical coordinate space
  GAME_WIDTH: 800,
  GAME_HEIGHT: 600,
  PLAYER_SIZE: 56,
  PLATE_SIZE: 68,
  BOWL_SIZE: 64,
  CUP_SIZE: 46,

  // Floor geometry, tight sprite hitboxes (matching actual non-transparent pixels), and interaction zones
  floors: {
    upstairs: {
      name: 'UPSTAIRS — BAR & KITCHEN',
      // Bar across top-center
      bar: {
        draw:     { x: 160, y: 16, width: 352, height: 136 },
        hitbox:   { x: 164, y: 20, width: 344, height: 118 },
        interact: { x: 155, y: 16, width: 362, height: 148 }
      },
      // Dirty Dish Bus Tub at right end of the Bar
      dishSpawn: {
        draw:     { x: 520, y: 38, width: 124, height: 132 },
        // bustub.png non-transparent pixels are norm=(0.21, 0.46, 0.58, 0.19)
        hitbox:   { x: 546, y: 98, width: 72, height: 28 },
        interact: { x: 518, y: 74, width: 126, height: 76 }
      },
      // Staircase in TOP RIGHT going down to Basement
      stairsDown: {
        draw:     { x: 668, y: 18, width: 112, height: 130 },
        // Side rails + top backstop are solid; bottom/front steps are walkable
        railLeft:  { x: 668, y: 18, width: 14, height: 118 },
        railRight: { x: 766, y: 18, width: 14, height: 118 },
        railTop:   { x: 668, y: 18, width: 112, height: 18 },
        trigger:   { x: 684, y: 40, width: 80, height: 86 },
        interact:  { x: 666, y: 20, width: 116, height: 142 }
      },
      // Washing Sink on the left
      sink: {
        draw:     { x: 42, y: 185, width: 110, height: 130 },
        // sink.png non-transparent pixels are norm=(0.16, 0.12, 0.69, 0.77)
        hitbox:   { x: 58, y: 202, width: 76, height: 98 },
        interact: { x: 34, y: 180, width: 130, height: 140 }
      },
      // Center Prep Table
      table: {
        draw:     { x: 325, y: 268, width: 150, height: 110 },
        // table.png non-transparent pixels are norm=(0.04, 0.03, 0.93, 0.93)
        hitbox:   { x: 332, y: 274, width: 136, height: 96 },
        interact: { x: 312, y: 254, width: 176, height: 136 }
      },
      // Clean Dish Shelf on bottom-right
      shelf: {
        draw:     { x: 615, y: 310, width: 155, height: 255 },
        // shelf.png non-transparent pixels are norm=(0.06, 0.09, 0.86, 0.82)
        hitbox:   { x: 625, y: 332, width: 134, height: 210 },
        zones: {
          bowl:  { drawX: 642, drawY: 334, x: 598, y: 324, width: 170, height: 72 },
          plate: { drawX: 642, drawY: 408, x: 598, y: 398, width: 170, height: 72 },
          cup:   { drawX: 642, drawY: 484, x: 598, y: 474, width: 170, height: 76 }
        }
      }
    },

    basement: {
      name: 'BASEMENT — CELLAR & BUFFET',
      // Staircase in TOP RIGHT going back up to Bar/Kitchen
      stairsUp: {
        draw:      { x: 668, y: 18, width: 112, height: 130 },
        railLeft:  { x: 668, y: 18, width: 14, height: 118 },
        railRight: { x: 766, y: 18, width: 14, height: 118 },
        railTop:   { x: 668, y: 18, width: 112, height: 18 },
        trigger:   { x: 684, y: 40, width: 80, height: 86 },
        interact:  { x: 666, y: 20, width: 116, height: 142 }
      },
      // Solid dividing wall across the basement separating the stairs side from the Buffet room!
      // Doorway opening is at x: 118..248 so the player walks around through the doorway to reach the other side.
      wallLeft:  { x: 0,   y: 232, width: 118, height: 36 },
      doorway:   { x: 118, y: 232, width: 130, height: 36 },
      wallRight: { x: 248, y: 232, width: 552, height: 36 },

      // Cellar Staging Table on the upper side of the wall
      cellarTable: {
        draw:     { x: 350, y: 74, width: 140, height: 98 },
        hitbox:   { x: 356, y: 80, width: 128, height: 86 },
        interact: { x: 338, y: 62, width: 164, height: 122 }
      },

      // Buffet Counter on the OTHER side of the dividing wall (lower basement room)
      buffet: {
        draw:   { x: 140, y: 418, width: 384, height: 128 },
        hitbox: { x: 144, y: 434, width: 376, height: 104 },
        zones: {
          bowl:  { label: 'BOWLS',  drawX: 182, drawY: 446, x: 136, y: 404, width: 130, height: 150 },
          plate: { label: 'PLATES', drawX: 298, drawY: 446, x: 267, y: 404, width: 130, height: 150 },
          cup:   { label: 'CUPS',   drawX: 414, drawY: 446, x: 398, y: 404, width: 130, height: 150 }
        }
      },

      // Buffet Dirty Bus Tub on the right side of the Buffet room
      buffetBustub: {
        draw:     { x: 580, y: 412, width: 124, height: 132 },
        hitbox:   { x: 606, y: 472, width: 72, height: 28 },
        interact: { x: 578, y: 448, width: 126, height: 76 }
      }
    }
  },

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = this.GAME_WIDTH;
    this.canvas.height = this.GAME_HEIGHT;

    this.loadAssets();
    this.player = this.player || new SpritePlayer(this);
    this.player.game = this;

    // Background Music
    this.bgMusic = new Audio('./assets/music.mp3');
    this.bgMusic.loop = true;
    this.updateBGMVolume();

    // Periodic simulation tick (bar patrons & downstairs buffet diners)
    setInterval(() => this.simulationTick(), 1000);

    // Input setup
    this.setupInput();
  },

  loadAssets() {
    const toLoad = [
      'dirtyPlate', 'cleanPlate', 'dirtyBowl', 'cleanBowl',
      'dirtyCup', 'cleanCup', 'shelf', 'sink', 'bustub', 'table', 'floor',
      'bubble', 'bar', 'stairsDown', 'stairsUp', 'buffet'
    ];
    toLoad.forEach(name => {
      const img = new Image();
      img.src = `./assets/art/${name}.png`;
      this.images[name] = img;
    });
  },

  /**
   * Returns all solid collision rectangles for the active floor.
   */
  getCurrentObstacles() {
    if (this.currentFloor === 'upstairs') {
      const u = this.floors.upstairs;
      return [
        u.bar.hitbox,
        u.dishSpawn.hitbox,
        u.stairsDown.railLeft,
        u.stairsDown.railRight,
        u.stairsDown.railTop,
        u.sink.hitbox,
        u.table.hitbox,
        u.shelf.hitbox
      ];
    } else {
      const b = this.floors.basement;
      return [
        b.stairsUp.railLeft,
        b.stairsUp.railRight,
        b.stairsUp.railTop,
        b.wallLeft,
        b.wallRight,
        b.cellarTable.hitbox,
        b.buffet.hitbox,
        b.buffetBustub.hitbox
      ];
    }
  },

  setupInput() {
    window.addEventListener('keydown', e => {
      const key = e.key.toLowerCase();
      switch (key) {
        case 'w': case 'arrowup':
          this.inputKeys.up = true;
          break;
        case 's': case 'arrowdown':
          this.inputKeys.down = true;
          break;
        case 'a': case 'arrowleft':
          this.inputKeys.left = true;
          break;
        case 'd': case 'arrowright':
          this.inputKeys.right = true;
          break;
        case 'e':
          if (!e.repeat) {
            this.inputKeys.e = true;
            if (this.gameStarted && !this.gamePaused && !this.player.isWashing) {
              this.handleInteraction();
            }
          }
          break;
        case 'escape':
          if (this.gameStarted) {
            const openModal = document.querySelector('.modal[style*="block"]');
            if (openModal) {
              openModal.style.display = 'none';
              document.getElementById('modalOverlay').style.display = 'none';
              if (document.getElementById('pauseOverlay').style.display !== 'flex') {
                this.resumeGame();
              }
            } else {
              this.gamePaused ? this.resumeGame() : this.pauseGame();
            }
          }
          break;
        case 'f':
          this.toggleFullscreen();
          break;
      }
    });

    window.addEventListener('keyup', e => {
      const key = e.key.toLowerCase();
      switch (key) {
        case 'w': case 'arrowup':    this.inputKeys.up = false; break;
        case 's': case 'arrowdown':  this.inputKeys.down = false; break;
        case 'a': case 'arrowleft':  this.inputKeys.left = false; break;
        case 'd': case 'arrowright': this.inputKeys.right = false; break;
        case 'e':
          this.inputKeys.e = false;
          this.player.isWashing = false;
          break;
      }
    });
  },

  playSfx(type) {
    if (this.sfxVolume <= 0) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) this.audioCtx = new AudioContextClass();
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const vol = (this.sfxVolume / 100) * 0.16;
      gain.gain.setValueAtTime(vol, now);

      if (type === 'pickup') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'clean') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.06);
        osc.frequency.setValueAtTime(783.99, now + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (type === 'store') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(587.33, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'buffet') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.05);
        osc.frequency.setValueAtTime(783.99, now + 0.10);
        osc.frequency.setValueAtTime(1046.5, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'stairs') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.linearRampToValueAtTime(160, now + 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'upgrade') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      }
    } catch (_) {}
  },

  addFloatingText(text, x, y, color = '#00ffcc') {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      alpha: 1.0,
      vy: -38
    });
  },

  startGame() {
    if (!this.gameStarted) {
      this.gameStarted = true;
      this.gamePaused = false;
      this.currentFloor = 'upstairs';
      this.showFloorBanner('UPSTAIRS: BAR & KITCHEN');
      document.getElementById('pauseOverlay').style.display = 'none';
      this.bgMusic.currentTime = 0;
      this.bgMusic.play().catch(() => {});
      this.lastTime = performance.now();
      requestAnimationFrame(t => this.gameLoop(t));
    }
  },

  pauseGame() {
    this.gamePaused = true;
    this.bgMusic.pause();
    document.getElementById('pauseOverlay').style.display = 'flex';
  },

  resumeGame() {
    if (!this.gameStarted) return;
    this.gamePaused = false;
    this.bgMusic.play().catch(() => {});
    document.getElementById('pauseOverlay').style.display = 'none';
    this.lastTime = performance.now();
    requestAnimationFrame(t => this.gameLoop(t));
  },

  returnToMainMenu() {
    this.gamePaused = false;
    this.gameStarted = false;
    this.currentFloor = 'upstairs';
    this.player.score = 0;
    this.player.heldItems = [];
    this.player.x = 370;
    this.player.y = 380;
    this.storedDishes = { bowl: 0, plate: 0, cup: 0 };
    this.buffetDishes = { bowl: 1, plate: 1, cup: 1 };
    this.barDirtyQueue = ['plate', 'bowl', 'cup', 'plate'];
    this.buffetDirtyQueue = ['bowl', 'plate', 'cup'];
    this.upstairsTableItems = [];
    this.basementTableItems = [];
    this.totalCleanedDishes = 0;
    this.totalBuffetServed = 0;
    this.updateScore();
    this.updateCleanedDishesDisplay();

    document.getElementById('pauseOverlay').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('inGameMenu').style.display = 'none';
    document.getElementById('mobileControls').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';

    this.bgMusic.pause();
    this.bgMusic.currentTime = 0;
  },

  showFloorBanner(text) {
    this.floorBannerText = text;
    this.floorBannerUntil = performance.now() + 2000;
  },

  switchFloor(targetFloor) {
    const now = performance.now();
    if (now < this.stairCooldownUntil) return;
    this.stairCooldownUntil = now + 900;
    this.currentFloor = targetFloor;
    this.player.isWashing = false;
    this.washingProgress = 0;
    // Place player just in front of the top-right staircase landing
    this.player.x = 696;
    this.player.y = 148;
    this.player.direction = 'SOUTH';
    this.playSfx('stairs');
    if (targetFloor === 'basement') {
      this.showFloorBanner('BASEMENT — GO AROUND WALL TO BUFFET');
    } else {
      this.showFloorBanner('UPSTAIRS — BAR & DISHWASHING KITCHEN');
    }
  },

  gameLoop(currentTime) {
    if (this.gamePaused || !this.gameStarted) return;
    const delta = Math.min(currentTime - this.lastTime, 40);
    this.lastTime = currentTime;

    this.player.update(delta, this.inputKeys);
    this.checkStaircaseWalkTrigger();
    this.updateWashingProgress(delta);
    this.updateParticles(delta);
    this.updatePrompt();
    this.drawScene();

    requestAnimationFrame(t => this.gameLoop(t));
  },

  checkStaircaseWalkTrigger() {
    const now = performance.now();
    if (now < this.stairCooldownUntil) return;
    const hb = this.player.getHitbox();
    if (this.currentFloor === 'upstairs') {
      if (this.checkCollision(hb, this.floors.upstairs.stairsDown.trigger)) {
        this.switchFloor('basement');
      }
    } else {
      if (this.checkCollision(hb, this.floors.basement.stairsUp.trigger)) {
        this.switchFloor('upstairs');
      }
    }
  },

  updateParticles(deltaMs) {
    const dt = deltaMs / 1000;
    // Spawn wash bubbles when washing
    if (this.player.isWashing && this.currentFloor === 'upstairs') {
      if (Math.random() < 0.35) {
        const sink = this.floors.upstairs.sink.draw;
        this.bubbles.push({
          x: sink.x + 28 + Math.random() * 52,
          y: sink.y + 35 + Math.random() * 25,
          size: 12 + Math.random() * 14,
          vy: -(30 + Math.random() * 25),
          vx: (Math.random() - 0.5) * 18,
          alpha: 0.95
        });
      }
    }
    this.bubbles.forEach(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.alpha -= 0.7 * dt;
    });
    this.bubbles = this.bubbles.filter(b => b.alpha > 0);

    this.floatingTexts.forEach(ft => {
      ft.y += ft.vy * dt;
      ft.alpha -= 0.85 * dt;
    });
    this.floatingTexts = this.floatingTexts.filter(ft => ft.alpha > 0);
  },

  drawScene() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;

    if (this.currentFloor === 'upstairs') {
      this.drawUpstairs(ctx);
    } else {
      this.drawBasement(ctx);
    }

    // Draw floating score/feedback popups
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = 'bold 14px "Press Start 2P", monospace';
      ctx.fillStyle = '#000';
      ctx.fillText(ft.text, ft.x + 2, ft.y + 2);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // Draw top-center Floor Indicator Badge
    this.drawFloorHUD(ctx);
  },

  drawUpstairs(ctx) {
    const u = this.floors.upstairs;

    // 1. Floor tiles
    if (this.images.floor && this.images.floor.complete) {
      ctx.drawImage(this.images.floor, 0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
    } else {
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
    }

    // Subtle warm bar rug / runner along the top bar area
    ctx.fillStyle = 'rgba(92, 34, 28, 0.38)';
    ctx.fillRect(152, 132, 368, 28);
    ctx.strokeStyle = 'rgba(218, 175, 52, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(152, 132, 368, 28);

    // 2. Top Bar Counter
    if (this.images.bar && this.images.bar.complete) {
      ctx.drawImage(this.images.bar, u.bar.draw.x, u.bar.draw.y, u.bar.draw.width, u.bar.draw.height);
    }
    this.drawPixelTag(ctx, 'THE BAR', u.bar.draw.x + 135, u.bar.draw.y + 12, '#ffd166');

    // 3. Top-Right Staircase going down to Basement
    if (this.images.stairsDown && this.images.stairsDown.complete) {
      ctx.drawImage(
        this.images.stairsDown,
        u.stairsDown.draw.x,
        u.stairsDown.draw.y,
        u.stairsDown.draw.width,
        u.stairsDown.draw.height
      );
    }
    this.drawPixelTag(ctx, 'BASEMENT v', u.stairsDown.draw.x + 8, u.stairsDown.draw.y + 136, '#7bdff2');

    // 4. Bar Bus Tub (Dirty Dish Return)
    if (this.images.bustub && this.images.bustub.complete) {
      ctx.drawImage(
        this.images.bustub,
        u.dishSpawn.draw.x,
        u.dishSpawn.draw.y,
        u.dishSpawn.draw.width,
        u.dishSpawn.draw.height
      );
    }
    // Render visible stacked dirty dishes inside the Bar Bus Tub
    const previewCount = Math.min(4, this.barDirtyQueue.length);
    for (let i = 0; i < previewCount; i++) {
      const dType = this.barDirtyQueue[i];
      const imgKey = 'dirty' + dType.charAt(0).toUpperCase() + dType.slice(1);
      const dImg = this.images[imgKey];
      if (dImg && dImg.complete) {
        ctx.drawImage(
          dImg,
          u.dishSpawn.draw.x + 36 + (i * 8),
          u.dishSpawn.draw.y + 42 - (i * 4),
          34,
          34
        );
      }
    }
    this.drawPixelTag(
      ctx,
      `DIRTY: ${this.barDirtyQueue.length}`,
      u.dishSpawn.draw.x + 22,
      u.dishSpawn.draw.y + 122,
      this.barDirtyQueue.length > 0 ? '#ff9f1c' : '#cccccc'
    );

    // 5. Left Washing Sink
    if (this.images.sink && this.images.sink.complete) {
      ctx.save();
      ctx.translate(u.sink.draw.x + u.sink.draw.width, u.sink.draw.y);
      ctx.scale(-1, 1);
      ctx.drawImage(this.images.sink, 0, 0, u.sink.draw.width, u.sink.draw.height);
      ctx.restore();
    }
    this.drawPixelTag(ctx, 'WASH SINK', u.sink.draw.x + 12, u.sink.draw.y + 128, '#a8dadc');

    // 6. Center Prep Table + any staged dishes on it
    if (this.images.table && this.images.table.complete) {
      ctx.drawImage(
        this.images.table,
        u.table.draw.x,
        u.table.draw.y,
        u.table.draw.width,
        u.table.draw.height
      );
    }
    this.drawTableItems(ctx, this.upstairsTableItems, u.table.draw);

    // 7. Clean Dish Storage Shelf (bottom-right)
    if (this.images.shelf && this.images.shelf.complete) {
      ctx.drawImage(
        this.images.shelf,
        u.shelf.draw.x,
        u.shelf.draw.y,
        u.shelf.draw.width,
        u.shelf.draw.height
      );
      this.drawPixelTag(ctx, 'SHELF', u.shelf.draw.x + 48, u.shelf.draw.y + 10, '#f4a261');

      const labels = { bowl: 'BOWLS', plate: 'PLATES', cup: 'CUPS' };
      Object.entries(u.shelf.zones).forEach(([type, zone]) => {
        const count = this.storedDishes[type] || 0;
        const itemKey = 'clean' + type.charAt(0).toUpperCase() + type.slice(1);
        const image = this.images[itemKey];
        const drawSize = type === 'cup' ? 38 : 48;

        if (image && image.complete) {
          ctx.save();
          ctx.globalAlpha = count > 0 ? 1.0 : 0.25;
          ctx.drawImage(image, zone.drawX - 6, zone.drawY + 8, drawSize, drawSize);
          ctx.restore();
        }

        ctx.font = '9px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffd166';
        ctx.fillText(labels[type], zone.drawX + 42, zone.drawY + 24);

        ctx.font = '11px "Press Start 2P", monospace';
        ctx.fillStyle = count > 0 ? '#ffffff' : 'rgba(255,255,255,0.45)';
        ctx.fillText(`${count}/${this.MAX_DISHES_PER_TYPE}`, zone.drawX + 42, zone.drawY + 44);
      });
    }

    // 8. Draw Player & Held Dish Stack
    this.drawPlayerAndHeld(ctx);

    // 9. Draw Washing Bubble Particles
    for (const b of this.bubbles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, b.alpha);
      if (this.images.bubble && this.images.bubble.complete) {
        ctx.drawImage(this.images.bubble, b.x, b.y, b.size, b.size);
      } else {
        ctx.strokeStyle = '#7bdff2';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  drawBasement(ctx) {
    const b = this.floors.basement;

    // 1. Subterranean stone tile floor
    if (this.images.floor && this.images.floor.complete) {
      ctx.drawImage(this.images.floor, 0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
      // Cool dark cellar tint overlay so basement looks distinct from upstairs
      ctx.fillStyle = 'rgba(14, 20, 34, 0.48)';
      ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
    } else {
      ctx.fillStyle = '#222733';
      ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
    }

    // Warm carpet area in the downstairs Buffet Dining Room (other side of the wall, y > 268)
    ctx.fillStyle = 'rgba(110, 24, 32, 0.28)';
    ctx.fillRect(40, 286, 720, 290);
    ctx.strokeStyle = 'rgba(218, 175, 52, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 286, 720, 290);

    this.drawPixelTag(
      ctx,
      `DOWNSTAIRS BUFFET (+25 PTS | RUSH: ${this.buffetHotItem.toUpperCase()} +45)`,
      175,
      304,
      '#ffd166'
    );

    // 2. Top-Right Staircase going UP to Bar & Kitchen
    if (this.images.stairsUp && this.images.stairsUp.complete) {
      ctx.drawImage(
        this.images.stairsUp,
        b.stairsUp.draw.x,
        b.stairsUp.draw.y,
        b.stairsUp.draw.width,
        b.stairsUp.draw.height
      );
    }
    this.drawPixelTag(ctx, 'UPSTAIRS ^', b.stairsUp.draw.x + 8, b.stairsUp.draw.y + 136, '#ffd166');

    // 3. Upper Cellar Staging Table
    if (this.images.table && this.images.table.complete) {
      ctx.drawImage(
        this.images.table,
        b.cellarTable.draw.x,
        b.cellarTable.draw.y,
        b.cellarTable.draw.width,
        b.cellarTable.draw.height
      );
    }
    this.drawTableItems(ctx, this.basementTableItems, b.cellarTable.draw);

    // 4. Dividing Wall Across the Basement (with Doorway Opening on the left)
    this.drawBrickWallSegment(ctx, b.wallLeft);
    this.drawBrickWallSegment(ctx, b.wallRight);

    // Doorway threshold & arrow indicator
    ctx.fillStyle = 'rgba(218, 175, 52, 0.25)';
    ctx.fillRect(b.doorway.x, b.doorway.y + 4, b.doorway.width, b.doorway.height - 8);
    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.doorway.x, b.doorway.y + 4, b.doorway.width, b.doorway.height - 8);
    this.drawPixelTag(ctx, 'DOORWAY', b.doorway.x + 26, b.doorway.y + 12, '#fefae0');

    // 5. Downstairs Buffet Counter (on the OTHER side of the wall!)
    if (this.images.buffet && this.images.buffet.complete) {
      ctx.drawImage(
        this.images.buffet,
        b.buffet.draw.x,
        b.buffet.draw.y,
        b.buffet.draw.width,
        b.buffet.draw.height
      );
    }

    // Draw clean dish stacks & counts on each of the 3 Buffet stations
    Object.entries(b.buffet.zones).forEach(([type, zone]) => {
      const count = this.buffetDishes[type] || 0;
      const isHot = (this.buffetHotItem === type);
      const itemKey = 'clean' + type.charAt(0).toUpperCase() + type.slice(1);
      const img = this.images[itemKey];

      if (img && img.complete && count > 0) {
        const stackDraw = Math.min(3, count);
        for (let s = 0; s < stackDraw; s++) {
          ctx.drawImage(img, zone.drawX + 12, zone.drawY - 30 - (s * 5), 44, 44);
        }
      }

      const tagColor = isHot ? '#00f5d4' : '#ffffff';
      this.drawPixelTag(
        ctx,
        `${zone.label} ${count}/${this.MAX_DISHES_PER_TYPE}${isHot ? '*' : ''}`,
        zone.drawX - 16,
        zone.drawY + 86,
        tagColor
      );
    });

    // 6. Buffet Dirty Bus Tub (right side of Buffet room)
    if (this.images.bustub && this.images.bustub.complete) {
      ctx.drawImage(
        this.images.bustub,
        b.buffetBustub.draw.x,
        b.buffetBustub.draw.y,
        b.buffetBustub.draw.width,
        b.buffetBustub.draw.height
      );
    }
    const bPreview = Math.min(4, this.buffetDirtyQueue.length);
    for (let i = 0; i < bPreview; i++) {
      const dType = this.buffetDirtyQueue[i];
      const imgKey = 'dirty' + dType.charAt(0).toUpperCase() + dType.slice(1);
      const dImg = this.images[imgKey];
      if (dImg && dImg.complete) {
        ctx.drawImage(
          dImg,
          b.buffetBustub.draw.x + 36 + (i * 8),
          b.buffetBustub.draw.y + 42 - (i * 4),
          34,
          34
        );
      }
    }
    this.drawPixelTag(
      ctx,
      `BUFFET TUB: ${this.buffetDirtyQueue.length}`,
      b.buffetBustub.draw.x + 8,
      b.buffetBustub.draw.y + 122,
      this.buffetDirtyQueue.length > 0 ? '#ff9f1c' : '#cccccc'
    );

    // 7. Draw Player & Held Dish Stack
    this.drawPlayerAndHeld(ctx);
  },

  drawBrickWallSegment(ctx, rect) {
    // Base mortar & dark stone top cap
    ctx.fillStyle = '#3d2b24';
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Brick course rows
    const brickW = 24;
    const brickH = 10;
    for (let row = 0; row < 3; row++) {
      const by = rect.y + 4 + row * (brickH + 1);
      const offset = (row % 2) * 12;
      for (let bx = rect.x; bx < rect.x + rect.width; bx += brickW) {
        const x0 = Math.max(rect.x, bx - offset);
        const x1 = Math.min(rect.x + rect.width, bx - offset + brickW - 2);
        if (x1 > x0) {
          ctx.fillStyle = (row + Math.floor(bx / brickW)) % 2 === 0 ? '#7f392b' : '#6b2d21';
          ctx.fillRect(x0, by, x1 - x0, brickH);
        }
      }
    }

    // Wall top & bottom trim
    ctx.fillStyle = '#221815';
    ctx.fillRect(rect.x, rect.y, rect.width, 4);
    ctx.fillRect(rect.x, rect.y + rect.height - 3, rect.width, 3);
  },

  drawTableItems(ctx, items, tableDraw) {
    items.forEach((item, idx) => {
      const prefix = item.state === 'clean' ? 'clean' : 'dirty';
      const cap = item.type.charAt(0).toUpperCase() + item.type.slice(1);
      const img = this.images[prefix + cap];
      if (img && img.complete) {
        ctx.drawImage(
          img,
          tableDraw.x + 16 + idx * 38,
          tableDraw.y + 16,
          42,
          42
        );
      }
    });
  },

  drawPlayerAndHeld(ctx) {
    // Subtle ground shadow under player feet
    const hb = this.player.getHitbox();
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(
      hb.x + hb.width / 2,
      hb.y + hb.height - 2,
      hb.width * 0.55,
      7,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // Draw player sprite frame
    const pImg = this.player.getCurrentImage();
    if (pImg && pImg.complete) {
      ctx.drawImage(pImg, this.player.x, this.player.y, this.player.width, this.player.height);
    }

    // Draw held dish stack next to player hands
    if (this.player.heldItems.length > 0) {
      const timeNow = performance.now() / 280;
      const floatOffset = 3 * Math.sin(timeNow);
      this.player.heldItems.forEach((item, index) => {
        const prefix = (item.state === 'clean') ? 'clean' : 'dirty';
        const capitalType = item.type.charAt(0).toUpperCase() + item.type.slice(1);
        const itemImg = this.images[prefix + capitalType];
        if (itemImg && itemImg.complete) {
          let drawSize = 48;
          if (item.type === 'plate') drawSize = this.PLATE_SIZE * 0.72;
          if (item.type === 'bowl')  drawSize = this.BOWL_SIZE * 0.72;
          if (item.type === 'cup')   drawSize = this.CUP_SIZE * 0.72;

          const drawX = this.player.x + 36;
          const drawY = this.player.y + 8 + floatOffset - (index * 10);
          ctx.drawImage(itemImg, drawX, drawY, drawSize, drawSize);
        }
      });

      if (this.player.carryCapacity > 1) {
        this.drawPixelTag(
          ctx,
          `${this.player.heldItems.length}/${this.player.carryCapacity}`,
          this.player.x + 42,
          this.player.y + 2,
          '#00f5d4'
        );
      }
    }
  },

  drawPixelTag(ctx, text, x, y, color = '#ffffff') {
    ctx.save();
    ctx.font = '9px "Press Start 2P", monospace';
    const metrics = ctx.measureText(text);
    const padX = 5;
    const padY = 4;
    const w = metrics.width + padX * 2;
    const h = 15;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(x - padX, y - 10, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - padX, y - 10, w, h);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  },

  drawFloorHUD(ctx) {
    const floorTitle = this.currentFloor === 'upstairs'
      ? 'FLOOR: UPSTAIRS (BAR & KITCHEN)'
      : 'FLOOR: BASEMENT (BUFFET DOWNSTAIRS)';
    this.drawPixelTag(ctx, floorTitle, 255, 14, '#00f5d4');

    if (performance.now() < this.floorBannerUntil && this.floorBannerText) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
      ctx.fillRect(140, 260, 520, 48);
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 3;
      ctx.strokeRect(140, 260, 520, 48);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.floorBannerText, 400, 290);
      ctx.restore();
    }
  },

  updateWashingProgress(deltaMs) {
    const progressBar = document.getElementById('progressBar');
    const washingProgressElement = document.getElementById('washingProgress');

    // Verify player is still on the upstairs floor, near the sink, holding E, and has a dirty dish
    const dirtyDish = [...this.player.heldItems].reverse().find(i => i.state === 'dirty');
    const nearSink = (
      this.currentFloor === 'upstairs' &&
      this.checkCollision(this.player.getInteractBox(), this.floors.upstairs.sink.interact)
    );

    if (this.player.isWashing && (!nearSink || !dirtyDish || !this.inputKeys.e)) {
      this.player.isWashing = false;
    }

    if (this.player.isWashing && dirtyDish) {
      washingProgressElement.style.display = 'block';
      const washRate = this.washingRateBase * this.player.washingSpeed * (deltaMs / 1000);
      this.washingProgress += washRate;
      progressBar.style.width = `${Math.min(100, this.washingProgress)}%`;

      if (this.washingProgress >= 100) {
        dirtyDish.state = 'clean';
        const pts = Math.round(10 * this.player.washingSpeed);
        this.player.score += pts;
        this.totalCleanedDishes++;
        this.updateScore();
        this.updateCleanedDishesDisplay();
        this.playSfx('clean');
        this.addFloatingText(`+${pts} CLEAN!`, this.player.x, this.player.y - 10, '#4ade80');

        this.washingProgress = 0;
        // If another dirty dish is in the player's stack and E is still held, keep washing next dish!
        const nextDirty = this.player.heldItems.find(i => i.state === 'dirty');
        if (!nextDirty) {
          this.player.isWashing = false;
          washingProgressElement.style.display = 'none';
        }
      }
    } else {
      this.washingProgress = 0;
      progressBar.style.width = '0%';
      washingProgressElement.style.display = 'none';
    }
  },

  updatePrompt() {
    const promptText = document.getElementById('promptText');
    const pBox = this.player.getInteractBox();
    const topItem = this.player.heldItem;
    const hasDirty = this.player.heldItems.some(i => i.state === 'dirty');
    const hasClean = this.player.heldItems.some(i => i.state === 'clean');

    if (this.currentFloor === 'upstairs') {
      const u = this.floors.upstairs;
      if (this.checkCollision(pBox, u.stairsDown.interact)) {
        promptText.textContent = 'Walk onto Stairs or Press "E" -> Go Down to Basement Buffet';
        return;
      }
      if (hasDirty && this.checkCollision(pBox, u.sink.interact)) {
        promptText.textContent = 'Hold "E" to Wash Dirty Dishes';
        return;
      }
      if (this.checkCollision(pBox, u.dishSpawn.interact) || this.checkCollision(pBox, u.bar.interact)) {
        if (this.player.canPickUp()) {
          promptText.textContent = 'Press "E" to Pick Up Dirty Dish from Bar';
          return;
        } else {
          promptText.textContent = 'Hands Full! Wash Dishes at the Sink';
          return;
        }
      }
      for (const [type, zone] of Object.entries(u.shelf.zones)) {
        if (this.checkCollision(pBox, zone)) {
          const matchingClean = this.player.heldItems.find(i => i.state === 'clean' && i.type === type);
          if (matchingClean) {
            promptText.textContent = `Press "E" to Store Clean ${type.toUpperCase()} (+10) or Take Downstairs to Buffet (+25)`;
            return;
          } else if (this.storedDishes[type] > 0 && this.player.canPickUp()) {
            promptText.textContent = `Press "E" to Take Clean ${type.toUpperCase()} for Downstairs Buffet`;
            return;
          } else if (hasClean) {
            promptText.textContent = `${type.toUpperCase()} Shelf — Put matching dish here or take to Basement Buffet!`;
            return;
          }
        }
      }
      if (this.checkCollision(pBox, u.table.interact)) {
        if (topItem && this.upstairsTableItems.length < 3) {
          promptText.textContent = 'Press "E" to Set Dish on Prep Table';
          return;
        } else if (!topItem && this.upstairsTableItems.length > 0) {
          promptText.textContent = 'Press "E" to Pick Up Dish from Prep Table';
          return;
        }
      }
    } else {
      // Basement prompts
      const b = this.floors.basement;
      if (this.checkCollision(pBox, b.stairsUp.interact)) {
        promptText.textContent = 'Walk onto Stairs or Press "E" -> Go Up to Bar & Kitchen';
        return;
      }
      for (const [type, zone] of Object.entries(b.buffet.zones)) {
        if (this.checkCollision(pBox, zone)) {
          const matchingClean = this.player.heldItems.find(i => i.state === 'clean' && i.type === type);
          if (matchingClean) {
            const pts = this.buffetHotItem === type ? 45 : 25;
            promptText.textContent = `Press "E" to Stock Buffet ${zone.label} (+${pts} PTS!)`;
            return;
          } else {
            promptText.textContent = `Buffet ${zone.label} Station — Bring Clean ${type.toUpperCase()}S here!`;
            return;
          }
        }
      }
      if (this.checkCollision(pBox, b.buffetBustub.interact)) {
        if (this.player.canPickUp()) {
          promptText.textContent = 'Press "E" to Collect Dirty Dish from Buffet Tub';
          return;
        } else {
          promptText.textContent = 'Hands Full! Take Dirty Dishes Upstairs to Wash';
          return;
        }
      }
      if (this.checkCollision(pBox, b.cellarTable.interact)) {
        if (topItem && this.basementTableItems.length < 3) {
          promptText.textContent = 'Press "E" to Set Dish on Cellar Table';
          return;
        } else if (!topItem && this.basementTableItems.length > 0) {
          promptText.textContent = 'Press "E" to Pick Up Dish from Cellar Table';
          return;
        }
      }
    }

    promptText.textContent = '';
  },

  handleInteraction() {
    const pBox = this.player.getInteractBox();

    if (this.currentFloor === 'upstairs') {
      const u = this.floors.upstairs;

      // 1. Top-Right Staircase to Basement
      if (this.checkCollision(pBox, u.stairsDown.interact)) {
        this.switchFloor('basement');
        return;
      }

      // 2. Sink washing (if holding any dirty dish)
      const hasDirty = this.player.heldItems.some(i => i.state === 'dirty');
      if (hasDirty && this.checkCollision(pBox, u.sink.interact)) {
        this.player.isWashing = true;
        return;
      }

      // 3. Bar / Bar Bus Tub dirty dish pickup
      if (this.checkCollision(pBox, u.dishSpawn.interact) || this.checkCollision(pBox, u.bar.interact)) {
        if (this.player.canPickUp()) {
          const nextType = this.barDirtyQueue.length > 0
            ? this.barDirtyQueue.shift()
            : ['plate', 'bowl', 'cup'][Math.floor(Math.random() * 3)];
          this.player.pushItem({ type: nextType, state: 'dirty' });
          this.playSfx('pickup');
          this.addFloatingText(`+1 DIRTY ${nextType.toUpperCase()}`, this.player.x, this.player.y - 8, '#ffbe0b');
          return;
        }
      }

      // 4. Upstairs Shelf interaction (store clean dish OR pick up clean dish to take to Buffet)
      for (const [type, zone] of Object.entries(u.shelf.zones)) {
        if (this.checkCollision(pBox, zone)) {
          const cleanIdx = this.player.heldItems.findIndex(i => i.state === 'clean' && i.type === type);
          if (cleanIdx !== -1 && this.storedDishes[type] < this.MAX_DISHES_PER_TYPE) {
            this.player.heldItems.splice(cleanIdx, 1);
            this.storedDishes[type]++;
            this.player.score += 10;
            this.updateScore();
            this.playSfx('store');
            this.addFloatingText('+10 SHELVED!', zone.drawX, zone.drawY, '#38bdf8');
            return;
          } else if (cleanIdx === -1 && this.storedDishes[type] > 0 && this.player.canPickUp()) {
            this.storedDishes[type]--;
            this.player.pushItem({ type, state: 'clean' });
            this.playSfx('pickup');
            this.addFloatingText(`TOOK CLEAN ${type.toUpperCase()}`, zone.drawX - 20, zone.drawY, '#a8dadc');
            return;
          }
        }
      }

      // 5. Center Prep Table staging
      if (this.checkCollision(pBox, u.table.interact)) {
        if (this.player.heldItems.length > 0 && this.upstairsTableItems.length < 3) {
          this.upstairsTableItems.push(this.player.popItem());
          this.playSfx('pickup');
          return;
        } else if (this.player.canPickUp() && this.upstairsTableItems.length > 0) {
          this.player.pushItem(this.upstairsTableItems.pop());
          this.playSfx('pickup');
          return;
        }
      }
    } else {
      // BASEMENT FLOOR INTERACTIONS
      const b = this.floors.basement;

      // 1. Top-Right Staircase back Upstairs
      if (this.checkCollision(pBox, b.stairsUp.interact)) {
        this.switchFloor('upstairs');
        return;
      }

      // 2. Buffet Counter stations (on the other side of the wall)
      for (const [type, zone] of Object.entries(b.buffet.zones)) {
        if (this.checkCollision(pBox, zone)) {
          const cleanIdx = this.player.heldItems.findIndex(i => i.state === 'clean' && i.type === type);
          if (cleanIdx !== -1 && this.buffetDishes[type] < this.MAX_DISHES_PER_TYPE) {
            this.player.heldItems.splice(cleanIdx, 1);
            this.buffetDishes[type]++;
            this.totalBuffetServed++;

            const isHot = (this.buffetHotItem === type);
            const bonus = isHot ? 45 : 25;
            this.player.score += bonus;
            if (isHot) {
              const types = ['bowl', 'plate', 'cup'];
              this.buffetHotItem = types[Math.floor(Math.random() * types.length)];
            }
            this.updateScore();
            this.playSfx('buffet');
            this.addFloatingText(
              isHot ? `+${bonus} BUFFET RUSH!` : `+${bonus} BUFFET!`,
              zone.drawX,
              zone.drawY - 20,
              '#ffd166'
            );
            return;
          }
        }
      }

      // 3. Buffet Dirty Bus Tub pickup
      if (this.checkCollision(pBox, b.buffetBustub.interact)) {
        if (this.player.canPickUp()) {
          const nextType = this.buffetDirtyQueue.length > 0
            ? this.buffetDirtyQueue.shift()
            : ['plate', 'bowl', 'cup'][Math.floor(Math.random() * 3)];
          this.player.pushItem({ type: nextType, state: 'dirty' });
          this.playSfx('pickup');
          this.addFloatingText(`+1 DIRTY ${nextType.toUpperCase()}`, this.player.x, this.player.y - 8, '#ffbe0b');
          return;
        }
      }

      // 4. Cellar Staging Table
      if (this.checkCollision(pBox, b.cellarTable.interact)) {
        if (this.player.heldItems.length > 0 && this.basementTableItems.length < 3) {
          this.basementTableItems.push(this.player.popItem());
          this.playSfx('pickup');
          return;
        } else if (this.player.canPickUp() && this.basementTableItems.length > 0) {
          this.player.pushItem(this.basementTableItems.pop());
          this.playSfx('pickup');
          return;
        }
      }
    }
  },

  simulationTick() {
    if (!this.gameStarted || this.gamePaused) return;
    const now = Date.now();
    const types = ['plate', 'bowl', 'cup'];

    // 1. Spawn dirty dishes at the Bar Bus Tub and Downstairs Buffet Bus Tub
    if (now - this.lastDirtySpawn > 4500) {
      if (this.barDirtyQueue.length < 10) {
        this.barDirtyQueue.push(types[Math.floor(Math.random() * 3)]);
      }
      if (this.buffetDirtyQueue.length < 8 && Math.random() < 0.65) {
        this.buffetDirtyQueue.push(types[Math.floor(Math.random() * 3)]);
      }
      this.lastDirtySpawn = now;
    }

    // 2. Upstairs shelf consumption
    Object.keys(this.storedDishes).forEach(type => {
      if (
        this.storedDishes[type] >= this.MIN_DISHES_BEFORE_REMOVAL &&
        now - this.lastDishRemoval[type] > this.DISH_REMOVAL_INTERVAL
      ) {
        this.storedDishes[type]--;
        this.lastDishRemoval[type] = now;
      }
    });

    // 3. Downstairs Buffet dish consumption by diners
    Object.keys(this.buffetDishes).forEach(type => {
      if (
        this.buffetDishes[type] >= 1 &&
        now - this.lastBuffetConsumption[type] > 8000
      ) {
        this.buffetDishes[type]--;
        this.lastBuffetConsumption[type] = now;
      }
    });
  },

  checkCollision(obj1, obj2) {
    return (
      obj1.x < obj2.x + obj2.width &&
      obj1.x + obj1.width > obj2.x &&
      obj1.y < obj2.y + obj2.height &&
      obj1.y + obj1.height > obj2.y
    );
  },

  updateScore() {
    const scoreDisplay = document.getElementById('scoreDisplay');
    if (scoreDisplay) {
      scoreDisplay.textContent = `Score: ${Math.floor(this.player.score)}`;
    }
    this.updateShopButtons();
  },

  updateCleanedDishesDisplay() {
    const cleanedDishesEl = document.getElementById('cleanedDishesDisplay');
    if (cleanedDishesEl) {
      cleanedDishesEl.textContent = `Cleaned: ${this.totalCleanedDishes}`;
    }
  },

  // Shop Upgrades
  purchaseSpeedUpgrade() {
    const cost = this.upgradeCosts.speed;
    if (this.player.score >= cost) {
      this.player.score -= cost;
      this.player.pixelPerSecond = Math.min(380, Math.round(this.player.pixelPerSecond * 1.18));
      this.upgradeLevels.speed++;
      this.upgradeCosts.speed = Math.round(cost * 1.5);
      this.playSfx('upgrade');
      this.updateScore();
      this.updateShopButtons();
    }
  },

  purchaseWashingUpgrade() {
    const cost = this.upgradeCosts.washing;
    if (this.player.score >= cost) {
      this.player.score -= cost;
      this.player.washingSpeed = +(this.player.washingSpeed * 1.3).toFixed(2);
      this.upgradeLevels.washing++;
      this.upgradeCosts.washing = Math.round(cost * 1.5);
      this.playSfx('upgrade');
      this.updateScore();
      this.updateShopButtons();
    }
  },

  purchaseStorageUpgrade() {
    const cost = this.upgradeCosts.storage;
    if (this.player.score >= cost) {
      this.player.score -= cost;
      this.MAX_DISHES_PER_TYPE += 2;
      this.player.carryCapacity += 1;
      this.upgradeLevels.storage++;
      this.upgradeCosts.storage = Math.round(cost * 1.6);
      this.playSfx('upgrade');
      this.updateScore();
      this.updateShopButtons();
    }
  },

  updateShopButtons() {
    const speedBtn = document.getElementById('speedUpgradeBtn');
    const washBtn = document.getElementById('washingUpgradeBtn');
    const storageBtn = document.getElementById('storageUpgradeBtn');

    if (speedBtn) {
      speedBtn.textContent = `Lv.${this.upgradeLevels.speed} Buy (${this.upgradeCosts.speed})`;
      speedBtn.disabled = (this.player.score < this.upgradeCosts.speed);
    }
    if (washBtn) {
      washBtn.textContent = `Lv.${this.upgradeLevels.washing} Buy (${this.upgradeCosts.washing})`;
      washBtn.disabled = (this.player.score < this.upgradeCosts.washing);
    }
    if (storageBtn) {
      storageBtn.textContent = `Lv.${this.upgradeLevels.storage} Buy (${this.upgradeCosts.storage})`;
      storageBtn.disabled = (this.player.score < this.upgradeCosts.storage);
    }
  },

  updateBGMVolume() {
    if (this.bgMusic) {
      this.bgMusic.volume = Math.max(0, Math.min(1, this.bgmVolume / 100));
    }
  },

  toggleFullscreen() {
    const gameContainer = document.getElementById('gameContainer');
    const target = (this.gameStarted && gameContainer) ? gameContainer : document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(() => {});
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }
};
