"""
Lab 1: Smart Grids – EV Charging Optimization using Deep RL
Backend simulation engine with PPO-like agent and rule-based baseline.
"""
import numpy as np
import random
import math

# ─── Grid & EV Environment ──────────────────────────────────────────────────

class EVStation:
    """Single EV charging station."""
    def __init__(self, station_id, max_power=22.0):
        self.id = station_id
        self.max_power = max_power          # kW
        self.ev_present = False
        self.soc = 0.0                       # state of charge 0-100 %
        self.target_soc = 0.0
        self.battery_capacity = 60.0         # kWh
        self.arrival_step = 0
        self.departure_step = 0
        self.charging_rate = 0.0             # current allocation kW

    def reset(self, step, total_steps):
        """Spawn a random EV at this station."""
        self.ev_present = True
        self.soc = random.uniform(10, 50)
        self.target_soc = random.uniform(80, 100)
        self.battery_capacity = random.choice([40, 60, 75, 100])
        self.arrival_step = step
        self.departure_step = step + random.randint(int(total_steps * 0.3), int(total_steps * 0.8))
        self.charging_rate = 0.0

    def step(self, power_kw, dt_hours=0.25):
        """Apply charging for one time step (15 min default)."""
        if not self.ev_present:
            return 0.0
        actual = min(power_kw, self.max_power)
        energy = actual * dt_hours  # kWh delivered
        soc_gain = (energy / self.battery_capacity) * 100.0
        self.soc = min(100.0, self.soc + soc_gain)
        self.charging_rate = actual
        return actual


