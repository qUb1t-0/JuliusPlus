import { useEffect, useState, type CSSProperties } from 'react';

// Tela de carregamento baseada no design "Tela de carregamento" (images/Tela de carregamento-html.zip):
// figurinha com sobrancelha animada, moedas caindo, contador de centavos e dicas de economia.

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
const TIP_MS = 2400;

function Coin({ size, label, style }: { size: number; label: 'R$' | '¢'; style: CSSProperties }) {
  return (
    <div className="jp-coin" aria-hidden style={{ position: 'absolute', width: size, height: size, ...style }}>
      <svg width={size} height={size} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="17" fill="#F2C14E" stroke="#B9862A" strokeWidth="4" />
        <text x="20" y={label === '¢' ? 28 : 27} textAnchor="middle" fontFamily="Bangers, Impact, sans-serif" fontSize={label === '¢' ? 22 : 18} fill="#8A5E12">{label}</text>
      </svg>
    </div>
  );
}

export function LoadingScreen() {
  const [elapsed, setElapsed] = useState(0);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const cents = window.setInterval(() => setElapsed((e) => (e >= CYCLE_MS ? 0 : e + TICK_MS)), TICK_MS);
    const tips = window.setInterval(() => setTip((i) => (i + 1) % TIPS.length), TIP_MS);
    return () => { window.clearInterval(cents); window.clearInterval(tips); };
  }, []);

  const t = Math.min(elapsed / FILL_MS, 1);
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const value = Math.round((-500 + 1500 * eased) * 100) / 100;
  // vermelho até R$ 0,00 · amarelo até R$ 600,00 · verde acima
  const barColor = value <= 0 ? '#E35A4C' : value <= 600 ? '#F2C14E' : '#35C08A';
  const amount = (value < 0 ? '-R$ ' : 'R$ ') + Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="loading" aria-busy="true" aria-live="polite">
      <div className="jp-glow loading-glow" aria-hidden />
      <div className="loading-stack">
        <div className="loading-art">
          <Coin size={40} label="R$" style={{ left: -18, top: 56, animationDelay: '0s' }} />
          <Coin size={48} label="R$" style={{ right: -22, top: 20, animationDelay: '.8s' }} />
          <Coin size={32} label="¢" style={{ right: 4, bottom: 6, animationDelay: '1.6s' }} />
          <div className="jp-pop">
            <div className="jp-wobble">
              <svg width="240" height="240" viewBox="40 20 560 560" aria-hidden>
                <defs><clipPath id="jpBadge"><circle cx="320" cy="300" r="262" /></clipPath></defs>
                <circle cx="320" cy="300" r="276" fill="#FFFFFF" />
                <circle cx="320" cy="300" r="262" fill="#1F9D6B" />
                <g clipPath="url(#jpBadge)">
                  <path d="M110 640 Q118 460 236 430 L404 430 Q522 460 530 640 Z" fill="#2B3A67" />
                  <path d="M272 430 L320 492 L368 430 Z" fill="#FFFFFF" />
                  <path d="M236 430 L292 430 L320 500 L262 478 Z" fill="#3A4C82" />
                  <path d="M404 430 L348 430 L320 500 L378 478 Z" fill="#3A4C82" />
                  <rect x="284" y="372" width="72" height="70" rx="20" fill="#6A3F24" />
                  <ellipse cx="212" cy="270" rx="20" ry="28" fill="#7A4A2B" />
                  <ellipse cx="428" cy="270" rx="20" ry="28" fill="#7A4A2B" />
                  <ellipse cx="320" cy="258" rx="110" ry="124" fill="#7A4A2B" />
                  <ellipse cx="278" cy="172" rx="34" ry="14" fill="#FFFFFF" fillOpacity="0.28" transform="rotate(-14 278 172)" />
                  <path className="jp-brow" d="M250 214 Q276 188 302 210" fill="none" stroke="#24150C" strokeWidth="12" strokeLinecap="round" />
                  <path d="M340 230 Q366 222 392 232" fill="none" stroke="#24150C" strokeWidth="12" strokeLinecap="round" />
                  <ellipse cx="276" cy="244" rx="20" ry="17" fill="#FFFFFF" />
                  <circle cx="281" cy="247" r="9" fill="#1A0F08" />
                  <circle cx="284" cy="243" r="3" fill="#FFFFFF" />
                  <path d="M346 250 Q366 240 386 250 Q366 258 346 250 Z" fill="#FFFFFF" />
                  <circle cx="370" cy="250" r="6" fill="#1A0F08" />
                  <path d="M343 248 Q366 236 389 248" fill="none" stroke="#24150C" strokeWidth="5" strokeLinecap="round" />
                  <path d="M308 262 Q300 296 296 300 Q320 314 344 300 Q340 296 332 262" fill="#6A3F24" />
                  <ellipse cx="320" cy="300" rx="28" ry="15" fill="#5E3820" />
                  <path d="M276 330 Q320 312 364 328 Q350 338 320 332 Q290 338 276 330 Z" fill="#1D120B" />
                  <path d="M296 352 Q320 404 344 352 Q332 362 320 362 Q308 362 296 352 Z" fill="#1D120B" />
                  <path d="M286 342 Q326 360 360 334" fill="none" stroke="#2A170D" strokeWidth="6" strokeLinecap="round" />
                  <path d="M296 344 Q326 356 352 340 Q326 352 296 344 Z" fill="#FFFFFF" />
                </g>
                <g transform="rotate(-12 190 470)">
                  <rect x="128" y="392" width="118" height="156" rx="14" fill="#F2C14E" stroke="#1C2748" strokeWidth="5" />
                  <rect x="144" y="408" width="86" height="38" rx="6" fill="#20352B" />
                  <rect x="146" y="458" width="20" height="16" rx="4" fill="#1C2748" />
                  <rect x="177" y="458" width="20" height="16" rx="4" fill="#1C2748" />
                  <rect x="208" y="458" width="20" height="16" rx="4" fill="#C2453A" />
                </g>
                <ellipse cx="236" cy="470" rx="22" ry="14" fill="#7A4A2B" stroke="#1C2748" strokeWidth="4" />
                <ellipse cx="240" cy="496" rx="22" ry="14" fill="#7A4A2B" stroke="#1C2748" strokeWidth="4" />
              </svg>
            </div>
          </div>
        </div>

        <h1 className="loading-title">Julius<span className="jp-plus">+</span></h1>

        <div className="loading-meter">
          <div className="loading-meter-head">
            <span className="loading-label">Contando centavos</span>
            <span className="loading-amount" style={{ color: barColor }}>{amount}</span>
          </div>
          <div className="loading-track" role="progressbar" aria-label="Carregando o Julius+">
            <div className="loading-fill" style={{ width: `${(eased * 100).toFixed(1)}%`, background: barColor }} />
          </div>
        </div>

        <p key={tip} className="jp-tip loading-tip">{TIPS[tip]}</p>
      </div>
    </main>
  );
}
