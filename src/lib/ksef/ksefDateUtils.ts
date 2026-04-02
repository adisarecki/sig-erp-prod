/**
 * VECTOR 114: KSeF Hardened Date Engine
 * Centralne źródło prawdy dla logiki dat w strefie Europe/Warsaw.
 * Eliminuje błędy przesunięć UTC, DST (czas letni/zimowy) i driftu kalendarzowego.
 */

export interface RangeValidationResult {
  isValid: boolean;
  days: number;
  fromNormalized: string;
  toNormalized: string;
}

/**
 * Normalizuje dowolną datę do formatu YYYY-MM-DD w strefie czasowej Polski.
 * Zapobiega błędom, gdzie UTC midnight na serwerze to 23:00 poprzedniego dnia w Polsce.
 */
export function normalizeToWarsaw(date: Date | string): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      // Fallback jeśli data jest niepoprawna (np. pusty string)
      return new Date().toISOString().split('T')[0];
    }

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    // en-CA zwraca YYYY-MM-DD
    return formatter.format(d);
  } catch (e) {
    console.error("[KSEF_DATE_UTILS] Normalization Error:", e);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Waliduje zakres dat kalendarzowo w strefie Europe/Warsaw.
 * Uwzględnia dni kalendarzowe (np. od 1 kwietnia do 1 lipca).
 */
export function validateRange(from: Date | string, to: Date | string, maxDays = 90): RangeValidationResult {
  const fromNorm = normalizeToWarsaw(from);
  const toNorm = normalizeToWarsaw(to);

  // Tworzymy daty w południe UTC dla znormalizowanych stringów, aby uniknąć problemów z DST przy odejmowaniu
  const d1 = new Date(`${fromNorm}T12:00:00Z`);
  const d2 = new Date(`${toNorm}T12:00:00Z`);

  const diffMs = d2.getTime() - d1.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const isValid = days >= 0 && days <= maxDays;

  return {
    isValid,
    days: Math.max(0, days),
    fromNormalized: fromNorm,
    toNormalized: toNorm
  };
}

/**
 * Formatuje datę do standardu akceptowanego przez KSeF API (ISO8601 z offsetem).
 * Automatycznie wylicza poprawny offset (+01:00 / +02:00) dla danej daty w Polsce.
 */
export function formatForKsef(date: Date | string, isEnd = false): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const warsawDate = normalizeToWarsaw(d);

  // Wyciągnięcie offsetu dla konkretnej daty
  // Przykładowo dla lata: GMT+2, dla zimy: GMT+1
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    timeZoneName: 'shortOffset'
  });

  const parts = tzFormatter.formatToParts(d);
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';

  // Formatowanie offsetu: GMT+2 -> +02:00, GMT-5 -> -05:00
  let offset = tzPart.replace('GMT', '').replace('UTC', '');
  if (!offset.includes(':')) {
    if (offset === '') offset = '+01:00'; // Default do zimy
    else if (offset.length === 2 || offset.length === 3) offset = offset + ':00'; // +1 -> +1:00
  }
  // Dodanie zera wiodącego jeśli trzeba: +1:00 -> +01:00
  if (offset.startsWith('+') && offset.length === 5) offset = '+0' + offset.substring(1);
  if (offset.startsWith('-') && offset.length === 5) offset = '-0' + offset.substring(1);

  const timePart = isEnd ? "23:59:59" : "00:00:00";
  return `${warsawDate}T${timePart}${offset}`;
}
