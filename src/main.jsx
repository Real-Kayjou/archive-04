import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { projects } from './content/projects'
import { fromRow, supabase, toRow } from './lib/supabase'
import './styles.css'
import './deck.css'
import './vault.css'

const ARCHIVE_PROJECT_KEY = 'archive-04-custom-projects'
const DEAD_PROJECT_KEY = 'archive-04-dead-projects'
const DELETED_PROJECT_KEY = 'archive-04-deleted-projects'
const DEAD_STATUSES = new Set(['failed-experiment', 'abandoned'])
const APP_BASE = import.meta.env.BASE_URL
const appAsset = (path) => `${APP_BASE}${path}`
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const isDeadProject = (project) => DEAD_STATUSES.has(project.status)
const safeExternalUrl = (value) => {
  try { const url = new URL(value, window.location.origin); return /^https?:$/.test(url.protocol) ? url.href : '' } catch { return '' }
}
const safeImageUrl = (value) => typeof value === 'string' && (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) ? value : ''

const OCEAN_PARTICLES = 190

function OceanParticles({ swimmer }) {
  const points = useRef(null)
  const positions = useMemo(() => {
    const data = new Float32Array(OCEAN_PARTICLES * 3)
    for (let i = 0; i < OCEAN_PARTICLES; i += 1) {
      data[i * 3] = (Math.random() - 0.5) * 12
      data[i * 3 + 1] = (Math.random() - 0.5) * 7
      data[i * 3 + 2] = (Math.random() - 0.5) * 4
    }
    return data
  }, [])
  useFrame((state, delta) => {
    if (!points.current) return
    const attribute = points.current.geometry.attributes.position
    for (let i = 0; i < OCEAN_PARTICLES; i += 1) {
      const index = i * 3
      attribute.array[index + 1] += delta * (0.012 + (i % 5) * 0.003)
      attribute.array[index] += Math.sin(state.clock.elapsedTime * 0.22 + i) * delta * 0.008
      if (attribute.array[index + 1] > 3.8) attribute.array[index + 1] = -3.8
      const dx = attribute.array[index] - swimmer.current.x
      const dy = attribute.array[index + 1] - swimmer.current.y
      const distance = Math.hypot(dx, dy)
      if (distance < 1.05) {
        attribute.array[index] += (dx / Math.max(distance, 0.1)) * delta * 0.28
        attribute.array[index + 1] += (dy / Math.max(distance, 0.1)) * delta * 0.28
      }
    }
    attribute.needsUpdate = true
  })
  return <points ref={points}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#ccd0cf" size={0.026} transparent opacity={0.68} depthWrite={false} /></points>
}

function SymbioteTendrils({ tendrils, state }) {
  return <>{tendrils.map((tendril) => <mesh key={tendril.id} ref={tendril.ref} position={tendril.position} rotation={tendril.rotation} scale={tendril.scale}>
    <cylinderGeometry args={[0.008, 0.024, 0.8 + (tendril.id % 4) * 0.14, 5]} />
    <meshStandardMaterial color="#040b27" roughness={0.3} metalness={0.35} emissive="#121f50" emissiveIntensity={state === 'WATCH' ? 0.2 : 0.08} />
  </mesh>)} </>
}

function SwimmingSymbiote({ pointer, swimmer }) {
  const group = useRef(null)
  const core = useRef(null)
  const eye = useRef(null)
  const tendrils = useMemo(() => Array.from({ length: 44 }, (_, id) => ({
    id,
    ref: { current: null },
    position: [Math.cos(id * 0.571) * 0.43, Math.sin(id * 0.571) * 0.43, 0],
    rotation: [0, 0, id * 0.571],
    scale: [1, 1, 1],
  })), [])
  const motion = useRef({ state: 'SWIM', next: 7, since: 0, watch: 4, lastPointer: 0, velocity: new THREE.Vector3(0.26, 0.04, 0), position: new THREE.Vector3(-1.35, -0.55, -0.25) })
  const desired = useRef(new THREE.Vector3()).current
  useFrame((frame, delta) => {
    if (!group.current) return
    const time = frame.clock.elapsedTime
    const current = motion.current
    const recent = pointer.current.active && performance.now() / 1000 - pointer.current.lastMove < 2
    if (current.state === 'SWIM' && time > current.next) {
      if (recent && Math.random() > 0.3) { current.state = 'NOTICE'; current.since = time; current.watch = 0.7 + Math.random() * 0.3 }
      else current.next = time + 6 + Math.random() * 9
    }
    if (current.state === 'NOTICE' && time - current.since > current.watch) { current.state = 'WATCH'; current.since = time; current.watch = 3 + Math.random() * 4 }
    if (current.state === 'WATCH' && ((!recent) || time - current.since > current.watch)) { current.state = 'LOSE_INTEREST'; current.since = time }
    if (current.state === 'LOSE_INTEREST' && time - current.since > 1) { current.state = 'SWIM'; current.next = time + 6 + Math.random() * 9 }

    desired.set(Math.sin(time * 0.15 + 1.2), Math.sin(time * 0.23) * 0.5, Math.sin(time * 0.11) * 0.18)
    if (current.state === 'NOTICE' || current.state === 'WATCH') {
      desired.set(pointer.current.x * 0.42, -pointer.current.y * 0.3, -0.55).sub(current.position).normalize()
      desired.multiplyScalar(current.state === 'NOTICE' ? 0.04 : 0.07)
    }
    desired.x += THREE.MathUtils.clamp(-current.position.x * 0.2, -0.18, 0.18)
    desired.y += THREE.MathUtils.clamp(-current.position.y * 0.24, -0.16, 0.16)
    current.velocity.lerp(desired, 1 - Math.pow(0.001, delta * 1.8))
    current.position.addScaledVector(current.velocity, delta)
    current.position.x = THREE.MathUtils.clamp(current.position.x, -2.7, 2.7)
    current.position.y = THREE.MathUtils.clamp(current.position.y, -1.8, 1.8)
    current.position.z = THREE.MathUtils.clamp(current.position.z, -1.2, 0.25)
    swimmer.current.copy(current.position)
    group.current.position.lerp(current.position, 1 - Math.pow(0.001, delta * 3.5))
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, -current.velocity.x * 0.35, 0.06)
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, current.velocity.x * 0.2, 0.06)
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -current.velocity.y * 0.18, 0.06)
    const pulse = 1 + Math.sin(time * 2.1) * 0.035
    core.current?.scale.setScalar(pulse)
    if (eye.current) {
      const lookX = current.state === 'WATCH' ? pointer.current.x * 0.28 : current.velocity.x * 0.28
      const lookY = current.state === 'WATCH' ? pointer.current.y * 0.2 : -current.velocity.y * 0.2
      eye.current.rotation.y = THREE.MathUtils.lerp(eye.current.rotation.y, lookX, 0.08)
      eye.current.rotation.x = THREE.MathUtils.lerp(eye.current.rotation.x, lookY, 0.08)
    }
    tendrils.forEach((tendril, id) => {
      if (!tendril.ref.current) return
      const angle = id * 0.571
      const sway = Math.sin(time * (1.3 + (id % 5) * 0.08) + id) * 0.08
      tendril.ref.current.rotation.z = angle + sway + current.velocity.x * 0.4
      tendril.ref.current.rotation.x = Math.sin(time * 0.8 + id * 0.4) * 0.12 + current.velocity.y * 0.25
    })
  })
  return <group ref={group} scale={0.84}>
    <mesh ref={core}><sphereGeometry args={[0.48, 32, 24]} /><meshPhysicalMaterial color="#040b27" roughness={0.2} metalness={0.65} clearcoat={0.8} clearcoatRoughness={0.16} emissive="#121f50" emissiveIntensity={0.22} /></mesh>
    <group ref={eye} position={[0, 0.03, 0.43]} rotation={[0, 0, 0]}>
      <mesh scale={[1.15, 0.76, 0.25]}><sphereGeometry args={[0.28, 32, 16]} /><meshPhysicalMaterial color="#ccd0cf" roughness={0.18} metalness={0.16} /></mesh>
      <mesh position={[0, 0, 0.075]} scale={[0.8, 0.8, 0.16]}><sphereGeometry args={[0.22, 32, 16]} /><meshPhysicalMaterial color="#6274e0" roughness={0.12} metalness={0.3} emissive="#4255b2" emissiveIntensity={0.7} /></mesh>
      <mesh position={[0, 0, 0.12]} scale={[0.4, 0.7, 0.16]}><sphereGeometry args={[0.16, 24, 16]} /><meshPhysicalMaterial color="#040b27" roughness={0.22} metalness={0.45} /></mesh>
      <mesh position={[0.06, 0.08, 0.17]}><sphereGeometry args={[0.035, 12, 8]} /><meshBasicMaterial color="#fff" /></mesh>
    </group>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.76, 0.012, 8, 96]} /><meshBasicMaterial color="#6274e0" transparent opacity={0.88} /></mesh>
    <mesh rotation={[0.4, 0.2, 0.1]}><torusGeometry args={[0.92, 0.009, 8, 96]} /><meshBasicMaterial color="#ccd0cf" transparent opacity={0.35} /></mesh>
    <mesh rotation={[0, 0.5, 0.7]}><torusGeometry args={[1.08, 0.006, 6, 64]} /><meshBasicMaterial color="#4255b2" transparent opacity={0.34} /></mesh>
    <SymbioteTendrils tendrils={tendrils} state={motion.current.state} />
  </group>
}

