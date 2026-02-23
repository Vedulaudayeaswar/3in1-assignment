/* ═══════════════════════════════════════════════════════════════════════
   Lab 1 – Smart Grid EV Charging: Three.js + Charts
   ═══════════════════════════════════════════════════════════════════════ */

// ─── Chart.js Global Config ────────────────────────────────────────────
Chart.defaults.color = "#8888aa";
Chart.defaults.borderColor = "#2a2a40";
Chart.defaults.font.family = "'Inter', sans-serif";

const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

// ─── Three.js EV Grid Visualization ────────────────────────────────────
(function () {
  const container = document.getElementById("lab1-3d");
  if (!container || typeof THREE === "undefined") return;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.02);
  const w = container.clientWidth,
    h = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
  camera.position.set(8, 6, 10);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a0f, 1);
  container.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.AmbientLight(0x6c63ff, 0.3));
  const dir = new THREE.DirectionalLight(0x00d9ff, 0.7);
  dir.position.set(5, 8, 5);
  scene.add(dir);
  const point = new THREE.PointLight(0x00e676, 0.5, 20);
  point.position.set(0, 3, 0);
  scene.add(point);

  // Ground grid
  const gridHelper = new THREE.GridHelper(20, 20, 0x1a1a28, 0x1a1a28);
  scene.add(gridHelper);

  // Transformer (center)
  const transformer = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.5, 1.5),
    new THREE.MeshPhongMaterial({
      color: 0x6c63ff,
      emissive: 0x6c63ff,
      emissiveIntensity: 0.2,
    }),
  );
  transformer.position.y = 0.75;
  scene.add(transformer);

  // EV Stations
  const stations = [];
  const stationColors = [0x00e676, 0x00d9ff, 0xff9100, 0xb388ff, 0xffd600];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const radius = 5;
    const group = new THREE.Group();

    // Charging pillar
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 2, 0.4),
      new THREE.MeshPhongMaterial({
        color: stationColors[i],
        emissive: stationColors[i],
        emissiveIntensity: 0.15,
      }),
    );
    pillar.position.y = 1;
    group.add(pillar);

    // EV body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.6, 0.9),
      new THREE.MeshPhongMaterial({ color: 0x333355 }),
    );
    body.position.set(0.9, 0.4, 0);
    group.add(body);

    // EV roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.4, 0.8),
      new THREE.MeshPhongMaterial({ color: 0x444466 }),
    );
    roof.position.set(0.7, 0.8, 0);
    group.add(roof);

    // SOC indicator bar
    const socBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.05, 0.05),
      new THREE.MeshPhongMaterial({
        color: stationColors[i],
        emissive: stationColors[i],
        emissiveIntensity: 0.5,
      }),
    );
    socBar.position.set(0, 2.2, 0);
    group.add(socBar);

    // Power cable
    const cable = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(
          Math.cos(angle) * radius,
          0.5,
          Math.sin(angle) * radius,
        ),
      ]),
      new THREE.LineBasicMaterial({
        color: stationColors[i],
        transparent: true,
        opacity: 0.3,
      }),
    );
    scene.add(cable);

    group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    group.lookAt(0, 0, 0);
    scene.add(group);
    stations.push({ group, socBar, color: stationColors[i] });
  }

  // Floating energy particles
  const particleGeo = new THREE.BufferGeometry();
  const particleCount = 60;
  const pPositions = new Float32Array(particleCount * 3);
  const pVelocities = [];
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 1 + Math.random() * 5;
    pPositions[i * 3] = Math.cos(angle) * r;
    pPositions[i * 3 + 1] = Math.random() * 4;
    pPositions[i * 3 + 2] = Math.sin(angle) * r;
    pVelocities.push({
      y: 0.01 + Math.random() * 0.02,
      angle: angle,
      r: r,
      speed: 0.005 + Math.random() * 0.01,
    });
  }
  particleGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(pPositions, 3),
  );
  const particleMat = new THREE.PointsMaterial({
    color: 0x00d9ff,
    size: 0.15,
    transparent: true,
    opacity: 0.7,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Mouse
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

    // Rotate transformer
    transformer.rotation.y += 0.005;

    // Animate SOC bars
    stations.forEach((s, i) => {
      const scale = 0.5 + Math.sin(t + i) * 0.3;
      s.socBar.scale.x = scale * 3;
    });

    // Animate particles
    for (let i = 0; i < particleCount; i++) {
      pVelocities[i].angle += pVelocities[i].speed;
      pPositions[i * 3] = Math.cos(pVelocities[i].angle) * pVelocities[i].r;
      pPositions[i * 3 + 1] = (pPositions[i * 3 + 1] + pVelocities[i].y) % 5;
      pPositions[i * 3 + 2] = Math.sin(pVelocities[i].angle) * pVelocities[i].r;
    }
    particleGeo.attributes.position.needsUpdate = true;

    // Camera orbit
    camera.position.x = 10 * Math.cos(t * 0.15) + mx * 2;
    camera.position.z = 10 * Math.sin(t * 0.15) + my * 2;
    camera.position.y = 6 + Math.sin(t * 0.3) * 0.5;
    camera.lookAt(0, 0.5, 0);

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
async function runLab1() {
  const btn = document.getElementById("lab1-run");
  const status = document.getElementById("lab1-status");
  const results = document.getElementById("lab1-results");

  btn.disabled = true;
  status.classList.remove("hidden");
  results.classList.add("hidden");

  const episodes = document.getElementById("lab1-episodes").value;
  const stations = document.getElementById("lab1-stations").value;

  try {
    const resp = await fetch("/api/lab1/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodes: +episodes, stations: +stations }),
    });
    const json = await resp.json();
    if (json.status === "ok") {
      renderLab1Results(json.data);
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

function renderLab1Results(data) {
  const c = data.comparison;
  document.getElementById("rl-cost").textContent = "$" + c.rl_total_cost;
  document.getElementById("base-cost").textContent =
    "$" + c.baseline_total_cost;
  document.getElementById("rl-peak").textContent = c.rl_peak + " kW";
  document.getElementById("base-peak").textContent = c.baseline_peak + " kW";
  document.getElementById("rl-vviol").textContent = c.rl_voltage_violations;
  document.getElementById("base-vviol").textContent =
    c.baseline_voltage_violations;
  document.getElementById("rl-soc").textContent = c.rl_final_avg_soc + "%";
  document.getElementById("base-soc").textContent =
    c.baseline_final_avg_soc + "%";

  const labels96 = Array.from({ length: 96 }, (_, i) => {
    const h = Math.floor(i * 0.25);
    const m = (i % 4) * 15;
    return h.toString().padStart(2, "0") + ":" + m.toString().padStart(2, "0");
  });
  const epLabels = data.training_costs.map((_, i) => i + 1);

  // Training cost
  destroyChart("chart-training-cost");
  chartInstances["chart-training-cost"] = new Chart(
    document.getElementById("chart-training-cost"),
    {
      type: "line",
      data: {
        labels: epLabels,
        datasets: [
          {
            label: "Episode Cost ($)",
            data: data.training_costs,
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
        plugins: { legend: { display: true } },
        scales: { x: { title: { display: true, text: "Episode" } } },
      },
    },
  );

  // Power comparison
  const rlLen = data.rl_history.total_power.length;
  const baseLen = data.baseline_history.total_power.length;
  const maxLen = Math.max(rlLen, baseLen);
  const powerLabels = labels96.slice(0, maxLen);

  destroyChart("chart-power");
  chartInstances["chart-power"] = new Chart(
    document.getElementById("chart-power"),
    {
      type: "line",
      data: {
        labels: powerLabels,
        datasets: [
          {
            label: "RL Agent",
            data: data.rl_history.total_power,
            borderColor: "#00D9FF",
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: "Baseline",
            data: data.baseline_history.total_power,
            borderColor: "#8888aa",
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { title: { display: true, text: "Total Power (kW)" } } },
      },
    },
  );

  // Voltage
  destroyChart("chart-voltage");
  chartInstances["chart-voltage"] = new Chart(
    document.getElementById("chart-voltage"),
    {
      type: "line",
      data: {
        labels: powerLabels,
        datasets: [
          {
            label: "RL Voltage",
            data: data.rl_history.voltage,
            borderColor: "#00E676",
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: "Baseline Voltage",
            data: data.baseline_history.voltage,
            borderColor: "#FF9100",
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          annotation: false,
        },
        scales: { y: { title: { display: true, text: "Voltage (V)" } } },
      },
    },
  );

  // Tariff & Cost
  destroyChart("chart-tariff");
  chartInstances["chart-tariff"] = new Chart(
    document.getElementById("chart-tariff"),
    {
      type: "bar",
      data: {
        labels: powerLabels,
        datasets: [
          {
            label: "Tariff ($/kWh)",
            data: data.rl_history.tariff,
            backgroundColor: "rgba(108,99,255,0.4)",
            borderRadius: 2,
          },
          {
            label: "RL Cost ($)",
            data: data.rl_history.cost,
            backgroundColor: "rgba(0,217,255,0.4)",
            borderRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: { stacked: false },
          y: { title: { display: true, text: "Value" } },
        },
      },
    },
  );

  // SOC
  destroyChart("chart-soc");
  chartInstances["chart-soc"] = new Chart(
    document.getElementById("chart-soc"),
    {
      type: "line",
      data: {
        labels: powerLabels,
        datasets: [
          {
            label: "RL Avg SOC",
            data: data.rl_history.avg_soc,
            borderColor: "#B388FF",
            backgroundColor: "rgba(179,136,255,0.1)",
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
          {
            label: "Baseline Avg SOC",
            data: data.baseline_history.avg_soc,
            borderColor: "#8888aa",
            borderDash: [5, 5],
            tension: 0.4,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { title: { display: true, text: "SOC (%)" }, min: 0, max: 100 },
        },
      },
    },
  );

  // Per-station power
  const stationColors = [
    "#00E676",
    "#00D9FF",
    "#FF9100",
    "#B388FF",
    "#FFD600",
    "#FF5252",
    "#2979FF",
    "#76FF03",
  ];
  const stationDatasets = data.rl_history.station_power.map((sp, i) => ({
    label: "Station " + (i + 1),
    data: sp,
    borderColor: stationColors[i % stationColors.length],
    tension: 0.3,
    pointRadius: 0,
  }));
  destroyChart("chart-station");
  chartInstances["chart-station"] = new Chart(
    document.getElementById("chart-station"),
    {
      type: "line",
      data: { labels: powerLabels, datasets: stationDatasets },
      options: {
        responsive: true,
        scales: { y: { title: { display: true, text: "Power (kW)" } } },
      },
    },
  );
}
