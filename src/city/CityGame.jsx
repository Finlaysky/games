import { useEffect, useRef, useState } from 'react';
import { createGame, update } from './sim.js';
import { draw, drawMinimap } from './draw.js';
import './city.css';

function snapshot(g) {
  if (!g) {
    return {
      money: 0,
      hp: 100,
      ammo: 0,
      wanted: 0,
      jobTitle: 'FREE ROAM',
      objective: '',
      vehicle: '',
      speed: 0,
      message: '',
      status: 'play',
      done: 0,
    };
  }
  const job = g.job;
  const step = job ? job.def.steps[job.step] : null;
  let objective = step ? step.label : 'Free roam — do whatever you want';
  if (step && step.kind === 'hold') {
    objective = `${step.label} (${Math.max(0, Math.ceil(step.seconds - job.timer))}s)`;
  }
  return {
    money: g.money,
    hp: Math.max(0, Math.round((g.player.hp / g.player.maxHp) * 100)),
    ammo: g.player.ammo,
    wanted: g.wanted,
    jobTitle: job ? job.def.title : 'FREE ROAM',
    objective,
    vehicle: g.player.car ? g.player.car.name : '',
    speed: g.player.car ? Math.round(Math.abs(g.player.car.speed) * 0.22) : 0,
    message: g.messageT > 0 ? g.message : '',
    status: g.status,
    done: g.jobDone,
  };
}

const CONTROLS = [
  ['W A S D', 'Walk / drive / steer'],
  ['Shift', 'Sprint / handbrake'],
  ['E', 'Steal or exit a car'],
  ['Click or Space', 'Shoot'],
  ['Esc', 'Pause'],
];

export default function CityGame({ onExit }) {
  const canvasRef = useRef(null);
  const miniRef = useRef(null);
  const gameRef = useRef(null);
  const inputRef = useRef({});
  const [hud, setHud] = useState(() => snapshot(null));
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!gameRef.current) gameRef.current = createGame();

    let dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let last = performance.now();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const g = gameRef.current;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.06) dt = 0.06;
      if (!g) return;
      if (!g.paused) update(g, dt, inputRef.current);
      draw(ctx, g, window.innerWidth, window.innerHeight, dpr);
      const mini = miniRef.current;
      if (mini) drawMinimap(mini.getContext('2d'), g, 176);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const g = gameRef.current;
      if (g) setHud(snapshot(g));
    }, 110);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const g = gameRef.current;
    if (g) g.paused = !started || paused;
  }, [started, paused]);

  useEffect(() => {
    const keyMap = {
      KeyW: 'up',
      ArrowUp: 'up',
      KeyS: 'down',
      ArrowDown: 'down',
      KeyA: 'left',
      ArrowLeft: 'left',
      KeyD: 'right',
      ArrowRight: 'right',
      ShiftLeft: 'sprint',
      ShiftRight: 'sprint',
      Space: 'fire',
      KeyE: 'enter',
      KeyF: 'enter',
    };

    const onKeyDown = (e) => {
      const action = keyMap[e.code];
      if (action) {
        inputRef.current[action] = true;
        e.preventDefault();
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    const onKeyUp = (e) => {
      const action = keyMap[e.code];
      if (action) {
        inputRef.current[action] = false;
        e.preventDefault();
      }
    };
    const onBlur = () => {
      inputRef.current = {};
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    const aimAt = (clientX, clientY) => {
      const g = gameRef.current;
      if (!g) return;
      const rect = canvas.getBoundingClientRect();
      const zoom = g.camera.zoom || 1;
      g.aim.x = g.camera.x + (clientX - rect.left - rect.width / 2) / zoom;
      g.aim.y = g.camera.y + (clientY - rect.top - rect.height / 2) / zoom;
    };
    const onMove = (e) => aimAt(e.clientX, e.clientY);
    const onDown = (e) => {
      if (e.button !== 0) return;
      aimAt(e.clientX, e.clientY);
      inputRef.current.fire = true;
    };
    const onUp = () => {
      inputRef.current.fire = false;
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const stars = Array.from({ length: 5 }, (_, i) => i < hud.wanted);

  return (
    <div className="sc-wrap">
      <canvas ref={canvasRef} className="sc-canvas" />

      <div className="sc-hud">
        <div className="sc-top-left">
          <div className="sc-money">${hud.money.toLocaleString()}</div>
          <div className="sc-job">{hud.jobTitle}</div>
          <div className="sc-objective">{hud.objective}</div>
        </div>

        <div className="sc-top-right">
          <div className="sc-stars" aria-label={`${hud.wanted} of 5 wanted stars`}>
            {stars.map((on, i) => (
              <span key={i} className={on ? 'on' : ''}>
                ★
              </span>
            ))}
          </div>
          <div className="sc-ammo">AMMO {hud.ammo}</div>
        </div>

        <div className="sc-bottom-left">
          <div className="sc-hp">
            <i style={{ width: `${hud.hp}%` }} />
          </div>
          <div className="sc-hint">
            {hud.vehicle ? `${hud.vehicle.toUpperCase()} · ${hud.speed} MPH` : 'ON FOOT'}
          </div>
        </div>

        <div className="sc-mini">
          <canvas ref={miniRef} width={176} height={176} />
        </div>

        {hud.message ? <div className="sc-message">{hud.message}</div> : null}
        {hud.status !== 'play' ? (
          <div className={`sc-big ${hud.status}`}>
            {hud.status === 'wasted' ? 'WASTED' : 'BUSTED'}
          </div>
        ) : null}
      </div>

      <button type="button" className="sc-exit" onClick={onExit}>
        ◀ ARCADE
      </button>

      {!started ? (
        <div className="sc-overlay">
          <div className="sc-panel">
            <p className="sc-kicker">Open world · Action</p>
            <h1 className="sc-title">
              SUNSET<span>CITY</span>
            </h1>
            <p className="sc-blurb">
              A living city with traffic, pedestrians and a police force that remembers you. Boost a
              car, run three jobs, then see how long you last at five stars.
            </p>
            <ul className="sc-controls">
              {CONTROLS.map(([key, what]) => (
                <li key={key}>
                  <b>{key}</b>
                  <span>{what}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="sc-play"
              onClick={() => {
                setStarted(true);
                setPaused(false);
              }}
            >
              START GAME
            </button>
          </div>
        </div>
      ) : null}

      {started && paused ? (
        <div className="sc-overlay">
          <div className="sc-panel small">
            <h2 className="sc-paused">PAUSED</h2>
            <p className="sc-blurb">
              Job: {hud.jobTitle} — {hud.objective}
            </p>
            <div className="sc-row">
              <button type="button" className="sc-play" onClick={() => setPaused(false)}>
                RESUME
              </button>
              <button type="button" className="sc-ghost" onClick={onExit}>
                QUIT TO ARCADE
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
