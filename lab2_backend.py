"""
Lab 2: Logistics – Multi-Agent Traffic Signal & Delivery Optimization
Backend simulation with MAPPO-inspired multi-agent RL.
"""
import numpy as np
import random
import math
from collections import defaultdict

# ─── Grid-World Traffic Simulation ──────────────────────────────────────────

class Intersection:
    """Single intersection agent controlling traffic signals."""
    def __init__(self, iid, x, y):
        self.id = iid
        self.x = x
        self.y = y
        self.phase = 0               # 0=NS green, 1=EW green
        self.phase_timer = 0
        self.queue_ns = 0            # vehicles waiting north-south
        self.queue_ew = 0            # vehicles waiting east-west
        self.throughput = 0
        self.total_wait = 0
        self.switch_count = 0

    def set_phase(self, action):
        """action: 0=keep, 1=switch."""
        if action == 1 and self.phase_timer >= 3:
            self.phase = 1 - self.phase
            self.phase_timer = 0
            self.switch_count += 1
        self.phase_timer += 1

    def simulate_step(self):
        """Simulate vehicle flow for one time step."""
        # New arrivals
        self.queue_ns += random.randint(0, 4)
        self.queue_ew += random.randint(0, 4)

        served = 0
        if self.phase == 0:  # NS green
            serve_ns = min(self.queue_ns, random.randint(2, 5))
            self.queue_ns -= serve_ns
            served += serve_ns
            self.total_wait += self.queue_ew
        else:                # EW green
            serve_ew = min(self.queue_ew, random.randint(2, 5))
            self.queue_ew -= serve_ew
            served += serve_ew
            self.total_wait += self.queue_ns

        self.throughput += served
        return served


class DeliveryVehicle:
    """Delivery vehicle with route and time-window constraints."""
    def __init__(self, vid, route, deadline):
        self.id = vid
        self.route = route              # list of intersection ids
        self.route_idx = 0
        self.deadline = deadline         # step by which delivery must complete
        self.completed = False
        self.arrival_step = -1
        self.steps_taken = 0
        self.delayed = False

    def move(self, step):
        if self.completed:
            return
        self.steps_taken += 1
        # Probabilistic movement (can be slowed by congestion)
        if random.random() < 0.7:
            self.route_idx += 1
        if self.route_idx >= len(self.route):
            self.completed = True
            self.arrival_step = step
            self.delayed = step > self.deadline


