/* RootCause 3D hero: stacked knowledge layers, roots running down to a glowing root cause.
   Loaded lazily; the SVG illustration stays as the fallback when WebGL is missing. */
import * as THREE from "/vendor/three.module.min.js";

const INK = 0x141414;
const STATUS = { weak: 0xe5484d, okay: 0xf59e0b, strong: 0x12a15e, untried: 0xd8d2c4 };

function roundedSlab(w, d, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 3, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function outlined(geo, mat, outline = 0.045) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = true; body.receiveShadow = true;
  const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  geo.computeBoundingBox();
  const bb = geo.boundingBox, size = new THREE.Vector3(); bb.getSize(size);
  shell.scale.set(1 + outline * 2 / size.x, 1 + outline * 2 / Math.max(size.y, 0.2), 1 + outline * 2 / size.z);
  shell.position.y = -outline;
  g.add(shell, body);
  return g;
}

function ball(radius, color, emissive = 0) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(radius, 32, 24);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05, emissive: emissive ? color : 0x000000, emissiveIntensity: emissive });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  shell.scale.setScalar(1 + 0.06 / radius);
  g.add(shell, m);
  return g;
}

function tube(points, radius, color, opacity = 1) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 64, radius, 10, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: opacity < 1, opacity });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return { mesh: m, curve };
}

