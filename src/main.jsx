import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { projects } from './content/projects'
import './styles.css'

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
    const move = event => frame.contentWindow?.postMessage({ type: 'deep-ocean-pointer', clientX: event.clientX, clientY: event.clientY }, '*')
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
  return <div className="modal-backdrop" onClick={onClose}><article className="project-modal project-detail" onClick={(event) => event.stopPropagation()}><button className="close" onClick={onClose}>CLOSE ×</button><p className="label">PROJECT {project.id} / {project.status.toUpperCase()}</p><h2>{project.title}</h2><p className="detail-description">{project.description}</p>{project.image && <img className="project-detail-image" src={project.image} alt={`${project.title} preview`} />}<div className="detail-grid">{project.media.map((item, index) => <MediaPlaceholder key={item} label={item} tone={project.tone} index={index} />)}</div><div className="detail-meta"><div><span className="label">TOOLS</span><p>{project.tools.join(' / ') || 'Not logged yet'}</p></div><div><span className="label">LINK</span>{project.link ? <p><a className="project-live-link" href={project.link} target="_blank" rel="noreferrer">OPEN PROJECT ↗</a></p> : <p>Link will attach here.</p>}</div></div></article></div>
}

function ArchiveDoor({ state, onOpen }) {
  return <div className={`archive-door archive-door-${state}`} role="dialog" aria-label="Archive entrance">
    <div className="door-ceiling"><i /><i /><i /><i /><i /></div>
    <div className="door-frame door-frame-left"><span /><span /><span /></div>
    <div className="door-frame door-frame-right"><span /><span /><span /></div>
    <div className="door-panel door-panel-left"><div className="door-vent vent-left"><i /><i /><i /><i /><i /><i /></div><div className="door-light light-left" /><div className="door-circuit circuit-left" /></div>
    <div className="door-panel door-panel-right"><div className="door-vent vent-right"><i /><i /><i /><i /><i /><i /></div><div className="door-light light-right" /><div className="door-circuit circuit-right" /></div>
    <div className="door-center-line"><span /><span /><span /></div>
    <div className="door-core"><i /><i /><i /><b /></div>
    <div className="door-status"><span className="status-dot" /> ARCHIVE AIRLOCK / {state === 'locked' ? 'SEALED' : state === 'opening' ? 'OPENING' : 'ACCESS GRANTED'}</div>
    {state !== 'open' && <button className="door-unlock" onClick={onOpen} disabled={state === 'opening'}><span>{state === 'opening' ? 'OPENING CHAMBER' : 'UNLOCK ARCHIVE'}</span><b>↘</b></button>}
  </div>
}

function ProjectComposer({ onClose, onSave, deadOnly = false }) {
  const [form, setForm] = useState({ title: '', type: deadOnly ? 'FAILED / EXPERIMENT' : 'PROJECT / NEW', note: '', description: '', tools: '', link: '', image: '', tone: 'iris', status: 'failed-experiment' })
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const readImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((current) => ({ ...current, image: String(reader.result) }))
    reader.readAsDataURL(file)
  }
  const submit = (event) => {
    event.preventDefault()
    if (!form.title.trim()) return
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
       {deadOnly && <label>FAILURE STATE<select value={form.status} onChange={update('status')}><option value="failed-experiment">FAILED EXPERIMENT</option><option value="unfinished">UNFINISHED</option><option value="abandoned">ABANDONED</option></select></label>}
    </div>
    {form.image && <div className="composer-preview" style={{ backgroundImage: `url(${form.image})` }} />}
    <button className="door-unlock composer-submit" type="submit"><span>{deadOnly ? 'PLACE IN GRAVEYARD' : 'PLACE IN ARCHIVE'}</span><b>↗</b></button>
  </form></div>
}