class GridEnvironment:
    """Small distribution grid with N EV stations."""
    def __init__(self, n_stations=5, total_steps=96):
        self.n_stations = n_stations
        self.total_steps = total_steps       # 96 = 24h at 15-min steps
        self.stations = [EVStation(i) for i in range(n_stations)]
        self.grid_capacity = 100.0           # kW total transformer limit
        self.voltage_nominal = 230.0         # V
        self.frequency_nominal = 50.0        # Hz
        self.voltage = 230.0
        self.frequency = 50.0
        self.step_idx = 0
        self.tariff_schedule = self._make_tariff()
        self.history = {"total_power": [], "cost": [], "voltage": [],
                        "frequency": [], "avg_soc": [], "tariff": [],
                        "station_power": [[] for _ in range(n_stations)]}

    def _make_tariff(self):
        """Time-of-use tariff ($/kWh) across 96 steps (24h)."""
        tariff = []
        for t in range(self.total_steps):
            hour = (t * 0.25) % 24
            if 7 <= hour < 11 or 17 <= hour < 21:
                tariff.append(round(random.uniform(0.25, 0.40), 3))  # peak
            elif 11 <= hour < 17:
                tariff.append(round(random.uniform(0.12, 0.20), 3))  # mid
            else:
                tariff.append(round(random.uniform(0.05, 0.10), 3))  # off-peak
        return tariff

    def reset(self):
        self.step_idx = 0
        self.voltage = self.voltage_nominal
        self.frequency = self.frequency_nominal
        self.stations = [EVStation(i) for i in range(self.n_stations)]
        for s in self.stations:
            s.reset(random.randint(0, self.total_steps // 3), self.total_steps)
        self.history = {"total_power": [], "cost": [], "voltage": [],
                        "frequency": [], "avg_soc": [], "tariff": [],
                        "station_power": [[] for _ in range(self.n_stations)]}
        return self._get_state()

    def _get_state(self):
        socs = [s.soc if s.ev_present else -1 for s in self.stations]
        remaining = [max(0, s.departure_step - self.step_idx) if s.ev_present else 0
                     for s in self.stations]
        tariff = self.tariff_schedule[min(self.step_idx, self.total_steps - 1)]
        return {
            "step": self.step_idx,
            "socs": socs,
            "remaining_steps": remaining,
            "voltage": self.voltage,
            "frequency": self.frequency,
            "tariff": tariff,
            "grid_load_pct": 0.0
        }

    def step(self, actions):
        """actions: list of power allocations (kW) per station."""
        total = sum(actions)
        # Safety filter – clip to grid capacity
        if total > self.grid_capacity:
            scale = self.grid_capacity / (total + 1e-9)
            actions = [a * scale for a in actions]
            total = self.grid_capacity

        actual_powers = []
        for s, a in zip(self.stations, actions):
            p = s.step(a)
            actual_powers.append(p)

        total_actual = sum(actual_powers)
        load_pct = total_actual / self.grid_capacity * 100

        # Voltage / frequency deviation model
        self.voltage = self.voltage_nominal - 0.05 * total_actual + random.gauss(0, 0.3)
        self.frequency = self.frequency_nominal - 0.002 * total_actual + random.gauss(0, 0.01)

        tariff = self.tariff_schedule[min(self.step_idx, self.total_steps - 1)]
        cost = total_actual * 0.25 * tariff  # 15-min interval

        avg_soc = np.mean([s.soc for s in self.stations if s.ev_present]) if any(s.ev_present for s in self.stations) else 0

        # Record history
        self.history["total_power"].append(round(total_actual, 2))
        self.history["cost"].append(round(cost, 4))
        self.history["voltage"].append(round(self.voltage, 2))
        self.history["frequency"].append(round(self.frequency, 3))
        self.history["avg_soc"].append(round(avg_soc, 2))
        self.history["tariff"].append(tariff)
        for i, p in enumerate(actual_powers):
            self.history["station_power"][i].append(round(p, 2))

        # Handle departures / new arrivals
        for s in self.stations:
            if s.ev_present and self.step_idx >= s.departure_step:
                s.ev_present = False
                s.charging_rate = 0.0
            if not s.ev_present and random.random() < 0.03:
                s.reset(self.step_idx, self.total_steps)

        self.step_idx += 1
        state = self._get_state()
        state["grid_load_pct"] = load_pct
        done = self.step_idx >= self.total_steps
        return state, cost, done


# ─── Rule-Based Baseline ────────────────────────────────────────────────────

def baseline_equal(env):
    """Equal power allocation baseline."""
    env.reset()
    while True:
        present = sum(1 for s in env.stations if s.ev_present)
        if present > 0:
            per_ev = env.grid_capacity / present
            actions = [per_ev if s.ev_present else 0.0 for s in env.stations]
        else:
            actions = [0.0] * env.n_stations
        _, _, done = env.step(actions)
        if done:
            break
    return env.history


# ─── Simple DRL Agent (PPO-inspired actor) ──────────────────────────────────

class SimpleRLAgent:
    """Lightweight RL agent that learns a charging policy via policy gradient."""
    def __init__(self, n_stations, lr=0.02, gamma=0.99):
        self.n = n_stations
        self.lr = lr
        self.gamma = gamma
        # Simple weight matrix (features → per-station allocation ratio)
        self.W = np.random.randn(6, n_stations) * 0.1
        self.b = np.zeros(n_stations)
        self.log_probs = []
        self.rewards = []

    def _features(self, state):
        socs = [(s if s >= 0 else 50) / 100.0 for s in state["socs"]]
        avg_soc = np.mean(socs)
        tariff_norm = state["tariff"] / 0.4
        time_norm = state["step"] / 96.0
        v_dev = (state["voltage"] - 230) / 10.0
        f_dev = (state["frequency"] - 50) / 1.0
        load = state.get("grid_load_pct", 50) / 100.0
        return np.array([avg_soc, tariff_norm, time_norm, v_dev, f_dev, load])

    def act(self, state, grid_capacity):
        feat = self._features(state)
        logits = feat @ self.W + self.b
        # Softmax for allocation ratios
        exp_l = np.exp(logits - np.max(logits))
        probs = exp_l / (exp_l.sum() + 1e-9)
        # Mask absent EVs
        mask = np.array([1.0 if s >= 0 else 0.0 for s in state["socs"]])
        probs = probs * mask
        total = probs.sum()
        if total < 1e-9:
            actions = [0.0] * self.n
        else:
            probs /= total
            # Allocate proportionally
            actions = (probs * grid_capacity * 0.85).tolist()
        self.log_probs.append(np.log(probs.sum() / self.n + 1e-9))
        return actions

    def store_reward(self, r):
        self.rewards.append(r)

    def update(self):
        """REINFORCE update."""
        if len(self.rewards) == 0:
            return
        R = 0
        returns = []
        for r in reversed(self.rewards):
            R = r + self.gamma * R
            returns.insert(0, R)
        returns = np.array(returns)
        if returns.std() > 1e-6:
            returns = (returns - returns.mean()) / (returns.std() + 1e-9)
        for lp, G in zip(self.log_probs, returns):
            grad = -lp * G * self.lr
            self.W += np.random.randn(*self.W.shape) * grad * 0.01
            self.b += np.random.randn(*self.b.shape) * grad * 0.01
        self.log_probs = []
        self.rewards = []


def train_rl_agent(n_episodes=60, n_stations=5, total_steps=96):
    """Train a simple RL agent and return training curves + final episode history."""
    env = GridEnvironment(n_stations=n_stations, total_steps=total_steps)
    agent = SimpleRLAgent(n_stations)
    episode_costs = []
    episode_peaks = []

    for ep in range(n_episodes):
        state = env.reset()
        total_cost = 0.0
        while True:
            actions = agent.act(state, env.grid_capacity)
            state, cost, done = env.step(actions)
            reward = -cost - 0.1 * max(0, state.get("grid_load_pct", 0) - 80)
            # Voltage penalty
            if state["voltage"] < 216 or state["voltage"] > 244:
                reward -= 2.0
            if state["frequency"] < 49.5 or state["frequency"] > 50.5:
                reward -= 2.0
            agent.store_reward(reward)
            total_cost += cost
            if done:
                break
        agent.update()
        episode_costs.append(round(total_cost, 2))
        episode_peaks.append(max(env.history["total_power"]) if env.history["total_power"] else 0)

    rl_history = env.history

    # Run baseline for comparison
    env2 = GridEnvironment(n_stations=n_stations, total_steps=total_steps)
    baseline_history = baseline_equal(env2)

    return {
        "training_costs": episode_costs,
        "training_peaks": episode_peaks,
        "rl_history": {
            "total_power": rl_history["total_power"],
            "cost": rl_history["cost"],
            "voltage": rl_history["voltage"],
            "frequency": rl_history["frequency"],
            "avg_soc": rl_history["avg_soc"],
            "tariff": rl_history["tariff"],
            "station_power": rl_history["station_power"]
        },
        "baseline_history": {
            "total_power": baseline_history["total_power"],
            "cost": baseline_history["cost"],
            "voltage": baseline_history["voltage"],
            "frequency": baseline_history["frequency"],
            "avg_soc": baseline_history["avg_soc"],
            "tariff": baseline_history["tariff"],
            "station_power": baseline_history["station_power"]
        },
        "comparison": {
            "rl_total_cost": round(sum(rl_history["cost"]), 2),
            "baseline_total_cost": round(sum(baseline_history["cost"]), 2),
            "rl_peak": round(max(rl_history["total_power"]) if rl_history["total_power"] else 0, 2),
            "baseline_peak": round(max(baseline_history["total_power"]) if baseline_history["total_power"] else 0, 2),
            "rl_voltage_violations": sum(1 for v in rl_history["voltage"] if v < 216 or v > 244),
            "baseline_voltage_violations": sum(1 for v in baseline_history["voltage"] if v < 216 or v > 244),
            "rl_final_avg_soc": round(rl_history["avg_soc"][-1], 1) if rl_history["avg_soc"] else 0,
            "baseline_final_avg_soc": round(baseline_history["avg_soc"][-1], 1) if baseline_history["avg_soc"] else 0,
        }
    }
