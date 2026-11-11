/* Hero element: a robot arm doing pick-and-place, with a camera that "sees" the cubes.
   SOURCE FILE. The site loads the bundled version, assets/js/arm.js.
   To rebuild after editing:  npx esbuild src/arm.src.js --bundle --minify --format=iife --outfile=assets/js/arm.js
   (needs `npm i three esbuild` once). Everything is built from primitives; there are no model files. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Vector3, Vector2, Raycaster,
  CylinderGeometry, BoxGeometry, TorusGeometry, CircleGeometry, PlaneGeometry, SphereGeometry,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial, LineSegments, LineLoop,
  BufferGeometry, Float32BufferAttribute, EdgesGeometry, GridHelper,
  HemisphereLight, DirectionalLight, PointLight, Color
} from 'three';

(function () {
  'use strict';
  var host = document.querySelector('[data-scan]');
  if (!host) return;
  var cv = host.querySelector('canvas');
  var hud = host.querySelector('.scan-hud'), hint = host.querySelector('.scan-hint');
  var renderer;
  try {
    renderer = new WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'low-power',
      preserveDrawingBuffer: !!window.__SCAN_STILL });
  } catch (e) { return; }               /* no WebGL: the static image stays */

  var AMBER = 0xffb547, COOL = 0x7fb0ff, BODY = 0x2f4777, FPS = 30;
  var B = 0.2, L1 = 0.42, L2 = 0.38, G = 0.15, S = 0.07;   /* base height, links, gripper, cube size (m) */

  var scene = new Scene();
  var cam = new PerspectiveCamera(32, 1.25, 0.1, 20);
  var camR = 2.25, camY = 1.05, camA0 = 0.8, camA = camA0, camATarget = camA0;
  var look = new Vector3(0.1, 0.24, 0.12);

  scene.add(new HemisphereLight(0xcfe0ff, 0x101a30, 1.5));
  var sun = new DirectionalLight(0xffffff, 1.5); sun.position.set(1.5, 3, 2); scene.add(sun);
  var rim = new DirectionalLight(COOL, 2.4); rim.position.set(-2, 1.2, -1.5); scene.add(rim);
  var glow = new PointLight(AMBER, 0.9, 1.6, 1.6); scene.add(glow);

  /* ---- table ---- */
  var grid = new GridHelper(2.4, 24, COOL, COOL);
  grid.material.transparent = true; grid.material.opacity = 0.16; scene.add(grid);
  function disc(r, color, op) {
    var m = new Mesh(new CircleGeometry(r, 40), new MeshBasicMaterial({ color: color, transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; return m;
  }
  var pool = disc(0.95, AMBER, 0.05); pool.position.y = 0.001; scene.add(pool);
  var reach = new LineLoop(new BufferGeometry().setFromPoints(circlePts(0.78, 72)), new LineBasicMaterial({ color: COOL, transparent: true, opacity: 0.28 }));
  reach.position.y = 0.002; scene.add(reach);
  function circlePts(r, n) { var a = []; for (var i = 0; i < n; i++) a.push(new Vector3(Math.cos(i / n * 6.2832) * r, 0, Math.sin(i / n * 6.2832) * r)); return a; }

  /* ---- arm ---- */
  var body = new MeshStandardMaterial({ color: BODY, metalness: 0.55, roughness: 0.38 });
  var dark = new MeshStandardMaterial({ color: 0x0f1930, metalness: 0.6, roughness: 0.5 });
  var accent = new MeshStandardMaterial({ color: AMBER, emissive: AMBER, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.4 });
  function cyl(r, len, mat, axis) {
    var m = new Mesh(new CylinderGeometry(r, r, len, 28), mat);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    return m;
  }
  function joint(parent, r) {          /* a hub whose axis is the joint's rotation axis (z) */
    parent.add(cyl(r, r * 2.1, body, 'z'));
    var ringA = new Mesh(new TorusGeometry(r * 0.78, r * 0.09, 8, 36), accent); ringA.position.z = r * 1.06; parent.add(ringA);
    var ringB = ringA.clone(); ringB.position.z = -r * 1.06; parent.add(ringB);
  }
  function link(parent, len, r) {
    var m = cyl(r, len, body, 'x'); m.position.x = len / 2; parent.add(m);
    var band = cyl(r * 1.07, 0.018, dark, 'x'); band.position.x = len * 0.5; parent.add(band);
  }

  var yaw = new Group(); scene.add(yaw);
  var plate = cyl(0.13, 0.025, dark, 'y'); plate.position.y = 0.0125; scene.add(plate);
  var pedestal = cyl(0.078, B - 0.03, body, 'y'); pedestal.position.y = (B - 0.03) / 2 + 0.02; yaw.add(pedestal);
  var collar = new Mesh(new TorusGeometry(0.08, 0.008, 8, 40), accent); collar.rotation.x = Math.PI / 2; collar.position.y = 0.05; yaw.add(collar);
  var shoulder = new Group(); shoulder.position.y = B; yaw.add(shoulder); joint(shoulder, 0.07); link(shoulder, L1, 0.042);
  var elbow = new Group(); elbow.position.x = L1; shoulder.add(elbow); joint(elbow, 0.058); link(elbow, L2, 0.034);
  var wrist = new Group(); wrist.position.x = L2; elbow.add(wrist); joint(wrist, 0.044);
  var hand = cyl(0.026, G - 0.07, body, 'x'); hand.position.x = (G - 0.07) / 2; wrist.add(hand);
  var palm = new Mesh(new BoxGeometry(0.022, 0.05, 0.12), dark); palm.position.x = G - 0.065; wrist.add(palm);
  var fingerGeo = new BoxGeometry(0.07, 0.03, 0.012);
  var fA = new Mesh(fingerGeo, accent), fB = new Mesh(fingerGeo, accent);
  fA.position.x = fB.position.x = G - 0.03; wrist.add(fA); wrist.add(fB);
  function setGrip(open) { var z = 0.039 + open * 0.016; fA.position.z = z; fB.position.z = -z; }

  /* ---- cubes, tray, camera ---- */
  var COLORS = [['amber', AMBER], ['blue', 0x5b9bff], ['white', 0xe7ecf6]];
  var HOME = [[0.50, -0.24], [0.60, 0.04], [0.47, 0.30]];
  var TRAY = [[-0.19, 0.50], [-0.06, 0.52], [0.07, 0.52]];
  var cubes = COLORS.map(function (c, i) {
    var m = new Mesh(new BoxGeometry(S, S, S), new MeshStandardMaterial({ color: c[1], emissive: c[1], emissiveIntensity: 0.22, metalness: 0.1, roughness: 0.45 }));
    m.position.set(HOME[i][0], S / 2, HOME[i][1]); m.userData = { i: i, name: c[0], inTray: false };
    scene.add(m);
    var sh = disc(S * 0.8, 0x000000, 0.4); sh.position.y = 0.003; scene.add(sh); m.userData.shadow = sh;
    /* detection bracket on the table, as if drawn by the camera's detector */
    var d = S * 0.95, c2 = d * 0.45, p = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
      p.push(q[0] * d, 0, q[1] * d, q[0] * (d - c2), 0, q[1] * d, q[0] * d, 0, q[1] * d, q[0] * d, 0, q[1] * (d - c2));
    });
    var g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3));
    var br = new LineSegments(g, new LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.5 }));
    br.position.y = 0.004; scene.add(br); m.userData.bracket = br;
    return m;
  });
  var tray = new LineSegments(new EdgesGeometry(new BoxGeometry(0.44, 0.03, 0.14)), new LineBasicMaterial({ color: COOL, transparent: true, opacity: 0.8 }));
  tray.position.set(-0.06, 0.015, 0.51); tray.rotation.y = 0.08; scene.add(tray);
  var trayFloor = new Mesh(new PlaneGeometry(0.44, 0.14), new MeshBasicMaterial({ color: COOL, transparent: true, opacity: 0.07, depthWrite: false }));
  trayFloor.rotation.x = -Math.PI / 2; trayFloor.rotation.z = 0.08; trayFloor.position.set(-0.06, 0.002, 0.51); scene.add(trayFloor);

  var CAMP = new Vector3(-0.62, 0.66, -0.3);
  var pole = cyl(0.012, CAMP.y, dark, 'y'); pole.position.set(CAMP.x, CAMP.y / 2, CAMP.z); scene.add(pole);
  var camBox = new Mesh(new BoxGeometry(0.09, 0.06, 0.06), body); camBox.position.copy(CAMP); camBox.lookAt(0.35, 0, 0.1); scene.add(camBox);
  var lens = new Mesh(new SphereGeometry(0.018, 16, 12), accent); lens.position.copy(CAMP).add(new Vector3(0.04, -0.025, 0.012)); scene.add(lens);
  var fr = [], corners = [[0.02, -0.42], [0.82, -0.42], [0.82, 0.62], [-0.3, 0.62]];
  corners.forEach(function (c, i) {
    var n = corners[(i + 1) % 4];
    fr.push(CAMP.x, CAMP.y, CAMP.z, c[0], 0.003, c[1], c[0], 0.003, c[1], n[0], 0.003, n[1]);
  });
  var fg = new BufferGeometry(); fg.setAttribute('position', new Float32BufferAttribute(fr, 3));
  scene.add(new LineSegments(fg, new LineBasicMaterial({ color: COOL, transparent: true, opacity: 0.2 })));

  /* ---- kinematics: tip is described in cylindrical coordinates (angle, radius, height) ---- */
  var tip = { a: 0, r: 0.42, y: 0.42 }, q = [0, 0, 0, 0], tipW = new Vector3();
  function solve() {
    var wy = tip.y + G - B, d = Math.min(Math.hypot(tip.r, wy), L1 + L2 - 0.004);
    var e = Math.acos(Math.max(-1, Math.min(1, (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2))));
    var s = Math.atan2(wy, tip.r) + Math.atan2(L2 * Math.sin(e), L1 + L2 * Math.cos(e));
    q[0] = tip.a; q[1] = s; q[2] = -e; q[3] = -Math.PI / 2 - (s - e);
    yaw.rotation.y = q[0]; shoulder.rotation.z = q[1]; elbow.rotation.z = q[2]; wrist.rotation.z = q[3];
    tipW.set(Math.cos(tip.a) * tip.r, tip.y, -Math.sin(tip.a) * tip.r);
    glow.position.set(tipW.x, tipW.y + 0.12, tipW.z);
  }
  function polar(x, z) { return { a: Math.atan2(-z, x), r: Math.hypot(x, z) }; }

  /* ---- task: a queue of short motions ---- */
  var REST = { a: 0.15, r: 0.40, y: 0.44 }, HOVER = 0.24, GRASP = S / 2 + 0.012;
  var steps = [], si = 0, st = 0, from = null, held = null, grip = 1, gripFrom = 1, order = 0, queued = null, task = '';
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function planMove(cube) {
    var u = cube.userData, dst = u.inTray ? HOME[u.i] : TRAY[u.i];
    var p = polar(cube.position.x, cube.position.z), d = polar(dst[0], dst[1]);
    task = u.inTray ? 'put the ' + u.name + ' cube back on the table' : 'put the ' + u.name + ' cube in the tray';
    steps = [
      { to: { a: p.a, r: p.r, y: HOVER }, t: 1.0 },
      { to: { a: p.a, r: p.r, y: GRASP }, t: 0.55 },
      { grip: 0, t: 0.3, grab: cube },
      { to: { a: p.a, r: p.r, y: HOVER }, t: 0.5 },
      { to: { a: d.a, r: d.r, y: HOVER }, t: 1.15 },
      { to: { a: d.a, r: d.r, y: GRASP }, t: 0.55 },
      { grip: 1, t: 0.3, drop: dst },
      { to: { a: d.a, r: d.r, y: HOVER }, t: 0.5 },
      { to: REST, t: 0.7 }, { t: 0.35 }
    ];
    si = 0; st = 0; from = null;
  }
  function nextTask() {
    var c = queued;
    queued = null;
    if (!c) { c = cubes[order % 3]; order++; }   /* three out, three back, repeat */
    planMove(c);
  }
  function step(dt) {
    if (si >= steps.length) nextTask();
    var s = steps[si];
    if (!from) { from = { a: tip.a, r: tip.r, y: tip.y }; gripFrom = grip; }
    st += dt;
    var k = Math.min(1, st / s.t), e = ease(k);
    if (s.to) {
      var da = Math.atan2(Math.sin(s.to.a - from.a), Math.cos(s.to.a - from.a));
      tip.a = from.a + da * e; tip.r = from.r + (s.to.r - from.r) * e; tip.y = from.y + (s.to.y - from.y) * e;
    }
    if (s.grip !== undefined) grip = gripFrom + (s.grip - gripFrom) * e;
    if (k >= 1) {
      if (s.grab) held = s.grab;
      if (s.drop && held) {
        held.position.set(s.drop[0], S / 2, s.drop[1]); held.rotation.y = 0;
        held.userData.inTray = !held.userData.inTray; held = null;
      }
      si++; st = 0; from = null;
    }
    solve(); setGrip(grip);
    if (held) { held.position.set(tipW.x, tipW.y - 0.012, tipW.z); held.rotation.y = tip.a; }
    for (var i = 0; i < 3; i++) {
      var c = cubes[i], u = c.userData, lifted = c.position.y - S / 2;
      u.shadow.position.x = u.bracket.position.x = c.position.x;
      u.shadow.position.z = u.bracket.position.z = c.position.z;
      u.shadow.material.opacity = Math.max(0.08, 0.4 - lifted * 1.6);
      u.bracket.rotation.y = c.rotation.y;
      u.bracket.material.opacity = (steps[2] && steps[2].grab === c) ? 0.95 : 0.3;
      u.bracket.visible = c !== held;
    }
  }

  /* ---- render ---- */
  function resize() {
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    /* phones render at a lower pixel ratio to keep the frame rate up */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5));
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.fov = cam.aspect < 1.2 ? 36 : 32;
    cam.updateProjectionMatrix();
    render();
  }
  function render() {
    cam.position.set(look.x + Math.sin(camA) * camR, camY, look.z + Math.cos(camA) * camR);
    cam.lookAt(look);
    renderer.render(scene, cam);
  }
  function deg(v) { v = String(Math.round(v * 57.2958)); while (v.length < 4) v = ' ' + v; return v; }
  function readout() {
    if (hud) hud.textContent = '"' + task + '"\nq ' + deg(q[0]) + '°' + deg(q[1]) + '°' + deg(q[2]) + '°' + deg(q[3]) + '°';
  }

  /* ---- start ---- */
  cv.style.display = 'block';
  solve(); setGrip(1); nextTask();
  for (var w = 0; w < 62; w++) step(1 / FPS);   /* same pose as the static image */
  resize();
  cv.style.display = '';
  host.classList.add('live');
  readout();
  if (window.__SCAN_STILL) return;
  if (hint) {
    if (window.matchMedia('(pointer: coarse)').matches) hint.textContent = 'Tap a cube to give the arm its next instruction';
    hint.hidden = false;
  }

  var raf = 0, last = 0, onScreen = true, frames = 0, slow = 0, lastHud = 0;
  function tick(t) {
    raf = requestAnimationFrame(tick);
    var gap = t - last;
    if (gap < 1000 / FPS - 1) return;
    last = t;
    step(Math.min(0.05, gap / 1000));
    camA += (camATarget - camA) * 0.06;
    render();
    if (t - lastHud > 200) { readout(); lastHud = t; }
    /* if the device can't hold ~15 fps in the first 3 seconds, go back to the image */
    if (frames < 90) { if (gap > 66) slow++; if (++frames === 90 && slow > 45) stopForGood(); }
  }
  function play() { if (!raf && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function pause() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  function stopForGood() {
    pause(); play = function () {};
    host.classList.remove('live');
    if (hint) hint.hidden = true;
    if (hud) hud.textContent = 'pick-and-place demo';
    renderer.dispose();
  }
  cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stopForGood(); });

  new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; onScreen ? play() : pause(); }, { threshold: 0.05 }).observe(host);
  document.addEventListener('visibilitychange', function () { document.hidden ? pause() : play(); });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv);
  else window.addEventListener('resize', resize);

  /* click a cube to make it the next instruction; move the mouse to look around */
  var ray = new Raycaster(), ndc = new Vector2();
  cv.addEventListener('pointerdown', function (e) {
    var b = cv.getBoundingClientRect();
    ndc.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    var hit = ray.intersectObjects(cubes)[0];
    if (hit && hit.object !== held) { queued = hit.object; if (hint) hint.hidden = true; }
  });
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    host.addEventListener('pointermove', function (e) {
      var b = host.getBoundingClientRect();
      camATarget = camA0 + ((e.clientX - b.left) / b.width - 0.5) * -0.5;
    }, { passive: true });
    host.addEventListener('pointerleave', function () { camATarget = camA0; });
  }

  play();
})();
