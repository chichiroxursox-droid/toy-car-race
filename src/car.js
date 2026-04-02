/**
 * RaycastVehicle Setup — How It Works
 * ====================================
 * Cannon-es RaycastVehicle casts rays downward from each wheel position to detect
 * the ground surface. This avoids the complexity of physical wheel bodies and joints.
 *
 * The chassis is a single rigid body (box shape). Each wheel is defined by:
 *   - position relative to chassis
 *   - direction (down), axle (left)
 *   - radius, suspension rest length, stiffness, damping
 *
 * Each frame we:
 *   1. Apply engine force / steering from keyboard input
 *   2. Let the physics world step
 *   3. Copy chassis body pos/quat → Three.js car group
 *   4. Copy each wheel transform from vehicle.wheelInfos → wheel meshes
 */

import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { world } from './physics.js'

// --- Config (mutable — debug panel writes to these) ---
const CHASSIS_SIZE = { x: 1.2, y: 0.3, z: 0.7 }
const WHEEL_RADIUS = 0.15
const SUSPENSION_REST = 0.15
const DAMPING_RELAXATION = 2.5
const DAMPING_COMPRESSION = 4.5
const MAX_SUSPENSION_FORCE = 50000
const BRAKE_FORCE = 30
const MAX_STEER = 0.5
const CHASSIS_MASS = 50

/** Mutable config — exposed to debug panel via car.config */
export const carConfig = {
  engineForce: 300,
  suspensionStiffness: 60
}

// Reusable objects (avoid per-frame allocations)
const _v3 = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _flipVec = new CANNON.Vec3()

// --- Input state ---
const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  brake: false,
  reset: false
}

function onKeyDown(e) {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp':    input.forward = true; break
    case 'KeyS': case 'ArrowDown':  input.backward = true; break
    case 'KeyA': case 'ArrowLeft':  input.left = true; break
    case 'KeyD': case 'ArrowRight': input.right = true; break
    case 'Space': input.brake = true; break
    case 'KeyR':  input.reset = true; break
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp':    input.forward = false; break
    case 'KeyS': case 'ArrowDown':  input.backward = false; break
    case 'KeyA': case 'ArrowLeft':  input.left = false; break
    case 'KeyD': case 'ArrowRight': input.right = false; break
    case 'Space': input.brake = false; break
    case 'KeyR':  input.reset = false; break
  }
}

window.addEventListener('keydown', onKeyDown)
window.addEventListener('keyup', onKeyUp)

// --- Build Three.js car mesh ---
function createCarMesh() {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xE63946,
    roughness: 0.3,
    metalness: 0.1
  })

  // Main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.25, 0.7),
    bodyMat
  )
  body.castShadow = true
  group.add(body)

  // Roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.2, 0.6),
    bodyMat
  )
  roof.position.set(-0.05, 0.22, 0)
  roof.castShadow = true
  group.add(roof)

  // Headlights
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2,
    roughness: 0.2,
    metalness: 0.0
  })
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.06),
      headlightMat
    )
    hl.position.set(0.58, 0.0, side * 0.25)
    group.add(hl)
  }

  // Spoiler
  const spoiler = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.1, 0.6),
    bodyMat
  )
  spoiler.position.set(-0.58, 0.18, 0)
  spoiler.castShadow = true
  group.add(spoiler)

  return group
}

// --- Build wheel meshes ---
function createWheelMesh() {
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7, metalness: 0.2 })
  )
  wheel.geometry.rotateX(Math.PI / 2)
  wheel.castShadow = true
  return wheel
}

