import { useCallback, useRef, useState } from 'react';

// The five like combos, ported from the motion studies. One is picked at random per
// press so a feed full of likes doesn't look mechanical.
const LIKE_FX = ['twin', 'triple', 'bloom', 'wave', 'orbit'];

// Sparks sit at fixed offsets rather than random ones: a burst that lands differently
// every time reads as a glitch, not as a flourish.
const SPARKS = [
  { dx: '14px', dy: '-12px' }, { dx: '-15px', dy: '-9px' }, { dx: '11px', dy: '13px' },
  { dx: '-12px', dy: '12px' }, { dx: '0px', dy: '-17px' },
];

// Plays a reaction effect on a button, independent of any request.
//
// `play()` bumps a counter that lands on the element as data-play. Changing that
// attribute restarts the CSS animation, so pressing the same button five times in a
// second gives five distinct plays instead of one stuck mid-flight — which is the whole
// point: the effect answers the finger, not the server.
//
// `fx` is either a fixed effect name or 'like', which draws a fresh combo each press.
export default function useReactionFx(fx) {
  const [play, setPlay] = useState(0);
  const [combo, setCombo] = useState(LIKE_FX[0]);
  const n = useRef(0);

  const trigger = useCallback(() => {
    if (fx === 'like') setCombo(LIKE_FX[Math.floor(Math.random() * LIKE_FX.length)]);
    n.current += 1;
    setPlay(n.current);
  }, [fx]);

  const name = fx === 'like' ? combo : fx;
  // Rings the effect actually uses; rendering three for everything would paint
  // (and animate) spans that no rule ever touches.
  const rings = { triple: 3, wave: 3, send: 2, twin: 2 }[name] || 1;
  const sparks = ['twin', 'triple', 'bloom'].includes(name) ? 3 : (name === 'orbit' ? 5 : 0);

  const fxProps = { className: 'mt-fx', 'data-fx': name, 'data-play': play };

  const layers = (
    <>
      {Array.from({ length: rings }, (_, i) => (
        <span key={`r${i}`} aria-hidden="true" className={`mt-fx__ring${i ? ` mt-fx__ring--${i + 1}` : ''}`} />
      ))}
      {Array.from({ length: sparks }, (_, i) => (
        <span
          key={`s${i}`}
          aria-hidden="true"
          className="mt-fx__spark"
          style={{ '--dx': SPARKS[i].dx, '--dy': SPARKS[i].dy, animationDelay: `${i * 30}ms` }}
        />
      ))}
    </>
  );

  return { trigger, fxProps, layers };
}
