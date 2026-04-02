import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { addBody, world, groundMaterial, objectMaterial } from './physics.js'

/**
 * Create the world: large ground plane + oval race track with barriers.
 */
export function createWorld(scene) {
  // ── Ground Surface ──
  const groundSize = 40
  const groundGeo = new THREE.BoxGeometry(groundSize, 0.5, groundSize)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x8B6914,
    roughness: 0.8,
    metalness: 0
  })
  const groundMesh = new THREE.Mesh(groundGeo, groundMat)
  groundMesh.position.set(0, -0.25, 0)
  groundMesh.receiveShadow = true
  scene.add(groundMesh)

  const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(groundSize / 2, 0.25, groundSize / 2)),
    position: new CANNON.Vec3(0, -0.25, 0),
    material: groundMaterial
  })
  addBody(groundMesh, groundBody)

  // ── Helper: barrier segment between two points ──
  function addBarrierBetween(x1, z1, x2, z2) {
    const mx = (x1 + x2) / 2
    const mz = (z1 + z2) / 2
    const dx = x2 - x1
    const dz = z2 - z1
    const len = Math.sqrt(dx * dx + dz * dz) + 0.05 // tiny overlap to close gaps
    const angle = -Math.atan2(dz, dx)

    const geo = new THREE.BoxGeometry(len, 0.25, 0.12)
    const mat = new THREE.MeshStandardMaterial({ color: 0xFF6B35, roughness: 0.6, metalness: 0.1 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(mx, 0.125, mz)
    mesh.rotation.set(0, angle, 0)
    mesh.castShadow = true
    scene.add(mesh)

    geo.computeBoundingBox()
    const bb = geo.boundingBox
    const he = new CANNON.Vec3(
      (bb.max.x - bb.min.x) / 2,
      (bb.max.y - bb.min.y) / 2,
      (bb.max.z - bb.min.z) / 2
    )
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(he),
      position: new CANNON.Vec3(mx, 0.125, mz),
      material: objectMaterial
    })
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0))
    body.quaternion.set(q.x, q.y, q.z, q.w)
    addBody(mesh, body)
  }

  // ── Generate oval points ──
  // Oval = two straights (along Z axis) connected by semicircles
  // Right semicircle centered at (S, 0), left semicircle centered at (-S, 0)
  const R = 6            // semicircle radius (center-line)
  const S = 6            // half-length of each straight
  const W = 1.5          // half track width (center-line to wall)
  const curveSegs = 20   // segments per semicircle (smoother)

  function getOvalPoints(offset) {
    // offset > 0 = outer wall, offset < 0 = inner wall
    const r = R + offset  // actual radius for this wall
    const points = []

    // Top straight: left to right at z = r
    points.push({ x: -S, z: r })
    points.push({ x:  S, z: r })

    // Right semicircle: center (S, 0), from top-right (S,r) clockwise to bottom-right (S,-r)
    for (let i = 1; i < curveSegs; i++) {
      const a = Math.PI / 2 - (Math.PI * i / curveSegs)
      points.push({ x: S + r * Math.cos(a), z: r * Math.sin(a) })
    }

    // Bottom straight: right to left at z = -r
    points.push({ x:  S, z: -r })
    points.push({ x: -S, z: -r })

    // Left semicircle: center (-S, 0), from bottom-left (-S,-r) clockwise to top-left (-S,r)
    for (let i = 1; i < curveSegs; i++) {
      const a = (3 * Math.PI / 2) - (Math.PI * i / curveSegs)
      points.push({ x: -S + r * Math.cos(a), z: r * Math.sin(a) })
    }

    return points
  }

  const outerPts = getOvalPoints(W)
  const innerPts = getOvalPoints(-W)

  for (let i = 0; i < outerPts.length - 1; i++) {
    addBarrierBetween(outerPts[i].x, outerPts[i].z, outerPts[i + 1].x, outerPts[i + 1].z)
  }
  // Close the outer loop
  addBarrierBetween(outerPts[outerPts.length - 1].x, outerPts[outerPts.length - 1].z, outerPts[0].x, outerPts[0].z)

  for (let i = 0; i < innerPts.length - 1; i++) {
    addBarrierBetween(innerPts[i].x, innerPts[i].z, innerPts[i + 1].x, innerPts[i + 1].z)
  }
  // Close the inner loop
  addBarrierBetween(innerPts[innerPts.length - 1].x, innerPts[innerPts.length - 1].z, innerPts[0].x, innerPts[0].z)

  // ── Start/Finish Line (checkerboard strip across the track) ──
  const checkerCanvas = document.createElement('canvas')
  checkerCanvas.width = 128
  checkerCanvas.height = 16
  const ctx = checkerCanvas.getContext('2d')
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 16; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#222222'
      ctx.fillRect(col * 8, row * 8, 8, 8)
    }
  }
  const checkerTex = new THREE.CanvasTexture(checkerCanvas)
  checkerTex.magFilter = THREE.NearestFilter

  // Start line sits at x=0 on the top straight, spanning inner to outer wall
  const startGeo = new THREE.PlaneGeometry(0.8, W * 2)
  const startMat = new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.9 })
  const startLine = new THREE.Mesh(startGeo, startMat)
  startLine.rotation.x = -Math.PI / 2
  startLine.rotation.z = Math.PI / 2  // rotate so checkers face along Z (across the track width)
  startLine.position.set(0, 0.005, R)  // center of the top straight
  scene.add(startLine)

  return { bodies: [] }
}
