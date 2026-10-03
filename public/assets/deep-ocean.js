/* DEEP OCEAN background: drop-in, no dependencies.
   Usage: const dispose = DeepOcean(container, { creature: () => ({ x: 0.5, y: 0.5 }) });
   - container: any element; the canvas fills it (give it position:fixed; inset:0; z-index:0 to sit behind your site)
   - creature: optional function returning the 3D object's centre in 0..1 screen coords (y down). Default: centre.
   The water ripples outward from the creature in time with its pulse, and reacts to the cursor/finger. */
function DeepOcean(container, opts) {
  opts = opts || {};
  const creature = opts.creature || (() => ({ x: 0.5, y: 0.5 }));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas');
  cv.style.cssText = 'display:block;width:100%;height:100%';
  const gl = cv.getContext('webgl', { antialias: false, alpha: false });
  container.style.background = 'linear-gradient(0deg,#040B27,#121F50)';
  if (!gl) return function () {};
  container.appendChild(cv);

  const FS = `precision highp float;
  uniform vec2 uRes, uM, uC, uV; uniform float uT, uMS, uP;
  float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+1.),f.x), f.y); }
  float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*noise(p); p=p*2.03+7.1; a*=.5; } return s; }
  float asp;
  void main(){
    vec2 uv=gl_FragCoord.xy/uRes; asp=uRes.x/uRes.y; float t=uT;
    vec3 obs=vec3(.016,.043,.153), mid=vec3(.071,.122,.314), slate=vec3(.165,.231,.502), iris=vec3(.259,.333,.698), med=vec3(.384,.455,.878);
    vec2 dv=(uv-uC)*vec2(asp,1.); float cd0=length(dv); float fo=exp(-cd0*cd0*7.);
    vec2 push=dv/(cd0+.03)*fo*uP*.04; push.x/=asp;
    vec2 w=uv-push-uV*fo*.35;
    vec2 p=w*vec2(asp,1.);
    vec2 q=vec2(fbm(p*1.4+vec2(0.,t*.03)), fbm(p*1.4+5.2-t*.025));
    float d=w.y;
    vec3 col=mix(obs,mid,smoothstep(0.,.8,d));
    col=mix(col,slate,smoothstep(.6,1.,d)*.35);
    float ray=fbm(vec2((p.x+w.y*.4)*3.+q.x*1.5, t*.035));
    col+=iris*smoothstep(.45,.8,ray)*pow(d,2.4)*.17;
    float c=fbm(p*vec2(3.,5.)+q*2.+t*.04);
    col+=iris*pow(smoothstep(.5,.78,c),2.)*smoothstep(.25,1.,d)*.09;
    col+=iris*fo*uP*.05;
    float cd=length((uv-uC)*vec2(asp,1.));
    col+=iris*exp(-cd*cd*7.)*.11*(.85+.15*sin(t*2.2));
    col+=iris*exp(-length((uv-uM)*vec2(asp,1.))*7.)*.05*uMS;
    vec2 pd=(uv-uC)*vec2(asp,1.); float pdl=length(pd); float pf=exp(-pdl*pdl*8.); vec2 pdir=pd/(pdl+.02);
    for(int L=0;L<3;L++){
      float fl=float(L); float s=24.+fl*26.;
      vec2 sh=(pdir*(.2+.06*uP)+vec2(-pdir.y,pdir.x)*.035)*pf*(1.2-.3*fl)+uV*vec2(asp,1.)*pf*.5;
      vec2 pp=(uv*vec2(asp,1.)-sh)*s; pp.y-=t*(.45+fl*.2); pp.x+=t*.12*(fl+1.)+sin(t*.5+fl*2.+pp.y*.25)*.7; pp.x+=sin(t*2.3+pp.y*1.7+fl)*pf*.4; pp.y+=cos(t*1.9+pp.x*1.3)*pf*.3;
      vec2 cell=floor(pp), f=fract(pp)-.5, o=(vec2(hash(cell+1.),hash(cell+2.))-.5)*.5;
      o+=vec2(sin(t*.6+hash(cell+3.)*30.),cos(t*.5+hash(cell+4.)*30.))*.2; float hh=hash(cell), dd=length(f-o);
      float r=mix(.16,.07,fl/2.), soft=mix(2.4,1.1,fl/2.);
      float tw=.5+.5*sin(t*(.4+hh)+hh*30.);
      float a=smoothstep(r*soft,0.,dd)*step(.55,hh)*tw;
      col+=mix(slate,med,hh)*a*mix(.8,.45,fl/2.)*(.35+.65*smoothstep(0.,.9,d))*(1.+pf*1.6);
    }
    col*=1.-.4*length(uv-.5);
    col+=(hash(gl_FragCoord.xy+t)-.5)/255.;
    gl_FragColor=vec4(col,1.);
  }`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr); gl.useProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(pr)); return function () {}; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  const uRes = U('uRes'), uT = U('uT'), uM = U('uM'), uMS = U('uMS'), uC = U('uC'), uV = U('uV'), uP = U('uP');


  const m = { x: 0.5, y: 0.5, s: 0, on: false, lx: 0, ly: 0, lt: 0 };
  function onMove(e) {
    const r = container.getBoundingClientRect();
    m.x = (e.clientX - r.left) / r.width; m.y = 1 - (e.clientY - r.top) / r.height; m.on = true;
  }
  function onLeave() { m.on = false; }
  addEventListener('pointermove', onMove); document.addEventListener('mouseleave', onLeave);

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.25);
    cv.width = Math.max(2, Math.round(container.clientWidth * dpr));
    cv.height = Math.max(2, Math.round(container.clientHeight * dpr));
    gl.viewport(0, 0, cv.width, cv.height);
  }
  addEventListener('resize', resize); resize();

  const sv = { x: 0, y: 0 }; let sp = 0;
  const t0 = performance.now() / 1000; let raf, nextPulse = 0;
  function loop() {
    if (document.hidden) { raf = 0; return; }
    const t = (performance.now() / 1000 - t0) * (reduce ? 0.3 : 1);
    const c = creature();
    m.s += ((m.on ? 1 : 0) - m.s) * 0.05;
    sv.x += ((c.vx || 0) - sv.x) * 0.08; sv.y += ((c.vy || 0) - sv.y) * 0.08; sp += ((c.pulse || 0) - sp) * 0.2;
    gl.uniform2f(uRes, cv.width, cv.height); gl.uniform1f(uT, t);
    gl.uniform2f(uM, m.x, m.y); gl.uniform1f(uMS, m.s); gl.uniform2f(uC, c.x, 1 - c.y);
    gl.uniform2f(uV, sv.x, sv.y); gl.uniform1f(uP, sp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(loop);
  }
  function onVisibility() { if (!document.hidden && !raf) loop(); }
  document.addEventListener('visibilitychange', onVisibility);
  loop();

  return function dispose() {
    cancelAnimationFrame(raf);
    removeEventListener('pointermove', onMove); document.removeEventListener('mouseleave', onLeave);
    removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    if (cv.parentNode) cv.parentNode.removeChild(cv);
  };
}