function OceanBackground() {
  useEffect(() => {
    const frame = document.getElementById('deep-ocean-frame')
    if (!frame) return undefined
    const move = event => frame.contentWindow?.postMessage({ type: 'deep-ocean-pointer', clientX: event.clientX, clientY: event.clientY }, window.location.origin)
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])
  return null
}

function LensModel({ pointer }) {
  const group = useRef(null)
  const core = useRef(null)
  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.z += delta * 0.11
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, pointer.x * 0.2, 0.04)
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, pointer.y * 0.12, 0.04)
    if (core.current) core.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.045)
  })
  return <group ref={group} scale={0.92}>
    <mesh ref={core}><sphereGeometry args={[0.42, 40, 40]} /><meshPhysicalMaterial color="#dbe5ff" metalness={0.35} roughness={0.08} transmission={0.45} thickness={0.7} emissive="#304aa0" emissiveIntensity={0.35} /></mesh>
    {[0.7, 0.98, 1.26].map((radius, index) => <mesh key={radius} rotation={[index * 0.25, index * 0.4, index * 0.3]}><torusGeometry args={[radius, index === 1 ? 0.018 : 0.01, 12, 96]} /><meshPhysicalMaterial color={index === 1 ? '#8d9cff' : '#cbd4db'} metalness={0.85} roughness={0.18} transparent opacity={index === 1 ? 0.78 : 0.5} /></mesh>)}
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.48, 0.014, 10, 64]} /><meshBasicMaterial color="#6274e0" transparent opacity={0.8} /></mesh>
    <pointLight color="#6274e0" intensity={3} distance={4} />
  </group>
}

function BackgroundPupil({ pointer }) {
  const group = useRef(null)
  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.z -= delta * 0.035
    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, pointer.x * 0.18, 0.035)
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -pointer.y * 0.12, 0.035)
    group.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.7) * 0.025)
  })
  return <group ref={group} position={[0, 0, -0.75]} scale={1.55}>
    <mesh><circleGeometry args={[0.78, 64]} /><meshBasicMaterial color="#040b27" transparent opacity={0.72} /></mesh>
    <mesh position={[0, 0, 0.02]}><ringGeometry args={[0.27, 0.7, 64]} /><meshBasicMaterial color="#6274e0" transparent opacity={0.32} /></mesh>
    {[0, 1, 2, 3, 4, 5].map((segment) => <mesh key={segment} position={[0, 0, 0.04]} rotation={[0, 0, segment * Math.PI / 3 + 0.16]}><torusGeometry args={[0.54, 0.016, 8, 22, Math.PI * 0.34]} /><meshBasicMaterial color="#dbe5ff" transparent opacity={0.42} /></mesh>)}
    <mesh position={[0, 0, 0.06]}><ringGeometry args={[0.08, 0.19, 48]} /><meshBasicMaterial color="#040b27" /></mesh>
  </group>
}

function BackgroundArchitecture() {
  const group = useRef(null)
  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * 0.012
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.22) * 0.018
  })
  return <group ref={group} position={[-0.25, 0.05, -1.8]} rotation={[0.12, -0.28, -0.06]} scale={1.65}>
    <mesh rotation={[0, 0, 0.02]}><boxGeometry args={[2.9, 2.15, 0.12]} /><meshBasicMaterial color="#6274e0" wireframe transparent opacity={0.16} /></mesh>
    <mesh position={[-1.15, 0.2, 0.12]} rotation={[0, 0, -0.08]}><boxGeometry args={[0.16, 2.8, 0.16]} /><meshBasicMaterial color="#ccd0cf" wireframe transparent opacity={0.24} /></mesh>
    <mesh position={[1.15, -0.18, 0.12]} rotation={[0, 0, 0.08]}><boxGeometry args={[0.16, 2.8, 0.16]} /><meshBasicMaterial color="#ccd0cf" wireframe transparent opacity={0.2} /></mesh>
    <mesh position={[0, 1.15, 0.12]} rotation={[0, 0, 0.02]}><boxGeometry args={[2.55, 0.14, 0.16]} /><meshBasicMaterial color="#8d9cff" wireframe transparent opacity={0.25} /></mesh>
    <mesh position={[0, -1.08, 0.12]} rotation={[0, 0, -0.02]}><boxGeometry args={[2.2, 0.12, 0.16]} /><meshBasicMaterial color="#ccd0cf" wireframe transparent opacity={0.18} /></mesh>
    <mesh position={[0.1, 0.05, 0.22]} rotation={[0.03, 0.1, 0.2]}><boxGeometry args={[1.65, 1.35, 0.08]} /><meshBasicMaterial color="#4255b2" wireframe transparent opacity={0.23} /></mesh>
    <mesh position={[-0.28, 0.08, 0.3]} rotation={[0, 0, -0.34]}><boxGeometry args={[0.08, 1.9, 0.08]} /><meshBasicMaterial color="#6274e0" wireframe transparent opacity={0.34} /></mesh>
  </group>
}

