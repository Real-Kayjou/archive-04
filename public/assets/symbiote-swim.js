function SymbiotePupil(container) {
  const W = () => container.clientWidth, H = () => container.clientHeight;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 768px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setSize(W(), H());
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W() / H(), 0.1, 100);
  camera.position.set(0, 0, 7.5);

  const uTime = { value: 0 };

  const NOISE = `
    vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
    vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
    vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g;
      vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
      float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.*floor(p*ns.z*ns.z);
      vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy;
      vec4 h=1.-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.;
      vec4 sh=-step(h,vec4(0.));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
      m=m*m;
      return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }
    /* palette ramp: #121F50 -> #2A3B80 -> #4255B2 -> #6274E0, ping-pongs with t */
    vec3 irid(float t){
      float p=abs(fract(t)*2.-1.)*3.;
      vec3 c1=vec3(.071,.122,.314), c2=vec3(.165,.231,.502), c3=vec3(.259,.333,.698), c4=vec3(.384,.455,.878);
      vec3 c=mix(c1,c2,clamp(p,0.,1.));
      c=mix(c,c3,clamp(p-1.,0.,1.));
      c=mix(c,c4,clamp(p-2.,0.,1.));
      return c;
    }
  `;

  const group = new THREE.Group();
  scene.add(group); group.scale.setScalar(0.85);

  /* ---- glow behind ---- */
  function radialTex(stops) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(128,128,0,128,128,128);
    stops.forEach(s => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr; g.fillRect(0,0,256,256);
    return new THREE.CanvasTexture(c);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTex([[0,'rgba(98,116,224,0.55)'],[0.4,'rgba(42,59,128,0.28)'],[1,'rgba(4,11,39,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(9, 9, 1); glow.position.z = -1.5;
  scene.add(glow);

  /* ---- goo core ---- */
  const gooMat = new THREE.ShaderMaterial({
    uniforms: { uTime },
    vertexShader: NOISE + `
      uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      float disp(vec3 p){
        float calm=1.-smoothstep(.5,.9,normalize(p).z)*.85; /* front face stays smooth so the eyes sit clean */
        return (snoise(p*1.4+vec3(0.,uTime*.35,0.))*.14 + snoise(p*3.2-uTime*.5)*.04)*calm;
      }
      void main(){
        vec3 n=normalize(normal);
        vec3 t=normalize(cross(n,abs(n.y)>.9?vec3(1.,0.,0.):vec3(0.,1.,0.)));
        vec3 b=cross(n,t); float e=.02;
        vec3 p0=position+n*disp(position);
        vec3 q1=position+t*e; q1+=n*disp(q1);
        vec3 q2=position+b*e; q2+=n*disp(q2);
        vec3 nn=normalize(cross(q1-p0,q2-p0)); if(dot(nn,n)<0.) nn=-nn;
        vN=normalize(normalMatrix*nn); vP=p0;
        vec4 mv=modelViewMatrix*vec4(p0,1.);
        vV=normalize(-mv.xyz);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: NOISE + `
      uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec3 N=normalize(vN), V=normalize(vV);
        float f=pow(1.-max(dot(N,V),0.),2.4);
        vec3 col=vec3(.012,.025,.07);
        col+=irid(f*1.1+uTime*.06)*f*1.7;
        vec3 R=reflect(-V,N);
        float streak=smoothstep(.86,1.,sin(R.y*9.+R.x*3.+uTime*.4));
        col+=vec3(.5,.58,1.)*streak*.3*(.3+f);
        vec3 L=normalize(vec3(-.5,.7,.8));
        float s=pow(max(dot(reflect(-L,N),V),0.),70.);
        col+=vec3(.82,.88,1.)*s*.9;
        float veins=smoothstep(.55,.62,snoise(vP*4.+uTime*.2));
        col+=irid(.7+uTime*.1)*veins*.3;
        gl_FragColor=vec4(col,1.);
      }`
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), gooMat);
  group.add(core);

  /* ---- tendrils ---- */
  const tendrilVS = `
    uniform float uTime, uPhase, uLen, uAmp, uFollow; uniform vec3 uTarget; varying vec3 vN; varying vec3 vV; varying float vT;
    void main(){
      float t=clamp(position.y,0.,1.); vT=t;
      vec3 p=position; p.y*=uLen;
      p.x+=sin(t*5.5+uTime*1.8+uPhase)*uAmp*t;
      p.z+=cos(t*4.2+uTime*1.4+uPhase*1.7)*uAmp*t;
      /* cursor pull: each tendril leans toward the smoothed target by its own amount */
      vec3 d=uTarget-vec3(0.,p.y,0.);
      float l=length(d.xz);
      vec2 dir=l>.0001?d.xz/l:vec2(0.);
      p.xz+=dir*min(l,1.3)*uFollow*t*t;
      vN=normalize(normalMatrix*normal);
      vec4 mv=modelViewMatrix*vec4(p,1.);
      vV=normalize(-mv.xyz);
      gl_Position=projectionMatrix*mv;
    }`;
  const tendrilFS = NOISE + `
    uniform float uTime, uPhase; varying vec3 vN; varying vec3 vV; varying float vT;
    void main(){
      vec3 N=normalize(vN), V=normalize(vV);
      float f=pow(1.-abs(dot(N,V)),2.);
      vec3 col=vec3(.01,.02,.06)+irid(f*.9+vT*.6+uPhase*.1+uTime*.08)*f*1.5;
      col+=irid(vT+uTime*.2)*pow(vT,4.)*.6;
      gl_FragColor=vec4(col,1.);
    }`;
  const tGeo = new THREE.CylinderGeometry(0.004, 0.07, 1, 10, 28, true);
  tGeo.translate(0, 0.5, 0);
  tGeo.rotateZ(0);
  const N_T = mobile ? 24 : 44;
  const tendrils = [];
  for (let i = 0; i < N_T; i++) {
    const pivot = new THREE.Group();
    const ang = (i / N_T) * Math.PI * 2 + (Math.random() - .5) * .12;
    pivot.rotation.set((Math.random() - .5) * 1.3, (Math.random() - .5) * 1.0, ang);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime, uPhase: { value: Math.random() * 10 }, uLen: { value: 0.7 + Math.random() * 1.3 }, uAmp: { value: 0.12 + Math.random() * 0.22 }, uTarget: { value: new THREE.Vector3() }, uFollow: { value: 0.3 + Math.random() * 0.6 } },
      vertexShader: tendrilVS, fragmentShader: tendrilFS, side: THREE.DoubleSide
    });
    const m = new THREE.Mesh(tGeo, mat);
    m.rotation.z = -Math.PI / 2;
    m.position.x = 0.82;
    pivot.add(m);
    group.add(pivot);
    tendrils.push({ mesh: m, mat, k: 0.02 + Math.random() * 0.07, cur: new THREE.Vector3(), v: new THREE.Vector3(), st: 14 + Math.random() * 22, dm: 2.2 + Math.random() * 2.6 });
  }

  /* ---- chrome ring ---- */
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uTime },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv=uv; vN=normalize(normalMatrix*normal);
        vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: NOISE + `uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.5);
        vec3 c=irid(vUv.x*2.+uTime*.15)*(.9+f*1.2);
        c+=vec3(.6,.68,1.)*smoothstep(.93,1.,sin(vUv.x*40.+uTime))*.4;
        gl_FragColor=vec4(c,1.);
      }`
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.028, 20, 240), ringMat);
  ring.rotation.set(Math.PI / 2.6, 0.3, 0);
  

  /* ---- tick ring (HUD) ---- */
  const tickPts = [];
  const TICKS = 140;
  for (let i = 0; i < TICKS; i++) {
    const a = (i / TICKS) * Math.PI * 2;
    const r1 = 2.15, r2 = 2.15 + (i % 10 === 0 ? 0.22 : i % 5 === 0 ? 0.13 : 0.06);
    tickPts.push(Math.cos(a) * r1, Math.sin(a) * r1, 0, Math.cos(a) * r2, Math.sin(a) * r2, 0);
  }
  const tickGeo = new THREE.BufferGeometry();
  tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPts, 3));
  const ticks = new THREE.LineSegments(tickGeo, new THREE.LineBasicMaterial({ color: 0x6274E0, transparent: true, opacity: 0.75 }));
  ticks.rotation.x = -0.35;
  

  /* ---- wire halo ---- */
  const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(2.55, 1),
    new THREE.MeshBasicMaterial({ color: 0x4255B2, wireframe: true, transparent: true, opacity: 0.22 }));
  

  /* ---- glint (Y2K sparkle) ---- */
  const sparkC = document.createElement('canvas'); sparkC.width = sparkC.height = 256;
  const sg = sparkC.getContext('2d');
  const sgr = sg.createRadialGradient(128,128,0,128,128,128);
  sgr.addColorStop(0,'rgba(255,255,255,1)'); sgr.addColorStop(.12,'rgba(130,150,255,.8)'); sgr.addColorStop(1,'rgba(0,0,0,0)');
  sg.fillStyle = sgr; sg.fillRect(0,0,256,256);
  sg.globalCompositeOperation = 'lighter';
  [[0,1],[1,0]].forEach(([x,y]) => {
    const g2 = sg.createLinearGradient(128-x*128,128-y*128,128+x*128,128+y*128);
    g2.addColorStop(0,'rgba(255,255,255,0)'); g2.addColorStop(.5,'rgba(255,255,255,1)'); g2.addColorStop(1,'rgba(255,255,255,0)');
    sg.fillStyle = g2;
    sg.fillRect(x?0:124, y?0:124, x?256:8, y?256:8);
  });
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sparkC), blending: THREE.AdditiveBlending, depthTest: false, transparent: true }));
  glint.scale.set(1.0, 1.0, 1); glint.position.set(-0.38, 0.42, 1.12);
  group.add(glint);

  /* ---- single eye: jagged-pupil iris, palette colors ---- */
  const EYE_R = 0.34;
  const S = 1024, C = S / 2, R = S / 2 - 6, FIX = (S / 2) / R;
  const mkCanvas = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const mkTex = c => { const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; };

  /* iris: radial fibres, dark limbus, soft lid shadow on top */
  const ic = mkCanvas(), ig = ic.getContext('2d');
  ig.save(); ig.beginPath(); ig.arc(C, C, R, 0, Math.PI * 2); ig.clip();
  let gr = ig.createRadialGradient(C, C, 0, C, C, R);
  gr.addColorStop(0, '#6274E0'); gr.addColorStop(.35, '#6274E0'); gr.addColorStop(.62, '#4255B2'); gr.addColorStop(.88, '#2A3B80'); gr.addColorStop(1, '#121F50');
  ig.fillStyle = gr; ig.fillRect(0, 0, S, S);
  for (let i = 0; i < 1100; i++) {
    const a = Math.random() * Math.PI * 2, r0 = R * (.18 + Math.random() * .35), r1 = R * (.55 + Math.random() * .45);
    ig.strokeStyle = Math.random() < .55 ? 'rgba(160,178,255,' + (.12 + Math.random() * .3) + ')' : 'rgba(4,11,39,' + (.15 + Math.random() * .3) + ')';
    ig.lineWidth = .6 + Math.random() * 2.2;
    ig.beginPath(); ig.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0); ig.lineTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1); ig.stroke();
  }
  gr = ig.createRadialGradient(C, C, R * .82, C, C, R);
  gr.addColorStop(0, 'rgba(4,11,39,0)'); gr.addColorStop(1, 'rgba(4,11,39,.9)');
  ig.fillStyle = gr; ig.fillRect(0, 0, S, S);
  gr = ig.createLinearGradient(0, 0, 0, S * .55);
  gr.addColorStop(0, 'rgba(4,11,39,.5)'); gr.addColorStop(1, 'rgba(4,11,39,0)');
  ig.fillStyle = gr; ig.fillRect(0, 0, S, S);
  ig.restore();

  /* pupil: black blob with long thin spikes pushing out into the iris */
  const pc = mkCanvas(), pg = pc.getContext('2d');
  const NSP = 80, p0 = R * .3;
  pg.beginPath();
  for (let i = 0; i < NSP; i++) {
    const a = (i / NSP) * Math.PI * 2;
    let rr;
    if (i % 2 === 0) { rr = p0 * (1.25 + Math.random() * .55); if (Math.random() < .14) rr = p0 * (1.9 + Math.random() * .35); }
    else rr = p0 * (.9 + Math.random() * .12);
    const x = C + Math.cos(a) * rr, y = C + Math.sin(a) * rr;
    i ? pg.lineTo(x, y) : pg.moveTo(x, y);
  }
  pg.closePath(); pg.fillStyle = '#040B27'; pg.fill();
  pg.beginPath(); pg.arc(C, C, p0 * .95, 0, Math.PI * 2); pg.fill();

  /* gloss: left crescent + three glassy orbs (fixed, they don't move with the iris) */
  const hc = mkCanvas(), hg = hc.getContext('2d');
  const tc = mkCanvas(), tg = tc.getContext('2d');
  const cg = tg.createLinearGradient(C - R, 0, C, 0);
  cg.addColorStop(0, 'rgba(215,224,255,.6)'); cg.addColorStop(1, 'rgba(215,224,255,.15)');
  tg.fillStyle = cg; tg.beginPath(); tg.arc(C, C, R * .93, 0, Math.PI * 2); tg.fill();
  tg.globalCompositeOperation = 'destination-out';
  tg.beginPath(); tg.arc(C + R * .15, C, R * .93, 0, Math.PI * 2); tg.fill();
  hg.drawImage(tc, 0, 0);
  function orb(x, y, rad) {
    const g = hg.createRadialGradient(x + rad * .2, y + rad * .2, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(230,236,255,.75)');
    g.addColorStop(.75, 'rgba(140,158,245,.35)'); g.addColorStop(1, 'rgba(98,116,224,.15)');
    hg.fillStyle = g; hg.beginPath(); hg.arc(x, y, rad, 0, Math.PI * 2); hg.fill();
  }
  orb(C + R * .34, C - R * .17, R * .2);
  orb(C + R * .2, C - R * .42, R * .1);
  orb(C - R * .2, C - R * .15, R * .05);

  const eye = new THREE.Group();
  eye.position.set(0, 0, 1.1);
  group.add(eye);
  const rot = new THREE.Group(); eye.add(rot);
  const plane = new THREE.PlaneGeometry(EYE_R * 2 * FIX, EYE_R * 2 * FIX);
  const layer = (canvas, order) => {
    const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: mkTex(canvas), transparent: true, depthWrite: false }));
    m.renderOrder = order; return m;
  };
  const irisM = layer(ic, 3), pupilM = layer(pc, 4), glossM = layer(hc, 5);
  pupilM.position.z = .004; glossM.position.z = .02;
  rot.add(irisM, pupilM);
  eye.add(glossM);
  const eyeHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTex([[0, 'rgba(98,116,224,0.55)'], [0.5, 'rgba(66,85,178,0.2)'], [1, 'rgba(4,11,39,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  eyeHalo.scale.set(EYE_R * 4.2, EYE_R * 4.2, 1); eyeHalo.position.z = -0.02;
  eye.add(eyeHalo);
  const eyeLook = { x: 0, y: 0 };
  let nextBlink = 2, blinkStart = -1;

  /* ---- floating droplets ---- */
  const dN = 120, dPos = new Float32Array(dN * 3);
  for (let i = 0; i < dN; i++) {
    const r = 2.4 + Math.random() * 2.2, a = Math.random() * 6.28, e = (Math.random() - .5) * 3;
    dPos[i*3] = Math.cos(a) * r; dPos[i*3+1] = e; dPos[i*3+2] = Math.sin(a) * r * .6;
  }
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const drops = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: 0x6274E0, size: 0.045, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(drops);

  /* ---- interaction ---- */
  const target = { x: 0, y: 0 };
  const mouse = { x: 0, y: 0, on: false, s: 0 };
  const cursorW = new THREE.Vector3(), tmp = new THREE.Vector3();
  function onLeave() { mouse.on = false; }
  function onMove(e) {
    const r = container.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 2 - 1;
    const py = ((e.clientY - r.top) / r.height) * 2 - 1;
        mouse.x = px; mouse.y = py; mouse.on = true;
  }
  window.addEventListener('pointermove', onMove);
  document.addEventListener('mouseleave', onLeave);
  function onResize() {
    renderer.setSize(W(), H());
    camera.aspect = W() / H();
    camera.position.z = camera.aspect < 1 ? 7.5 / Math.max(camera.aspect, 0.55) : 7.5;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize); onResize();

  /* ---- loop ---- */
  const clock = new THREE.Clock(); let raf;
  /* ---- swimming brain: wander, sometimes stop to stare at the cursor and drift close, then swim off. wraps edge to edge ---- */
  const SW = { x: 0, y: 0, vx: 1, vy: 0.2, head: Math.random() * 6.28, mode: 'swim', until: 5 + Math.random() * 4, look: 0.65 };
  const trailW = new THREE.Vector3(), baseW = new THREE.Vector3(), tmp2 = new THREE.Vector3(), lookW = new THREE.Vector3();
  let lastT = 0;
  function loop() {
    if (document.hidden) { raf = 0; return; }
    const t = clock.getElapsedTime() * (reduce ? 0.3 : 1); uTime.value = t;
    const dt = Math.min(0.05, t - lastT); lastT = t;
    const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z, hw = hh * camera.aspect;
    const curX = mouse.x * hw, curY = -mouse.y * hh;
    if (SW.mode === 'stare' && !mouse.on) SW.until = t;
    if (t > SW.until) {
      if (SW.mode === 'swim' && mouse.on && Math.random() < 0.8) { SW.mode = 'stare'; SW.until = t + 3 + Math.random() * 3.5; }
      else { if (SW.mode === 'stare') SW.head = Math.random() * 6.28; SW.mode = 'swim'; SW.until = t + 5 + Math.random() * 8; }
    }
    let dvx, dvy;
    if (SW.mode === 'swim') {
      SW.head += (Math.sin(t * 0.31) + Math.sin(t * 0.73 + 2)) * 0.22 * dt;
      const stroke = 0.3 + Math.pow(Math.max(0, Math.sin(t * 2.2 - 0.6)), 1.5);
      dvx = Math.cos(SW.head) * 1.5 * stroke; dvy = Math.sin(SW.head) * 1.5 * stroke;
      SW.look += (0.65 - SW.look) * 0.05;
    } else {
      const dx = curX - SW.x, dy = curY - SW.y, dist = Math.hypot(dx, dy) || 1;
      const sp = dist > 2.4 ? Math.min(1.2, (dist - 2.4) * 0.7) : 0;
      dvx = (dx / dist) * sp; dvy = (dy / dist) * sp;
      SW.head = Math.atan2(dy, dx);
      SW.look += (1 - SW.look) * 0.08;
    }
    const k = Math.min(1, dt * (SW.mode === 'swim' ? 1.8 : 2.6));
    SW.vx += (dvx - SW.vx) * k; SW.vy += (dvy - SW.vy) * k;
    SW.x += SW.vx * dt; SW.y += SW.vy * dt + Math.sin(t * 1.1) * 0.12 * dt;
    const M = 3.2;
    if (SW.x > hw + M) SW.x = -hw - M; else if (SW.x < -hw - M) SW.x = hw + M;
    if (SW.y > hh + M) SW.y = -hh - M; else if (SW.y < -hh - M) SW.y = hh + M;
    group.position.set(SW.x, SW.y, 0); glow.position.set(SW.x, SW.y, -1.5);
    if (SW.mode === 'swim') { target.y = Math.max(-0.5, Math.min(0.5, SW.vx * 0.22)); target.x = Math.max(-0.4, Math.min(0.4, -SW.vy * 0.2)); }
    else { target.y = Math.max(-0.5, Math.min(0.5, (curX - SW.x) * 0.12)); target.x = Math.max(-0.4, Math.min(0.4, (curY - SW.y) * 0.1)); }
    const spd = Math.hypot(SW.vx, SW.vy), ux = spd > 0.01 ? SW.vx / spd : 0, uy = spd > 0.01 ? SW.vy / spd : 0, mag = Math.min(spd * 1.1, 1.6);
    baseW.set(SW.x, SW.y, 0); trailW.set(SW.x - ux * mag, SW.y - uy * mag, 0);
    if (SW.mode === 'swim') lookW.set(SW.x + Math.cos(SW.head) * 4, SW.y + Math.sin(SW.head) * 4, 1.5); else lookW.set(curX, curY, 1.5);
    container.__pos = { x: SW.x / (2 * hw) + 0.5, y: 0.5 - SW.y / (2 * hh), vx: SW.vx / (2 * hw), vy: SW.vy / (2 * hh), pulse: SW.mode === 'swim' ? Math.max(0, Math.sin(t * 2.2 - 0.6)) : 0 };
    group.rotation.y += (target.y - group.rotation.y) * 0.07;
    group.rotation.x += (target.x - group.rotation.x) * 0.07;
    ring.rotation.z = t * 0.35;
    ticks.rotation.z = -t * 0.18;
    halo.rotation.y = t * 0.08; halo.rotation.x = t * 0.05;
    drops.rotation.y = t * 0.05;
    const pulse = 1 + Math.sin(t * 2.2) * 0.04;
    core.scale.setScalar(pulse);
    glint.material.rotation = Math.sin(t * .6) * .15;
    glow.material.opacity = 0.85 + Math.sin(t * 1.3) * 0.15;
    /* tendrils follow cursor: smooth, each with its own lag + strength */
    group.updateMatrixWorld(true);
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - 1.5);
    cursorW.set(mouse.x * halfH * camera.aspect, -mouse.y * halfH, 1.5);
    mouse.s += ((mouse.on ? 1 : 0) - mouse.s) * 0.05;
    for (const o of tendrils) {
      tmp.copy(trailW); o.mesh.worldToLocal(tmp);
      tmp2.copy(baseW); o.mesh.worldToLocal(tmp2); tmp.sub(tmp2); tmp.y = 0;
      o.v.x += ((tmp.x - o.cur.x) * o.st - o.v.x * o.dm) * dt;
      o.v.z += ((tmp.z - o.cur.z) * o.st - o.v.z * o.dm) * dt;
      o.cur.x += o.v.x * dt; o.cur.z += o.v.z * dt;
      o.mat.uniforms.uTarget.value.copy(o.cur);
    }
    /* eye: iris tilts toward cursor, jagged pupil shifts more (depth), pupil breathes, blinks */
    if (t > nextBlink) { blinkStart = t; nextBlink = t + 2.5 + Math.random() * 3.5; }
    const bp = (t - blinkStart) / 0.16;
    const blink = bp >= 0 && bp <= 1 ? 1 - 0.92 * Math.sin(Math.PI * bp) : 1;
    tmp.copy(lookW);
    eye.worldToLocal(tmp);
    const elen = Math.hypot(tmp.x, tmp.y) || 1;
    const reach = Math.min(elen / 1.6, 1);
    const cx = (tmp.x / elen) * reach, cy = (tmp.y / elen) * reach;
    const ix = Math.sin(t * 0.7) * 0.35, iy = Math.cos(t * 0.5) * 0.25;
    const tx = ix + (cx - ix) * SW.look, ty = iy + (cy - iy) * SW.look;
    eyeLook.x += (tx - eyeLook.x) * 0.16; eyeLook.y += (ty - eyeLook.y) * 0.16;
    rot.rotation.y = eyeLook.x * 0.28; rot.rotation.x = -eyeLook.y * 0.28;
    pupilM.position.set(eyeLook.x * EYE_R * 0.36, eyeLook.y * EYE_R * 0.36, 0.004);
    pupilM.scale.setScalar(1 + Math.sin(t * 1.6) * 0.05 - Math.min(Math.hypot(eyeLook.x, eyeLook.y), 1) * 0.08);
    eye.scale.y = blink;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  function onVisibility() { if (!document.hidden && !raf) loop(); }
  document.addEventListener('visibilitychange', onVisibility);
  loop();

  return function dispose() {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('mouseleave', onLeave);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    renderer.dispose(); container.removeChild(renderer.domElement);
  };
}

