/* ═══════════════════════════════════════════════════════════════════════
   Dashboard – Three.js Mini 3D Cards
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  if (typeof THREE === "undefined") return;

  function createMiniScene(containerId, createObjects) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const scene = new THREE.Scene();
    const w = container.clientWidth || 380;
    const h = container.clientHeight || 180;
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 2, 6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x6c63ff, 0.4);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0x00d9ff, 0.8);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const group = new THREE.Group();
    scene.add(group);
    createObjects(group);

    function animate() {
      requestAnimationFrame(animate);
      group.rotation.y += 0.005;
      group.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;
      renderer.render(scene, camera);
    }
    animate();
  }

  // Card 1 – EV Charging / Grid: Cylinders as charging stations + connecting lines
  createMiniScene("card3d-1", (group) => {
    const stationMat = new THREE.MeshPhongMaterial({
      color: 0x00e676,
      emissive: 0x00e676,
      emissiveIntensity: 0.3,
    });
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const geo = new THREE.CylinderGeometry(0.2, 0.2, 1.2 + Math.random(), 8);
      const mesh = new THREE.Mesh(geo, stationMat);
      mesh.position.set(Math.cos(angle) * 2, 0, Math.sin(angle) * 2);
      group.add(mesh);

      // Lightning bolt
      const boltGeo = new THREE.ConeGeometry(0.12, 0.5, 4);
      const boltMat = new THREE.MeshPhongMaterial({
        color: 0xffd600,
        emissive: 0xffd600,
        emissiveIntensity: 0.5,
      });
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(Math.cos(angle) * 2, 1.2, Math.sin(angle) * 2);
      group.add(bolt);
    }
    // Center transformer
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshPhongMaterial({
        color: 0x6c63ff,
        emissive: 0x6c63ff,
        emissiveIntensity: 0.3,
      }),
    );
    group.add(core);
  });

  // Card 2 – Traffic Grid: Spheres at intersections + roads
  createMiniScene("card3d-2", (group) => {
    const intMat = new THREE.MeshPhongMaterial({
      color: 0x00d9ff,
      emissive: 0x00d9ff,
      emissiveIntensity: 0.3,
    });
    const roadMat = new THREE.MeshPhongMaterial({ color: 0x333355 });
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 12, 12),
          intMat,
        );
        sphere.position.set((i - 1) * 2, 0, (j - 1) * 2);
        group.add(sphere);
      }
    }
    // Roads (horizontal)
    for (let j = 0; j < 3; j++) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 0.3), roadMat);
      road.position.set(0, -0.15, (j - 1) * 2);
      group.add(road);
    }
    // Roads (vertical)
    for (let i = 0; i < 3; i++) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 6), roadMat);
      road.position.set((i - 1) * 2, -0.15, 0);
      group.add(road);
    }
    // Delivery truck
    const truck = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.35, 0.3),
      new THREE.MeshPhongMaterial({
        color: 0xff9100,
        emissive: 0xff9100,
        emissiveIntensity: 0.4,
      }),
    );
    truck.position.set(-1.5, 0.2, 0);
    group.add(truck);
  });

  // Card 3 – Brain: Sphere with EEG waves
  createMiniScene("card3d-3", (group) => {
    // Brain sphere
    const brainGeo = new THREE.SphereGeometry(1.2, 32, 32);
    const brainMat = new THREE.MeshPhongMaterial({
      color: 0xb388ff,
      emissive: 0x6c63ff,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.5,
      wireframe: true,
    });
    const brain = new THREE.Mesh(brainGeo, brainMat);
    group.add(brain);

    // EEG wave rings
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(1.5 + i * 0.3, 0.02, 8, 60);
      const ringMat = new THREE.MeshPhongMaterial({
        color: i === 0 ? 0x00d9ff : i === 1 ? 0x6c63ff : 0x00e676,
        emissive: i === 0 ? 0x00d9ff : i === 1 ? 0x6c63ff : 0x00e676,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.3;
      ring.rotation.z = i * 0.5;
      group.add(ring);
    }

    // Electrode points
    const elMat = new THREE.MeshPhongMaterial({
      color: 0x00e676,
      emissive: 0x00e676,
      emissiveIntensity: 0.6,
    });
    for (let i = 0; i < 8; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / 8);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const el = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), elMat);
      el.position.setFromSphericalCoords(1.22, phi, theta);
      group.add(el);
    }
  });
})();