function SectionArchitecture({ variant }) {
  return <div className={`section-architecture architecture-${variant}`} aria-hidden="true"><Canvas frameloop="demand" camera={{ position: [0, 0, 6], fov: 42 }} dpr={[1, 1]} gl={{ antialias: false, alpha: true }}><ambientLight intensity={0.25} /><group scale={1.25}>
    {variant === 'entry' && <><mesh position={[-1.45, 0, 0]}><boxGeometry args={[0.12, 2.8, 0.12]} /><meshBasicMaterial color="#6274e0" wireframe transparent opacity={0.5} /></mesh><mesh position={[1.45, 0.25, 0]}><boxGeometry args={[0.12, 3.3, 0.12]} /><meshBasicMaterial color="#ccd0cf" wireframe transparent opacity={0.35} /></mesh><mesh position={[0, 1.3, 0]} rotation={[0, 0, 0.04]}><boxGeometry args={[2.9, 0.12, 0.14]} /><meshBasicMaterial color="#8d9cff" wireframe transparent opacity={0.45} /></mesh><mesh position={[0, 0, -0.3]}><boxGeometry args={[2.1, 1.65, 0.06]} /><meshBasicMaterial color="#4255b2" wireframe transparent opacity={0.3} /></mesh></>}
    {variant === 'gallery' && <>{[-1.7, -0.85, 0, 0.85, 1.7].map((x, index) => <mesh key={x} position={[x, (index % 2) * 0.18 - 0.08, 0]} rotation={[0, index * 0.12, index % 2 ? -0.04 : 0.04]}><boxGeometry args={[0.48, 2.05 - (index % 2) * 0.3, 0.08]} /><meshBasicMaterial color={index === 2 ? '#8d9cff' : '#6274e0'} wireframe transparent opacity={index === 2 ? 0.42 : 0.25} /></mesh>)}<mesh position={[0, -1.05, 0]}><boxGeometry args={[4.3, 0.08, 0.1]} /><meshBasicMaterial color="#ccd0cf" wireframe transparent opacity={0.3} /></mesh></>}
    {variant === 'lab' && <><mesh position={[-1.05, 0, 0]} rotation={[0, 0, -0.12]}><boxGeometry args={[0.18, 2.8, 0.18]} /><meshBasicMaterial color="#ccd0cf" wireframe transparent opacity={0.44} /></mesh><mesh position={[1.05, 0.2, 0]} rotation={[0, 0, 0.2]}><boxGeometry args={[0.18, 2.5, 0.18]} /><meshBasicMaterial color="#6274e0" wireframe transparent opacity={0.5} /></mesh><mesh position={[0, 0.95, 0]} rotation={[0, 0, 0.12]}><boxGeometry args={[2.4, 0.16, 0.18]} /><meshBasicMaterial color="#8d9cff" wireframe transparent opacity={0.4} /></mesh><mesh position={[0.2, -0.8, -0.2]} rotation={[0.3, 0.2, -0.18]}><boxGeometry args={[1.7, 0.7, 0.12]} /><meshBasicMaterial color="#4255b2" wireframe transparent opacity={0.36} /></mesh></>}
    {variant === 'atrium' && <><mesh position={[-1.35, 0, 0]}><boxGeometry args={[0.12, 3.2, 0.12]} /><meshBasicMaterial color="#6274e0" wireframe transparent opacity={0.42} /></mesh><mesh position={[1.35, 0, 0]}><boxGeometry args={[0.12, 3.2, 0.12]} /><meshBasicMaterial color="#ccd0cf" wireframe transparent opacity={0.35} /></mesh><mesh position={[0, 1.25, 0]}><boxGeometry args={[2.8, 0.12, 0.12]} /><meshBasicMaterial color="#8d9cff" wireframe transparent opacity={0.42} /></mesh><mesh position={[0, -0.2, -0.25]} rotation={[0.2, 0, 0]}><boxGeometry args={[2.2, 1.2, 0.08]} /><meshBasicMaterial color="#6274e0" wireframe transparent opacity={0.26} /></mesh><mesh position={[0, -1.15, 0]}><boxGeometry args={[3.4, 0.08, 0.1]} /><meshBasicMaterial color="#ccd0cf" wireframe transparent opacity={0.25} /></mesh></>}
  </group></Canvas></div>
}

function InfoGraphics({ variant }) {
  return <div className={`info-graphics info-graphics-${variant}`} aria-hidden="true">
    <span className="info-frame info-frame-a" />
    <span className="info-frame info-frame-b" />
    <span className="info-ring info-ring-a" />
    <span className="info-ring info-ring-b" />
    <span className="info-cross info-cross-a">+</span>
    <span className="info-cross info-cross-b">+</span>
    <span className="info-code info-code-a">SYS / {variant.toUpperCase()} / 04.02</span>
    <span className="info-code info-code-b">SIGNAL LOCKED //////</span>
    <span className="info-bars info-bars-a"><i /><i /><i /><i /><i /></span>
    <span className="info-bars info-bars-b"><i /><i /><i /></span>
    <span className="info-warning">!</span>
    <span className="info-corner info-corner-a" />
    <span className="info-corner info-corner-b" />
  </div>
}

function DeckRuntime() {
  useEffect(() => {
    const frame = document.getElementById('hero')
    const orb = frame?.querySelector('.hero-object .lens-stage')
    let observer
    const anchor = () => {
      if (!frame || !orb) return
      const box = frame.getBoundingClientRect()
      const target = orb.getBoundingClientRect()
      if (!box.width || !target.width) return
      const centerX = target.left + target.width / 2 - box.left
      const centerY = target.top + target.height / 2 - box.top
      for (const [name, size] of [['orbits', 58], ['glow', 40], ['radar', 34]]) {
        const diameter = target.width * size / 31.4
        frame.style.setProperty(`--deck-${name}-left`, `${centerX - diameter / 2}px`)
        frame.style.setProperty(`--deck-${name}-top`, `${centerY - diameter / 2}px`)
        frame.style.setProperty(`--deck-${name}-size`, `${diameter}px`)
      }
      frame.style.setProperty('--deck-object-width', `${target.width}px`)
    }
    anchor()
    window.addEventListener('resize', anchor, { passive: true })
    window.addEventListener('scroll', anchor, { passive: true })
    if (orb && 'ResizeObserver' in window) { observer = new ResizeObserver(anchor); observer.observe(orb) }
    if (!window.__archiveDeckRuntime) {
      window.__archiveDeckRuntime = true
      const script = document.createElement('script')
      script.src = '/deck.js?v=cursor-translate-living-type-1'
      script.async = true
      script.onerror = () => { window.__archiveDeckRuntime = false }
      document.body.append(script)
    }
    return () => {
      window.removeEventListener('resize', anchor)
      window.removeEventListener('scroll', anchor)
      observer?.disconnect()
    }
  }, [])
  return null
}

