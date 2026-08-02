/**
 * Chronos SaaS - Immersive 3D WebGL Background Engine (Three.js)
 * Features an undulating 3D wireframe mesh wave + floating geometric octahedrons + dynamic lighting
 */

let scene, camera, renderer;
let waveMesh, floatingGroup;
let pointLight, ambientLight;
let mouseX = 0, mouseY = 0;
let targetMouseX = 0, targetMouseY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let clock = new THREE.Clock();

export function initThreeBackground() {
  const container = document.getElementById('three-canvas-container');
  if (!container) return;

  // 1. Scene Setup
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0f19, 0.0018);

  // 2. Camera Setup
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 3000);
  camera.position.set(0, 150, 450);

  // 3. Lighting Setup
  ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  pointLight = new THREE.PointLight(0x3b82f6, 2.5, 1200);
  pointLight.position.set(0, 200, 200);
  scene.add(pointLight);

  // 4. Undulating 3D Wave Mesh Setup
  const planeGeo = new THREE.PlaneGeometry(1600, 1600, 45, 45);
  planeGeo.rotateX(-Math.PI / 2.4);

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const wireColor = currentTheme === 'dark' ? 0x3b82f6 : 0x2563eb;

  const planeMat = new THREE.MeshStandardMaterial({
    color: wireColor,
    wireframe: true,
    transparent: true,
    opacity: currentTheme === 'dark' ? 0.35 : 0.22,
    roughness: 0.2,
    metalness: 0.8
  });

  waveMesh = new THREE.Mesh(planeGeo, planeMat);
  waveMesh.position.y = -180;
  scene.add(waveMesh);

  // 5. Floating 3D Geometric Polyhedra Group
  floatingGroup = new THREE.Group();
  const polyGeo = new THREE.OctahedronGeometry(18, 0);

  for (let i = 0; i < 35; i++) {
    const polyMat = new THREE.MeshStandardMaterial({
      color: wireColor,
      wireframe: true,
      transparent: true,
      opacity: Math.random() * 0.4 + 0.2
    });

    const mesh = new THREE.Mesh(polyGeo, polyMat);
    mesh.position.set(
      (Math.random() - 0.5) * 1200,
      (Math.random() - 0.5) * 600 + 100,
      (Math.random() - 0.5) * 800
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    mesh.scale.setScalar(Math.random() * 1.5 + 0.6);
    
    // Custom float speeds
    mesh.userData = {
      rotSpeedX: (Math.random() - 0.5) * 0.015,
      rotSpeedY: (Math.random() - 0.5) * 0.015,
      floatSpeed: Math.random() * 0.02 + 0.005,
      initialY: mesh.position.y
    };

    floatingGroup.add(mesh);
  }
  scene.add(floatingGroup);

  // 6. Renderer
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  // Listeners
  document.addEventListener('mousemove', onMouseMove, false);
  window.addEventListener('resize', onWindowResize, false);

  // Update scene background fog color according to theme
  updateThreeTheme(currentTheme);

  // Animation Loop
  animate();
}

function onMouseMove(event) {
  mouseX = (event.clientX - windowHalfX) * 0.2;
  mouseY = (event.clientY - windowHalfY) * 0.2;
}

function onWindowResize() {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();

  // Smooth mouse inertia
  targetMouseX += (mouseX - targetMouseX) * 0.04;
  targetMouseY += (mouseY - targetMouseY) * 0.04;

  camera.position.x = targetMouseX;
  camera.position.y = 150 - targetMouseY;
  camera.lookAt(0, 0, 0);

  // Animate Wave Vertices (3D Sine Wave Motion)
  if (waveMesh) {
    const pos = waveMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      const v = pos.getY(i);
      const z = Math.sin(u * 0.01 + elapsedTime * 1.2) * Math.cos(v * 0.01 + elapsedTime * 1.2) * 28;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
  }

  // Animate Floating Octahedrons
  if (floatingGroup) {
    floatingGroup.children.forEach(child => {
      child.rotation.x += child.userData.rotSpeedX;
      child.rotation.y += child.userData.rotSpeedY;
      child.position.y = child.userData.initialY + Math.sin(elapsedTime * 1.5 + child.position.x) * 15;
    });
  }

  // Animate Point Light Position
  if (pointLight) {
    pointLight.position.x = Math.sin(elapsedTime * 0.8) * 300;
    pointLight.position.z = Math.cos(elapsedTime * 0.8) * 300;
  }

  renderer.render(scene, camera);
}

// Dynamic Theme Switcher Sync for Three.js Scene
export function updateThreeTheme(theme) {
  if (!scene || !waveMesh) return;

  if (theme === 'dark') {
    scene.fog.color.setHex(0x0b0f19);
    waveMesh.material.color.setHex(0x3b82f6);
    waveMesh.material.opacity = 0.35;
    if (pointLight) pointLight.color.setHex(0x3b82f6);
    
    if (floatingGroup) {
      floatingGroup.children.forEach(child => {
        child.material.color.setHex(0x60a5fa);
      });
    }
  } else {
    scene.fog.color.setHex(0xf8fafc);
    waveMesh.material.color.setHex(0x2563eb);
    waveMesh.material.opacity = 0.22;
    if (pointLight) pointLight.color.setHex(0x2563eb);

    if (floatingGroup) {
      floatingGroup.children.forEach(child => {
        child.material.color.setHex(0x1d4ed8);
      });
    }
  }
}
