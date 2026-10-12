/* ui.js
   Handles UI modals, volume sliders, and bridging calls to Game
*/
import { startRain, stopRain } from './rain.js';

export const UI = {
  Game: null,
  pausedByModal: false,

  initialize(GameInstance) {
    this.Game = GameInstance;
    window.UI = this;
    GameInstance.init();

    // Main Menu Buttons
    document.querySelector('[data-action="start-game"]')?.addEventListener('click', () => this.startGame());
    document.querySelectorAll('[data-action="open-shop"]').forEach(button => {
      button.addEventListener('click', () => this.openShop());
    });
    document.querySelectorAll('[data-action="open-settings"]').forEach(button => {
      button.addEventListener('click', () => this.openSettings());
    });
    document.querySelector('[data-action="open-help"]')?.addEventListener('click', () => this.openHelp());
    document.querySelector('[data-action="open-credits"]')?.addEventListener('click', () => this.openCredits());

    // In-Game Buttons
    document.querySelector('[data-action="pause-game"]')?.addEventListener('click', () => this.pauseGame());
    document.querySelector('[data-action="resume-game"]')?.addEventListener('click', () => this.resumeGame());
    document.querySelector('[data-action="return-to-menu"]')?.addEventListener('click', () => this.returnToMainMenu());

    // Shop Upgrade Buttons
    document.getElementById('speedUpgradeBtn')?.addEventListener('click', () => GameInstance.purchaseSpeedUpgrade());
    document.getElementById('washingUpgradeBtn')?.addEventListener('click', () => GameInstance.purchaseWashingUpgrade());
    document.getElementById('storageUpgradeBtn')?.addEventListener('click', () => GameInstance.purchaseStorageUpgrade());

    // Modal Close Buttons & Backdrop click
    document.querySelectorAll('.close-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) this.closeModal(modal.id);
      });
    });

    document.getElementById('modalOverlay')?.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(m => {
        if (m.style.display === 'block') this.closeModal(m.id);
      });
    });

    // Fullscreen Button
    const fsBtn = document.getElementById('fullscreenBtn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => GameInstance.toggleFullscreen());
    }

    // Volume Sliders (fixed ReferenceError where Game was undefined)
    const bgmRange = document.getElementById('bgmVolume');
    const sfxRange = document.getElementById('sfxVolume');
    if (bgmRange) {
      bgmRange.addEventListener('input', (e) => {
        GameInstance.bgmVolume = Number(e.target.value);
        GameInstance.updateBGMVolume();
      });
    }
    if (sfxRange) {
      sfxRange.addEventListener('input', (e) => {
        GameInstance.sfxVolume = Number(e.target.value);
      });
    }

    startRain();
  },

  isMobileOrTouch() {
    return window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  },

  startGame() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    document.getElementById('inGameMenu').style.display = 'block';
    document.getElementById('mobileControls').style.display = this.isMobileOrTouch() ? 'flex' : 'none';
    stopRain();
    this.Game.startGame();
  },

  pauseGame() {
    this.pausedByModal = false;
    this.Game.pauseGame();
  },

  resumeGame() {
    this.pausedByModal = false;
    this.Game.resumeGame();
  },

  returnToMainMenu() {
    this.pausedByModal = false;
    this.Game.returnToMainMenu();
    startRain();
  },

  openShop() {
    this.Game.updateShopButtons();
    this.openModal('shopModal');
  },

  openSettings() {
    this.openModal('settingsModal');
  },

  openHelp() {
    this.openModal('helpModal');
  },

  openCredits() {
    this.openModal('creditsModal');
  },

  openModal(modalId) {
    if (this.Game.gameStarted && !this.Game.gamePaused) {
      this.pausedByModal = true;
      this.Game.gamePaused = true;
      this.Game.bgMusic?.pause();
    }
    document.getElementById(modalId).style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'block';
  },

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
    if (this.Game.gameStarted && this.pausedByModal &&
        document.getElementById('pauseOverlay').style.display !== 'flex') {
      this.pausedByModal = false;
      this.Game.resumeGame();
    }
  }
};