function ReferenceDeckHero({ archiveButton }) {
  return <>
    <div className="deck-band" aria-hidden="true" /><div className="deck-scanlines" aria-hidden="true" />
    <div className="floor"><i /></div><div className="glow" aria-hidden="true" />
    <svg className="orbits" viewBox="-100 -100 200 200" aria-hidden="true">
      <defs><path id="tp" d="M-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0" /></defs>
      <circle className="o1" r="56" /><g className="spin q"><circle className="sat" cx="56" cy="0" r="2" /></g>
      <g className="spin"><circle className="o2" r="75" /><circle className="sat" cx="75" cy="0" r="2.6" /><rect className="sq" x="-76.5" y="-3" width="6" height="6" transform="rotate(30 -73 0)" /></g>
      <circle className="o3" r="94" /><g className="spin b"><text><textPath href="#tp" textLength="548" lengthAdjust="spacing">ARCHIVE // 03 — SPATIAL STUDY — MOD ARCHIVE — SIGNAL LOCKED — UNFINISHED IDEAS — </textPath></text></g>
    </svg>
    <div className="k mono fade" style={{ '--dl': '.3s' }}>KAYJOU / SAIF EDINE JBALI / DIGITAL ARCHIVE</div>
    <h1 className="disp" id="hh"><span className="ln">I make things</span><span className="ln" style={{ paddingLeft: '4.2cqw' }}>with <span className="m dec" id="dec">CODE, 3D,</span></span><span className="ln" style={{ paddingLeft: '1cqw' }}>and experiments.</span></h1>
    <svg className="scr" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path className="draw" pathLength="1" d="M2 12 C30 4 60 17 95 9 S160 5 198 11" /></svg>
    <p className="p">A collection of spaces, systems, mods, and unfinished ideas.<em>Enter carefully.</em></p>
    <div className="radar" aria-hidden="true" />
    <div className="ghost g2 fade" style={{ '--dl': '2.2s' }} aria-hidden="true"><span className="ln">I make things</span><span className="ln" style={{ paddingLeft: '4.2cqw' }}>with CODE, 3D,</span><span className="ln" style={{ paddingLeft: '1cqw' }}>and experiments.</span></div>
    <div className="ghost g1 fade" style={{ '--dl': '1.9s' }} aria-hidden="true"><span className="ln">I make things</span><span className="ln" style={{ paddingLeft: '4.2cqw' }}>with CODE, 3D,</span><span className="ln" style={{ paddingLeft: '1cqw' }}>and experiments.</span></div>
    <div className="hud fade" style={{ '--dl': '.2s' }}><i /><i /><i /><i /></div><div className="hudl fade" style={{ '--dl': '.5s' }}>CMD.DECK // V4<br />NODE 01 / ARCHIVE</div><div className="hudr fade" style={{ '--dl': '.5s' }}><b />SYS.ONLINE<br /><span className="hi">X <span data-x>0000</span> · Y <span data-y>0000</span></span><br /><span className="clk">--:--:--</span><br /><span id="rdo">&gt; idle</span></div>
    <div className="rail fade" style={{ '--dl': '1.2s' }}><i /><b>SCROLL // 01—02</b></div><div className="rail r fade" style={{ '--dl': '1.2s' }}><i /><b>ARCHIVE // 2026</b></div>
    <div className="acts fade" style={{ '--dl': '5.2s' }}>
      <button className="gb" type="button"><svg className="bd" aria-hidden="true"><rect x="0" y="0" width="100%" height="100%" /></svg><u />SCAN ARCHIVE</button>
      <span className="mw mag"><button ref={archiveButton} className="mb" type="button" aria-label="Hold Send Signal for 1.2 seconds to enter the archive" title="Hold for 1.2 seconds to enter the archive">SEND SIGNAL <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19L19 5M8 5h11v11" /></svg><i className="signal-progress" aria-hidden="true" /></button></span>
      <button className="hold" id="hold" type="button" aria-label="Hold to confirm"><svg viewBox="0 0 48 48" aria-hidden="true"><circle className="ht" cx="24" cy="24" r="21" /><circle className="hg" cx="24" cy="24" r="21" pathLength="1" transform="rotate(-90 24 24)" /><circle className="hc" cx="24" cy="24" r="3" /></svg><span className="hl"><b id="hlt">HOLD TO CONFIRM</b><em id="hold-time">1.2 SEC</em></span></button>
    </div>
    <div className="rad fade" id="rad" style={{ '--dl': '5.4s' }}><button className="it" style={{ '--n': 0 }} data-k="ARCHIVE" type="button">AR<em>ARCHIVE</em></button><button className="it" style={{ '--n': 1 }} data-k="MODS" type="button">MD<em>MODS</em></button><button className="it" style={{ '--n': 2 }} data-k="3D LAB" type="button">3D<em>3D LAB</em></button><button className="it" style={{ '--n': 3 }} data-k="LOG" type="button">LG<em>LOG</em></button><button className="it" style={{ '--n': 4 }} data-k="ABOUT" type="button">ME<em>ABOUT</em></button><button className="rt" id="rt" type="button" aria-label="Quick actions" aria-expanded="false"><svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16" /></svg></button></div>
  </>
}

function ReferenceDeckLab({ sequence, onOpen, labButton }) {
  return <>
    <div className="deck-band" aria-hidden="true" /><div className="deck-scanlines" aria-hidden="true" /><div className="floor"><i /></div>
    <svg className="bigring" viewBox="-100 -100 200 200" aria-hidden="true"><circle className="dsh" r="96" /><g className="spin"><circle className="st" r="78" /><circle cx="78" cy="0" r="2.5" fill="#EAF0FF" stroke="none" /></g><circle r="58" style={{ strokeDasharray: '1 5' }} /></svg>
    <svg className="bigring l" viewBox="-100 -100 200 200" aria-hidden="true"><g className="spin b"><circle className="dsh" r="96" /></g><circle r="70" /></svg>
    <div className="hud"><i /><i /><i /><i /></div><div className="hudl">MODULE 03<br />LAB // RESTRICTED</div><div className="hudr"><b />SIGNAL STABLE<br /><span className="clk">--:--:--</span></div><div className="rail"><i /><b>SCROLL // 02—02</b></div><div className="rail r"><i /><b>FAILED // KEPT</b></div>
    <div className="panel">
      <svg className="pf" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,8 4,0 100,0 100,92 96,100 0,100" pathLength="1" /></svg>
      <div className="lg mono"><b />LIVE LOG / 000</div><h2 className="disp" id="lh"><span className="ln l1"><span className="fx">Failed</span> experiments</span><span className="ln m l2"><span className="alive">kept alive.<svg className="loop" viewBox="0 0 200 60" preserveAspectRatio="none"><path className="draw" pathLength="1" d="M22 32 C8 10 120 -2 186 12 C208 22 190 54 118 56 C50 60 4 48 20 22 C30 8 70 6 104 6" /></svg></span></span></h2>
      <div className="rule" /><svg className="pr" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,8 4,0 100,0 100,92 96,100 0,100" pathLength="1" /></svg>
      <div className="tele"><div><span>CORE <b className="hi">0.98</b></span><br /><span>FAIL RATE <b className="hi">73%</b></span></div><div className="wv" aria-hidden="true">{Array.from({ length: 9 }, (_, n) => <u key={n} style={{ '--n': n }} />)}</div></div>
      <div className="strip"><span>BUILD 2026.10</span><i /><span>STATUS: UNSTABLE</span></div><p className="p">Notes, broken prototypes, strange tests, and half-built things. The process stays visible.</p>
      <div className="out" style={{ opacity: sequence.busy ? 1 : undefined }}><pre className="log" id="log">{sequence.log.join('\n')}</pre><div className="pb"><i id="pbi" style={{ width: `${sequence.progress}%` }} /></div></div>
      <button ref={labButton} className="cmd" id="cmd" aria-label="Open the lab" onClick={onOpen} disabled={sequence.busy}><i className="cr a" /><i className="cr b" /><i className="cr cc" /><i className="cr dd" /><span className="idx">03</span><span className="lab" id="cl">{sequence.label}</span><span className="eq" aria-hidden="true">{Array.from({ length: 7 }, (_, n) => <u key={n} style={{ '--n': n }} />)}</span><span className="arr"><svg viewBox="0 0 24 24"><path d="M5 19L19 5M8 5h11v11" /></svg></span></button>
    </div>
    {sequence.sweep && <div className="sweep" id="sw" aria-hidden="true" />}
  </>
}

function Lens() {
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const move = (event) => setPointer({ x: (event.clientX / window.innerWidth - 0.5) * 2, y: (event.clientY / window.innerHeight - 0.5) * 2 })
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])
  return <div className="lens-stage webgl-lens" aria-label="Interactive archive orb and pupil"><Canvas camera={{ position: [0, 0, 4.5], fov: 30 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}><ambientLight intensity={0.55} color="#8b9dff" /><directionalLight position={[2, 2, 3]} intensity={2.6} color="#ccd0cf" /><BackgroundPupil pointer={pointer} /><LensModel pointer={pointer} /></Canvas><div className="lens-scan">WATCHING / {String(Math.abs(Math.round(pointer.x * 99))).padStart(2, '0')}</div></div>
}

function MediaPlaceholder({ label, tone, index }) {
  return <div className={`media-placeholder media-${tone}`} style={{ '--delay': `${index * 120}ms` }}><span className="media-orbit" /><span className="media-label">{label}</span><span className="media-time">00:{String(index + 7).padStart(2, '0')}</span></div>
}

function ProjectModal({ project, onClose }) {
  if (!project) return null
  const image = safeImageUrl(project.image)
  const link = safeExternalUrl(project.link)
  return <div className="modal-backdrop" onClick={onClose}><article className="project-modal project-detail" onClick={(event) => event.stopPropagation()}><button className="close" onClick={onClose}>CLOSE ×</button><p className="label">PROJECT {project.id} / {project.status.toUpperCase()}</p><h2>{project.title}</h2><p className="detail-description">{project.description}</p>{image && <img className="project-detail-image" src={image} alt={`${project.title} preview`} />}<div className="detail-grid">{project.media.map((item, index) => <MediaPlaceholder key={item} label={item} tone={project.tone} index={index} />)}</div><div className="detail-meta"><div><span className="label">TOOLS</span><p>{project.tools.join(' / ') || 'Not logged yet'}</p></div><div><span className="label">LINK</span>{link ? <p><a className="project-live-link" href={link} target="_blank" rel="noopener noreferrer">OPEN PROJECT ↗</a></p> : <p>Link will attach here.</p>}</div></div></article></div>
}

