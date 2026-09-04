/**
 * TRACE Agent — Three.js OLED Cyber Background
 * Pure OLED black canvas with interactive 3D particle constellation & security grid.
 */
import * as THREE from "three";

let scene, camera, renderer;
let particleSystem, linesMesh;
let shieldGroup;
let mouseX = 0, mouseY = 0;
let targetMouseX = 0, targetMouseY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let animationFrameId = null;

const PARTICLE_COUNT = 160;
const MAX_DISTANCE = 120;

export function initThreeBackground() {
  const existingCanvas = document.getElementById("bg-canvas");
  if (existingCanvas) return;

  // 1. Canvas setup
  const canvas = document.createElement("canvas");
  canvas.id = "bg-canvas";
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.zIndex = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.background = "#000000";
  document.body.prepend(canvas);

  // 2. Three.js Scene & Camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    1,
    2000
  );
  camera.position.z = 450;

  // 3. Renderer with OLED pure black
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 1.0); // OLED Pitch Black
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // 4. Central Cyber Security Shield / Icosahedron
  shieldGroup = new THREE.Group();
  
  // Outer wireframe dodecahedron
  const geoDodec = new THREE.DodecahedronGeometry(140, 1);
  const matDodec = new THREE.MeshBasicMaterial({
    color: 0x4338ca, // Deep indigo
    wireframe: true,
    transparent: true,
    opacity: 0.18,
  });
  const dodecMesh = new THREE.Mesh(geoDodec, matDodec);
  shieldGroup.add(dodecMesh);

  // Inner glowing core icosahedron
  const geoIcosa = new THREE.IcosahedronGeometry(85, 1);
  const matIcosa = new THREE.MeshBasicMaterial({
    color: 0x06b6d4, // Cyan glow
    wireframe: true,
    transparent: true,
    opacity: 0.28,
  });
  const icosaMesh = new THREE.Mesh(geoIcosa, matIcosa);
  shieldGroup.add(icosaMesh);

  // Center glowing pivot
  const coreGeo = new THREE.SphereGeometry(18, 16, 16);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x818cf8,
    wireframe: true,
    transparent: true,
    opacity: 0.4,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  shieldGroup.add(coreMesh);

  shieldGroup.position.set(0, 0, -50);
  scene.add(shieldGroup);

  // 5. Constellation Particles
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  const particleVelocities = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = (Math.random() - 0.5) * 1000;
    const y = (Math.random() - 0.5) * 800;
    const z = (Math.random() - 0.5) * 600;

    particlePositions[i * 3] = x;
    particlePositions[i * 3 + 1] = y;
    particlePositions[i * 3 + 2] = z;

    particleVelocities.push({
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      vz: (Math.random() - 0.5) * 0.3,
    });
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(particlePositions, 3)
  );

  // High-tech glowing particle shader/points
  const particleMaterial = new THREE.PointsMaterial({
    color: 0x818cf8,
    size: 3.5,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
  });

  particleSystem = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particleSystem);

  // 6. Dynamic Connection Lines Mesh
  const maxLinePositions = PARTICLE_COUNT * PARTICLE_COUNT * 6;
  const linePositions = new Float32Array(maxLinePositions);
  const lineColors = new Float32Array(maxLinePositions);

  const linesGeometry = new THREE.BufferGeometry();
  linesGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage)
  );
  linesGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage)
  );

  const linesMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
  });

  linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
  scene.add(linesMesh);

  // 7. Mouse Listener with smooth damping
  window.addEventListener("mousemove", onDocumentMouseMove, { passive: true });
  window.addEventListener("resize", onWindowResize, { passive: true });

  // 8. Animation Loop
  function animate() {
    animationFrameId = requestAnimationFrame(animate);

    // Smooth mouse parallax
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    camera.position.x = mouseX * 0.25;
    camera.position.y = -mouseY * 0.25;
    camera.lookAt(scene.position);

    // Slowly rotate central cyber shield
    if (shieldGroup) {
      shieldGroup.rotation.x += 0.002;
      shieldGroup.rotation.y += 0.003;
      shieldGroup.rotation.z += 0.001;
    }

    // Update particle positions & draw proximity connections
    const pos = particleGeometry.attributes.position.array;
    let lineIdx = 0;
    let colorIdx = 0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const v = particleVelocities[i];
      pos[i * 3] += v.vx;
      pos[i * 3 + 1] += v.vy;
      pos[i * 3 + 2] += v.vz;

      // Bounce on boundaries
      if (pos[i * 3] < -500 || pos[i * 3] > 500) v.vx *= -1;
      if (pos[i * 3 + 1] < -400 || pos[i * 3 + 1] > 400) v.vy *= -1;
      if (pos[i * 3 + 2] < -300 || pos[i * 3 + 2] > 300) v.vz *= -1;

      // Check proximity with other particles to draw lines
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const dx = pos[i * 3] - pos[j * 3];
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < MAX_DISTANCE * MAX_DISTANCE) {
          const alpha = 1.0 - Math.sqrt(distSq) / MAX_DISTANCE;

          // Line start
          linePositions[lineIdx++] = pos[i * 3];
          linePositions[lineIdx++] = pos[i * 3 + 1];
          linePositions[lineIdx++] = pos[i * 3 + 2];

          // Line end
          linePositions[lineIdx++] = pos[j * 3];
          linePositions[lineIdx++] = pos[j * 3 + 1];
          linePositions[lineIdx++] = pos[j * 3 + 2];

          // Cyber cyan / indigo connection color
          lineColors[colorIdx++] = 0.25 * alpha; // R
          lineColors[colorIdx++] = 0.55 * alpha; // G
          lineColors[colorIdx++] = 0.95 * alpha; // B

          lineColors[colorIdx++] = 0.05 * alpha;
          lineColors[colorIdx++] = 0.7 * alpha;
          lineColors[colorIdx++] = 0.85 * alpha;
        }
      }
    }

    particleGeometry.attributes.position.needsUpdate = true;

    linesGeometry.setDrawRange(0, lineIdx / 3);
    linesGeometry.attributes.position.needsUpdate = true;
    linesGeometry.attributes.color.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animate();
}

function onDocumentMouseMove(event) {
  targetMouseX = event.clientX - windowHalfX;
  targetMouseY = event.clientY - windowHalfY;
}

function onWindowResize() {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
