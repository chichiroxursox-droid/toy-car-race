import * as CANNON from 'cannon-es'

// Cannon-es physics world — exaggerated gravity for toy feel
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -20, 0)
})

world.broadphase = new CANNON.SAPBroadphase(world)
world.solver.iterations = 10
world.defaultContactMaterial.friction = 0.3

// Default contact material for ground-object interaction
const groundMaterial = new CANNON.Material('ground')
const objectMaterial = new CANNON.Material('object')
const groundObjectContact = new CANNON.ContactMaterial(groundMaterial, objectMaterial, {
  friction: 0.5,
  restitution: 0.3
})
world.addContactMaterial(groundObjectContact)

// Track mesh-body pairs for sync
const syncPairs = []

/**
 * Register a Three.js mesh and Cannon-es body for automatic sync.
 */
export function addBody(mesh, body) {
  world.addBody(body)
  syncPairs.push({ mesh, body })
}

/**
 * Step the physics world and copy positions/quaternions to Three.js meshes.
 */
export function updatePhysics(dt) {
  world.step(1 / 60, dt, 3)

  for (let i = 0; i < syncPairs.length; i++) {
    const { mesh, body } = syncPairs[i]
    mesh.position.copy(body.position)
    mesh.quaternion.copy(body.quaternion)
  }
}

export { world, groundMaterial, objectMaterial }
