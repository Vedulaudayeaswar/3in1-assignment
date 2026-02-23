"""
Lab 3: Healthcare – EEG-Guided Parkinson's Therapy Tuning
Backend simulation with PPO-inspired RL agent.
"""
import numpy as np
import random
import math

# ─── Patient Simulator ──────────────────────────────────────────────────────

class ParkinsonPatient:
    """Simulated Parkinson's disease patient with EEG biomarkers."""
    def __init__(self):
        self.tremor = 0.0           # 0-10 scale
        self.bradykinesia = 0.0     # 0-10 scale
        self.rigidity = 0.0         # 0-10 scale
        self.side_effects = 0.0     # 0-10 scale (dyskinesia, nausea etc)
        # EEG features
        self.theta_power = 0.0      # μV²
        self.beta_power = 0.0       # μV²
        self.theta_beta_ratio = 0.0
        # Treatment state
        self.drug_dose = 0.0        # mg (0 - 10)
        self.dbs_amplitude = 0.0    # mA (0 - 5)
        self.dbs_frequency = 130.0  # Hz (100-185)
        # Internal dynamics
        self._drug_effect = 0.0
        self._dbs_effect = 0.0
        self._time = 0

    def reset(self):
        self.tremor = random.uniform(5, 9)
        self.bradykinesia = random.uniform(4, 8)
        self.rigidity = random.uniform(3, 7)
        self.side_effects = 0.0
        self.theta_power = random.uniform(15, 30)
        self.beta_power = random.uniform(5, 15)
        self.theta_beta_ratio = self.theta_power / (self.beta_power + 1e-9)
        self.drug_dose = 2.0
        self.dbs_amplitude = 1.0
        self.dbs_frequency = 130.0
        self._drug_effect = 0.0
        self._dbs_effect = 0.0
        self._time = 0
        return self._get_obs()

    def _get_obs(self):
        return {
            "tremor": round(self.tremor, 2),
            "bradykinesia": round(self.bradykinesia, 2),
            "rigidity": round(self.rigidity, 2),
            "side_effects": round(self.side_effects, 2),
            "theta_power": round(self.theta_power, 2),
            "beta_power": round(self.beta_power, 2),
            "theta_beta_ratio": round(self.theta_beta_ratio, 3),
            "drug_dose": round(self.drug_dose, 2),
            "dbs_amplitude": round(self.dbs_amplitude, 2),
            "dbs_frequency": round(self.dbs_frequency, 1),
            "time_step": self._time,
            "symptom_score": round(self.tremor + self.bradykinesia + self.rigidity, 2)
        }

    def step(self, dose_change, dbs_amp_change, dbs_freq_change):
        """Apply therapy adjustment and simulate patient response."""
        # Safety constraints
        self.drug_dose = np.clip(self.drug_dose + dose_change, 0, 10)
        self.dbs_amplitude = np.clip(self.dbs_amplitude + dbs_amp_change, 0, 5)
        self.dbs_frequency = np.clip(self.dbs_frequency + dbs_freq_change, 100, 185)

        # Pharmacokinetic delay (drug takes ~2 steps to peak)
        target_drug_effect = self.drug_dose * 0.4
        self._drug_effect += 0.3 * (target_drug_effect - self._drug_effect)

        # DBS effect (more immediate)
        self._dbs_effect = self.dbs_amplitude * 0.6 * (self.dbs_frequency / 130.0)

        # Symptom response
        total_effect = self._drug_effect + self._dbs_effect
        noise = random.gauss(0, 0.3)

        self.tremor = np.clip(
            self.tremor - 0.15 * total_effect + 0.05 * random.gauss(0, 1) + noise * 0.1,
            0, 10
        )
        self.bradykinesia = np.clip(
            self.bradykinesia - 0.12 * total_effect + 0.04 * random.gauss(0, 1),
            0, 10
        )
        self.rigidity = np.clip(
            self.rigidity - 0.10 * total_effect + 0.03 * random.gauss(0, 1),
            0, 10
        )

        # Side effects increase with high doses
        self.side_effects = np.clip(
            0.2 * (self.drug_dose ** 1.5) / 10 + 0.15 * (self.dbs_amplitude ** 1.3) / 5 + random.gauss(0, 0.2),
            0, 10
        )

        # EEG biomarker response
        self.beta_power = np.clip(
            self.beta_power + 0.8 * self._dbs_effect - 0.3 * self.tremor + random.gauss(0, 1),
            1, 40
        )
        self.theta_power = np.clip(
            self.theta_power - 0.3 * total_effect + 0.2 * self.bradykinesia + random.gauss(0, 0.8),
            1, 50
        )
        self.theta_beta_ratio = self.theta_power / (self.beta_power + 1e-9)

        self._time += 1
        return self._get_obs()


