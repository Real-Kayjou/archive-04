import { useEffect, useRef } from 'react'

const SPEED = 1
const REDUCED_SPEED = 0.2
const TOTAL = 12600
const REVEAL_START = 0.35
const HOVER_TILT = { x: 0.4, y: 0.6 }

const clamp = (value) => Math.max(0, Math.min(1, value))
const rad = (degrees) => degrees * Math.PI / 180

function bezier(x1, y1, x2, y2) {
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0; let hi = 1; let t = 0.5
    for (let i = 0; i < 22; i += 1) {
      const k = 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t
      if (k < x) lo = t; else hi = t
      t = (lo + hi) / 2
    }
    return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t
  }
}

const E = { io: bezier(.65, 0, .25, 1), slow: bezier(.55, 0, .15, 1), over: bezier(.3, 1.25, .5, 1), soft: bezier(.4, 0, .2, 1), out: bezier(0, 0, .4, 1) }
const segment = (n, at, duration, easing) => easing((n - at) / duration)

function disposeScene(scene, renderer) {
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose()
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        Object.values(material).forEach((value) => value?.isTexture && value.dispose())
        material.dispose()
      })
    }
  })
  scene.environment?.dispose?.()
  renderer.dispose()
  renderer.forceContextLoss?.()
}

export default function ArchiveAirlock({ onProgress, onOpen, onUnavailable }) {
  const canvasRef = useRef(null)
  const buttonRef = useRef(null)
  const statusRef = useRef(null)
  const pressureRef = useRef(null)
  const lockRef = useRef(null)
  const irisRef = useRef(null)
  const clearanceRef = useRef(null)
  const buttonTextRef = useRef(null)
  const startedRef = useRef(false)
  const activateRef = useRef(null)

  useEffect(() => {
    const THREE = window.THREE
    if (!THREE || !canvasRef.current) { onUnavailable?.(); return undefined }

    let renderer
    try { renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true, stencil: true, powerPreference: 'high-performance' }) } catch { onUnavailable?.(); return undefined }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    const scene = new THREE.Scene()
    const environmentCanvas = document.createElement('canvas'); environmentCanvas.width = 128; environmentCanvas.height = 128
    const environmentContext = environmentCanvas.getContext('2d'); const environmentGradient = environmentContext.createLinearGradient(0, 0, 0, 128)
    environmentGradient.addColorStop(0, '#8fa0ff'); environmentGradient.addColorStop(.35, '#2A3B80'); environmentGradient.addColorStop(.7, '#121F50'); environmentGradient.addColorStop(1, '#040B27'); environmentContext.fillStyle = environmentGradient; environmentContext.fillRect(0, 0, 128, 128); environmentContext.fillStyle = '#EAF0FF'; environmentContext.fillRect(20, 18, 88, 8); environmentContext.fillRect(8, 60, 6, 40); environmentContext.fillRect(114, 60, 6, 40)
    const environment = new THREE.CubeTexture([environmentCanvas, environmentCanvas, environmentCanvas, environmentCanvas, environmentCanvas, environmentCanvas]); environment.needsUpdate = true; scene.environment = environment
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 60)
    const root = new THREE.Group()
    scene.add(root)
    const COL = { obs: 0x040B27, mid: 0x121F50, slate: 0x2A3B80, iris: 0x4255B2, med: 0x6274E0, ink: 0xEAF0FF }
    const R = 2.5; const NB = 8; const NL = 12; const NT = 48
    const tmpA = new THREE.Color(COL.mid); const tmpB = new THREE.Color(COL.ink); const tmpC = new THREE.Color()
    const keyLight = new THREE.DirectionalLight(COL.ink, 1.1); keyLight.position.set(-3, 4, 6)
    const rimLight = new THREE.DirectionalLight(COL.med, .8); rimLight.position.set(4, -3, 3)
    const light = new THREE.PointLight(0x9fb0ff, 0, 14, 1.4); light.position.set(0, 0, -1.2)
    root.add(new THREE.AmbientLight(COL.slate, .7), keyLight, rimLight, light)
    const metal = (color, roughness = .38, metalness = .7) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 1 })
    const stencil = (material) => { material.stencilWrite = true; material.stencilRef = 1; material.stencilFunc = THREE.EqualStencilFunc; return material }

    const housingShape = new THREE.Shape(); housingShape.absarc(0, 0, 2.98, 0, Math.PI * 2, false)
    const hole = new THREE.Path(); hole.absarc(0, 0, R, 0, Math.PI * 2, true); housingShape.holes.push(hole)
    const housing = new THREE.Mesh(new THREE.ExtrudeGeometry(housingShape, { depth: .32, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 3, curveSegments: 96 }), metal(0x16246e, .42, .75)); housing.position.z = .2; root.add(housing)
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R + .02, .035, 12, 128), new THREE.MeshBasicMaterial({ color: COL.ink, transparent: true, opacity: .72, toneMapped: false })); lip.position.z = .58; root.add(lip)
    const dots = new THREE.Mesh(new THREE.TorusGeometry(2.7, .012, 6, 160), new THREE.MeshBasicMaterial({ color: COL.iris, toneMapped: false })); dots.position.z = .58; root.add(dots)
    const mask = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); mask.material.stencilWrite = true; mask.material.stencilRef = 1; mask.material.stencilFunc = THREE.AlwaysStencilFunc; mask.material.stencilZPass = THREE.ReplaceStencilOp; mask.renderOrder = 1; mask.position.z = .3; root.add(mask)

    const blades = []
    for (let i = 0; i < NB; i += 1) {
      const angle = 90 - 45 * i; const pivot = [R * Math.cos(rad(angle - 30)), R * Math.sin(rad(angle - 30))]
      const shape = new THREE.Shape(); shape.moveTo(-pivot[0], -pivot[1]); shape.lineTo(R * Math.cos(rad(angle - 30)) - pivot[0], R * Math.sin(rad(angle - 30)) - pivot[1]); shape.absarc(-pivot[0], -pivot[1], R, rad(angle - 30), rad(angle + 30), false); shape.lineTo(-pivot[0], -pivot[1])
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: .07, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 2, curveSegments: 40 })
      const mesh = new THREE.Mesh(geometry, stencil(metal(i % 2 ? 0x1a2b82 : 0x22369a, .34, .72))); mesh.renderOrder = 2
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 35), stencil(new THREE.LineBasicMaterial({ color: COL.med }))); lines.renderOrder = 3; lines.position.z = .001
      const blade = new THREE.Group(); blade.add(mesh, lines)
      [[.72, .07, .075], [.5, .03, .075]].forEach(([distance, size, z]) => { const circle = new THREE.Mesh(new THREE.CircleGeometry(size * 1.5, 24), stencil(new THREE.MeshBasicMaterial({ color: COL.ink, toneMapped: false }))); circle.position.set(R * distance * Math.cos(rad(angle)) - pivot[0], R * distance * Math.sin(rad(angle)) - pivot[1], z + .02); circle.renderOrder = 3; blade.add(circle) })
      const ring = new THREE.Mesh(new THREE.RingGeometry(.15, .17, 32), stencil(new THREE.MeshBasicMaterial({ color: COL.med, toneMapped: false }))); ring.renderOrder = 3; ring.position.set(R * .86 * Math.cos(rad(angle)) - pivot[0], R * .86 * Math.sin(rad(angle)) - pivot[1], .095); blade.add(ring)
      blade.position.set(pivot[0], pivot[1], .06 + i * .008); root.add(blade); blades.push(blade)
    }

    const ticks = []; for (let i = 0; i < NT; i += 1) { const tick = new THREE.Mesh(new THREE.BoxGeometry(.07, .2, .05), new THREE.MeshStandardMaterial({ color: COL.mid, roughness: .5, metalness: .4 })); const angle = rad(360 / NT * i + 90); tick.position.set(2.8 * Math.cos(angle), 2.8 * Math.sin(angle), .6); tick.rotation.z = angle - Math.PI / 2; root.add(tick); ticks.push(tick) }
    const ring = new THREE.Group(); ring.position.z = .6; root.add(ring); ring.add(new THREE.Mesh(new THREE.TorusGeometry(2.38, .02, 8, 140), new THREE.MeshBasicMaterial({ color: COL.iris, toneMapped: false })))
    const lugs = []; for (let i = 0; i < NL; i += 1) { const lug = new THREE.Group(); const angle = rad(360 / NL * i + 90); lug.rotation.z = angle - Math.PI / 2; const body = new THREE.Mesh(new THREE.BoxGeometry(.3, .4, .18), metal(0x1b2c86, .3, .8)); body.position.y = 2.52; const cap = new THREE.Mesh(new THREE.BoxGeometry(.07, .2, .2), new THREE.MeshBasicMaterial({ color: COL.med, toneMapped: false })); cap.position.set(0, 2.52, .01); const holder = new THREE.Group(); holder.add(body, cap); lug.add(holder); ring.add(lug); lugs.push(holder) }
    const emblem = new THREE.Group(); emblem.position.z = .32; root.add(emblem); const emblemMaterials = []; const addEmblem = (mesh) => { mesh.material.transparent = true; emblemMaterials.push(mesh.material); emblem.add(mesh); return mesh }
    addEmblem(new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .1, 48), metal(0x050c2b, .3, .8))).rotation.x = Math.PI / 2
    addEmblem(new THREE.Mesh(new THREE.TorusGeometry(.62, .025, 10, 64), new THREE.MeshBasicMaterial({ color: COL.ink }))).position.z = .06
    addEmblem(new THREE.Mesh(new THREE.TorusGeometry(.44, .012, 8, 64), new THREE.MeshBasicMaterial({ color: COL.med }))).position.z = .07
    for (let i = 0; i < 3; i += 1) { const angle = rad(90 + 120 * i); const arm = addEmblem(new THREE.Mesh(new THREE.BoxGeometry(.08, .2, .05), new THREE.MeshBasicMaterial({ color: COL.ink }))); arm.position.set(.34 * Math.cos(angle), .34 * Math.sin(angle), .08); arm.rotation.z = angle - Math.PI / 2 }
    addEmblem(new THREE.Mesh(new THREE.CircleGeometry(.1, 24), new THREE.MeshBasicMaterial({ color: COL.med }))).position.z = .09
    const count = 260; const positions = new Float32Array(count * 3); for (let i = 0; i < count; i += 1) { positions[i * 3] = (Math.random() - .5) * 14; positions[i * 3 + 1] = (Math.random() - .5) * 9; positions[i * 3 + 2] = Math.random() * 5 - 1 }
    const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0x9fb0ff, size: .035, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })); scene.add(dust)

    let width = 1; let height = 1; let z0 = 10; let progress = 0; let direction = 0; let last = performance.now(); let frame = 0; let disposed = false; let mouseX = 0; let mouseY = 0; let smoothX = 0; let smoothY = 0
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const speed = reduced ? REDUCED_SPEED : SPEED
    const size = () => { width = window.innerWidth; height = window.innerHeight; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); const tangent = 2 * Math.tan(rad(20)); z0 = Math.max(7.9 / tangent, 7 / (tangent * camera.aspect)) }
    const move = (event) => { mouseX = event.clientX / window.innerWidth - .5; mouseY = event.clientY / window.innerHeight - .5 }
    const pose = (value, now) => {
      for (let i = 0; i < NT; i += 1) { const amount = segment(value, 300 + i * 55, 350, E.out); tmpC.copy(tmpA).lerp(tmpB, amount); ticks[i].material.color.copy(tmpC); ticks[i].material.emissive.copy(tmpB).multiplyScalar(amount * .9) }
      ring.rotation.z = -rad(150) * segment(value, 1000, 4200, E.io)
      for (let i = 0; i < NL; i += 1) lugs[i].position.y = .46 * segment(value, 3400 + Math.floor(i / 2) * 110, 1100, E.over)
      const emblemAmount = segment(value, 4200, 2200, E.io); emblem.visible = emblemAmount < 1; emblem.rotation.z = rad(120) * emblemAmount; emblem.scale.setScalar(1 + .6 * emblemAmount); emblemMaterials.forEach((material) => { material.opacity = 1 - emblemAmount })
      for (let i = 0; i < NB; i += 1) { const amount = segment(value, 5000 + i * 110, 6800, E.soft); const nudge = Math.sin(Math.min(1, (value - 5000 - i * 110) / 500) * Math.PI) * (value > 5000 + i * 110 && value < 5600 + i * 110 ? 1 : 0); blades[i].rotation.z = rad(58) * amount - rad(1.6) * nudge * (1 - amount) }
      const glowAmount = segment(value, 4600, 7200, (x) => clamp(x)); light.intensity = 7 * segment(value, 4600, 7200, E.soft); lip.material.opacity = .5 + glowAmount * .22; camera.position.set(smoothX * HOVER_TILT.y, -smoothY * HOVER_TILT.x, z0 * (1 - .2 * glowAmount)); camera.lookAt(0, 0, 0); dust.rotation.y = now * .00004; dust.position.y = Math.sin(now * .0003) * .1
    }
    const hud = () => { const value = progress * TOTAL; const phase = direction < 0 ? (value > 11800 ? 'SEALING' : value > 5200 ? 'IRIS CLOSING' : value > 3400 ? 'ENGAGING BOLTS' : value > 300 ? 'LOCKING' : 'SEALED') : (value < 300 ? 'SEALED' : value < 3200 ? 'AUTHORIZING' : value < 3500 ? 'ROTATING LOCK RING' : value < 4700 ? 'BOLTS RETRACTING' : value < 5200 ? 'EQUALIZING PRESSURE' : value < 11800 ? 'IRIS OPENING' : 'OPEN'); if (statusRef.current) statusRef.current.textContent = `ARCHIVE AIRLOCK / ${phase}`; if (pressureRef.current) pressureRef.current.textContent = `${(1 - .62 * clamp((value - 4700) / 6000)).toFixed(2)} ATM`; if (lockRef.current) lockRef.current.textContent = `${Math.max(0, NL - Math.round(clamp((value - 3400) / 1650) * NL))} / ${NL}`; if (irisRef.current) irisRef.current.textContent = `${Math.round(clamp((value - 5000) / 7500) * 100)}%`; if (clearanceRef.current) clearanceRef.current.textContent = value > 11800 ? 'GRANTED' : value > 300 ? 'VERIFYING' : 'PENDING'; if (buttonTextRef.current) buttonTextRef.current.textContent = direction ? (direction > 0 ? 'AUTHORIZING…' : 'SEALING…') : value >= TOTAL ? 'RESEAL ARCHIVE' : 'UNLOCK ARCHIVE' }
    const loop = (now) => { if (disposed) return; frame = requestAnimationFrame(loop); const delta = Math.min(50, now - last); last = now; if (direction) { progress += direction * (direction < 0 ? 1.1 : 1) * delta / (TOTAL * speed); progress = clamp(progress); if (progress === 1 || progress === 0) { direction = 0; onOpen?.(progress === 1) } } smoothX += (mouseX - smoothX) * .04; smoothY += (mouseY - smoothY) * .04; pose(progress * TOTAL, now); hud(); onProgress?.(progress); renderer.render(scene, camera) }
    const start = () => { if (startedRef.current || disposed) return; startedRef.current = true; direction = 1; buttonRef.current?.focus() }
    const click = () => { if (!direction) { if (progress >= 1) direction = -1; else start() } }
    const resize = () => size()
    activateRef.current = click
    size(); pose(0, performance.now()); hud(); window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize); window.addEventListener('pointermove', move, { passive: true }); buttonRef.current?.focus(); loop(performance.now())
    return () => { disposed = true; activateRef.current = null; cancelAnimationFrame(frame); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize); window.removeEventListener('pointermove', move); disposeScene(scene, renderer) }
  }, [onProgress, onOpen, onUnavailable])

  return <div className="archive-airlock" role="dialog" aria-modal="true" aria-label="Archive airlock"><canvas ref={canvasRef} /><div className="airlock-tag"><i /> <span ref={statusRef}>ARCHIVE AIRLOCK / SEALED</span></div><div className="airlock-data airlock-data-left"><div>PRESSURE <b ref={pressureRef}>1.00 ATM</b></div><div>LOCK RING <b ref={lockRef}>12 / 12</b></div><div>IRIS <b ref={irisRef}>0%</b></div></div><div className="airlock-data airlock-data-right"><div>SECTOR <b>04-ARCHIVE</b></div><div>CLEARANCE <b ref={clearanceRef}>PENDING</b></div><div>BLADES <b>8 × TITANIUM</b></div></div><button ref={buttonRef} className="airlock-button" type="button" onClick={() => activateRef.current?.()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateRef.current?.() } }}><span ref={buttonTextRef}>UNLOCK ARCHIVE</span><b>↘</b></button></div>
}

export { SPEED, REVEAL_START, HOVER_TILT }
