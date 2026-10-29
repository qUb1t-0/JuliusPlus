import { useCallback, useEffect, useRef, useState } from 'react';
import { stopEscape, useFloating } from './useFloating';

// Grupos no estilo do teclado de emojis do WhatsApp.
const GROUPS: { icon: string; label: string; emojis: string }[] = [
  { icon: '😀', label: 'Carinhas', emojis: '😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬😌😔😪🤤😴😷🤒🤕🤢🤮🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀💩🤡👻👽🤖' },
  { icon: '👋', label: 'Pessoas', emojis: '👋🤚✋🖖👌🤌🤏✌️🤞🤟🤘🤙👈👉👆👇☝️👍👎✊👊👏🙌👐🤲🤝🙏💪🧠👀👶🧒👦👧🧑👨👩🧓👴👵👮👷💂🕵️👩‍⚕️👨‍🍳👩‍🎓👨‍💻👩‍🏫👨‍🔧👩‍🌾🤰🤱👪💑💏' },
  { icon: '🐻', label: 'Animais e natureza', emojis: '🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🐤🦆🦅🦉🐴🦄🐝🦋🐌🐞🐢🐍🐙🐠🐟🐬🐳🦈🐊🐘🦒🐄🐖🐑🐕🐈🌵🌲🌳🌴🌱🌿🍀🍁🌷🌹🌻🌸💐🌍🌙⭐🌟☀️⛅🌧️⛈️❄️🔥💧🌈' },
  { icon: '🍔', label: 'Comidas e bebidas', emojis: '🍏🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🥑🥦🥬🥒🌶️🌽🥕🧄🧅🥔🍠🥐🍞🥖🧀🥚🍳🥓🥩🍗🍖🌭🍔🍟🍕🥪🌮🌯🥗🍝🍜🍲🍛🍣🍱🍤🍙🍚🍰🎂🧁🍩🍪🍫🍬🍭🍿🥤🧃☕🍵🍺🍻🍷🥂🍸🍹🧉🍼🛒' },
  { icon: '⚽', label: 'Atividades', emojis: '⚽🏀🏈⚾🎾🏐🏉🎱🏓🏸🥊🥋⛳🏹🎣🤿🛹⛸️🎿🏋️🤸🧘🏃🚴🏊🏆🥇🥈🥉🏅🎖️🎫🎟️🎭🎨🎬🎤🎧🎼🎹🥁🎷🎺🎸🎻🎲♟️🎯🎳🎮🕹️🧩🎰🎉🎊🎁🎈' },
  { icon: '🚗', label: 'Viagens e lugares', emojis: '🚗🚕🚙🚌🚎🏎️🚓🚑🚒🚐🛻🚚🚛🚜🛵🏍️🚲🛴🚨🚔🚍🚘🚖✈️🛫🛬🚁🚀🛸🚢⛵🚤🛳️⚓🛟⛽🚧🚦🗺️🏠🏡🏢🏬🏪🏫🏥🏦🏨🏛️⛪🕌🏰🏟️🎡🎢🏖️🏝️🏕️⛺🌋🗽🗼🌆🌃' },
  { icon: '💡', label: 'Objetos', emojis: '💡🔦🕯️📱💻🖥️⌨️🖨️🖱️💾📷📸📹🎥📺📻⏰⌛📡🔋🔌💸💵💴💶💷💰💳🪙💎⚖️🧾📄📈📉📊🧰🔧🔨🛠️⚙️🔩🧱🔑🗝️🚪🛏️🛋️🚿🛁🧹🧺🧻🧼🧽🪒💊💉🩺🩹🧬🔬📚📖📝✏️🖊️📎📌📅📆🗓️📦📫✉️🎓👓👔👕👖👗👘👠👟👜🎒💼☂️💄💍' },
  { icon: '❤️', label: 'Símbolos', emojis: '❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝✅❌⭕❗❓⚠️🚫♻️✔️➕➖➗✖️💯🔝🆕🆗🆙🆒🔔🔕📶💤💬💭🗯️♠️♥️♦️♣️🔴🟠🟡🟢🔵🟣⚫⚪🟥🟧🟨🟩🟦🟪⬛⬜🔶🔷✨⚡🎵🎶➡️⬅️⬆️⬇️🔄🔁' },
  { icon: '🏁', label: 'Bandeiras', emojis: '🏁🚩🎌🏴🏳️🏳️‍🌈🇧🇷🇵🇹🇺🇸🇨🇦🇲🇽🇦🇷🇨🇱🇺🇾🇵🇾🇨🇴🇪🇸🇫🇷🇮🇹🇩🇪🇬🇧🇮🇪🇯🇵🇨🇳🇰🇷🇦🇺🇿🇦🇮🇳' },
];

// Separa por grafema para emojis compostos (👩‍⚕️, 🇧🇷) virarem um item só.
// (Intl.Segmenter existe nos navegadores atuais; a lib TS do projeto ainda não o declara.)
type GraphemeSegmenter = new (locale: string, opts: { granularity: 'grapheme' }) => { segment(s: string): Iterable<{ segment: string }> };
const segmenter = new (Intl as unknown as { Segmenter: GraphemeSegmenter }).Segmenter('pt-BR', { granularity: 'grapheme' });
const LISTS = GROUPS.map((g) => [...segmenter.segment(g.emojis)].map((s) => s.segment));

export function EmojiPicker({ value, onChange, label = 'Escolher ícone' }: { value: string; onChange: (emoji: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const { anchorRef, floatRef } = useFloating(open, close);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const grid = gridRef.current;
    grid?.scrollTo({ top: 0 });
    (grid?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? grid?.querySelector('button'))?.focus({ preventScroll: true });
  }, [open, tab]);

  const show = () => {
    const found = LISTS.findIndex((l) => l.includes(value));
    setTab(found >= 0 ? found : 0);
    setOpen(true);
  };
  const dismiss = () => { setOpen(false); anchorRef.current?.focus(); };

  return (
    <>
      <button ref={anchorRef} type="button" className="emoji-trigger" aria-haspopup="dialog" aria-expanded={open}
        aria-label={`${label}: ${value}`} title={label} onClick={() => (open ? setOpen(false) : show())}>
        {value}
      </button>
      {open && (
        <div ref={floatRef} popover="manual" className="pop emoji-pop" role="dialog" aria-label={label}
          onClick={(e) => e.preventDefault()} onKeyDown={(e) => stopEscape(e, dismiss)}>
          <div className="emoji-tabs" role="tablist" aria-label="Grupos de emojis">
            {GROUPS.map((g, i) => (
              <button key={g.label} type="button" role="tab" aria-selected={tab === i} aria-label={g.label} title={g.label}
                className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{g.icon}</button>
            ))}
          </div>
          <p className="emoji-group-title">{GROUPS[tab].label}</p>
          <div ref={gridRef} className="emoji-grid" role="tabpanel" aria-label={GROUPS[tab].label}>
            {LISTS[tab].map((e) => (
              <button key={e} type="button" aria-label={e} aria-pressed={e === value} onClick={() => { onChange(e); dismiss(); }}>{e}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
