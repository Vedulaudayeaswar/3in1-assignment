# 3-in-1 Deep Reinforcement Learning Labs

A full-stack web application featuring three Deep RL lab experiments with interactive 3D visualizations, real-time training, and performance comparison dashboards.

Built with **Flask**, **Three.js**, **Chart.js**, and **SQLite**.

---

## Lab Experiments

### Lab 1: Smart Grids – EV Charging Optimization

- **Goal:** Design an autonomous EV charging controller for a smart distribution grid
- **Algorithm:** PPO-inspired policy gradient agent
- **Environment:** 3–8 EV charging stations with time-of-use tariffs, voltage/frequency constraints
- **Baseline:** Equal power allocation (rule-based)
- **Metrics:** Total cost, peak demand, voltage violations, final SOC

### Lab 2: Logistics – Multi-Agent Traffic Signal & Delivery

- **Goal:** Optimize traffic signal timing and delivery vehicle routing in a grid-world network
- **Algorithm:** MAPPO (Multi-Agent PPO) with independent intersection agents
- **Environment:** NxN intersection grid with delivery vehicles and time-window constraints
- **Baseline:** Static fixed-cycle signal timing
- **Metrics:** Avg queue length, throughput, on-time delivery %

### Lab 3: Healthcare – EEG-Guided Parkinson's Therapy Tuning

- **Goal:** Closed-loop AI agent that adjusts drug dosage and DBS parameters based on EEG biomarkers
- **Algorithm:** PPO-inspired continuous action agent
- **Environment:** Simulated Parkinson's patient with tremor, bradykinesia, rigidity, and EEG features
- **Baseline:** Fixed dosage (no adjustments)
- **Metrics:** Symptom score, side effects, drug dose, DBS amplitude

---

## Features

- **Authentication:** Login & registration with SQLite database
- **3D Visualizations:** Three.js scenes for each lab (EV grid, traffic network, brain with EEG electrodes)
- **Interactive Charts:** Real-time Chart.js graphs comparing RL agent vs baseline
- **Framer-style Animations:** Smooth page transitions, floating elements, gradient glows
- **Configurable Parameters:** Adjust episodes, stations, grid size, vehicles via sliders
- **Safety Filters:** Voltage/frequency limits (Lab 1), DBS/dose bounds (Lab 3)

---

## Tech Stack

| Layer         | Technology               |
| ------------- | ------------------------ |
| Backend       | Python, Flask            |
| Database      | SQLite                   |
| Frontend      | HTML5, CSS3, JavaScript  |
| 3D Engine     | Three.js                 |
| Charts        | Chart.js                 |
| RL Algorithms | NumPy (custom PPO/MAPPO) |

---

## Project Structure

```
├── app.py                  # Flask application (routes, auth, API)
├── lab1_backend.py         # Lab 1: EV Charging RL environment + agent
├── lab2_backend.py         # Lab 2: Traffic Signal multi-agent RL
├── lab3_backend.py         # Lab 3: Parkinson's therapy RL agent
├── requirements.txt        # Python dependencies
├── templates/
│   ├── base.html           # Base template
│   ├── login.html          # Login page
│   ├── register.html       # Registration page
│   ├── dashboard.html      # Main dashboard with lab cards
│   ├── lab1.html           # Lab 1 page
│   ├── lab2.html           # Lab 2 page
│   └── lab3.html           # Lab 3 page
└── static/
    ├── css/
    │   └── style.css       # Complete stylesheet with animations
    └── js/
        ├── three-bg.js     # Particle network background (auth pages)
        ├── dashboard-3d.js # Mini 3D card scenes (dashboard)
        ├── lab1.js         # Lab 1 Three.js + Chart.js
        ├── lab2.js         # Lab 2 Three.js + Chart.js
        └── lab3.js         # Lab 3 Three.js + Chart.js
```

---

## Setup & Run Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

Open **http://127.0.0.1:5000** in your browser. Register an account, log in, and start running simulations.

---

## Screenshots

| Login                        | Dashboard        | Lab Simulation            |
| ---------------------------- | ---------------- | ------------------------- |
| Three.js particle background | 3D card previews | Real-time charts + 3D viz |

---

## How It Works

1. **Register/Login** → Creates account in SQLite, starts session
2. **Dashboard** → Browse 3 lab cards with Three.js mini-scenes
3. **Lab Page** → Read problem statement, adjust parameters, click "Run Simulation"
4. **Backend** → Flask API trains the RL agent for N episodes, runs baseline comparison
5. **Results** → Comparison cards + interactive Chart.js graphs render in-browser

---

## Authors

**Vedula Udaye Aswar** – [GitHub](https://github.com/Vedulaudayeaswar)

---

## License

This project is for educational/academic purposes.
