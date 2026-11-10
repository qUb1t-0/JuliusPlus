import type { ClipboardEvent, InputHTMLAttributes, SyntheticEvent } from 'react';
import { parseMoney } from '../lib/format';

const MAX_DIGITS = 15; // até R$ 9.999.999.999.999,99, ainda dentro do inteiro seguro do JS

// Formata só os dígitos como moeda: os dois últimos são os centavos ("100000000" → "R$ 1.000.000,00").
function formatMoneyDigits(digits: string): string {
  const clean = digits.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS);
  if (!clean) return '';
  const padded = clean.padStart(3, '0');
  const int = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${int},${padded.slice(-2)}`;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  value: string;
  onChange: (value: string) => void;
};

// Campo de valor em R$: aceita só números e se formata sozinho enquanto o usuário digita,
// preenchendo da direita para a esquerda (1 → 0,01 · 100 → 1,00 · 100000000 → 1.000.000,00).
// O texto devolvido ("R$ 1.500,00") é entendido por parseMoney, então os formulários não mudam.
export function MoneyInput({ value, onChange, placeholder = 'R$ 0,00', onPaste, onFocus, onClick, ...rest }: Props) {
  const shown = formatMoneyDigits(centsDigits(value));

  // O cursor fica sempre no fim: a máscara reescreve o texto inteiro a cada tecla.
  const toEnd = (e: SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
  };

  function paste(e: ClipboardEvent<HTMLInputElement>) {
    onPaste?.(e);
    // Colar "1.234,56", "1234.5" ou "R$ 12" vira o valor certo, não só a sequência de dígitos.
    const cents = parseMoney(e.clipboardData.getData('text'));
    if (cents === null) return;
    e.preventDefault();
    onChange(formatMoneyDigits(String(cents)));
    toEnd(e);
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={shown}
      onChange={(e) => { onChange(formatMoneyDigits(e.target.value)); toEnd(e); }}
      onPaste={paste}
      onFocus={(e) => { onFocus?.(e); toEnd(e); }}
      onClick={(e) => { onClick?.(e); toEnd(e); }}
    />
  );
}

// Valor vindo de fora (ex.: centsToInput → "1500,00") convertido para dígitos em centavos.
function centsDigits(value: string): string {
  const cents = parseMoney(value);
  return cents === null ? value : String(cents);
}
