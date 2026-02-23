"""
3-in-1 Deep RL Labs – Flask Application
Lab 1: Smart Grids EV Charging
Lab 2: Multi-Agent Traffic Signal & Delivery
Lab 3: EEG-Guided Parkinson's Therapy
"""
import os
import sqlite3
import hashlib
import secrets
from functools import wraps
from flask import (Flask, render_template, request, redirect,
                   url_for, session, jsonify, flash, g)

from lab1_backend import train_rl_agent
from lab2_backend import train_traffic_agents
from lab3_backend import train_therapy_agent

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
DATABASE = os.path.join(os.path.dirname(__file__), 'users.db')

# ─── Database helpers ────────────────────────────────────────────────────────

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DATABASE)
    db.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    db.commit()
    db.close()


def hash_password(password):
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return salt + ':' + hashed


def verify_password(stored, provided):
    salt, hashed = stored.split(':')
    return hashlib.sha256((salt + provided).encode()).hexdigest() == hashed


# ─── Auth decorator ──────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        db = get_db()
        user = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        if user and verify_password(user['password'], password):
            session['user_id'] = user['id']
            session['user_name'] = user['fullname']
            session['user_email'] = user['email']
            return redirect(url_for('dashboard'))
        flash('Invalid email or password', 'error')
    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        fullname = request.form.get('fullname', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')

        if not fullname or not email or not password:
            flash('All fields are required', 'error')
        elif password != confirm:
            flash('Passwords do not match', 'error')
        elif len(password) < 6:
            flash('Password must be at least 6 characters', 'error')
        else:
            db = get_db()
            try:
                db.execute('INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)',
                           (fullname, email, hash_password(password)))
                db.commit()
                flash('Registration successful! Please log in.', 'success')
                return redirect(url_for('login'))
            except sqlite3.IntegrityError:
                flash('Email already registered', 'error')
    return render_template('register.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', user_name=session.get('user_name', 'User'))


# ─── Lab Pages ───────────────────────────────────────────────────────────────

@app.route('/lab1')
@login_required
def lab1():
    return render_template('lab1.html')


@app.route('/lab2')
@login_required
def lab2():
    return render_template('lab2.html')


@app.route('/lab3')
@login_required
def lab3():
    return render_template('lab3.html')


# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.route('/api/lab1/run', methods=['POST'])
@login_required
def api_lab1_run():
    try:
        data = request.get_json() or {}
        episodes = min(int(data.get('episodes', 60)), 120)
        stations = min(int(data.get('stations', 5)), 8)
        result = train_rl_agent(n_episodes=episodes, n_stations=stations)
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/lab2/run', methods=['POST'])
@login_required
def api_lab2_run():
    try:
        data = request.get_json() or {}
        episodes = min(int(data.get('episodes', 50)), 100)
        grid = min(int(data.get('grid_size', 3)), 5)
        vehicles = min(int(data.get('vehicles', 8)), 20)
        result = train_traffic_agents(n_episodes=episodes, grid_size=grid,
                                      n_vehicles=vehicles)
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/lab3/run', methods=['POST'])
@login_required
def api_lab3_run():
    try:
        data = request.get_json() or {}
        episodes = min(int(data.get('episodes', 60)), 120)
        result = train_therapy_agent(n_episodes=episodes)
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ─── Boot ────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