function ProjectComposer({ onClose, onSave, deadOnly = false }) {
  const [form, setForm] = useState({ title: '', type: deadOnly ? 'FAILED / EXPERIMENT' : 'PROJECT / NEW', note: '', description: '', tools: '', link: '', image: '', tone: 'iris', status: deadOnly ? 'failed-experiment' : 'in-progress' })
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const [error, setError] = useState('')
  const readImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES) {
      setError('Use an image file smaller than 5 MB.')
      event.target.value = ''
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => setForm((current) => ({ ...current, image: String(reader.result) }))
    reader.readAsDataURL(file)
  }
  const submit = (event) => {
    event.preventDefault()
    if (!form.title.trim() || form.title.trim().length > 120) { setError('Enter a title up to 120 characters.'); return }
    if (form.note.length > 240 || form.description.length > 2000 || form.tools.length > 500) { setError('Short note, description, or tools are too long.'); return }
    if (form.link && !safeExternalUrl(form.link)) { setError('Use a valid http or https project link.'); return }
    onSave({
      ...form,
      id: `0${Date.now().toString().slice(-2)}`,
      note: form.note || 'A new signal has entered the archive.',
      description: form.description || 'A newly added project in the Kayjou archive.',
      tools: form.tools.split(',').map((tool) => tool.trim()).filter(Boolean),
      media: ['PROJECT / IMAGE', 'PROCESS / NOTES'],
       status: deadOnly ? form.status : 'in-progress',
    })
  }
  return <div className="modal-backdrop composer-backdrop" onClick={onClose}><form className="project-modal project-composer" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
    <button type="button" className="close" onClick={onClose}>CLOSE ×</button>
    <p className="label">{deadOnly ? 'LABORATORY CMS / NEW REMAINS' : 'ARCHIVE CMS / NEW EXHIBIT'}</p><h2>{deadOnly ? 'Log a dead signal.' : 'Attach a project.'}</h2>
    <div className="composer-grid">
      <label>TITLE<input value={form.title} onChange={update('title')} placeholder="Project name" required /></label>
      <label>TYPE<input value={form.type} onChange={update('type')} placeholder="3D / CODE / EXPERIMENT" /></label>
      <label className="composer-wide">SHORT NOTE<input value={form.note} onChange={update('note')} placeholder="What is this project about?" /></label>
      <label className="composer-wide">DESCRIPTION<textarea value={form.description} onChange={update('description')} placeholder="A few lines for the project detail view." rows="3" /></label>
      <label>TOOLS<input value={form.tools} onChange={update('tools')} placeholder="React, Blender, SketchUp" /></label>
      <label>LINK<input value={form.link} onChange={update('link')} placeholder="https://github.com/..." type="url" /></label>
      <label className="composer-wide">IMAGE URL<input value={form.image.startsWith('data:') ? '' : form.image} onChange={update('image')} placeholder="https://.../project.jpg" type="url" /></label>
      <label className="composer-wide file-drop">OR UPLOAD IMAGE<input onChange={readImage} type="file" accept="image/*" /></label>
       <label>VISUAL TONE<select value={form.tone} onChange={update('tone')}><option value="iris">IRIS</option><option value="slate">SLATE</option><option value="chrome">CHROME</option></select></label>
       {deadOnly ? <label>FAILURE STATE<select value={form.status} onChange={update('status')}><option value="failed-experiment">FAILED EXPERIMENT</option><option value="unfinished">UNFINISHED</option><option value="abandoned">ABANDONED</option></select></label> : <label>PROJECT STATE<select value={form.status} onChange={update('status')}><option value="in-progress">IN PROGRESS</option><option value="completed">FINISHED</option></select></label>}
    </div>
    {error && <p className="admin-message" role="alert">{error}</p>}
    {form.image && <div className="composer-preview" style={{ backgroundImage: `url(${form.image})` }} />}
    <button className="door-unlock composer-submit" type="submit"><span>{deadOnly ? 'PLACE IN GRAVEYARD' : 'PLACE IN ARCHIVE'}</span><b>↗</b></button>
  </form></div>
}

function DeleteChooser({ archiveProjects, deadProjects, onClose, onDelete }) {
  const [selected, setSelected] = useState(null)
  const choose = (bucket, project) => setSelected({ bucket, project })
  const remove = () => { if (selected) onDelete(selected.bucket, selected.project.id) }
  const choice = (bucket, project) => <button type="button" className={`delete-choice ${selected?.bucket === bucket && selected.project.id === project.id ? 'selected' : ''}`} onClick={() => choose(bucket, project)} key={`${bucket}-${project.id}`}><span>{String(project.id).padStart(3, '0')}</span><strong>{project.title}</strong><em>{project.status.replaceAll('-', ' ')}</em></button>
  return <div className="modal-backdrop delete-backdrop" onClick={onClose}><section className="project-modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title" onClick={(event) => event.stopPropagation()}>
    <button type="button" className="close" onClick={onClose}>CLOSE ×</button>
    <p className="label">ARCHIVE CONTROL / REMOVE SIGNAL</p><h2 id="delete-title">Choose a project to delete.</h2>
    <div className="delete-groups"><div><p className="delete-group-label">ARCHIVE VAULT</p>{archiveProjects.length ? archiveProjects.map((project) => choice('archive', project)) : <p className="delete-empty">NO ARCHIVE PROJECTS</p>}</div><div><p className="delete-group-label">FAILED PROJECTS</p>{deadProjects.length ? deadProjects.map((project) => choice('dead', project)) : <p className="delete-empty">NO FAILED PROJECTS</p>}</div></div>
    <div className="delete-actions"><button type="button" className="add-exhibit delete-cancel" onClick={onClose}>CANCEL</button><button type="button" className="door-unlock composer-submit delete-confirm" onClick={remove} disabled={!selected}><span>{selected ? `DELETE ${selected.project.title}` : 'SELECT A PROJECT'}</span><b>×</b></button></div>
  </section></div>
}

function AdminAuth({ session, isAdmin, onClose, onSignOut, onSession }) {
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const submit = async (event) => {
    event.preventDefault(); if (!supabase) { setMessage('Admin service is not configured for this deployment.'); return }
    setBusy(true); setMessage('')
    const result = mode === 'sign-in' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (result.error) { setMessage(result.error.message); return }
    if (result.data.session) { onSession(result.data.session); onClose() }
    else setMessage('Account created. Confirm your email, then sign in.')
  }
  if (session) return <div className="modal-backdrop admin-backdrop" onClick={onClose}><section className="project-modal admin-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button type="button" className="close" onClick={onClose}>CLOSE ×</button><p className="label">ARCHIVE CONTROL / IDENTITY</p><h2>{isAdmin ? 'Admin access granted.' : 'Account not authorized.'}</h2><p className="admin-message">{isAdmin ? 'You can now add and remove archive signals.' : 'This account is signed in but is not listed as an administrator.'}</p><button type="button" className="door-unlock composer-submit" onClick={onSignOut}><span>SIGN OUT</span><b>↗</b></button></section></div>
  return <div className="modal-backdrop admin-backdrop" onClick={onClose}><form className="project-modal admin-modal" role="dialog" aria-modal="true" onSubmit={submit} onClick={(event) => event.stopPropagation()}><button type="button" className="close" onClick={onClose}>CLOSE ×</button><p className="label">ARCHIVE CONTROL / PRIVATE ACCESS</p><h2>{mode === 'sign-in' ? 'Admin sign in.' : 'Create admin account.'}</h2><label className="admin-field">EMAIL<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label className="admin-field">PASSWORD<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength="8" required /></label>{message && <p className="admin-message">{message}</p>}<button className="door-unlock composer-submit" type="submit" disabled={busy}><span>{busy ? 'CHECKING' : mode === 'sign-in' ? 'ENTER CONTROL' : 'CREATE ACCOUNT'}</span><b>↗</b></button><button type="button" className="admin-switch" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage('') }}>{mode === 'sign-in' ? 'Create the first admin account' : 'Already have an account? Sign in'}</button></form></div>
}

