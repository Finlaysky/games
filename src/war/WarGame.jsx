import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MISSIONS } from '../game/missions.js';
import {
  createBattle,
  moveUnit,
  performAttack,
  recruit,
  endTurn,
  aiStep,
  reachableTiles,
  attackTargets,
} from '../game/engine.js';
import MissionSelect from '../ui/MissionSelect.jsx';
import Battlefield from '../ui/Battlefield.jsx';
import Sidebar from '../ui/Sidebar.jsx';
import ResultModal from '../ui/ResultModal.jsx';
import { sfx } from '../sfx.js';

const STORAGE_KEY = 'ironfront.progress.v1';

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.unlocked) && Array.isArray(parsed.cleared)) {
        return {
          unlocked: parsed.unlocked.filter((id) => MISSIONS.some((m) => m.id === id)),
          cleared: parsed.cleared.filter((id) => MISSIONS.some((m) => m.id === id)),
        };
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { unlocked: [MISSIONS[0].id], cleared: [] };
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* storage may be unavailable */
  }
}

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [battle, setBattle] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [progress, setProgress] = useState(loadProgress);
  const [floaters, setFloaters] = useState([]);
  const [notice, setNotice] = useState('');
  const [muted, setMuted] = useState(false);

  const aiSteps = useRef(0);
  const lastLogId = useRef(0);
  const savedResult = useRef(null);

  useEffect(() => {
    sfx.setMuted(muted);
  }, [muted]);

  const startMission = useCallback((missionId) => {
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const next = createBattle(missionId, seed);
    lastLogId.current = next.log[next.log.length - 1]?.id ?? 0;
    aiSteps.current = 0;
    savedResult.current = null;
    setBattle(next);
    setSelectedId(null);
    setFloaters([]);
    setNotice('');
    setScreen('battle');
    sfx.start();
  }, []);

  const toMenu = useCallback(() => {
    setScreen('menu');
    setBattle(null);
    setSelectedId(null);
    setFloaters([]);
  }, []);

  const resetProgress = useCallback(() => {
    const fresh = { unlocked: [MISSIONS[0].id], cleared: [] };
    setProgress(fresh);
    saveProgress(fresh);
    setNotice('');
  }, []);

  /* ------------------------------------------------------------ derived UI */

  const selected = battle?.units.find((u) => u.id === selectedId) ?? null;
  const playerTurn = battle?.status === 'playing' && battle?.side === 'player';

  const reachKeys = useMemo(() => {
    if (!battle || !selected || !playerTurn || selected.side !== 'player' || selected.moved) {
      return null;
    }
    const reach = reachableTiles(battle, selected);
    const set = new Set();
    for (const key of reach.keys()) {
      set.add(`${key % battle.w},${Math.floor(key / battle.w)}`);
    }
    return set;
  }, [battle, selected, playerTurn]);

  const targetIds = useMemo(() => {
    if (!battle || !selected || !playerTurn || selected.side !== 'player') return null;
    return new Set(attackTargets(battle, selected).map((u) => u.id));
  }, [battle, selected, playerTurn]);

  /* --------------------------------------------------------- log -> effects */

  useEffect(() => {
    if (!battle) return;
    const fresh = battle.log.filter((e) => e.id > lastLogId.current);
    const newest = battle.log[battle.log.length - 1];
    if (newest) lastLogId.current = newest.id;
    if (!fresh.length) return;

    const fresh_floaters = fresh
      .filter((e) => e.amount && e.at)
      .map((e) => ({
        id: `${e.id}`,
        amount: e.amount,
        at: e.at,
        side: e.side === 'player' ? 'player' : 'enemy',
      }));

    if (fresh_floaters.length) {
      setFloaters((prev) => [...prev, ...fresh_floaters]);
      const ids = new Set(fresh_floaters.map((f) => f.id));
      window.setTimeout(() => {
        setFloaters((prev) => prev.filter((f) => !ids.has(f.id)));
      }, 1200);
    }

    if (fresh.some((e) => e.kind === 'destroy')) sfx.boom();
    else if (fresh.some((e) => e.kind === 'attack')) sfx.shot();
    else if (fresh.some((e) => e.kind === 'recruit')) sfx.build();
  }, [battle]);

  /* ------------------------------------------------------------- AI driver */

  useEffect(() => {
    if (!battle || battle.status !== 'playing' || battle.side !== 'enemy') {
      aiSteps.current = 0;
      return undefined;
    }
    const timer = window.setTimeout(() => {
      aiSteps.current += 1;
      if (aiSteps.current > 90) {
        setBattle((prev) => (prev && prev.side === 'enemy' ? endTurn(prev) : prev));
        return;
      }
      setBattle((prev) => {
        if (!prev || prev.side !== 'enemy' || prev.status !== 'playing') return prev;
        return aiStep(prev).state;
      });
    }, 360);
    return () => window.clearTimeout(timer);
  }, [battle]);

  /* ------------------------------------------------- campaign progression */

  useEffect(() => {
    if (!battle || battle.status === 'playing') return;
    if (savedResult.current === `${battle.missionId}:${battle.status}`) return;
    savedResult.current = `${battle.missionId}:${battle.status}`;

    if (battle.status === 'won') {
      sfx.win();
      setProgress((prev) => {
        const index = MISSIONS.findIndex((m) => m.id === battle.missionId);
        const nextId = MISSIONS[index + 1]?.id;
        const unlocked = [...new Set([...prev.unlocked, nextId].filter(Boolean))];
        const cleared = [...new Set([...prev.cleared, battle.missionId])];
        const next = { unlocked, cleared };
        saveProgress(next);
        return next;
      });
    } else {
      sfx.lose();
    }
  }, [battle]);

  /* --------------------------------------------------------------- actions */

  const handleUnit = useCallback(
    (unit) => {
      if (!battle || battle.status !== 'playing' || battle.side !== 'player') return;
      if (unit.side === 'player') {
        setSelectedId((prev) => (prev === unit.id ? null : unit.id));
        sfx.select();
        return;
      }
      if (selected && targetIds?.has(unit.id)) {
        const res = performAttack(battle, selected.id, unit.id);
        setBattle(res.state);
        setSelectedId(null);
      }
    },
    [battle, selected, targetIds]
  );

  const handleTile = useCallback(
    (x, y) => {
      if (!battle || battle.status !== 'playing' || battle.side !== 'player') return;
      const occupant = battle.units.find((u) => u.x === x && u.y === y);
      if (occupant) {
        handleUnit(occupant);
        return;
      }
      if (selected && reachKeys?.has(`${x},${y}`)) {
        const res = moveUnit(battle, selected.id, x, y);
        setBattle(res.state);
        sfx.move();
        const after = res.state.units.find((u) => u.id === selected.id);
        if (!after || after.attacked) setSelectedId(null);
        return;
      }
      setSelectedId(null);
    },
    [battle, selected, reachKeys, handleUnit]
  );

  const handleEndTurn = useCallback(() => {
    if (!battle || battle.status !== 'playing' || battle.side !== 'player') return;
    setSelectedId(null);
    setBattle(endTurn(battle));
  }, [battle]);

  const handleRecruit = useCallback(
    (typeId) => {
      if (!battle || battle.status !== 'playing' || battle.side !== 'player') return;
      const res = recruit(battle, 'player', typeId);
      if (res.error === 'supply') setNotice('Not enough supply for that unit.');
      else if (res.error === 'cap') setNotice('Unit cap reached — commit a unit first.');
      else if (res.error === 'space') setNotice('Command post is surrounded — clear a tile.');
      else {
        setNotice('');
        setBattle(res.state);
      }
    },
    [battle]
  );

  const handleDeselect = useCallback(() => setSelectedId(null), []);

  /* ---------------------------------------------------------------- render */

  if (screen === 'menu' || !battle) {
    return (
      <div className="app">
        <MissionSelect progress={progress} onStart={startMission} onReset={resetProgress} />
      </div>
    );
  }

  const enemyUnits = battle.units.filter((u) => u.side === 'enemy').length;
  const ownUnits = battle.units.filter((u) => u.side === 'player').length;

  return (
    <div className="app battle-app">
      <header className="hud">
        <div className="hud-left">
          <span className="logo">IRON FRONT</span>
          <span className="mission-tag">
            {battle.missionCode} · {battle.missionName}
          </span>
        </div>
        <div className="hud-stats">
          <div className="stat">
            <span className="label">Turn</span>
            <strong>{battle.turn}</strong>
          </div>
          <div className="stat">
            <span className="label">Supply</span>
            <strong data-testid="supply">{battle.supply.player}</strong>
          </div>
          <div className="stat">
            <span className="label">Your units</span>
            <strong>{ownUnits}</strong>
          </div>
          <div className="stat">
            <span className="label">Enemy</span>
            <strong>{enemyUnits}</strong>
          </div>
          <div className={`stat side-indicator ${battle.side}`}>
            <span className="label">Initiative</span>
            <strong>{battle.side === 'player' ? 'ALLIED' : 'AXIS'}</strong>
          </div>
        </div>
        <div className="hud-actions">
          <button
            type="button"
            className="ghost small"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button type="button" className="ghost small" onClick={toMenu}>
            Campaign
          </button>
          <button
            type="button"
            className="primary end-turn"
            onClick={handleEndTurn}
            disabled={!playerTurn}
          >
            End Turn
          </button>
        </div>
      </header>

      <div className="objective-bar">
        <span className="objective">
          Objective: capture the enemy command post <b>✦</b> or destroy all enemy units.
        </span>
        {battle.side === 'enemy' && battle.status === 'playing' ? (
          <span className="thinking">Axis commander is issuing orders…</span>
        ) : (
          <span className="thinking ready">
            {selected ? 'Select a green tile to move, or a red ring to fire.' : 'Select a unit to give orders.'}
          </span>
        )}
      </div>

      <main className="battle-main">
        <Battlefield
          battle={battle}
          selectedId={selectedId}
          reachKeys={reachKeys}
          targetIds={targetIds}
          onTile={handleTile}
          onUnit={handleUnit}
          floaters={floaters}
        />
        <Sidebar
          battle={battle}
          selected={selected}
          onDeselect={handleDeselect}
          onRecruit={handleRecruit}
          message={notice}
        />
      </main>

      {battle.status !== 'playing' ? (
        <ResultModal
          battle={battle}
          onRetry={() => startMission(battle.missionId)}
          onNext={startMission}
          onMenu={toMenu}
        />
      ) : null}
    </div>
  );
}
