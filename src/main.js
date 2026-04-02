import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

import { world, updatePhysics } from './physics.js'
import { createCar } from './car.js'
import { createWorld } from './world.js'
import { createCamera } from './camera.js'
import { createUI } from './ui.js'
import { createRace } from './race.js'

// ── Renderer ──
const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
renderer.outputColorSpace = THREE.SRGBColorSpace

// ── Scene ──
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87CEEB) // Sky blue
scene.fog = new THREE.Fog(0x87CEEB, 30, 80)

// ── Lighting ──
// Ambient — warm fill
const ambient = new THREE.AmbientLight(0xffffff, 0.4)
scene.add(ambient)

// Directional — main desk lamp (top-right)
const dirLight = new THREE.DirectionalLight(0xFFF5E0, 1.2)
dirLight.position.set(5, 8, 3)
dirLight.castShadow = true
dirLight.shadow.mapSize.width = 2048
dirLight.shadow.mapSize.height = 2048
dirLight.shadow.camera.near = 0.5
dirLight.shadow.camera.far = 50
dirLight.shadow.camera.left = -20
dirLight.shadow.camera.right = 20
dirLight.shadow.camera.top = 20
dirLight.shadow.camera.bottom = -20
dirLight.shadow.bias = -0.001
scene.add(dirLight)

// Point light — warm desk lamp glow
const pointLight = new THREE.PointLight(0xFFE4B5, 0.8, 8, 2)
pointLight.position.set(-3, 4, -2)
pointLight.castShadow = true
scene.add(pointLight)

// ── Post-Processing ──
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, null)) // camera set after creation

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6,   // strength
  0.4,   // radius
  0.85   // threshold
)
composer.addPass(bloomPass)

// Vignette shader
const vignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 1.2 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * 2.0;
      float vig = clamp(1.0 - dot(uv, uv) * darkness * 0.5, 0.0, 1.0);
      texel.rgb *= mix(1.0 - darkness * 0.3, 1.0, vig);
      gl_FragColor = texel;
    }
  `
}
const vignettePass = new ShaderPass(vignetteShader)
composer.addPass(vignettePass)

// ── Create game objects ──
const cam = createCamera(renderer)
const camera = cam.camera

// Update RenderPass with actual camera
composer.passes[0].camera = camera

// Register composer with camera for resize handling
cam.setComposer(composer)

const car = createCar(scene)
createWorld(scene)
const race = createRace(car.chassisBody)
const ui = createUI(car, world, bloomPass, race)

// ── Intro animation ──
cam.playIntro(car.mesh, () => {
  // Controls are always active, intro just moves camera
})

// ── Restart handler ──
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && race.finished) {
    race.reset()
    document.getElementById('race-finished').classList.add('hidden')
  }
})

// ── Game Loop ──
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)

  const dt = clock.getDelta()

  // Physics
  updatePhysics(dt)

  // Car
  car.update()

  // Race
  race.update()

  // Camera
  cam.update(car.chassisBody, car.mesh)

  // UI
  ui.update()

  // Render
  composer.render()
}

animate()
