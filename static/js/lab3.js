/* ═══════════════════════════════════════════════════════════════════════
   Lab 3 – EEG-Guided Parkinson's Therapy: Three.js + Charts
   ═══════════════════════════════════════════════════════════════════════ */

Chart.defaults.color = "#8888aa";
Chart.defaults.borderColor = "#2a2a40";
Chart.defaults.font.family = "'Inter', sans-serif";

const chartInstances3 = {};
function destroyChart3(id) {
  if (chartInstances3[id]) {
    chartInstances3[id].destroy();
    delete chartInstances3[id];
  }
}

// ─── Three.js Brain & EEG Visualization ────────────────────────────────
(function () {
  const container = document.getElementById("lab3-3d");
  if (!container || typeof THREE === "undefined") return;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.012);
  const w = container.clientWidth,
    h = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
  camera.position.set(0, 3, 8);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a0f, 1);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x6c63ff, 0.25));
  const dir = new THREE.DirectionalLight(0xb388ff, 0.6);
  dir.position.set(5, 8, 5);
  scene.add(dir);
  const backLight = new THREE.DirectionalLight(0x00d9ff, 0.3);
  backLight.position.set(-5, 3, -5);
  scene.add(backLight);

  // Brain hemisphere (wireframe)
  const brainGroup = new THREE.Group();
  scene.add(brainGroup);

  const brainGeo = new THREE.SphereGeometry(2, 40, 40);
  // Slightly deform to look more brain-like
  const posAttr = brainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const noise = 1 + 0.1 * Math.sin(x * 4) * Math.cos(y * 3) * Math.sin(z * 5);
    posAttr.setXYZ(i, x * noise, y * noise * 1.1, z * noise);
  }
  brainGeo.computeVertexNormals();

  const brainMat = new THREE.MeshPhongMaterial({
    color: 0x8866cc,
    emissive: 0x6c63ff,
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 0.2,
    wireframe: true,
    wireframeLinewidth: 1,
  });
  const brain = new THREE.Mesh(brainGeo, brainMat);
  brainGroup.add(brain);

  // Solid inner brain
  const innerBrain = new THREE.Mesh(
    new THREE.SphereGeometry(1.85, 32, 32),
    new THREE.MeshPhongMaterial({
      color: 0x553399,
      emissive: 0x331177,
      emissiveIntensity: 0.1,
      transparent: true,
      opacity: 0.35,
    }),
  );
  brainGroup.add(innerBrain);

  // Electrodes (EEG)
  const electrodes = [];
  const electrodeMat = new THREE.MeshPhongMaterial({
    color: 0x00e676,
    emissive: 0x00e676,
    emissiveIntensity: 0.6,
  });
  const electrodePositions = [
    [0, 2.2, 0],
    [1.5, 1.2, 0.8],
    [-1.5, 1.2, 0.8],
    [1.0, 1.8, -0.5],
    [-1.0, 1.8, -0.5],
    [0.5, 0.8, 1.8],
    [-0.5, 0.8, 1.8],
    [1.8, 0.5, 0],
    [-1.8, 0.5, 0],
    [0, 1.5, -1.5],
  ];
  electrodePositions.forEach((pos) => {
    const el = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      electrodeMat.clone(),
    );
    el.position.set(...pos);
    brainGroup.add(el);
    electrodes.push(el);

    // Wire from electrode to brain surface
    const wire = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...pos),
        new THREE.Vector3(pos[0] * 0.7, pos[1] * 0.7, pos[2] * 0.7),
      ]),
      new THREE.LineBasicMaterial({
        color: 0x00e676,
        transparent: true,
        opacity: 0.3,
      }),
    );
    brainGroup.add(wire);
  });

  // EEG wave rings
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const ringGeo = new THREE.TorusGeometry(2.5 + i * 0.4, 0.015, 8, 80);
    const ringColors = [0x00d9ff, 0x6c63ff, 0xb388ff, 0x00e676];
    const ringMat = new THREE.MeshPhongMaterial({
      color: ringColors[i],
      emissive: ringColors[i],
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.4,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.5 - i * 0.3;
    brainGroup.add(ring);
    rings.push(ring);
  }

  // DBS probe
  const probeGeo = new THREE.CylinderGeometry(0.03, 0.03, 3, 8);
  const probeMat = new THREE.MeshPhongMaterial({
    color: 0xff9100,
    emissive: 0xff9100,
    emissiveIntensity: 0.4,
  });
  const probe = new THREE.Mesh(probeGeo, probeMat);
  probe.position.set(0.5, 0, 0);
  probe.rotation.z = Math.PI / 6;
  brainGroup.add(probe);

  // DBS pulse light
  const dbsLight = new THREE.PointLight(0xff9100, 0.5, 5);
  dbsLight.position.set(0.5, -0.5, 0);
  brainGroup.add(dbsLight);

  // Floating neurotransmitter particles
  const neoGeo = new THREE.BufferGeometry();
  const nCount = 80;
  const nPos = new Float32Array(nCount * 3);
  const nVel = [];
  for (let i = 0; i < nCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 2 + Math.random() * 2;
    nPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    nPos[i * 3 + 1] = r * Math.cos(phi);
    nPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    nVel.push({
      theta: theta,
      phi: phi,
      r: r,
      speed: 0.002 + Math.random() * 0.005,
      ySpeed: (Math.random() - 0.5) * 0.01,
    });
  }
  neoGeo.setAttribute("position", new THREE.BufferAttribute(nPos, 3));
  const neoMat = new THREE.PointsMaterial({
    color: 0xb388ff,
    size: 0.1,
    transparent: true,
    opacity: 0.6,
  });
  const neoParticles = new THREE.Points(neoGeo, neoMat);
  brainGroup.add(neoParticles);

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

    // Rotate brain slowly
    brainGroup.rotation.y += 0.003;

    // Pulse electrodes
    electrodes.forEach((el, i) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i * 0.8);
      el.material.emissiveIntensity = 0.3 + pulse * 0.7;
      el.scale.setScalar(0.8 + pulse * 0.4);
    });

    // Animate rings
    rings.forEach((ring, i) => {
      ring.rotation.z = t * (0.2 + i * 0.1);
      ring.material.opacity = 0.2 + 0.2 * Math.sin(t * 2 + i);
    });

    // DBS pulse
    dbsLight.intensity = 0.3 + 0.4 * Math.abs(Math.sin(t * 5));

    // Neurotransmitter particles
    for (let i = 0; i < nCount; i++) {
      nVel[i].theta += nVel[i].speed;
      const v = nVel[i];
      nPos[i * 3] = v.r * Math.sin(v.phi) * Math.cos(v.theta);
      nPos[i * 3 + 1] += v.ySpeed;
      if (Math.abs(nPos[i * 3 + 1]) > 3) v.ySpeed *= -1;
      nPos[i * 3 + 2] = v.r * Math.sin(v.phi) * Math.sin(v.theta);
    }
    neoGeo.attributes.position.needsUpdate = true;

    // Camera
    camera.position.x = 7 * Math.sin(t * 0.12) + mx * 2;
    camera.position.z = 7 * Math.cos(t * 0.12) + my * 2;
    camera.position.y = 3 + Math.sin(t * 0.25) * 0.5;
    camera.lookAt(0, 0.3, 0);

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
async function runLab3() {
  const btn = document.getElementById("lab3-run");
  const status = document.getElementById("lab3-status");
  const results = document.getElementById("lab3-results");

  btn.disabled = true;
  status.classList.remove("hidden");
  results.classList.add("hidden");

  const episodes = document.getElementById("lab3-episodes").value;

  try {
    const resp = await fetch("/api/lab3/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodes: +episodes }),
    });
    const json = await resp.json();
    if (json.status === "ok") {
      renderLab3Results(json.data);
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

function renderLab3Results(data) {
  const c = data.comparison;
  document.getElementById("h-rl-symptom").textContent = c.rl_final_symptom;
  document.getElementById("h-base-symptom").textContent =
    c.baseline_final_symptom;
  document.getElementById("h-rl-se").textContent = c.rl_avg_side_effects;
  document.getElementById("h-base-se").textContent =
    c.baseline_avg_side_effects;
  document.getElementById("h-rl-dose").textContent = c.rl_final_dose + " mg";
  document.getElementById("h-base-dose").textContent =
    c.baseline_final_dose + " mg";
  document.getElementById("h-rl-dbs").textContent = c.rl_final_dbs + " mA";
  document.getElementById("h-base-dbs").textContent =
    c.baseline_final_dbs + " mA";

  const stepLabels = data.rl_history.symptom_score.map((_, i) => {
    const mins = i * 20;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h.toString().padStart(2, "0") + ":" + m.toString().padStart(2, "0");
  });
  const epLabels = data.training_rewards.map((_, i) => i + 1);

  // Training reward
  destroyChart3("chart-h-reward");
  chartInstances3["chart-h-reward"] = new Chart(
    document.getElementById("chart-h-reward"),
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
          {
            label: "Final Symptom Score",
            data: data.training_symptoms,
            borderColor: "#FF5252",
            tension: 0.4,
            pointRadius: 0,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: "Episode" } },
          y: { title: { display: true, text: "Reward" }, position: "left" },
          y1: {
            title: { display: true, text: "Symptom Score" },
            position: "right",
            grid: { drawOnChartArea: false },
          },
        },
      },
    },
  );

  // Symptom score comparison
  destroyChart3("chart-h-symptom");
  chartInstances3["chart-h-symptom"] = new Chart(
    document.getElementById("chart-h-symptom"),
    {
      type: "line",
      data: {
        labels: stepLabels,
        datasets: [
          {
            label: "RL Agent",
            data: data.rl_history.symptom_score,
            borderColor: "#00D9FF",
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: "Fixed Baseline",
            data: data.baseline_history.symptom_score,
            borderColor: "#8888aa",
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            title: { display: true, text: "Symptom Score (lower = better)" },
          },
        },
      },
    },
  );

  // Side effects
  destroyChart3("chart-h-side");
  chartInstances3["chart-h-side"] = new Chart(
    document.getElementById("chart-h-side"),
    {
      type: "line",
      data: {
        labels: stepLabels,
        datasets: [
          {
            label: "RL Side Effects",
            data: data.rl_history.side_effects,
            borderColor: "#FF5252",
            backgroundColor: "rgba(255,82,82,0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: "Baseline Side Effects",
            data: data.baseline_history.side_effects,
            borderColor: "#FF9100",
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { title: { display: true, text: "Side Effects (0-10)" }, min: 0 },
        },
      },
    },
  );

  // EEG biomarkers
  destroyChart3("chart-h-eeg");
  chartInstances3["chart-h-eeg"] = new Chart(
    document.getElementById("chart-h-eeg"),
    {
      type: "line",
      data: {
        labels: stepLabels,
        datasets: [
          {
            label: "Theta Power",
            data: data.rl_history.theta_power,
            borderColor: "#B388FF",
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: "Beta Power",
            data: data.rl_history.beta_power,
            borderColor: "#00D9FF",
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: "Theta/Beta Ratio",
            data: data.rl_history.theta_beta_ratio,
            borderColor: "#00E676",
            tension: 0.3,
            pointRadius: 0,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            title: { display: true, text: "Power (μV²)" },
            position: "left",
          },
          y1: {
            title: { display: true, text: "Ratio" },
            position: "right",
            grid: { drawOnChartArea: false },
          },
        },
      },
    },
  );

  // Drug dosage
  destroyChart3("chart-h-drug");
  chartInstances3["chart-h-drug"] = new Chart(
    document.getElementById("chart-h-drug"),
    {
      type: "line",
      data: {
        labels: stepLabels,
        datasets: [
          {
            label: "RL Drug Dose (mg)",
            data: data.rl_history.drug_dose,
            borderColor: "#FF9100",
            backgroundColor: "rgba(255,145,0,0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: "Baseline Drug Dose",
            data: data.baseline_history.drug_dose,
            borderColor: "#8888aa",
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { title: { display: true, text: "Dose (mg)" }, min: 0, max: 10 },
        },
      },
    },
  );

  // DBS parameters
  destroyChart3("chart-h-dbs");
  chartInstances3["chart-h-dbs"] = new Chart(
    document.getElementById("chart-h-dbs"),
    {
      type: "line",
      data: {
        labels: stepLabels,
        datasets: [
          {
            label: "DBS Amplitude (mA)",
            data: data.rl_history.dbs_amplitude,
            borderColor: "#6C63FF",
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: "DBS Frequency (Hz)",
            data: data.rl_history.dbs_frequency,
            borderColor: "#00D9FF",
            tension: 0.3,
            pointRadius: 0,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            title: { display: true, text: "Amplitude (mA)" },
            position: "left",
            min: 0,
            max: 5,
          },
          y1: {
            title: { display: true, text: "Frequency (Hz)" },
            position: "right",
            min: 100,
            max: 185,
            grid: { drawOnChartArea: false },
          },
        },
      },
    },
  );
}
