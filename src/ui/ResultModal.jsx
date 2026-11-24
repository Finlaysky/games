import React from 'react';
import { MISSIONS } from '../game/missions.js';

export default function ResultModal({ battle, onRetry, onNext, onMenu }) {
  const won = battle.status === 'won';
  const index = MISSIONS.findIndex((m) => m.id === battle.missionId);
  const next = MISSIONS[index + 1];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={won ? 'Victory' : 'Defeat'}>
      <div className={`modal ${won ? 'won' : 'lost'}`}>
        <p className="eyebrow">{battle.missionCode}</p>
        <h2 className="modal-title">{won ? 'VICTORY' : 'DEFEAT'}</h2>
        <p className="modal-sub">
          {won
            ? 'The position is taken. Your command stands ready for the next push.'
            : 'The line did not hold. Regroup and try a different approach.'}
        </p>
        <dl className="result-stats">
          <div>
            <dt>Turns</dt>
            <dd>{battle.turn}</dd>
          </div>
          <div>
            <dt>Enemies destroyed</dt>
            <dd>{battle.stats.kills}</dd>
          </div>
          <div>
            <dt>Units lost</dt>
            <dd>{battle.stats.losses}</dd>
          </div>
          <div>
            <dt>Units deployed</dt>
            <dd>{battle.stats.recruited}</dd>
          </div>
        </dl>
        <div className="modal-actions">
          {won && next ? (
            <button type="button" className="primary" onClick={() => onNext(next.id)}>
              Next: {next.name}
            </button>
          ) : null}
          <button type="button" className={won && next ? 'ghost' : 'primary'} onClick={onRetry}>
            Fight again
          </button>
          <button type="button" className="ghost" onClick={onMenu}>
            Campaign map
          </button>
        </div>
        {won && !next ? (
          <p className="campaign-done">All four battles cleared — the front has collapsed.</p>
        ) : null}
      </div>
    </div>
  );
}