export function mount(el, { compact = false } = {}) {
  let renderer;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return false; // no WebGL: keep the SVG
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(compact ? 30 : 32, 1, 0.1, 100);
  camera.position.set(10.4, 9.0, 10.4);
  camera.lookAt(0, 2.05, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xe8dcc0, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(5, 10, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  scene.add(ground);

  const world = new THREE.Group();
  scene.add(world);

  // ---- three layers: root (amber) at the bottom, what it builds on, the topic you're stuck on
  const W = 4.2, H = 0.48, GAP = 1.55;
  const layers = [
    { y: 0, color: 0xf5b700, opacity: 1 },
    { y: GAP, color: 0xbfe9d2, opacity: 0.9 },
    { y: GAP * 2, color: 0xffffff, opacity: 0.9 },
  ];
  const slabGeo = roundedSlab(W, W, H, 0.42);
  layers.forEach((l) => {
    const mat = new THREE.MeshStandardMaterial({ color: l.color, roughness: 0.6, metalness: 0.02, transparent: l.opacity < 1, opacity: l.opacity });
    const s = outlined(slabGeo, mat);
    s.position.y = l.y;
    world.add(s);
  });
  const top = (i) => layers[i].y + H + 0.07;

  // ---- topic nodes on each layer; the centre column is the diagnosed chain
  const side = [
    [[-1.3, -1.1, "strong"], [1.25, -0.9, "okay"], [1.1, 1.3, "untried"]],
    [[-1.4, 0.9, "okay"], [1.35, -1.2, "strong"], [-0.9, -1.45, "untried"]],
    [[-1.35, 1.2, "untried"], [1.4, 0.95, "okay"]],
  ];
  const sideNodes = [];
  side.forEach((row, li) => row.forEach(([x, z, st]) => {
    const b = ball(0.2, STATUS[st]);
    b.position.set(x, top(li) + 0.2, z);
    world.add(b);
    sideNodes.push({ li, x, z, st });
  }));
  const chainTop = ball(0.3, STATUS.weak); chainTop.position.set(0, top(2) + 0.3, 0); world.add(chainTop);
  const chainMid = ball(0.3, STATUS.weak); chainMid.position.set(0, top(1) + 0.3, 0); world.add(chainMid);
  const root = ball(0.5, 0xffc21a, 0.35); root.position.set(0, top(0) + 0.5, 0); world.add(root);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf5b700, transparent: true, opacity: 0.55 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 12, 64), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, top(0) + 0.06, 0);
  world.add(ring);

  // ---- roots: the main chain threads down through the layers; side roots hang from other nodes
  const main = tube([
    new THREE.Vector3(0, top(2) + 0.3, 0),
    new THREE.Vector3(0.18, top(1) + 1.0, 0.1),
    new THREE.Vector3(0, top(1) + 0.3, 0),
    new THREE.Vector3(-0.15, top(0) + 1.0, -0.1),
    new THREE.Vector3(0, top(0) + 0.5, 0),
  ], 0.075, INK);
  world.add(main.mesh);
  sideNodes.filter((n) => n.li > 0).forEach((n) => {
    const t = tube([
      new THREE.Vector3(n.x, top(n.li) + 0.2, n.z),
      new THREE.Vector3(n.x * 0.8, top(n.li) - 0.6, n.z * 0.8),
      new THREE.Vector3(n.x * 0.45, top(n.li - 1) + 0.25, n.z * 0.45),
    ], 0.035, 0x3b3b3b, 0.75);
    world.add(t.mesh);
  });

  // ---- sap: little amber beads rising from the root up the main chain
  const beadGeo = new THREE.SphereGeometry(0.085, 16, 12);
  const beadMat = new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xf5b700, emissiveIntensity: 0.9 });
  const beads = Array.from({ length: 7 }, (_, i) => {
    const m = new THREE.Mesh(beadGeo, beadMat);
    world.add(m);
    return { m, t: i / 7 };
  });

  // ---- sprout on top
  const green = new THREE.MeshStandardMaterial({ color: 0x2fbf71, roughness: 0.45 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.1, 12), green);
  stem.position.set(0, top(2) + 0.85, 0); stem.castShadow = true; world.add(stem);
  const leafGeo = new THREE.SphereGeometry(0.5, 24, 16);
  [[-0.38, 0.55], [0.4, -0.5]].forEach(([x, rz], i) => {
    const leaf = new THREE.Mesh(leafGeo, i ? new THREE.MeshStandardMaterial({ color: 0x12a15e, roughness: 0.45 }) : green);
    leaf.scale.set(0.75, 0.14, 0.38);
    leaf.position.set(x, top(2) + 1.3 + i * 0.12, 0);
    leaf.rotation.z = rz;
    leaf.castShadow = true;
    world.add(leaf);
  });

  // ---- floating orbs for depth
  const orbA = ball(0.32, 0xf5b700, 0.15); orbA.position.set(2.7, 4.6, -1.2); world.add(orbA);
  const orbB = ball(0.22, 0x2fbf71); orbB.position.set(-2.8, 2.2, 1.6); world.add(orbB);

  world.rotation.y = -0.35;

  // ---- sizing, pointer tilt, animation
  el.prepend(canvas);
  function size() {
    const w = el.clientWidth || 300, h = el.clientHeight || w * 1.1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  size();
  new ResizeObserver(size).observe(el);

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    tilt.tx = ((e.clientX - (r.left + r.width / 2)) / innerWidth) * 0.9;
    tilt.ty = ((e.clientY - (r.top + r.height / 2)) / innerHeight) * 0.35;
  }, { passive: true });

  let visible = true, last = performance.now(), time = 0, raf = 0;
  function frame(now) {
    // ~30 fps is plenty for a slow idle animation and halves the GPU work.
    if (now - last < 32 && time > 0) { if (visible && !reduce) raf = requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    tilt.x += (tilt.tx - tilt.x) * 0.06;
    tilt.y += (tilt.ty - tilt.y) * 0.06;
    world.rotation.y = -0.35 + Math.sin(time * 0.35) * 0.22 + tilt.x;
    world.rotation.x = tilt.y * 0.4;
    const pulse = 1 + Math.sin(time * 2.4) * 0.06;
    root.scale.setScalar(pulse);
    ring.scale.setScalar(1 + ((time * 0.6) % 1) * 0.8);
    ringMat.opacity = 0.55 * (1 - ((time * 0.6) % 1));
    beads.forEach((b) => {
      b.t = (b.t + dt * 0.12) % 1;
      b.m.position.copy(main.curve.getPointAt(1 - b.t));
    });
    orbA.position.y = 4.6 + Math.sin(time * 1.1) * 0.18;
    orbB.position.y = 2.2 + Math.sin(time * 1.4 + 1) * 0.14;
    renderer.render(scene, camera);
    if (visible && !reduce) raf = requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver(([entry]) => {
    const was = visible;
    visible = entry.isIntersecting && !document.hidden;
    if (visible && !was && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  io.observe(el);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { visible = false; cancelAnimationFrame(raf); }
    else if (!reduce) { visible = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  frame(performance.now());
  el.classList.add("has-3d");
  return true;
}
