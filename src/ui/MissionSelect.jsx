import React from 'react';
import { MISSIONS } from '../game/missions.js';

export default function MissionSelect({ progress, onStart, onReset }) {
  return (
    <div className="menu">
      <header className="hero">
        <p className="eyebrow">Tactical Command · 1944</p>
        <h1 className="title">IRON FRONT</h1>
        <p className="lede">
          A turn-based war game. Command infantry, armour, artillery and anti-tank guns across
          four campaign battles. Break the enemy line or hold your own command post.
        </p>
      </header>

      <section className="campaign">
        <h2 className="section-title">Campaign</h2>
        <div className="mission-grid">
          {MISSIONS.map((m, i) => {
            const unlocked = progress.unlocked.includes(m.id);
            const cleared = progress.cleared.includes(m.id);
            return (
              <article
                key={m.id}
                className={`mission-card${unlocked ? '' : ' locked'}${cleared ? ' cleared' : ''}`}
              >
                <div className="mission-top">
                  <span className="mission-no">0{i + 1}</span>
                  <span className={`difficulty d${i}`}>{m.difficulty}</span>
                </div>
                <h3>{m.name}</h3>
                <p className="mission-code">{m.code}</p>
                <p className="mission-brief">{m.brief}</p>
                <div className="mission-meta">
                  <span>{m.player.length} units</span>
                  <span>{m.enemy.length} enemy</span>
                </div>
                {cleared ? <span className="cleared-stamp">CLEARED</span> : null}
                <button
                  type="button"
                  className="primary"
                  disabled={!unlocked}
                  onClick={() => onStart(m.id)}
                >
                  {unlocked ? (cleared ? 'Replay battle' : 'Deploy') : 'Locked'}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="briefing">
        <h2 className="section-title">Field Manual</h2>
        <div className="manual-grid">
          <div>
            <h3>Orders</h3>
            <ul>
              <li>Click a unit, then a green tile to move.</li>
              <li>Click a red-ringed enemy to fire. A unit may move and fire once per turn.</li>
              <li>End Turn hands the initiative to the enemy commander.</li>
            </ul>
          </div>
          <div>
            <h3>Victory</h3>
            <ul>
              <li>Stand on the enemy command post (✦) to capture it.</li>
              <li>Or destroy every enemy unit on the field.</li>
              <li>Lose your own ★ post, or every unit, and the battle is lost.</li>
            </ul>
          </div>
          <div>
            <h3>Combat</h3>
            <ul>
              <li>Terrain adds defence: towns and ruins +3, hills and forest +2.</li>
              <li>Anti-tank guns double damage against armour; infantry barely dent it.</li>
              <li>Artillery fires 2–4 tiles away and takes no return fire.</li>
              <li>Units trading shots at range 1 exchange return fire.</li>
            </ul>
          </div>
          <div>
            <h3>Supply</h3>
            <ul>
              <li>+240 supply each turn, +45 for every town you occupy.</li>
              <li>Spend it deploying new units at your command post.</li>
              <li>Tanks and artillery cannot enter forest or rivers.</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="menu-footer">
        <span>
          Battles cleared: {progress.cleared.length} / {MISSIONS.length}
        </span>
        <button type="button" className="ghost small" onClick={onReset}>
          Reset campaign progress
        </button>
      </footer>
    </div>
  );
}