// --- Create vehicle ---
export function createCar(scene) {
  // Chassis physics body
  const chassisShape = new CANNON.Box(
    new CANNON.Vec3(CHASSIS_SIZE.x / 2, CHASSIS_SIZE.y / 2, CHASSIS_SIZE.z / 2)
  )
  const chassisBody = new CANNON.Body({
    mass: CHASSIS_MASS,
    shape: chassisShape,
    position: new CANNON.Vec3(-2, 1, 6),
    angularDamping: 0.9,
    linearDamping: 0.05
  })
  // Lower center of mass for stability
  chassisBody.shapeOffsets[0] = new CANNON.Vec3(0, -0.1, 0)
  world.addBody(chassisBody)

  // RaycastVehicle
  const vehicle = new CANNON.RaycastVehicle({
    chassisBody,
    indexRightAxis: 2,
    indexUpAxis: 1,
    indexForwardAxis: 0
  })

  // Wheel options
  const wheelOptions = {
    radius: WHEEL_RADIUS,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    axleLocal: new CANNON.Vec3(0, 0, 1),
    suspensionRestLength: SUSPENSION_REST,
    suspensionStiffness: carConfig.suspensionStiffness,
    dampingRelaxation: DAMPING_RELAXATION,
    dampingCompression: DAMPING_COMPRESSION,
    maxSuspensionForce: MAX_SUSPENSION_FORCE,
    frictionSlip: 3,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true
  }

  // Wheel positions: front-right, front-left, back-right, back-left
  // Wide stance for stability, connection point below chassis center
  const wheelPositions = [
    new CANNON.Vec3( 0.45, -0.15,  0.4),
    new CANNON.Vec3( 0.45, -0.15, -0.4),
    new CANNON.Vec3(-0.45, -0.15,  0.4),
    new CANNON.Vec3(-0.45, -0.15, -0.4)
  ]

  const wheelMeshes = []
  for (const pos of wheelPositions) {
    vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: pos })
    const wMesh = createWheelMesh()
    scene.add(wMesh)
    wheelMeshes.push(wMesh)
  }

  vehicle.addToWorld(world)

  // Three.js car group
  const carMesh = createCarMesh()
  scene.add(carMesh)

  // Spawn position
  const spawnPos = new CANNON.Vec3(-2, 1, 6)
  const spawnQuat = new CANNON.Quaternion()

  // --- Public API ---
  const car = {
    chassisBody,
    vehicle,
    mesh: carMesh,
    wheelMeshes,

    /** Returns speed in "km/h" (scaled arbitrarily for fun) */
    getSpeed() {
      const v = chassisBody.velocity
      return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) * 3.6
    },

    /** Check if car is flipped (chassis up vector points downward) */
    isFlipped() {
      _flipVec.set(0, 1, 0)
      chassisBody.quaternion.vmult(_flipVec, _flipVec)
      return _flipVec.y < 0.3
    },

    /** Apply keyboard input to vehicle each frame */
    update() {
      // Reset
      if (input.reset) {
        chassisBody.position.copy(spawnPos)
        chassisBody.quaternion.copy(spawnQuat)
        chassisBody.velocity.setZero()
        chassisBody.angularVelocity.setZero()
        input.reset = false
      }

      // Engine force (rear wheels: 2, 3 — rear-wheel drive for stability)
      let engineForce = 0
      if (input.forward) engineForce = carConfig.engineForce
      if (input.backward) engineForce = -carConfig.engineForce
      vehicle.applyEngineForce(engineForce, 2)
      vehicle.applyEngineForce(engineForce, 3)

      // Steering (front wheels)
      let steer = 0
      if (input.left) steer = MAX_STEER
      if (input.right) steer = -MAX_STEER
      vehicle.setSteeringValue(steer, 0)
      vehicle.setSteeringValue(steer, 1)

      // Braking (rear wheels: 2, 3)
      const brakeForce = input.brake ? BRAKE_FORCE : 0
      vehicle.setBrake(brakeForce, 2)
      vehicle.setBrake(brakeForce, 3)

      // Sync chassis mesh
      carMesh.position.copy(chassisBody.position)
      carMesh.quaternion.copy(chassisBody.quaternion)

      // Sync wheel meshes
      for (let i = 0; i < 4; i++) {
        vehicle.updateWheelTransform(i)
        const t = vehicle.wheelInfos[i].worldTransform
        wheelMeshes[i].position.copy(t.position)
        wheelMeshes[i].quaternion.copy(t.quaternion)
      }
    },

    /** Mutable config — debug panel writes here, update() reads it */
    config: carConfig
  }

  return car
}
