/* ═══════════════════════════════════════════════════════════════════════
   Lab 2 – Multi-Agent Traffic Signal & Delivery: Three.js + Charts
   ═══════════════════════════════════════════════════════════════════════ */

Chart.defaults.color = "#8888aa";
Chart.defaults.borderColor = "#2a2a40";
Chart.defaults.font.family = "'Inter', sans-serif";

const chartInstances2 = {};
function destroyChart2(id) {
  if (chartInstances2[id]) {
    chartInstances2[id].destroy();
    delete chartInstances2[id];
  }
}

// ─── Three.js Traffic Network Visualization ────────────────────────────
(function () {
  const container = document.getElementById("lab2-3d");
  if (!container || typeof THREE === "undefined") return;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.015);
  const w = container.clientWidth,
    h = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
  camera.position.set(10, 10, 10);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a0f, 1);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x4444aa, 0.3));
  const dir = new THREE.DirectionalLight(0x00d9ff, 0.6);
  dir.position.set(8, 10, 5);
  scene.add(dir);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshPhongMaterial({ color: 0x0a0a14 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  scene.add(ground);

  const GRID = 3;
  const SPACING = 4;
  const roadW = 0.6;
  const intersections = [];
  const vehicles = [];

  // Roads
  const roadMat = new THREE.MeshPhongMaterial({ color: 0x1a1a30 });
  for (let i = 0; i < GRID; i++) {
    // Horizontal
    const hRoad = new THREE.Mesh(
      new THREE.BoxGeometry(SPACING * (GRID - 1) + 2, 0.05, roadW),
      roadMat,
    );
    hRoad.position.set(0, 0, (i - 1) * SPACING);
    scene.add(hRoad);
    // Vertical
    const vRoad = new THREE.Mesh(
      new THREE.BoxGeometry(roadW, 0.05, SPACING * (GRID - 1) + 2),
      roadMat,
    );
    vRoad.position.set((i - 1) * SPACING, 0, 0);
    scene.add(vRoad);
  }

  // Intersections (traffic lights)
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const x = (i - 1) * SPACING;
      const z = (j - 1) * SPACING;

      // Signal light
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8),
        new THREE.MeshPhongMaterial({ color: 0x555577 }),
      );
      pole.position.set(x, 0.75, z);
      scene.add(pole);

      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 12, 12),
        new THREE.MeshPhongMaterial({
          color: 0x00e676,
          emissive: 0x00e676,
          emissiveIntensity: 0.5,
        }),
      );
      light.position.set(x, 1.55, z);
      scene.add(light);

      // Point light from signal
      const sLight = new THREE.PointLight(0x00e676, 0.3, 3);
      sLight.position.set(x, 1.6, z);
      scene.add(sLight);

      intersections.push({ light, sLight, x, z, phase: 0, timer: 0 });
    }
  }

  // Delivery vehicles
  const vColors = [0xff9100, 0x00d9ff, 0xb388ff, 0xffd600, 0xff5252];
  for (let v = 0; v < 5; v++) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.3),
      new THREE.MeshPhongMaterial({
        color: vColors[v],
        emissive: vColors[v],
        emissiveIntensity: 0.2,
      }),
    );
    const startIdx = Math.floor(Math.random() * intersections.length);
    mesh.position.set(
      intersections[startIdx].x + (Math.random() - 0.5),
      0.2,
      intersections[startIdx].z + (Math.random() - 0.5),
    );
    scene.add(mesh);

    // Trail
    const trail = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        mesh.position.clone(),
        mesh.position.clone(),
      ]),
      new THREE.LineBasicMaterial({
        color: vColors[v],
        transparent: true,
        opacity: 0.2,
      }),
    );
    scene.add(trail);

    vehicles.push({
      mesh,
      trail,
      targetX: (Math.floor(Math.random() * GRID) - 1) * SPACING,
      targetZ: (Math.floor(Math.random() * GRID) - 1) * SPACING,
      speed: 0.02 + Math.random() * 0.02,
    });
  }

  let mx = 0,
    my = 0;
  container.addEventListener("mousemove", (e) => {
    const rect = container.getBoundingClientRect();
    mx = ((e.clientX - rect.left) / w - 0.5) * 2;
    my = -((e.clientY - rect.top) / h - 0.5) * 2;
  });

  function animate() {
    requestAnimationFrame(animate);
    const t = Date.now() * 0.001;

    // Animate traffic lights
    intersections.forEach((ix, i) => {
      ix.timer++;
      if (ix.timer > 120 + i * 10) {
        ix.phase = 1 - ix.phase;
        ix.timer = 0;
      }
      const color = ix.phase === 0 ? 0x00e676 : 0xff9100;
      ix.light.material.color.setHex(color);
      ix.light.material.emissive.setHex(color);
      ix.sLight.color.setHex(color);
    });

    // Animate vehicles
    vehicles.forEach((v) => {
      const dx = v.targetX - v.mesh.position.x;
      const dz = v.targetZ - v.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.3) {
        v.targetX = (Math.floor(Math.random() * GRID) - 1) * SPACING;
        v.targetZ = (Math.floor(Math.random() * GRID) - 1) * SPACING;
      } else {
        // Move along road axes
        if (Math.abs(dx) > Math.abs(dz)) {
          v.mesh.position.x += Math.sign(dx) * v.speed;
        } else {
          v.mesh.position.z += Math.sign(dz) * v.speed;
        }
      }
    });

    camera.position.x = 12 * Math.cos(t * 0.1) + mx * 2;
    camera.position.z = 12 * Math.sin(t * 0.1) + my * 2;
    camera.position.y = 9 + Math.sin(t * 0.2) * 0.5;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    const nw = container.clientWidth,
      nh = container.clientHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
})();

