import * as THREE from 'three'
import gsap from 'gsap'

const _idealOffset = new THREE.Vector3()
const _idealLookAt = new THREE.Vector3()
const _currentPos = new THREE.Vector3()
const _currentLookAt = new THREE.Vector3()
const _orbitTarget = new THREE.Vector3()
const _orbitPos = new THREE.Vector3()
const _carQuat = new THREE.Quaternion()

/**
 * Follow camera with smooth lerp, intro animation, and orbit override.
 */
export function createCamera(renderer) {
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  )
  camera.position.set(6, 8, 6)
  _currentPos.copy(camera.position)
  _currentLookAt.set(0, 0, 0)

  // Resize handler — also resizes composer if provided
  let _composer = null

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    if (_composer) {
      _composer.setSize(window.innerWidth, window.innerHeight)
    }
  })

  // --- Orbit override state ---
  let orbiting = false
  let orbitTimeout = null
  let orbitStart = { x: 0, y: 0 }
  let orbitAngles = { theta: 0, phi: 0.6 }
  let orbitDistance = 3

  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault())
  renderer.domElement.addEventListener('mousedown', e => {
    if (e.button === 2) {
      orbiting = true
      orbitStart.x = e.clientX
      orbitStart.y = e.clientY
      if (orbitTimeout) clearTimeout(orbitTimeout)
    }
  })
  window.addEventListener('mousemove', e => {
    if (!orbiting) return
    const dx = (e.clientX - orbitStart.x) * 0.005
    const dy = (e.clientY - orbitStart.y) * 0.005
    orbitAngles.theta -= dx
    orbitAngles.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.1, orbitAngles.phi - dy))
    orbitStart.x = e.clientX
    orbitStart.y = e.clientY
  })
  window.addEventListener('mouseup', e => {
    if (e.button === 2 && orbiting) {
      orbiting = false
      orbitTimeout = setTimeout(() => {
        orbitTimeout = null
      }, 2000)
    }
  })

  // Track intro state
  let introPlaying = true

  const cam = {
    camera,

    /** Register the EffectComposer so it gets resized with the window */
    setComposer(composer) {
      _composer = composer
    },

    /** Play a single smooth intro that settles behind the car */
    playIntro(carMesh, onComplete) {
      introPlaying = true

      // Start high and wide to see the oval
      camera.position.set(12, 10, 12)
      camera.lookAt(0, 0, 0)

      // Single smooth move to behind the car
      gsap.to(camera.position, {
        x: -5, y: 4, z: 5,
        duration: 2.5,
        ease: 'power2.inOut',
        onUpdate: () => {
          if (carMesh) camera.lookAt(carMesh.position)
        },
        onComplete: () => {
          introPlaying = false
          _currentPos.copy(camera.position)
          _currentLookAt.copy(carMesh.position)
          if (onComplete) onComplete()
        }
      })
    },

    /** Update follow camera — call each frame */
    update(carBody, carMesh) {
      if (introPlaying) return

      // If orbit override is active or just released (waiting for timeout)
      if (orbiting || orbitTimeout) {
        _orbitTarget.copy(carMesh.position)
        _orbitPos.set(
          _orbitTarget.x + orbitDistance * Math.sin(orbitAngles.theta) * Math.cos(orbitAngles.phi),
          _orbitTarget.y + orbitDistance * Math.sin(orbitAngles.phi),
          _orbitTarget.z + orbitDistance * Math.cos(orbitAngles.theta) * Math.cos(orbitAngles.phi)
        )
        camera.position.lerp(_orbitPos, 0.1)
        camera.lookAt(_orbitTarget)
        return
      }

      // Follow camera — behind and above the car in its facing direction
      _carQuat.set(
        carBody.quaternion.x,
        carBody.quaternion.y,
        carBody.quaternion.z,
        carBody.quaternion.w
      )

      // Offset: behind (-x in car local space) and above — pulled back for wider view
      _idealOffset.set(-3.5, 2.5, 0)
      _idealOffset.applyQuaternion(_carQuat)
      _idealOffset.add(carMesh.position)

      // Look at: ahead of car
      _idealLookAt.set(1.5, 0.2, 0)
      _idealLookAt.applyQuaternion(_carQuat)
      _idealLookAt.add(carMesh.position)

      // Smooth lerp
      _currentPos.lerp(_idealOffset, 0.05)
      _currentLookAt.lerp(_idealLookAt, 0.05)

      camera.position.copy(_currentPos)
      camera.lookAt(_currentLookAt)
    }
  }

  return cam
}
