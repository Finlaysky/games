import React from 'react';
import { TERRAIN, UNIT_TYPES } from '../game/units.js';

export default function Battlefield({
  battle,
  selectedId,
  reachKeys,
  targetIds,
  onTile,
  onUnit,
  floaters,
}) {
  const { w, h, tiles, units, hq, side, status } = battle;
  const active = status === 'playing' && side === 'player';

  return (
    <div className="board-wrap">
      <div
        className="board"
        style={{ aspectRatio: `${w} / ${h}`, '--w': w, '--h': h }}
      >
        {tiles.map((t, i) => {
          const x = i % w;
          const y = Math.floor(i / w);
          const key = `${x},${y}`;
          const canMove = reachKeys?.has(key);
          const isHQ =
            (hq.player[0] === x && hq.player[1] === y) ||
            (hq.enemy[0] === x && hq.enemy[1] === y);
          return (
            <button
              key={i}
              type="button"
              className={`tile t-${t}${canMove ? ' can-move' : ''}${isHQ ? ' hq-tile' : ''}`}
              onClick={() => onTile(x, y)}
              aria-label={`${TERRAIN[t].name} ${x},${y}`}
            >
              <span className="tile-deco" aria-hidden="true" />
            </button>
          );
        })}

        {['player', 'enemy'].map((s) => (
          <div
            key={s}
            className={`hq ${s}`}
            style={{ '--x': hq[s][0], '--y': hq[s][1] }}
            aria-hidden="true"
          >
            <span className="hq-flag">{s === 'player' ? '★' : '✦'}</span>
          </div>
        ))}

        {units.map((u) => {
          const t = UNIT_TYPES[u.type];
          const isSel = u.id === selectedId;
          const isTarget = targetIds?.has(u.id);
          const done = u.side === side && u.moved && u.attacked && active;
          return (
            <button
              key={u.id}
              type="button"
              className={`token ${u.side}${isSel ? ' sel' : ''}${isTarget ? ' target' : ''}${done ? ' spent' : ''}`}
              style={{ '--x': u.x, '--y': u.y }}
              onClick={(e) => {
                e.stopPropagation();
                onUnit(u);
              }}
              aria-label={`${t.name}, ${u.side === 'player' ? 'allied' : 'axis'}, ${u.hp} of ${u.maxHp} hit points`}
            >
              <span className="token-body">
                <span className="token-abbr">{t.abbr}</span>
              </span>
              <span className="hp">
                <span
                  className={`hp-fill${u.hp / u.maxHp < 0.35 ? ' low' : ''}`}
                  style={{ width: `${(u.hp / u.maxHp) * 100}%` }}
                />
              </span>
            </button>
          );
        })}

        {floaters.map((f) => (
          <div
            key={f.id}
            className={`floater ${f.side}`}
            style={{ '--x': f.at[0], '--y': f.at[1] }}
            aria-hidden="true"
          >
            -{f.amount}
          </div>
        ))}
      </div>
    </div>
  );
}
