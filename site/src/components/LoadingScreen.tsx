import { useEffect, useRef, useState } from 'react';
import { Mascot } from './Mascot';

// Tela de carregamento baseada no design "Tela de carregamento" (images/Tela de carregamento-html.zip).
// Quando o app termina de carregar: a barra completa, contador e dicas somem devagar e a figurinha
// com o título "voa" até a mesma posição no topo do cartão de login/cadastro (flyTarget).

const TIPS = [
  'Apagando a luz do quarto que ninguém está usando…',
  'Conferindo o troco duas vezes…',
  'Guardando o ketchup que veio de graça…',
  'Calculando quanto custa esse copo d’água…',
  'Separando as moedinhas por tamanho…',
];

const FILL_MS = 3600; // contador vai de -R$ 500,00 a R$ 1.000,00
const CYCLE_MS = 4200; // + pausa em R$ 1.000,00 antes de reiniciar
const TICK_MS = 40;
const FINISH_SPEED = 4; // ao terminar de carregar, a barra acelera até completar
const TIP_MS = 2400;
const FADE_MS = 800;
const FLY_MS = 1000;
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

type Phase = 'counting' | 'fading' | 'flying';

// Move e escala `el` para ocupar o lugar de `target` (mesmo centro e altura).
function flyTo(el: Element, target: Element): Animation {
  const a = el.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const s = b.height / a.height;
  return el.animate(
    [{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }],
    { duration: FLY_MS, easing: EASE, fill: 'forwards' },
  );
}

export function LoadingScreen({ done, flyTarget, onExited }: { done: boolean; flyTarget: string | null; onExited: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [tip, setTip] = useState(0);
  const [phase, setPhase] = useState<Phase>('counting');
  const doneRef = useRef(done);
  const rootRef = useRef<HTMLElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  doneRef.current = done;

  useEffect(() => {
    const cents = window.setInterval(() => setElapsed((e) => {
      if (doneRef.current) return Math.min(e + TICK_MS * FINISH_SPEED, FILL_MS);
      return e >= CYCLE_MS ? 0 : e + TICK_MS;
    }), TICK_MS);
    const tips = window.setInterval(() => setTip((i) => (i + 1) % TIPS.length), TIP_MS);
    return () => { window.clearInterval(cents); window.clearInterval(tips); };
  }, []);

  // Barra completa e app pronto: começa a saída.
  useEffect(() => {
    if (done && elapsed >= FILL_MS && phase === 'counting') setPhase('fading');
  }, [done, elapsed, phase]);

  useEffect(() => {
    if (phase !== 'fading') return;
    const t = window.setTimeout(() => setPhase('flying'), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'flying') return;
    const root = rootRef.current;
    // Em aba em segundo plano o navegador pausa as animações: pula direto para a próxima tela.
    if (!root || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return onExited();
    const art = artRef.current;
    const title = titleRef.current;
    const artTarget = flyTarget ? document.querySelector(`${flyTarget} .mascot`) : null;
    const titleTarget = flyTarget ? document.querySelector(`${flyTarget} .signup-title`) : null;

    const anims: Animation[] = [];
    if (art && title && artTarget && titleTarget) {
      // A figurinha e o título viajam até o cartão enquanto o fundo escuro se dissolve no da página.
      anims.push(flyTo(art, artTarget), flyTo(title, titleTarget));
      anims.push(root.animate([{ backgroundColor: '#11172a' }, { backgroundColor: 'rgba(17, 23, 42, 0)' }], { duration: FLY_MS, easing: EASE, fill: 'forwards' }));
      if (glowRef.current) anims.push(glowRef.current.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: FLY_MS, fill: 'forwards' }));
    } else {
      // Indo direto para o app (já logado): só esmaece a tela.
      anims.push(root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'ease', fill: 'forwards' }));
    }
    let alive = true;
    Promise.all(anims.map((a) => a.finished)).then(() => alive && onExited()).catch(() => alive && onExited());
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const t = Math.min(elapsed / FILL_MS, 1);
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const value = Math.round((-500 + 1500 * eased) * 100) / 100;
  // vermelho até R$ 0,00 · amarelo até R$ 600,00 · verde acima
  const barColor = value <= 0 ? '#E35A4C' : value <= 600 ? '#F2C14E' : '#35C08A';
  const amount = (value < 0 ? '-R$ ' : 'R$ ') + Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main ref={rootRef} className={`loading ${phase !== 'counting' ? 'is-leaving' : ''}`} aria-busy={phase === 'counting'} aria-live="polite">
      <div ref={glowRef} className="jp-glow loading-glow" aria-hidden />
      <div className="loading-stack">
        <div ref={artRef} className="loading-art"><Mascot size={240} /></div>
        <h1 ref={titleRef} className="loading-title">Julius<span className="jp-plus">+</span></h1>
        <div className="loading-info">
          <div className="loading-meter">
            <div className="loading-meter-head">
              <span className="loading-label">{phase === 'counting' ? 'Contando centavos' : 'Tudo contado!'}</span>
              <span className="loading-amount" style={{ color: barColor }}>{amount}</span>
            </div>
            <div className="loading-track" role="progressbar" aria-label="Carregando o Julius+" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(eased * 100)}>
              <div className="loading-fill" style={{ width: `${(eased * 100).toFixed(1)}%`, background: barColor }} />
            </div>
          </div>
          <p key={tip} className="jp-tip loading-tip">{TIPS[tip]}</p>
        </div>
      </div>
    </main>
  );
}
