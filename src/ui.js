import gsap from 'gsap'
import { Pane } from 'tweakpane'

/**
 * UI overlay: speedometer, control hints, flip detection, debug panel.
 */
function formatTime(ms) {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const millis = Math.floor(ms % 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

export function createUI(car, world, bloomPass, race) {
  const speedEl = document.getElementById('speed-value')
  const hintEl = document.getElementById('controls-hint')
  const resetEl = document.getElementById('reset-prompt')
  const lapEl = document.getElementById('lap-counter')
  const timerEl = document.getElementById('lap-timer')
  const bestEl = document.getElementById('best-lap')
  const finishedEl = document.getElementById('race-finished')
  const finishTotalEl = document.getElementById('finish-total')
  const finishBestEl = document.getElementById('finish-best')

  // Fade out controls hint after 5 seconds
  gsap.to(hintEl, {
    opacity: 0,
    duration: 0.5,
    delay: 5,
    onComplete: () => { hintEl.style.display = 'none' }
  })

  // ── Debug Panel (Tweakpane) ──
  let debugVisible = false
  const container = document.createElement('div')
  container.id = 'debug-container'
  container.style.display = 'none'
  document.getElementById('ui').appendChild(container)

  const params = {
    engineForce: 300,
    suspensionStiffness: 60,
    gravityY: -20,
    bloomStrength: 0.6
  }

  const pane = new Pane({ container, title: 'Debug' })
  pane.addBinding(params, 'engineForce', { min: 50, max: 500, step: 10 })
  pane.addBinding(params, 'suspensionStiffness', { min: 5, max: 100, step: 1 })
  pane.addBinding(params, 'gravityY', { min: -50, max: -5, step: 1 })
  if (bloomPass) {
    pane.addBinding(params, 'bloomStrength', { min: 0, max: 2, step: 0.05 })
  }

  // Use backtick/tilde for debug toggle (avoids D key conflict)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote' && !e.repeat) {
      debugVisible = !debugVisible
      container.style.display = debugVisible ? 'block' : 'none'
    }
  })

  // ── Update loop ──
  const ui = {
    params,

    update() {
      // Speedometer
      const speed = Math.round(car.getSpeed())
      speedEl.textContent = speed

      // Flip detection
      if (car.isFlipped()) {
        resetEl.classList.remove('hidden')
      } else {
        resetEl.classList.add('hidden')
      }

      // Apply debug params to physics
      world.gravity.y = params.gravityY
      if (bloomPass) {
        bloomPass.strength = params.bloomStrength
      }

      // Sync engine force + suspension stiffness to car config
      car.config.engineForce = params.engineForce
      car.config.suspensionStiffness = params.suspensionStiffness
      // Apply suspension stiffness to all wheels
      for (let i = 0; i < car.vehicle.wheelInfos.length; i++) {
        car.vehicle.wheelInfos[i].suspensionStiffness = params.suspensionStiffness
      }

      // Race HUD
      if (race) {
        if (!race.started) {
          lapEl.textContent = 'Drive through start!'
          timerEl.textContent = '0:00.000'
        } else if (race.finished) {
          lapEl.textContent = `Lap ${race.totalLaps}/${race.totalLaps}`
          timerEl.textContent = ''
          finishedEl.classList.remove('hidden')
          finishTotalEl.textContent = `Total: ${formatTime(race.totalTime)}`
          finishBestEl.textContent = `Best lap: ${formatTime(race.bestTime)}`
        } else {
          lapEl.textContent = `Lap ${race.lap + 1}/${race.totalLaps}`
          timerEl.textContent = formatTime(race.currentTime)
        }
        if (race.bestTime < Infinity) {
          bestEl.textContent = `Best: ${formatTime(race.bestTime)}`
        }
      }
    }
  }

  return ui
}