function HudTelemetry() {
  const [telemetry, setTelemetry] = useState({ width: window.innerWidth, height: window.innerHeight, scroll: 0, x: 50, y: 50, mode: 'IDLE', load: 42 })
  useEffect(() => {
    let pointer = { x: 50, y: 50 }
    let lastMove = performance.now()
    const move = (event) => { pointer = { x: Math.round((event.clientX / window.innerWidth) * 100), y: Math.round((event.clientY / window.innerHeight) * 100) }; lastMove = performance.now() }
    const update = () => setTelemetry({ width: window.innerWidth, height: window.innerHeight, scroll: Math.round(window.scrollY), x: pointer.x, y: pointer.y, mode: performance.now() - lastMove < 800 ? 'TRACKING' : 'SCANNING', load: Math.round(38 + Math.abs(Math.sin(performance.now() / 1700)) * 33) })
    window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('resize', update); window.addEventListener('scroll', update, { passive: true })
    const timer = window.setInterval(update, 260); update()
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('resize', update); window.removeEventListener('scroll', update); window.clearInterval(timer) }
  }, [])
  return <aside className="hud-telemetry" aria-hidden="true">
    <span className="hud-tick hud-tick-a">+</span><span className="hud-tick hud-tick-b">+</span>
    <div className="hud-readout hud-readout-left"><span>VIEWPORT / ACTIVE</span><strong>{telemetry.width} × {telemetry.height}</strong><i><b style={{ width: `${telemetry.load}%` }} /></i><small>RENDER LOAD / {telemetry.load}%</small></div>
    <div className="hud-readout hud-readout-right"><span>POINTER VECTOR</span><strong>{String(telemetry.x).padStart(3, '0')} / {String(telemetry.y).padStart(3, '0')}</strong><small>SCROLL / {String(telemetry.scroll).padStart(4, '0')} PX</small><em>{telemetry.mode}</em></div>
    <div className="hud-signal-line"><span /><span /><span /><span /><span /></div>
  </aside>
}

function GalaxyDimension({ projects, origin, closing, onClose, onAddDeadProject, onDeleteProject, canManage }) {
  const frame = useRef(null)
  const exit = useRef(null)
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const galaxyProjects = useMemo(() => projects.filter((project) => project.status !== 'completed').map((project, index) => ({
    name: project.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `project_${index + 1}`,
    years: '2024–26',
    lang: project.type || 'EXPERIMENT',
    pct: project.status === 'failed-experiment' ? 28 : 62,
    cause: project.description || project.note || 'The signal stopped before the project resolved.',
    code: [`// ${project.title}`, `const tools = [${project.tools.join(', ')}]`, '/* unfinished signal */', project.note || '// TODO: continue', 'return unresolved;'],
  })), [projects])
  const sendProjects = () => frame.current?.contentWindow?.postMessage({ type: 'lab-projects', projects: galaxyProjects }, window.location.origin)
  useEffect(() => { sendProjects() }, [galaxyProjects])
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key === 'Tab') { event.preventDefault(); exit.current?.focus() }
    }
    window.addEventListener('keydown', handleKey)
    window.setTimeout(() => exit.current?.focus(), 80)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', handleKey) }
  }, [onClose])
  return <div className={`lab-dimension ${closing ? 'lab-dimension-closing' : ''} ${reducedMotion ? 'lab-dimension-reduced' : ''}`} style={{ '--portal-x': `${origin.x}px`, '--portal-y': `${origin.y}px`, clipPath: reducedMotion ? `circle(${closing ? 0 : 150}% at ${origin.x}px ${origin.y}px)` : undefined }} role="dialog" aria-modal="true" aria-label="Dimension 01, the unfinished galaxy">
    <iframe ref={frame} src={appAsset('lab-galaxy.html')} title="Unfinished project galaxy" tabIndex="-1" onLoad={sendProjects} />
    <div className="lab-dimension-chrome"><span>DIMENSION 01 / THE LAB</span><div className="lab-dimension-actions">{canManage && <><button onClick={onAddDeadProject}>ADD DEAD PROJECT +</button><button onClick={onDeleteProject}>DELETE PROJECT −</button></>}<button ref={exit} onClick={onClose}>EXIT ↙</button></div></div>
  </div>
}

function ArchiveDimension({ projects, origin, onClose, onProject, onAdd, onDelete, canManage }) {
  const frameRef = useRef(null)
  const vaultProjects = useMemo(() => projects.map((project, index) => ({
    id: String(project.id).padStart(3, '0'), title: project.title,
    cat: project.type?.split('/')[0]?.trim().toUpperCase() || 'OTHER',
    status: (project.status || 'IN PROGRESS').replaceAll('-', ' ').toUpperCase(),
    desc: project.note || project.description || '', logged: project.logged || '2026.10',
    files: project.tools?.length || 0, sig: Math.max(.35, .92 - index * .08),
  })), [projects])
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const key = (event) => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }
    const receive = (event) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return
      const message = event.data
      if (message?.type === 'vault:exit') onClose()
      if (message?.type === 'vault:add' && canManage) onAdd()
      if (message?.type === 'vault:delete' && canManage) onDelete()
      if (message?.type === 'vault:open') {
        const project = projects.find((item) => String(item.id).padStart(3, '0') === message.project?.id)
        if (project) onProject(project)
      }
      if (message?.type === 'vault:motion') {
        try { localStorage.setItem('vault.motion', message.enabled ? '1' : '0') } catch { /* storage may be blocked */ }
        document.documentElement.classList.toggle('rm', !message.enabled)
        window.dispatchEvent(new CustomEvent('vault-motion', { detail: { enabled: message.enabled } }))
      }
    }
    window.addEventListener('keydown', key)
    window.addEventListener('message', receive)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', key); window.removeEventListener('message', receive) }
  }, [canManage, onClose, onAdd, onDelete, onProject, projects])
  useEffect(() => { frameRef.current?.contentWindow?.postMessage({ type: 'vault:projects', projects: vaultProjects, admin: canManage }, window.location.origin) }, [canManage, vaultProjects])
  return <section className="archive-dimension memory-vault" style={{ '--archive-origin-x': `${origin.x}px`, '--archive-origin-y': `${origin.y}px` }} role="dialog" aria-modal="true" aria-label="Archive dimension">
    <iframe ref={frameRef} src={appAsset('vault.html')} title="Memory Vault" onLoad={() => frameRef.current?.contentWindow?.postMessage({ type: 'vault:projects', projects: vaultProjects, admin: canManage }, window.location.origin)} />
  </section>
}

function BetterAirlock({ origin, onOpen }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const receive = (event) => { if (event.origin === window.location.origin && event.data?.type === 'archive-airlock-open') onOpen() }
    window.addEventListener('message', receive)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('message', receive) }
  }, [onOpen])
  return <div className="better-airlock-layer" style={{ '--airlock-origin-x': `${origin.x}px`, '--airlock-origin-y': `${origin.y}px` }} role="dialog" aria-modal="true" aria-label="Archive airlock"><iframe src={appAsset('archive-airlock.html')} title="Archive airlock" /></div>
}