class TherapyEnvironment:
    """RL environment for therapy tuning."""
    def __init__(self, total_steps=72):  # 72 steps = 24h at 20-min intervals
        self.total_steps = total_steps
        self.patient = ParkinsonPatient()
        self.step_idx = 0
        self.history = {
            "tremor": [], "bradykinesia": [], "rigidity": [], "side_effects": [],
            "symptom_score": [], "theta_power": [], "beta_power": [],
            "theta_beta_ratio": [], "drug_dose": [], "dbs_amplitude": [],
            "dbs_frequency": [], "reward": []
        }

    def reset(self):
        self.step_idx = 0
        obs = self.patient.reset()
        self.history = {k: [] for k in self.history}
        return obs

    def step(self, actions):
        """actions: [dose_change, dbs_amp_change, dbs_freq_change]"""
        obs = self.patient.step(*actions)

        # Reward: minimize symptoms, minimize side effects, respect safety
        symptom_score = obs["tremor"] + obs["bradykinesia"] + obs["rigidity"]
        reward = -symptom_score * 0.3 - obs["side_effects"] * 0.5

        # Safety penalties
        if obs["drug_dose"] > 8:
            reward -= 3.0
        if obs["dbs_amplitude"] > 4:
            reward -= 2.0
        if obs["side_effects"] > 5:
            reward -= 3.0

        # Bonus for good control
        if symptom_score < 8:
            reward += 2.0
        if obs["side_effects"] < 2:
            reward += 1.0

        for key in self.history:
            if key == "reward":
                self.history["reward"].append(round(reward, 3))
            elif key == "symptom_score":
                self.history["symptom_score"].append(round(symptom_score, 2))
            else:
                self.history[key].append(obs.get(key, 0))

        self.step_idx += 1
        done = self.step_idx >= self.total_steps
        return obs, reward, done


# ─── Rule-Based Baseline ────────────────────────────────────────────────────

def baseline_fixed(env):
    """Fixed dosage baseline."""
    env.reset()
    while True:
        _, _, done = env.step([0.0, 0.0, 0.0])  # No adjustments
        if done:
            break
    return env.history


# ─── RL Agent ────────────────────────────────────────────────────────────────