class TrafficEnvironment:
    """Grid-world traffic network with intersections and delivery vehicles."""
    def __init__(self, grid_size=3, n_vehicles=8, total_steps=100):
        self.grid_size = grid_size
        self.n_intersections = grid_size * grid_size
        self.total_steps = total_steps
        self.n_vehicles = n_vehicles
        self.intersections = []
        self.vehicles = []
        self.step_idx = 0
        self.history = {
            "avg_queue": [], "throughput": [], "deliveries_completed": [],
            "on_time_pct": [], "phase_map": [], "queue_map": []
        }

    def reset(self):
        self.step_idx = 0
        self.intersections = []
        for i in range(self.grid_size):
            for j in range(self.grid_size):
                self.intersections.append(Intersection(i * self.grid_size + j, j, i))

        self.vehicles = []
        for v in range(self.n_vehicles):
            route_len = random.randint(3, self.n_intersections)
            route = random.sample(range(self.n_intersections), min(route_len, self.n_intersections))
            deadline = random.randint(self.total_steps // 2, self.total_steps)
            self.vehicles.append(DeliveryVehicle(v, route, deadline))

        self.history = {
            "avg_queue": [], "throughput": [], "deliveries_completed": [],
            "on_time_pct": [], "phase_map": [], "queue_map": []
        }
        return self._get_state()

    def _get_state(self):
        queues_ns = [ix.queue_ns for ix in self.intersections]
        queues_ew = [ix.queue_ew for ix in self.intersections]
        phases = [ix.phase for ix in self.intersections]
        completed = sum(1 for v in self.vehicles if v.completed)
        on_time = sum(1 for v in self.vehicles if v.completed and not v.delayed)
        return {
            "step": self.step_idx,
            "queues_ns": queues_ns,
            "queues_ew": queues_ew,
            "phases": phases,
            "vehicles_completed": completed,
            "on_time": on_time,
            "total_vehicles": self.n_vehicles
        }

    def step(self, actions):
        """actions: list of 0/1 per intersection (keep/switch)."""
        for ix, a in zip(self.intersections, actions):
            ix.set_phase(a)

        total_throughput = 0
        for ix in self.intersections:
            total_throughput += ix.simulate_step()

        for v in self.vehicles:
            v.move(self.step_idx)

        avg_q = np.mean([ix.queue_ns + ix.queue_ew for ix in self.intersections])
        completed = sum(1 for v in self.vehicles if v.completed)
        on_time = sum(1 for v in self.vehicles if v.completed and not v.delayed)
        on_time_pct = (on_time / max(completed, 1)) * 100

        self.history["avg_queue"].append(round(avg_q, 2))
        self.history["throughput"].append(total_throughput)
        self.history["deliveries_completed"].append(completed)
        self.history["on_time_pct"].append(round(on_time_pct, 1))
        self.history["phase_map"].append([ix.phase for ix in self.intersections])
        self.history["queue_map"].append([ix.queue_ns + ix.queue_ew for ix in self.intersections])

        self.step_idx += 1
        state = self._get_state()
        done = self.step_idx >= self.total_steps
        reward = total_throughput - 0.5 * avg_q + 2.0 * (on_time_pct / 100.0)
        return state, reward, done


# ─── Static Timing Baseline ─────────────────────────────────────────────────

def baseline_static(env):
    """Fixed-cycle signal timing baseline (switch every 5 steps)."""
    env.reset()
    while True:
        actions = [1 if env.step_idx % 5 == 0 else 0 for _ in range(env.n_intersections)]
        _, _, done = env.step(actions)
        if done:
            break
    return env.history


# ─── Multi-Agent RL (MAPPO-inspired) ────────────────────────────────────────

class MAPPOAgent:
    """Simple multi-agent policy gradient agent for traffic signals."""
    def __init__(self, n_agents, lr=0.03, gamma=0.95):
        self.n = n_agents
        self.lr = lr
        self.gamma = gamma
        self.weights = [np.random.randn(4) * 0.1 for _ in range(n_agents)]
        self.biases = [0.0] * n_agents
        self.log_probs = [[] for _ in range(n_agents)]
        self.rewards = []

    def _features(self, state, idx):
        qns = state["queues_ns"][idx] / 20.0
        qew = state["queues_ew"][idx] / 20.0
        phase = float(state["phases"][idx])
        time_norm = state["step"] / 100.0
        return np.array([qns, qew, phase, time_norm])

    def act(self, state):
        actions = []
        for i in range(self.n):
            feat = self._features(state, i)
            logit = feat @ self.weights[i] + self.biases[i]
            prob_switch = 1.0 / (1.0 + math.exp(-logit))
            action = 1 if random.random() < prob_switch else 0
            self.log_probs[i].append(math.log(prob_switch if action == 1 else 1 - prob_switch + 1e-9))
            actions.append(action)
        return actions

    def store_reward(self, r):
        self.rewards.append(r)

    def update(self):
        if len(self.rewards) == 0:
            return
        R = 0
        returns = []
        for r in reversed(self.rewards):
            R = r + self.gamma * R
            returns.insert(0, R)
        returns = np.array(returns, dtype=np.float64)
        if returns.std() > 1e-6:
            returns = (returns - returns.mean()) / (returns.std() + 1e-9)

        for i in range(self.n):
            for t, (lp, G) in enumerate(zip(self.log_probs[i], returns)):
                grad = -lp * G * self.lr
                self.weights[i] += np.random.randn(4) * grad * 0.01
                self.biases[i] += random.gauss(0, 1) * grad * 0.01
        self.log_probs = [[] for _ in range(self.n)]
        self.rewards = []


def train_traffic_agents(n_episodes=50, grid_size=3, n_vehicles=8, total_steps=100):
    """Train multi-agent traffic RL and return results."""
    env = TrafficEnvironment(grid_size=grid_size, n_vehicles=n_vehicles, total_steps=total_steps)
    agent = MAPPOAgent(env.n_intersections)
    episode_rewards = []
    episode_throughputs = []
    episode_queues = []

    for ep in range(n_episodes):
        state = env.reset()
        total_reward = 0
        while True:
            actions = agent.act(state)
            state, reward, done = env.step(actions)
            agent.store_reward(reward)
            total_reward += reward
            if done:
                break
        agent.update()
        episode_rewards.append(round(total_reward, 2))
        episode_throughputs.append(sum(env.history["throughput"]))
        episode_queues.append(round(np.mean(env.history["avg_queue"]), 2))

    rl_history = env.history

    # Baseline comparison
    env2 = TrafficEnvironment(grid_size=grid_size, n_vehicles=n_vehicles, total_steps=total_steps)
    baseline_hist = baseline_static(env2)

    return {
        "training_rewards": episode_rewards,
        "training_throughputs": episode_throughputs,
        "training_queues": episode_queues,
        "grid_size": grid_size,
        "rl_history": {
            "avg_queue": rl_history["avg_queue"],
            "throughput": rl_history["throughput"],
            "deliveries_completed": rl_history["deliveries_completed"],
            "on_time_pct": rl_history["on_time_pct"],
            "phase_map": rl_history["phase_map"][-1] if rl_history["phase_map"] else [],
            "queue_map": rl_history["queue_map"][-1] if rl_history["queue_map"] else []
        },
        "baseline_history": {
            "avg_queue": baseline_hist["avg_queue"],
            "throughput": baseline_hist["throughput"],
            "deliveries_completed": baseline_hist["deliveries_completed"],
            "on_time_pct": baseline_hist["on_time_pct"],
        },
        "comparison": {
            "rl_avg_queue": round(np.mean(rl_history["avg_queue"]), 2),
            "baseline_avg_queue": round(np.mean(baseline_hist["avg_queue"]), 2),
            "rl_total_throughput": sum(rl_history["throughput"]),
            "baseline_total_throughput": sum(baseline_hist["throughput"]),
            "rl_on_time_pct": round(rl_history["on_time_pct"][-1], 1) if rl_history["on_time_pct"] else 0,
            "baseline_on_time_pct": round(baseline_hist["on_time_pct"][-1], 1) if baseline_hist["on_time_pct"] else 0,
            "rl_deliveries": rl_history["deliveries_completed"][-1] if rl_history["deliveries_completed"] else 0,
            "baseline_deliveries": baseline_hist["deliveries_completed"][-1] if baseline_hist["deliveries_completed"] else 0,
        }
    }