function App() {
  const [sound, setSound] = useState(false)
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminAuthOpen, setAdminAuthOpen] = useState(false)
  const [cloudReady, setCloudReady] = useState(false)
  const [activeProject, setActiveProject] = useState(null)
  const [visibleProjects, setVisibleProjects] = useState([])
  const archiveReady = true
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [airlockOpen, setAirlockOpen] = useState(false)
  const [airlockOrigin, setAirlockOrigin] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const [archiveOrigin, setArchiveOrigin] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const [archiveProjects, setArchiveProjects] = useState(() => projects.filter((project) => !isDeadProject(project)))
  const [deadProjects, setDeadProjects] = useState(() => projects.filter(isDeadProject))
  const [composerOpen, setComposerOpen] = useState(false)
  const [deleteChooserOpen, setDeleteChooserOpen] = useState(false)
  const [labOpen, setLabOpen] = useState(false)
  const [labClosing, setLabClosing] = useState(false)
  const [labSequence, setLabSequence] = useState({ busy: false, label: 'OPEN THE LAB', log: [], progress: 0, sweep: false })
  const [deadComposerOpen, setDeadComposerOpen] = useState(false)
  const [labOrigin, setLabOrigin] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const audio = useRef(null)
  const labButton = useRef(null)
  const archiveButton = useRef(null)
  const closingLab = useRef(false)
  useEffect(() => {
    if (!supabase) return undefined
    let alive = true
    supabase.auth.getSession().then(({ data }) => { if (alive) setSession(data.session) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (alive) setSession(nextSession) })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    if (!supabase || !session?.user?.id) { setIsAdmin(false); return undefined }
    let alive = true
    supabase.rpc('is_archive_admin').then(({ data, error }) => { if (alive) setIsAdmin(!error && data === true) })
    return () => { alive = false }
  }, [session])
  useEffect(() => {
    try {
      const deleted = JSON.parse(window.localStorage.getItem(DELETED_PROJECT_KEY) || '[]')
      const deletedIds = new Set(Array.isArray(deleted) ? deleted.map(String) : [])
      const saved = JSON.parse(window.localStorage.getItem(ARCHIVE_PROJECT_KEY) || '[]')
      const savedArchive = Array.isArray(saved) ? saved.filter((project) => !isDeadProject(project)) : []
      const legacyDead = Array.isArray(saved) ? saved.filter(isDeadProject) : []
      const savedDead = JSON.parse(window.localStorage.getItem(DEAD_PROJECT_KEY) || '[]')
      const customDead = [...legacyDead, ...(Array.isArray(savedDead) ? savedDead : [])].filter((project, index, list) => project?.id && list.findIndex((item) => item.id === project.id) === index)
      setArchiveProjects(projects.filter((project) => !isDeadProject(project) && !deletedIds.has(String(project.id))).concat(savedArchive.filter((project) => !deletedIds.has(String(project.id)))))
      setDeadProjects(projects.filter(isDeadProject).concat(customDead.filter((project) => !deletedIds.has(String(project.id)))))
    } catch { /* local storage can be unavailable in private browsing */ }
  }, [])
  useEffect(() => {
    if (!supabase) return undefined
    let alive = true
    supabase.from('projects').select('*').order('created_at', { ascending: true }).then(({ data, error }) => {
      if (!alive || error || !Array.isArray(data)) return
      setCloudReady(true)
      if (!data.length) return
      const loaded = data.map(fromRow)
      setArchiveProjects(loaded.filter((project) => project.bucket !== 'dead' && !isDeadProject(project)))
      setDeadProjects(loaded.filter((project) => project.bucket === 'dead' || isDeadProject(project)))
    })
    return () => { alive = false }
  }, [])
  useEffect(() => { const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && setVisibleProjects((current) => [...new Set([...current, entry.target.dataset.project])])), { threshold: 0.18 }); document.querySelectorAll('[data-project]').forEach((element) => observer.observe(element)); return () => observer.disconnect() }, [])
  const animateLabClose = useCallback(() => {
    if (!labOpen || closingLab.current) return
    closingLab.current = true
    setLabClosing(true)
    window.setTimeout(() => { setLabOpen(false); setLabClosing(false); closingLab.current = false; window.setTimeout(() => labButton.current?.focus(), 40) }, 720)
  }, [labOpen])
  useEffect(() => {
    const onPopState = () => { if (window.location.hash !== '#lab') animateLabClose() }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [animateLabClose])
  const openLab = () => {
    const rect = labButton.current?.getBoundingClientRect()
    setLabOrigin(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 })
    closingLab.current = false
    window.history.pushState({ lab: true }, '', '#lab')
    setLabOpen(true)
  }
  const runLabSequence = async () => {
    if (labSequence.busy) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, reduced ? 20 : ms))
    const setLabel = (label) => setLabSequence((current) => ({ ...current, label }))
    const addLog = async (line) => { await wait(line.length * 13); setLabSequence((current) => ({ ...current, log: [...current.log.slice(-7), line] })) }
    setLabSequence({ busy: true, label: 'ACCESSING', log: [], progress: 0, sweep: false })
    await wait(700)
    const lines = ['> opening /lab', '> loading Untitled Spatial Study ... ok', '> loading Mod Archive ............. ok', '> loading Signal / Noise .......... failed', '> kept it anyway.']
    for (let index = 0; index < lines.length; index += 1) { await addLog(lines[index]); setLabSequence((current) => ({ ...current, progress: ((index + 1) / lines.length) * 100 })); await wait(180) }
    setLabel('ENTERING'); await wait(500); setLabSequence((current) => ({ ...current, sweep: true })); await wait(reduced ? 20 : 800); document.dispatchEvent(new CustomEvent('lab:enter')); openLab(); await wait(500); setLabSequence({ busy: false, label: 'OPEN THE LAB', log: [], progress: 0, sweep: false })
  }
  const openArchive = (source = archiveButton.current) => {
    const rect = source?.getBoundingClientRect()
    const point = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    setAirlockOrigin(point)
    setArchiveOrigin({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    setAirlockOpen(true)
  }
  const closeArchive = () => { setArchiveOpen(false); window.dispatchEvent(new Event('archive:closed')) }
  useEffect(() => {
    const enterArchive = (event) => openArchive(event.detail?.source || archiveButton.current)
    window.addEventListener('archive:enter', enterArchive)
    return () => window.removeEventListener('archive:enter', enterArchive)
  }, [])
  const closeLab = () => { if (window.location.hash === '#lab') window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`); animateLabClose() }
  const toggleSound = () => {
    if (!sound) {
      const context = new (window.AudioContext || window.webkitAudioContext)()
      const master = context.createGain(); master.gain.value = 0.0001; master.connect(context.destination)
      const low = context.createOscillator(); const high = context.createOscillator()
      const lowGain = context.createGain(); const highGain = context.createGain()
      low.type = 'sine'; low.frequency.value = 47; lowGain.gain.value = 0.035
      high.type = 'triangle'; high.frequency.value = 73; highGain.gain.value = 0.012
      low.connect(lowGain).connect(master); high.connect(highGain).connect(master)
      low.start(); high.start(); master.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 1.4)
      audio.current = { context, master, low, high }; setSound(true)
    } else {
      const active = audio.current
      if (active) { active.master.gain.exponentialRampToValueAtTime(0.0001, active.context.currentTime + 0.5); window.setTimeout(() => { active.low.stop(); active.high.stop(); active.context.close() }, 700) }
      setSound(false)
    }
  }
  const addProject = async (project, bucket = 'archive') => {
    if (!isAdmin) return
    if (supabase && cloudReady) {
      const { data: allowed, error: rateError } = await supabase.rpc('check_admin_rate_limit', { action_name: 'project_write' })
      if (rateError || allowed !== true) return
    }
    const isDead = bucket === 'dead'
    const setProjects = isDead ? setDeadProjects : setArchiveProjects
    const storageKey = isDead ? DEAD_PROJECT_KEY : ARCHIVE_PROJECT_KEY
    setProjects((current) => [...current, project])
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
      window.localStorage.setItem(storageKey, JSON.stringify([...(Array.isArray(saved) ? saved : []), project]))
    } catch { /* keep the project in the current session if storage is blocked */ }
    if (supabase && cloudReady) await supabase.from('projects').upsert(toRow(project, bucket), { onConflict: 'bucket,id' })
    setComposerOpen(false)
  }
  const deleteProject = async (bucket, id) => {
    if (!isAdmin) return
    if (supabase && cloudReady) {
      const { data: allowed, error: rateError } = await supabase.rpc('check_admin_rate_limit', { action_name: 'project_delete' })
      if (rateError || allowed !== true) return
    }
    const setProjects = bucket === 'dead' ? setDeadProjects : setArchiveProjects
    setProjects((current) => current.filter((project) => String(project.id) !== String(id)))
    try {
      const deleted = JSON.parse(window.localStorage.getItem(DELETED_PROJECT_KEY) || '[]')
      const ids = Array.isArray(deleted) ? deleted.map(String) : []
      if (!ids.includes(String(id))) window.localStorage.setItem(DELETED_PROJECT_KEY, JSON.stringify([...ids, String(id)]))
      for (const key of [ARCHIVE_PROJECT_KEY, DEAD_PROJECT_KEY]) {
        const saved = JSON.parse(window.localStorage.getItem(key) || '[]')
        if (Array.isArray(saved)) window.localStorage.setItem(key, JSON.stringify(saved.filter((project) => String(project.id) !== String(id))))
      }
    } catch { /* keep the deletion in the current session if storage is blocked */ }
    if (supabase && cloudReady) await supabase.from('projects').delete().eq('bucket', bucket).eq('id', String(id))
    setDeleteChooserOpen(false)
  }
  return <main><div className="site-content" aria-hidden={labOpen ? 'true' : undefined} inert={labOpen || undefined}>
    <OceanBackground /><HudTelemetry /><DeckRuntime />
    <div className="grain" />
    <header className="topbar" id="top"><a className="brand" href="#top"><img className="brand-mark" src={appAsset('favicon.svg')} alt="Archive 04 mark" width="27" height="27" /><span className="brand-type"><small>ARCHIVE</small><b>04</b></span></a><div className="status"><span className="status-dot" /> SYSTEM / OBSERVING</div><div className="topbar-actions"><button className="admin-control" onClick={() => setAdminAuthOpen(true)}>{isAdmin ? 'ADMIN / ON' : 'ADMIN ACCESS'}</button><button className="sound-control" onClick={toggleSound} aria-label="Toggle ambient sound">{sound ? 'SOUND ON' : 'SOUND OFF'} <span className={sound ? 'sound-bars active' : 'sound-bars'}><i /><i /><i /></span></button></div></header>
    <section className="hero frame play" id="hero"><InfoGraphics variant="hero" /><div className="hero-background-model" aria-hidden="true"><Canvas camera={{ position: [0, 0, 7], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}><ambientLight intensity={0.3} /><BackgroundArchitecture /></Canvas></div><ReferenceDeckHero archiveButton={archiveButton} /><div className="hero-object"><Lens /></div><div className="hero-coordinates">DEPTH 04.02<br />LAT 36°48'N<br />STATUS: UNFINISHED</div><div className="hero-caption">THE ARCHIVE LENS / SPECIMEN 001</div></section>
    <section className="intro section-shell"><InfoGraphics variant="entry" /><SectionArchitecture variant="entry" /><p className="section-index">01 / ENTRY LOG</p><div className="intro-grid"><h2>Not everything here<br /><span>is finished.</span></h2><p>I’m Kayjou. I work between code, 3D space, game mods, and whatever experiment refuses to leave me alone. This is where the finished work and the interesting failures live together.</p></div></section>
    <section className={`archive section-shell archive-reveal-stage ${archiveReady ? 'archive-entry-open' : 'archive-entry-locked'}`} id="archive" style={{ '--archive-open-progress': 1 }}><InfoGraphics variant="gallery" /><SectionArchitecture variant="gallery" /><div className="section-heading"><p className="section-index">02 / THE ARCHIVE</p><div className="archive-heading-actions">{archiveReady && isAdmin && <button className="add-exhibit" onClick={() => setComposerOpen(true)}>ADD EXHIBIT +</button>}<span>{archiveReady ? 'SCROLL TO EXAMINE' : 'ACCESS SEALED'}</span></div></div><div className="archive-entry"><div className="project-list">{archiveProjects.map((project, index) => { const image = safeImageUrl(project.image); return <button className={`project project-${project.tone} ${archiveReady ? 'archive-project-enter' : ''} ${visibleProjects.includes(project.id) ? 'project-visible' : ''}`} style={{ '--archive-row-delay': `${index * 90}ms` }} data-project={project.id} key={project.id} onClick={() => setActiveProject(project)} disabled={!archiveReady}><span className="project-id">{project.id}</span><span className="project-visual" style={image ? { backgroundImage: `linear-gradient(135deg, #040b27aa, #121f5055), url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><span className="visual-shape" /><span className="visual-scanline" /><span className="project-callout">EXHIBIT / {project.id}</span></span><span className="project-info"><small>{project.type}</small><strong>{project.title}</strong><em>{project.note}</em><span className="project-status">STATUS // {project.status.replace('-', ' ')}</span></span><span className="project-arrow">↗</span></button>})}</div></div></section>
    <section className={`lab section-shell frame play${labSequence.busy ? ' run' : ''}`} id="lab"><InfoGraphics variant="lab" /><SectionArchitecture variant="lab" /><ReferenceDeckLab sequence={labSequence} onOpen={runLabSequence} labButton={labButton} /></section>
    <footer className="footer section-shell" id="contact"><InfoGraphics variant="atrium" /><SectionArchitecture variant="atrium" /><p className="section-index">04 / CONTACT CHAMBER</p><h2>Find me outside<br /><span>the archive.</span></h2><div className="footer-links"><a href="https://github.com/Real-Kayjou" target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href="https://www.instagram.com/kay.jou/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="mailto:saiftig450@gmail.com">Email ↗</a><a href={appAsset('privacy.html')}>Privacy / data ↗</a></div><p className="copyright">ARCHIVE 04 / KAYJOU / 2026</p></footer>
    <ProjectModal project={activeProject} onClose={() => setActiveProject(null)} />
    {composerOpen && <ProjectComposer onClose={() => setComposerOpen(false)} onSave={(project) => addProject(project, 'archive')} />}
    </div><span className="sr-only" aria-live="polite">{archiveReady ? 'Archive open' : ''}</span>{adminAuthOpen && <AdminAuth session={session} isAdmin={isAdmin} onClose={() => setAdminAuthOpen(false)} onSignOut={() => supabase?.auth.signOut()} onSession={setSession} />}{airlockOpen && <BetterAirlock origin={airlockOrigin} onOpen={() => { setAirlockOpen(false); setArchiveOpen(true) }} />}{archiveOpen && <ArchiveDimension projects={archiveProjects} origin={archiveOrigin} onClose={closeArchive} onProject={(project) => { closeArchive(); setActiveProject(project) }} onAdd={() => { closeArchive(); setComposerOpen(true) }} onDelete={() => setDeleteChooserOpen(true)} canManage={isAdmin} />}{labOpen && <GalaxyDimension projects={deadProjects} origin={labOrigin} closing={labClosing} onClose={closeLab} onAddDeadProject={() => setDeadComposerOpen(true)} onDeleteProject={() => setDeleteChooserOpen(true)} canManage={isAdmin} />}{deadComposerOpen && isAdmin && <div className="lab-compose-layer"><ProjectComposer deadOnly onClose={() => setDeadComposerOpen(false)} onSave={(project) => { addProject(project, 'dead'); setDeadComposerOpen(false) }} /></div>}{deleteChooserOpen && isAdmin && <DeleteChooser archiveProjects={archiveProjects} deadProjects={deadProjects} onClose={() => setDeleteChooserOpen(false)} onDelete={deleteProject} />}
  </main>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
