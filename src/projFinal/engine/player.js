import GameObject from './gameObject.js';

export default class Player extends GameObject {
  constructor(name) {
    super(name);

    this.lookSpeed       = 0.002;
    this.keys            = {};
    this.yaw             = 0;
    this.pitch           = 0;
    this.isPointerLocked = false;
    this.physicsBody     = null;

    this.velX        = 0;
    this.velY        = 0;
    this.velZ        = 0;

    this.rate        = 6.0;    
    this.mult        = 6.0;  
    this.grav        = 30.0;   
    this.jumpVel     = 9.4375; 

    this.capsuleHalfHeight = 1.3;
    this.capsuleRadius     = 0.4;
    this.eyeHeight         = 2.5;

    this._addInput();
  }

  _addInput() {
    window.addEventListener('keydown', (e) => { this.keys[e.code] = true;  });
    window.addEventListener('keyup',   (e) => { this.keys[e.code] = false; });
    window.addEventListener('click', (e) => {
      if (!this.isPointerLocked && !e.target.closest('#ui-container')) {
        document.body.requestPointerLock();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === document.body;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;
      this.yaw   -= e.movementX * this.lookSpeed;
      this.pitch -= e.movementY * this.lookSpeed;
      this.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });
  }

update(dt, physics) {
  const handle     = physics.bodies.get(this);
  const controller = handle?.controller;
  const grounded   = controller ? controller.computedGrounded() : false;
  const time       = Math.min(dt, 0.05);
  const rate       = this.rate;
  const drag       = Math.exp(-time * rate);
  const diff       = 1.0 - drag;

  const yaw = this.yaw;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);

  let dirX = 0, dirZ = 0;
  if (this.keys['KeyW'] || this.keys['ArrowUp'])    dirZ -= 1;
  if (this.keys['KeyS'] || this.keys['ArrowDown'])  dirZ += 1;
  if (this.keys['KeyA'] || this.keys['ArrowLeft'])  dirX -= 1;
  if (this.keys['KeyD'] || this.keys['ArrowRight']) dirX += 1;
  if (grounded && this.keys['ShiftLeft']) { this.mult = 30; this.rate = 15.0; }
  else if (!this.keys['ShiftLeft'])       { this.mult = 60; this.rate = 6.0;  }

  const norm = dirX * dirX + dirZ * dirZ;
  let accX = 0, accZ = 0;
  if (norm > 0) {
    const inv = 1.0 / Math.sqrt(norm);
    accX = this.mult * ( cos * dirX + sin * dirZ) * inv;
    accZ = this.mult * (-sin * dirX + cos * dirZ) * inv;
  }

  this.velX -= this.velX * diff;
  this.velZ -= this.velZ * diff;
  this.velX += diff * accX / rate;
  this.velZ += diff * accZ / rate;

  if (grounded && this.velY <= 0) {
    this.velY = 0;
    if (this.keys['Space']) {
      this.velY = this.jumpVel;
    }
  } else {
    this.velY -= this.grav * time;
    this.velY  = Math.max(this.velY, -40);
  }

  const moveX = (time - diff / rate) * accX / rate + diff * this.velX / rate;
  const moveZ = (time - diff / rate) * accZ / rate + diff * this.velZ / rate;
  const moveY = this.velY * time;

  physics.moveKinematic(this, [moveX, moveY, moveZ], time);

  // Read back what the controller actually allowed
  const corrected = handle?.controller?.computedMovement();
  if (corrected && this.velY > 0) {
    const expectedY  = moveY;
    const correctedY = corrected.y;
    // If the controller blocked most of the upward movement, we hit a ceiling
    if (Math.abs(correctedY) < Math.abs(expectedY) * 0.1) {
      this.velY = 0;
    }
  }

  const t = physics.getTranslation(this);
  if (t) this.transform.position = [t.x, t.y, t.z];
}
}
