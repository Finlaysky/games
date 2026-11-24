import React, { useEffect, useRef } from 'react';
import { UNIT_TYPES, UNIT_ORDER, TERRAIN } from '../game/units.js';

const KIND_CLASS = {
  attack: 'log-attack',
  destroy: 'log-destroy',
  move: 'log-move',
  recruit: 'log-recruit',
  income: 'log-income',
  victory: 'log-victory',
  defeat: 'log-defeat',
  info: 'log-info',
};

function UnitCard({ unit, onDeselect }) {
  if (!unit) {
    return (
      <div className="card empty-card">
        <h2>No unit selected</h2>
        <p className="hint">
          Click one of your units to see its orders. Green tiles are movement, red rings are
          valid targets.
        </p>
      </div>
    );
  }
  const t = UNIT_TYPES[unit.type];
  const spent = unit.moved && unit.attacked;
  return (
    <div className="card unit-card">
      <div className="unit-head">
        <span className={`badge ${unit.side}`}>{t.abbr}</span>
        <div>
          <h2>{t.name}</h2>
          <span className="unit-status">
            {spent ? 'Orders complete' : unit.moved ? 'Moved — may still fire' : 'Ready for orders'}
          </span>
        </div>
        <button type="button" className="ghost small" onClick={onDeselect}>
          ✕
        </button>
      </div>
      <div className="bar big">
        <span
          className={`bar-fill${unit.hp / unit.maxHp < 0.35 ? ' low' : ''}`}
          style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }}
        />
        <span className="bar-label">
          {unit.hp} / {unit.maxHp} HP
        </span>
      </div>
      <dl className="stats">
        <div>
          <dt>ATK</dt>
          <dd>{t.atk}</dd>
        </div>
        <div>
          <dt>DEF</dt>
          <dd>{t.def}</dd>
        </div>
        <div>
          <dt>MOV</dt>
          <dd>{t.move}</dd>
        </div>
        <div>
          <dt>RNG</dt>
          <dd>
            {t.minRange === t.maxRange ? t.maxRange : `${t.minRange}–${t.maxRange}`}
          </dd>
        </div>
      </dl>
      <p className="hint">{t.desc}</p>
    </div>
  );
}

function RecruitPanel({ battle, onRecruit, message }) {
  const playerUnits = battle.units.filter((u) => u.side === 'player').length;
  const atCap = playerUnits >= battle.maxUnits;
  const yourTurn = battle.side === 'player' && battle.status === 'playing';

  return (
    <div className="card">
      <div className="card-head">
        <h2>Deploy Forces</h2>
        <span className="tag">
          {playerUnits}/{battle.maxUnits} units
        </span>
      </div>
      <p className="hint">
        New units appear at your command post (★) and can act immediately.
      </p>
      {message ? <p className="warn">{message}</p> : null}
      <ul className="recruit-list">
        {UNIT_ORDER.map((id) => {
          const t = UNIT_TYPES[id];
          const unaffordable = battle.supply.player < t.cost;
          const disabled = !yourTurn || atCap || unaffordable;
          return (
            <li key={id}>
              <button
                type="button"
                className="recruit"
                disabled={disabled}
                onClick={() => onRecruit(id)}
                title={t.desc}
              >
                <span className="badge player tiny">{t.abbr}</span>
                <span className="recruit-name">
                  {t.name}
                  <em>
                    {t.hp}hp · {t.atk}atk · {t.move}mov
                  </em>
                </span>
                <span className="cost">{t.cost}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {atCap ? <p className="warn">Unit cap reached — commit a unit before deploying more.</p> : null}
    </div>
  );
}

function BattleLog({ log }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <div className="card log-card">
      <div className="card-head">
        <h2>Field Reports</h2>
      </div>
      <ol className="log" ref={ref}>
        {log.map((e) => (
          <li key={e.id} className={KIND_CLASS[e.kind] ?? 'log-info'}>
            <span className="log-turn">T{e.turn}</span>
            {e.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Sidebar({ battle, selected, onDeselect, onRecruit, message }) {
  const income = 240 + 45 * battle.units.filter(
    (u) => u.side === 'player' && battle.tiles[u.y * battle.w + u.x] === 'city'
  ).length;

  return (
    <aside className="sidebar">
      <UnitCard unit={selected} onDeselect={onDeselect} />
      <div className="card supply-card">
        <div>
          <span className="label">Supply</span>
          <strong data-testid="supply">{battle.supply.player}</strong>
        </div>
        <div>
          <span className="label">Income / turn</span>
          <strong>+{income}</strong>
        </div>
      </div>
      <RecruitPanel battle={battle} onRecruit={onRecruit} message={message} />
      <BattleLog log={battle.log} />
      <div className="card legend-card">
        <h2>Terrain</h2>
        <ul className="legend">
          {Object.values(TERRAIN).map((t) => (
            <li key={t.id}>
              <span className={`swatch t-${t.id}`} />
              {t.name}
              <em>+{t.def} def</em>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
