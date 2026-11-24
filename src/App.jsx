import { useState } from 'react';
import CityGame from './city/CityGame.jsx';
import WarGame from './war/WarGame.jsx';
import './shell.css';

function Launcher({ onPick }) {
  return (
    <div className="shell">
      <div className="shell-glow" aria-hidden="true" />
      <header className="shell-head">
        <div className="shell-logo">
          SUNSET<span>ARCADE</span>
        </div>
        <p className="shell-tag">Two games, one cabinet. Pick your chaos.</p>
      </header>

      <main className="shell-games">
        <article className="card city">
          <div className="card-art" aria-hidden="true">
            <div className="art-sun" />
            <div className="art-skyline" />
            <div className="art-road" />
          </div>
          <div className="card-body">
            <span className="card-kicker">Open world · Action</span>
            <h2>SUNSET CITY</h2>
            <p>
              A living city full of traffic and pedestrians. Boost cars, shoot it out, run three jobs
              and shake a five star police chase.
            </p>
            <ul className="card-feats">
              <li>Steal and drive any car</li>
              <li>Police heat &amp; wanted stars</li>
              <li>Jobs, cash, health, minimap</li>
            </ul>
            <button type="button" className="card-btn" onClick={() => onPick('city')}>
              PLAY SUNSET CITY
            </button>
          </div>
        </article>

        <article className="card war">
          <div className="card-art" aria-hidden="true">
            <div className="art-grid" />
            <div className="art-tanks" />
          </div>
          <div className="card-body">
            <span className="card-kicker">Turn-based · Tactics</span>
            <h2>IRON FRONT</h2>
            <p>
              Command infantry, armour and artillery across four WW2 campaign battles on a hex-style
              grid. Recruit units, use terrain and break the enemy HQ.
            </p>
            <ul className="card-feats">
              <li>Four scripted battles</li>
              <li>Six unit types with counters</li>
              <li>Recruit, flank, outgun</li>
            </ul>
            <button type="button" className="card-btn alt" onClick={() => onPick('war')}>
              PLAY IRON FRONT
            </button>
          </div>
        </article>
      </main>

      <footer className="shell-foot">
        Keyboard and mouse. <b>Sunset City</b> runs in real time — click the game once it loads.
      </footer>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState('menu');

  if (screen === 'city') return <CityGame onExit={() => setScreen('menu')} />;
  if (screen === 'war') {
    return (
      <div className="shell-host">
        <button type="button" className="shell-back" onClick={() => setScreen('menu')}>
          ◀ ARCADE
        </button>
        <WarGame />
      </div>
    );
  }
  return <Launcher onPick={setScreen} />;
}