class TherapyRLAgent:
    """PPO-inspired agent for therapy tuning."""
    def __init__(self, lr=0.015, gamma=0.97):
        self.lr = lr
        self.gamma = gamma
        # Weight matrices for 3 continuous actions
        self.W = np.random.randn(8, 3) * 0.05
        self.b = np.zeros(3)
        self.std = np.array([0.5, 0.3, 5.0])  # exploration noise
        self.log_probs = []
        self.rewards = []

    def _features(self, obs):
        return np.array([
            obs["tremor"] / 10.0,
            obs["bradykinesia"] / 10.0,
            obs["rigidity"] / 10.0,
            obs["side_effects"] / 10.0,
            obs["theta_beta_ratio"] / 5.0,
            obs["drug_dose"] / 10.0,
            obs["dbs_amplitude"] / 5.0,
            obs["time_step"] / 72.0
        ])

    def act(self, obs):
        feat = self._features(obs)
        mean = feat @ self.W + self.b
        # Sample actions with exploration
        noise = np.random.randn(3) * self.std
        actions = mean + noise
        # Clip to safe ranges
        actions[0] = np.clip(actions[0], -1.0, 1.0)   # dose change
        actions[1] = np.clip(actions[1], -0.5, 0.5)    # DBS amp change
        actions[2] = np.clip(actions[2], -10.0, 10.0)   # DBS freq change

        log_prob = -0.5 * np.sum(((actions - mean) / (self.std + 1e-9)) ** 2)
        self.log_probs.append(log_prob)
        return actions.tolist()

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
        returns = np.array(returns)
        if returns.std() > 1e-6:
            returns = (returns - returns.mean()) / (returns.std() + 1e-9)

        for lp, G in zip(self.log_probs, returns):
            grad = -lp * G * self.lr
            self.W += np.random.randn(*self.W.shape) * grad * 0.005
            self.b += np.random.randn(*self.b.shape) * grad * 0.005

        # Decay exploration
        self.std *= 0.995
        self.log_probs = []
        self.rewards = []


def train_therapy_agent(n_episodes=60, total_steps=72):
    """Train therapy RL agent and return results."""
    env = TherapyEnvironment(total_steps=total_steps)
    agent = TherapyRLAgent()
    episode_rewards = []
    episode_symptoms = []
    episode_side_effects = []

    for ep in range(n_episodes):
        obs = env.reset()
        total_reward = 0
        while True:
            actions = agent.act(obs)
            obs, reward, done = env.step(actions)
            agent.store_reward(reward)
            total_reward += reward
            if done:
                break
        agent.update()
        episode_rewards.append(round(total_reward, 2))
        final_symptom = env.history["symptom_score"][-1] if env.history["symptom_score"] else 0
        final_se = env.history["side_effects"][-1] if env.history["side_effects"] else 0
        episode_symptoms.append(round(final_symptom, 2))
        episode_side_effects.append(round(final_se, 2))

    rl_history = {k: v[:] for k, v in env.history.items()}

    # Baseline
    env2 = TherapyEnvironment(total_steps=total_steps)
    baseline_hist = baseline_fixed(env2)

    return {
        "training_rewards": episode_rewards,
        "training_symptoms": episode_symptoms,
        "training_side_effects": episode_side_effects,
        "rl_history": rl_history,
        "baseline_history": baseline_hist,
        "comparison": {
            "rl_final_symptom": round(rl_history["symptom_score"][-1], 2) if rl_history["symptom_score"] else 0,
            "baseline_final_symptom": round(baseline_hist["symptom_score"][-1], 2) if baseline_hist["symptom_score"] else 0,
            "rl_avg_side_effects": round(np.mean(rl_history["side_effects"]), 2) if rl_history["side_effects"] else 0,
            "baseline_avg_side_effects": round(np.mean(baseline_hist["side_effects"]), 2) if baseline_hist["side_effects"] else 0,
            "rl_avg_symptom": round(np.mean(rl_history["symptom_score"]), 2) if rl_history["symptom_score"] else 0,
            "baseline_avg_symptom": round(np.mean(baseline_hist["symptom_score"]), 2) if baseline_hist["symptom_score"] else 0,
            "rl_final_dose": round(rl_history["drug_dose"][-1], 2) if rl_history["drug_dose"] else 0,
            "baseline_final_dose": round(baseline_hist["drug_dose"][-1], 2) if baseline_hist["drug_dose"] else 0,
            "rl_final_dbs": round(rl_history["dbs_amplitude"][-1], 2) if rl_history["dbs_amplitude"] else 0,
            "baseline_final_dbs": round(baseline_hist["dbs_amplitude"][-1], 2) if baseline_hist["dbs_amplitude"] else 0,
        }
    }