// ─── Run Simulation ────────────────────────────────────────────────────
async function runLab2() {
  const btn = document.getElementById("lab2-run");
  const status = document.getElementById("lab2-status");
  const results = document.getElementById("lab2-results");

  btn.disabled = true;
  status.classList.remove("hidden");
  results.classList.add("hidden");

  const episodes = document.getElementById("lab2-episodes").value;
  const grid = document.getElementById("lab2-grid").value;
  const vehicles = document.getElementById("lab2-vehicles").value;

  try {
    const resp = await fetch("/api/lab2/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodes: +episodes,
        grid_size: +grid,
        vehicles: +vehicles,
      }),
    });
    const json = await resp.json();
    if (json.status === "ok") {
      renderLab2Results(json.data);
      results.classList.remove("hidden");
    } else {
      alert("Error: " + json.message);
    }
  } catch (e) {
    alert("Request failed: " + e.message);
  } finally {
    btn.disabled = false;
    status.classList.add("hidden");
  }
}

function renderLab2Results(data) {
  const c = data.comparison;
  document.getElementById("t-rl-queue").textContent = c.rl_avg_queue;
  document.getElementById("t-base-queue").textContent = c.baseline_avg_queue;
  document.getElementById("t-rl-thru").textContent = c.rl_total_throughput;
  document.getElementById("t-base-thru").textContent =
    c.baseline_total_throughput;
  document.getElementById("t-rl-ontime").textContent = c.rl_on_time_pct + "%";
  document.getElementById("t-base-ontime").textContent =
    c.baseline_on_time_pct + "%";
  document.getElementById("t-rl-deliv").textContent = c.rl_deliveries;
  document.getElementById("t-base-deliv").textContent = c.baseline_deliveries;

  const stepLabels = data.rl_history.avg_queue.map((_, i) => i + 1);
  const epLabels = data.training_rewards.map((_, i) => i + 1);

  // Training reward
  destroyChart2("chart-t-reward");
  chartInstances2["chart-t-reward"] = new Chart(
    document.getElementById("chart-t-reward"),
    {
      type: "line",
      data: {
        labels: epLabels,
        datasets: [
          {
            label: "Episode Reward",
            data: data.training_rewards,
            borderColor: "#6C63FF",
            backgroundColor: "rgba(108,99,255,0.1)",
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        scales: { x: { title: { display: true, text: "Episode" } } },
      },
    },
  );

  // Queue comparison
  destroyChart2("chart-t-queue");
  chartInstances2["chart-t-queue"] = new Chart(
    document.getElementById("chart-t-queue"),
    {
      type: "line",
      data: {
        labels: stepLabels,
        datasets: [
          {
            label: "RL Agent",
            data: data.rl_history.avg_queue,
            borderColor: "#00D9FF",
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: "Static Baseline",
            data: data.baseline_history.avg_queue,
            borderColor: "#8888aa",
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { title: { display: true, text: "Avg Queue Length" } } },
      },
    },
  );

  // Throughput
  destroyChart2("chart-t-throughput");
  chartInstances2["chart-t-throughput"] = new Chart(
    document.getElementById("chart-t-throughput"),
    {
      type: "bar",
      data: {
        labels: stepLabels,
        datasets: [
          {
            label: "RL Throughput",
            data: data.rl_history.throughput,
            backgroundColor: "rgba(0,217,255,0.4)",
            borderRadius: 2,
          },
          {
            label: "Baseline Throughput",
            data: data.baseline_history.throughput,
            backgroundColor: "rgba(136,136,170,0.3)",
            borderRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { title: { display: true, text: "Vehicles Served" } } },
      },
    },
  );

  // On-time %
  destroyChart2("chart-t-ontime");
  chartInstances2["chart-t-ontime"] = new Chart(
    document.getElementById("chart-t-ontime"),
    {
      type: "line",
      data: {
        labels: stepLabels,
        datasets: [
          {
            label: "RL On-Time %",
            data: data.rl_history.on_time_pct,
            borderColor: "#00E676",
            backgroundColor: "rgba(0,230,118,0.1)",
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
          {
            label: "Baseline On-Time %",
            data: data.baseline_history.on_time_pct,
            borderColor: "#FF9100",
            borderDash: [5, 5],
            tension: 0.4,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { title: { display: true, text: "On-Time %" }, min: 0, max: 100 },
        },
      },
    },
  );

  // Traffic grid map
  const gridMap = document.getElementById("traffic-grid-map");
  gridMap.innerHTML = "";
  const gridSize = data.grid_size;
  gridMap.style.gridTemplateColumns = `repeat(${gridSize}, 60px)`;

  const phases = data.rl_history.phase_map;
  const queues = data.rl_history.queue_map;
  for (let i = 0; i < gridSize * gridSize; i++) {
    const div = document.createElement("div");
    div.className =
      "traffic-intersection " + (phases[i] === 0 ? "ns-green" : "ew-green");
    div.innerHTML = `<div>${phases[i] === 0 ? "NS" : "EW"}</div><div style="font-size:0.6rem;opacity:0.7">Q:${queues[i] || 0}</div>`;
    gridMap.appendChild(div);
  }
}
