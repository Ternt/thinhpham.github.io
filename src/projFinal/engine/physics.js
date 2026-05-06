import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.19.3/+esm';

export default class Physics {
  async init() {
    await RAPIER.init();
    this.world      = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.bodies     = new Map();
    this.RAPIER     = RAPIER;
    return this;
  }

  addStatic(gameObject) {
    const desc = RAPIER.RigidBodyDesc.fixed();
    const body = this.world.createRigidBody(desc);
    this._addTrimeshCollider(body, gameObject);
    this.bodies.set(gameObject, body);
    return body;
  }

  addDynamic(gameObject, mass = 1.0) {
    const pos  = gameObject.transform.position;
    const desc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(pos[0], pos[1], pos[2])
    .setAdditionalMass(mass);
    const body = this.world.createRigidBody(desc);
    this._addTrimeshCollider(body, gameObject);
    this.bodies.set(gameObject, body);
    return body;
  }

  addKinematic(gameObject) {
    const pos = gameObject.transform.position;

    const controller = this.world.createCharacterController(0.01);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setSlideEnabled(true);
    controller.setMaxSlopeClimbAngle(45 * Math.PI / 180);
    controller.setMinSlopeSlideAngle(30 * Math.PI / 180);
    controller.enableAutostep(0.3, 0.1, true);
    controller.enableSnapToGround(0.3);

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(pos[0], pos[1], pos[2]);
    const body = this.world.createRigidBody(bodyDesc);

    // Read dimensions from the game object if available, fall back to defaults
    const halfHeight = gameObject.capsuleHalfHeight ?? 0.9;
    const radius     = gameObject.capsuleRadius ?? 0.4;

    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
    const collider = this.world.createCollider(colliderDesc, body);

    const handle = { body, controller, collider };
    this.bodies.set(gameObject, handle);
    return handle;
  }

  addBox(gameObject, halfExtents = [0.5, 0.5, 0.5], dynamic = false) {
    const pos  = gameObject.transform.position;
    const desc = dynamic
      ? RAPIER.RigidBodyDesc.dynamic().setTranslation(pos[0], pos[1], pos[2])
      : RAPIER.RigidBodyDesc.fixed().setTranslation(pos[0], pos[1], pos[2]);
    const body = this.world.createRigidBody(desc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(...halfExtents);
    this.world.createCollider(colliderDesc, body);
    this.bodies.set(gameObject, body);
    return body;
  }

  _addTrimeshCollider(body, gameObject) {
    if (!gameObject.mesh) return;
    const verts     = gameObject.mesh.vertices;
    const worldMat  = gameObject.worldMatrix();
    const positions = new Float32Array(verts.length * 3);
    const indices   = new Uint32Array(verts.length);

    verts.forEach((v, i) => {

      const x = v.position[0], y = v.position[1], z = v.position[2];
      positions[i * 3]     = worldMat[0]*x + worldMat[4]*y + worldMat[8]*z  + worldMat[12];
      positions[i * 3 + 1] = worldMat[1]*x + worldMat[5]*y + worldMat[9]*z  + worldMat[13];
      positions[i * 3 + 2] = worldMat[2]*x + worldMat[6]*y + worldMat[10]*z + worldMat[14];
      indices[i] = i;
    });

    const colliderDesc = RAPIER.ColliderDesc.trimesh(positions, indices);
    this.world.createCollider(colliderDesc, body);
  }

  moveKinematic(gameObject, desiredTranslation, dt) {
    const handle = this.bodies.get(gameObject);
    if (!handle || !handle.controller) return;

    const { body, controller, collider } = handle;
    const move = {
      x: desiredTranslation[0],
      y: desiredTranslation[1],
      z: desiredTranslation[2],
    };

    controller.computeColliderMovement(collider, move);
    const corrected = controller.computedMovement();

    const current = body.translation();
    body.setNextKinematicTranslation({
      x: current.x + corrected.x,
      y: current.y + corrected.y,
      z: current.z + corrected.z,
    });
  }

  step(dt) {
    this.world.timestep = Math.min(dt, 0.05);
    this.world.step();

    for (const [gameObject, handle] of this.bodies) {

      const body = handle.body ?? handle;
      if (!body.isDynamic()) continue;

      const t = body.translation();
      const r = body.rotation();
      gameObject.localMatrix = _quatTranslationToMat4(
        [r.x, r.y, r.z, r.w],
        [t.x, t.y, t.z]
      );
    }
  }


  getTranslation(gameObject) {
    const handle = this.bodies.get(gameObject);
    if (!handle) return null;
    const body = handle.body ?? handle;
    return body.translation();
  }

  remove(gameObject) {
    const handle = this.bodies.get(gameObject);
    if (!handle) return;
    const body = handle.body ?? handle;
    if (handle.controller) this.world.removeCharacterController(handle.controller);
    this.world.removeRigidBody(body);
    this.bodies.delete(gameObject);
  }
}

function _quatTranslationToMat4(q, t) {
  const [x, y, z, w] = q;
  const [tx, ty, tz] = t;
  const x2=x+x, y2=y+y, z2=z+z;
  const xx=x*x2, xy=x*y2, xz=x*z2;
  const yy=y*y2, yz=y*z2, zz=z*z2;
  const wx=w*x2, wy=w*y2, wz=w*z2;
  return new Float32Array([
    1-(yy+zz),  xy+wz,     xz-wy,     0,
    xy-wz,      1-(xx+zz), yz+wx,     0,
    xz+wy,      yz-wx,     1-(xx+yy), 0,
    tx,         ty,        tz,        1,
  ]);
}