function LabChamber({ projects, onClose, onSelect }) {
  const remains = projects.filter((project) => project.status !== 'completed')
  return <div className="lab-chamber" role="dialog" aria-label="Failed experiments laboratory">
    <div className="lab-chamber-grid" /><div className="lab-chamber-noise" />
    <header className="lab-chamber-header"><span>03 / THE LABORATORY / NULL SECTOR</span><span>RECOVERY MODE / {String(remains.length).padStart(2, '0')} SIGNALS</span><button onClick={onClose}>EXIT LAB ×</button></header>
    <div className="lab-chamber-shell">
      <aside className="lab-rail"><span className="lab-rail-mark">//</span><span>UNFINISHED<br />ARCHIVE</span><b>NO<br />DELETION</b><i /><small>DEPTH 03.17<br />SIGNAL LOSS: ACTIVE</small></aside>
      <main className="lab-chamber-main"><div className="lab-chamber-title"><p className="label">RECOVERED LOGS / PROCESS REMAINS</p><h2>Things that<br /><em>did not resolve.</em></h2><p>Failed prototypes, abandoned directions, and ideas left in the pressure chamber. Nothing here is clean. That is the point.</p></div><div className="lab-readout"><span>ARCHIVE INTEGRITY</span><strong>47%</strong><i><b /></i><small>THESE SIGNALS WERE NOT FINISHED</small></div><div className="lab-dead-grid">{remains.map((project, index) => <button className={`lab-dead-card lab-dead-${project.tone}`} key={project.id} onClick={() => onSelect(project)}><span className="lab-card-index">LOG / {project.id}</span><span className="lab-card-status">{project.status === 'failed-experiment' ? 'FAILED' : 'UNFINISHED'}</span><span className="lab-card-image" style={project.image ? { backgroundImage: `linear-gradient(135deg,#040b27aa,#121f5066),url(${project.image})` } : undefined}><span className="lab-card-signal">SIGNAL / {String(index + 1).padStart(2, '0')}</span><span className="lab-card-ring" /></span><span className="lab-card-copy"><small>{project.type}</small><strong>{project.title}</strong><em>{project.note}</em><span>{project.tools.join(' / ')}</span></span><span className="lab-card-arrow">↗</span></button>)}</div>{remains.length === 0 && <div className="lab-empty">NO UNFINISHED SIGNALS FOUND / ADD A PROJECT TO BEGIN A NEW FAILURE LOG.</div>}</main>
    </div>
  </div>
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

function GalaxyDimension({ projects, origin, closing, onClose, onAddDeadProject }) {
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
  const sendProjects = () => frame.current?.contentWindow?.postMessage({ type: 'lab-projects', projects: galaxyProjects }, '*')
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
    <iframe ref={frame} src="/lab-galaxy.html" title="Unfinished project galaxy" tabIndex="-1" onLoad={sendProjects} />
    <div className="lab-dimension-chrome"><span>DIMENSION 01 / THE LAB</span><div className="lab-dimension-actions"><button onClick={onAddDeadProject}>ADD DEAD PROJECT +</button><button ref={exit} onClick={onClose}>EXIT ↙</button></div></div>
  </div>
}

function App() {
  const [sound, setSound] = useState(false)
  const [activeProject, setActiveProject] = useState(null)
  const [visibleProjects, setVisibleProjects] = useState([])
  const [archiveDoor, setArchiveDoor] = useState('locked')
  const [archiveProjects, setArchiveProjects] = useState(projects)
  const [composerOpen, setComposerOpen] = useState(false)
  const [labOpen, setLabOpen] = useState(false)
  const [labClosing, setLabClosing] = useState(false)
  const [deadComposerOpen, setDeadComposerOpen] = useState(false)
  const [labOrigin, setLabOrigin] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const audio = useRef(null)
  const labButton = useRef(null)
  const closingLab = useRef(false)
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('archive-04-custom-projects') || '[]')
      if (Array.isArray(saved) && saved.length) setArchiveProjects([...projects, ...saved])
    } catch { /* local storage can be unavailable in private browsing */ }
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
  const unlockArchive = () => {
    if (archiveDoor !== 'locked') return
    setArchiveDoor('opening')
    window.setTimeout(() => setArchiveDoor('open'), 1250)
  }
  const addProject = (project) => {
    setArchiveProjects((current) => [...current, project])
    try {
      const saved = JSON.parse(window.localStorage.getItem('archive-04-custom-projects') || '[]')
      window.localStorage.setItem('archive-04-custom-projects', JSON.stringify([...saved, project]))
    } catch { /* keep the project in the current session if storage is blocked */ }
    setComposerOpen(false)
  }
  return <main><div className="site-content" aria-hidden={labOpen ? 'true' : undefined} inert={labOpen || undefined}>
    <OceanBackground /><HudTelemetry />
    <div className="grain" />
    <header className="topbar"><a className="brand" href="#top"><img className="brand-mark" src="/favicon.svg" alt="Archive 04 mark" width="27" height="27" /><span className="brand-type"><small>ARCHIVE</small><b>04</b></span></a><div className="status"><span className="status-dot" /> SYSTEM / OBSERVING</div><button className="sound-control" onClick={toggleSound} aria-label="Toggle ambient sound">{sound ? 'SOUND ON' : 'SOUND OFF'} <span className={sound ? 'sound-bars active' : 'sound-bars'}><i /><i /><i /></span></button></header>
    <section className="hero" id="top"><InfoGraphics variant="hero" /><div className="hero-background-model" aria-hidden="true"><Canvas camera={{ position: [0, 0, 7], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}><ambientLight intensity={0.3} /><BackgroundArchitecture /></Canvas></div><div className="hero-copy"><p className="eyebrow">KAYJOU / SAIF EDINE JBALI / DIGITAL ARCHIVE</p><h1>I make things with<br /><em>CODE, 3D,</em> and experiments.</h1><p className="hero-note">A collection of spaces, systems, mods, and unfinished ideas. Enter carefully.</p><a className="enter-link hud-button" href="#archive"><span>ENTER THE ARCHIVE</span><b>↘</b></a></div><div className="hero-object"><Lens /></div><div className="hero-coordinates">DEPTH 04.02<br />LAT 36°48'N<br />STATUS: UNFINISHED</div><div className="hero-caption">THE ARCHIVE LENS / SPECIMEN 001</div></section>
    <section className="intro section-shell"><InfoGraphics variant="entry" /><SectionArchitecture variant="entry" /><p className="section-index">01 / ENTRY LOG</p><div className="intro-grid"><h2>Not everything here<br /><span>is finished.</span></h2><p>I’m Kayjou. I work between code, 3D space, game mods, and whatever experiment refuses to leave me alone. This is where the finished work and the interesting failures live together.</p></div></section>
    <section className="archive section-shell" id="archive"><InfoGraphics variant="gallery" /><SectionArchitecture variant="gallery" /><div className="section-heading"><p className="section-index">02 / THE ARCHIVE</p><div className="archive-heading-actions">{archiveDoor === 'open' && <button className="add-exhibit" onClick={() => setComposerOpen(true)}>ADD EXHIBIT +</button>}<span>{archiveDoor === 'open' ? 'SCROLL TO EXAMINE' : 'ACCESS SEALED'}</span></div></div><div className={`archive-entry archive-entry-${archiveDoor}`}><div className="project-list">{archiveProjects.map((project) => <button className={`project project-${project.tone} ${visibleProjects.includes(project.id) ? 'project-visible' : ''}`} data-project={project.id} key={project.id} onClick={() => setActiveProject(project)} disabled={archiveDoor !== 'open'}><span className="project-id">{project.id}</span><span className="project-visual" style={project.image ? { backgroundImage: `linear-gradient(135deg, #040b27aa, #121f5055), url(${project.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><span className="visual-shape" /><span className="visual-scanline" /><span className="project-callout">EXHIBIT / {project.id}</span></span><span className="project-info"><small>{project.type}</small><strong>{project.title}</strong><em>{project.note}</em><span className="project-status">STATUS // {project.status.replace('-', ' ')}</span></span><span className="project-arrow">↗</span></button>)}</div><ArchiveDoor state={archiveDoor} onOpen={unlockArchive} /></div></section>
    <section className="lab section-shell"><InfoGraphics variant="lab" /><SectionArchitecture variant="lab" /><p className="section-index">03 / THE LABORATORY</p><div className="lab-card"><span className="panel-corner corner-a" /><span className="panel-corner corner-b" /><div><p className="label">LIVE LOG / 000</p><h2>Failed experiments<br /><i>kept alive.</i></h2></div><p className="lab-copy">Notes, broken prototypes, strange tests, and half-built things. The process stays visible.</p><button ref={labButton} className="glass-button hud-button" onClick={openLab}><span>OPEN THE LAB</span><b>↗</b></button></div></section>
    <footer className="footer section-shell" id="contact"><InfoGraphics variant="atrium" /><SectionArchitecture variant="atrium" /><p className="section-index">04 / CONTACT CHAMBER</p><h2>Find me outside<br /><span>the archive.</span></h2><div className="footer-links"><a href="https://github.com/Real-Kayjou" target="_blank">GitHub ↗</a><a href="https://www.instagram.com/kay.jou/" target="_blank">Instagram ↗</a><a href="mailto:saiftig450@gmail.com">Email ↗</a></div><p className="copyright">ARCHIVE 04 / KAYJOU / 2026</p></footer>
    <ProjectModal project={activeProject} onClose={() => setActiveProject(null)} />
    {composerOpen && <ProjectComposer onClose={() => setComposerOpen(false)} onSave={addProject} />}
    </div>{labOpen && <GalaxyDimension projects={archiveProjects} origin={labOrigin} closing={labClosing} onClose={closeLab} onAddDeadProject={() => setDeadComposerOpen(true)} />}{deadComposerOpen && <div className="lab-compose-layer"><ProjectComposer deadOnly onClose={() => setDeadComposerOpen(false)} onSave={(project) => { addProject(project); setDeadComposerOpen(false) }} /></div>}
  </main>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
