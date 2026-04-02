import * as CANNON from 'cannon-es'
import { world } from './physics.js'

const TOTAL_LAPS = 3
const NUM_CHECKPOINTS = 4

/**
 * Create checkpoint trigger zones and lap/timing logic.
 * Checkpoints must be hit in order: 0 → 1 → 2 → 3 → 0 = 1 lap.
 */
export function createRace(chassisBody) {
  let nextCheckpoint = 0
  let currentLap = 0
  let raceStarted = false
  let raceFinished = false
  let lapStartTime = 0
  let currentLapTime = 0
  let bestLapTime = Infinity
  let lastLapTime = 0
  let raceStartRealTime = 0
  let totalRaceTime = 0
  let armed = false  // don't detect checkpoints until car has moved away from spawn

  // Arm after 2 seconds so car can land without triggering CP0
  setTimeout(() => { armed = true }, 2000)

  // Checkpoint definitions — match oval: R=6 semicircle radius, S=6 straight half-length
  // Top straight at z=6, bottom at z=-6, curve apexes at x=±12
  // CP0/CP2 on straights: thin in X (driving direction), wide in Z (track width)
  // CP1/CP3 at curve apexes: thin in Z (driving direction), wide in X (track width)
  const cpDefs = [
    { pos: [0, 0.3, 6],      he: [0.2, 0.3, 2.0] },   // CP0 — start/finish (top straight)
    { pos: [12, 0.3, 0],     he: [2.0, 0.3, 0.2] },   // CP1 — right curve apex
    { pos: [0, 0.3, -6],     he: [0.2, 0.3, 2.0] },   // CP2 — bottom straight
    { pos: [-12, 0.3, 0],    he: [2.0, 0.3, 0.2] },   // CP3 — left curve apex
  ]

  const checkpoints = []
  for (const cp of cpDefs) {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(...cp.he)),
      position: new CANNON.Vec3(...cp.pos),
      collisionResponse: false  // ghost body — detects overlaps, no physics push
    })
    world.addBody(body)
    checkpoints.push(body)
  }

  // Listen for car entering checkpoint zones
  world.addEventListener('beginContact', (event) => {
    const { bodyA, bodyB } = event
    let cpIndex = -1
    if (bodyA === chassisBody) cpIndex = checkpoints.indexOf(bodyB)
    else if (bodyB === chassisBody) cpIndex = checkpoints.indexOf(bodyA)
    if (cpIndex === -1 || !armed) return

    if (cpIndex !== nextCheckpoint) return

    nextCheckpoint = (nextCheckpoint + 1) % NUM_CHECKPOINTS

    // Crossed CP0 after all others → lap complete
    if (cpIndex === 0 && raceStarted) {
      const now = performance.now()
      lastLapTime = now - lapStartTime
      if (lastLapTime < bestLapTime) bestLapTime = lastLapTime
      currentLap++
      lapStartTime = now

      if (currentLap >= TOTAL_LAPS) {
        raceFinished = true
        totalRaceTime = performance.now() - raceStartRealTime
      }
    }

    // First time crossing CP0 → race begins
    if (cpIndex === 0 && !raceStarted) {
      raceStarted = true
      raceStartRealTime = performance.now()
      lapStartTime = performance.now()
      currentLap = 0
    }
  })

  return {
    update() {
      if (raceStarted && !raceFinished) {
        currentLapTime = performance.now() - lapStartTime
      }
    },

    reset() {
      nextCheckpoint = 0
      currentLap = 0
      raceStarted = false
      raceFinished = false
      lapStartTime = 0
      currentLapTime = 0
      bestLapTime = Infinity
      lastLapTime = 0
      raceStartRealTime = 0
      totalRaceTime = 0
      armed = false
      setTimeout(() => { armed = true }, 2000)
    },

    get lap() { return currentLap },
    get totalLaps() { return TOTAL_LAPS },
    get started() { return raceStarted },
    get finished() { return raceFinished },
    get currentTime() { return currentLapTime },
    get bestTime() { return bestLapTime },
    get lastTime() { return lastLapTime },
    get nextCP() { return nextCheckpoint },
    get totalTime() { return totalRaceTime },
  }
}
