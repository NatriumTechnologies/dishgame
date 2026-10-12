// mobile.js
export function setupMobileControls(Game) {
  const joystickContainer = document.getElementById('joystickContainer');
  const joystickHandle = document.getElementById('joystickHandle');
  const interactButton = document.getElementById('interactButton');
  if (!joystickContainer || !joystickHandle || !interactButton) return;

  let joystickActive = false;
  let joystickStartX = 0;
  let joystickStartY = 0;

  joystickContainer.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joystickActive = true;
    const touch = e.changedTouches[0];
    joystickStartX = touch.pageX;
    joystickStartY = touch.pageY;
  }, { passive: false });

  joystickContainer.addEventListener('touchmove', (e) => {
    if (!joystickActive) return;
    e.preventDefault();

    const touch = e.changedTouches[0];
    const dx = touch.pageX - joystickStartX;
    const dy = touch.pageY - joystickStartY;
    const radius = 60;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const clampedDist = Math.min(dist, radius);
    const handleX = 75 + clampedDist * Math.cos(angle);
    const handleY = 75 + clampedDist * Math.sin(angle);

    joystickHandle.style.left = (handleX - 20) + 'px';
    joystickHandle.style.top = (handleY - 20) + 'px';

    const deadZone = 14;
    if (dist > deadZone) {
      // Allow 8-directional movement on mobile joystick
      Game.inputKeys.up    = (dy < -deadZone);
      Game.inputKeys.down  = (dy > deadZone);
      Game.inputKeys.left  = (dx < -deadZone);
      Game.inputKeys.right = (dx > deadZone);
    } else {
      Game.inputKeys.up    = false;
      Game.inputKeys.down  = false;
      Game.inputKeys.left  = false;
      Game.inputKeys.right = false;
    }
  }, { passive: false });

  const resetJoystick = () => {
    joystickActive = false;
    joystickHandle.style.left = 'calc(50% - 20px)';
    joystickHandle.style.top = 'calc(50% - 20px)';
    Game.inputKeys.up    = false;
    Game.inputKeys.down  = false;
    Game.inputKeys.left  = false;
    Game.inputKeys.right = false;
  };

  joystickContainer.addEventListener('touchend', resetJoystick);
  joystickContainer.addEventListener('touchcancel', resetJoystick);

  interactButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    Game.inputKeys.e = true;
    if (!Game.player.isWashing) {
      Game.handleInteraction();
    }
  }, { passive: false });

  const releaseInteract = () => {
    Game.inputKeys.e = false;
    Game.player.isWashing = false;
  };
  interactButton.addEventListener('touchend', releaseInteract);
  interactButton.addEventListener('touchcancel', releaseInteract);
}