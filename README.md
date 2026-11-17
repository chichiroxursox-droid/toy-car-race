# Toy Car Race

A small 3D driving game: a toy car on an oval track on a desk, three timed laps.

**Live:** https://toycar-race.netlify.app/

## Why it exists

To learn real-time vehicle physics in the browser, after a run of scroll-animation sites.

## How it works

- **Vehicle physics.** cannon-es `RaycastVehicle`: each wheel casts a ray down for suspension instead of simulating a wheel collider. Gravity is set to -20 (about twice real) so the car feels light and toy-like.
- **Lap timing.** Four checkpoint trigger bodies with collision response turned off. They have to be hit in order to count a lap, so cutting across the infield doesn't work. Checkpoints arm two seconds after spawn so the drop-in doesn't trigger one.
- **Camera.** Smoothed chase camera with an intro move and an orbit override.
- **Rendering.** ACES tone mapping, soft shadows, UnrealBloom plus a custom vignette pass.
- **Debug panel.** Press the backtick key for a Tweakpane panel to tune engine force, suspension, gravity and bloom live.

Controls: W A S D to drive, R to reset or restart.

## Stack

Three.js 0.170, cannon-es 0.20, GSAP, Tweakpane, Vite 6.

## Run it locally

```bash
npm install
npm run dev
```

## Status

Finished small project. One track, keyboard only (no touch controls).
