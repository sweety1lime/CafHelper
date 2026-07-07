import { getSynonymGroups } from "../data/loader";

export function normalizeTerm(term: string): string {
  return term.toLowerCase().replace(/ё/g, "е");
}

const SEP = /[^a-zа-я0-9.]+/i;

// жаргон -> канонические слова из текстов статей;
// ключ — нормализованные токены термина через пробел («за спиной», «код 6»),
// поэтому словарь понимает и многословные выражения, и «код-6» (дефис — разделитель)
const phraseMap = new Map<string, string[]>();
let maxPhraseLen = 1;
for (const group of getSynonymGroups()) {
  for (const term of group.terms) {
    const key = normalizeTerm(term).split(SEP).filter(Boolean);
    if (key.length === 0) continue;
    phraseMap.set(key.join(" "), group.expand);
    maxPhraseLen = Math.max(maxPhraseLen, key.length);
  }
}

// «ствол за спиной» -> «ствол за спиной оружие огнестрельное»
// Жадный проход: на каждой позиции ищем самую длинную фразу словаря;
// совпавшие токены съедаются, чтобы «код 6» не сработал ещё и как «код».
export function expandQuery(query: string): string {
  const tokens = normalizeTerm(query).split(SEP).filter(Boolean);
  const extra: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    let matched = 0;
    for (let n = Math.min(maxPhraseLen, tokens.length - i); n >= 1; n--) {
      const expansion = phraseMap.get(tokens.slice(i, i + n).join(" "));
      if (expansion) {
        extra.push(...expansion);
        matched = n;
        break;
      }
    }
    i += matched || 1;
  }
  return [...tokens, ...extra].join(" ");
}

// QWERTY -> ЙЦУКЕН: спасает запросы, набранные в английской раскладке («vbhfylf» -> «миранда»)
const EN_TO_RU: Record<string, string> = {
  q: "й", w: "ц", e: "у", r: "к", t: "е", y: "н", u: "г", i: "ш", o: "щ", p: "з",
  "[": "х", "]": "ъ", a: "ф", s: "ы", d: "в", f: "а", g: "п", h: "р", j: "о",
  k: "л", l: "д", ";": "ж", "'": "э", z: "я", x: "ч", c: "с", v: "м", b: "и",
  n: "т", m: "ь", ",": "б", ".": "ю", "`": "е",
};

export function mapLayoutToRu(query: string): string {
  return query
    .toLowerCase()
    .split("")
    .map((ch) => EN_TO_RU[ch] ?? ch)
    .join("");
}

// Варианты запроса для поиска: исходный + перебитый из EN-раскладки (если есть латиница)
export function queryVariants(query: string): string[] {
  const variants = [query];
  if (/[a-z]/i.test(query)) {
    const mapped = mapLayoutToRu(query);
    if (mapped !== query.toLowerCase()) variants.push(mapped);
  }
  return variants;
}
