import MiniSearch from "minisearch";
import type { Article, Rule, Scenario, ServerDataBundle } from "../types";
import { getRules } from "../data/loader";
import { expandQuery, normalizeTerm, queryVariants } from "./normalize";

// Результат с релевантностью: weak — совпадение сильно хуже лучшего,
// в UI такие прячутся под «Слабые совпадения»
export interface Scored<T> {
  item: T;
  score: number;
  weak: boolean;
  matchedTerms: string[];
}

// Правило проекта, обогащённое категорией — для показа в общем поиске
export interface RuleHit extends Rule {
  docId: string; // `${categoryId}:${rule.id}` — уникально между категориями
  categoryId: string;
  categoryTitle: string;
  source: string;
}

export interface SearchResults {
  scenarios: Scored<Scenario>[];
  rules: Scored<RuleHit>[];
  articles: Scored<Article>[];
}

const MAX_SCENARIOS = 4;
const MAX_RULES = 5;
const MAX_ARTICLES = 15;
// результат слабее WEAK_RATIO × (лучший score) считается мусорным
const WEAK_RATIO = 0.25;

// Поля-массивы (tags, keywords и т.п.) склеиваем в строку для индексации
function extractField<T>(doc: T, fieldName: string): string {
  const value = (doc as Record<string, unknown>)[fieldName];
  if (Array.isArray(value)) return value.join(" ");
  return value == null ? "" : String(value);
}

// Разворачиваем категории правил в плоский список для индексации
function flattenRules(): RuleHit[] {
  const out: RuleHit[] = [];
  for (const cat of getRules().categories) {
    for (const r of cat.rules) {
      out.push({
        ...r,
        docId: `${cat.id}:${r.id}`,
        categoryId: cat.id,
        categoryTitle: cat.title,
        source: cat.source,
      });
    }
  }
  return out;
}

export class SearchEngine {
  private articleIndex: MiniSearch<Article>;
  private scenarioIndex: MiniSearch<Scenario>;
  private ruleIndex: MiniSearch<RuleHit>;
  private articleById = new Map<string, Article>();
  private scenarioById = new Map<string, Scenario>();
  private ruleById = new Map<string, RuleHit>();

  constructor(bundle: ServerDataBundle) {
    this.articleIndex = new MiniSearch<Article>({
      fields: ["number", "title", "text", "punishment", "tags", "chapter"],
      extractField,
      processTerm: normalizeTerm,
      searchOptions: {
        boost: { number: 6, tags: 4, title: 3 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
    this.scenarioIndex = new MiniSearch<Scenario>({
      fields: ["title", "keywords", "situation", "steps", "phrases", "pitfalls"],
      extractField,
      processTerm: normalizeTerm,
      searchOptions: {
        boost: { keywords: 5, title: 3 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
    // правила общие для всех серверов; docId уникален между категориями
    this.ruleIndex = new MiniSearch<RuleHit>({
      idField: "docId",
      fields: ["title", "text", "forOfficer", "tags", "code", "categoryTitle"],
      extractField,
      processTerm: normalizeTerm,
      searchOptions: {
        boost: { title: 4, tags: 4, categoryTitle: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });

    const rules = flattenRules();
    this.articleIndex.addAll(bundle.articles);
    this.scenarioIndex.addAll(bundle.scenarios);
    this.ruleIndex.addAll(rules);
    for (const a of bundle.articles) this.articleById.set(a.id, a);
    for (const s of bundle.scenarios) this.scenarioById.set(s.id, s);
    for (const r of rules) this.ruleById.set(r.docId, r);
  }

  search(query: string): SearchResults {
    if (!query.trim()) return { scenarios: [], rules: [], articles: [] };
    // ищем по исходному запросу и по варианту, перебитому из EN-раскладки,
    // затем сливаем результаты по лучшему score
    const variants = queryVariants(query)
      .map((v) => expandQuery(v))
      .filter((v) => v.trim());
    if (variants.length === 0) return { scenarios: [], rules: [], articles: [] };

    return {
      scenarios: mergeSearch(this.scenarioIndex, variants, MAX_SCENARIOS, this.scenarioById),
      rules: mergeSearch(this.ruleIndex, variants, MAX_RULES, this.ruleById),
      articles: mergeSearch(this.articleIndex, variants, MAX_ARTICLES, this.articleById),
    };
  }
}

function mergeSearch<T>(
  index: MiniSearch<T>,
  variants: string[],
  limit: number,
  byId: Map<string, T>,
): Scored<T>[] {
  const best = new Map<string, { score: number; terms: Set<string> }>();
  for (const variant of variants) {
    for (const result of index.search(variant)) {
      const id = result.id as string;
      const prev = best.get(id);
      if (!prev) {
        best.set(id, { score: result.score, terms: new Set(result.terms) });
      } else {
        prev.score = Math.max(prev.score, result.score);
        for (const t of result.terms) prev.terms.add(t);
      }
    }
  }
  const sorted = [...best.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, limit);
  // опорный score — ВТОРОЙ результат: один аномально жирный топ (статья,
  // где искомое слово встречается десятки раз) не должен утаскивать
  // нормальные результаты в «слабые»
  const refScore = sorted[Math.min(1, sorted.length - 1)]?.[1].score ?? 0;
  const out: Scored<T>[] = [];
  for (const [id, { score, terms }] of sorted) {
    const item = byId.get(id);
    if (!item) continue;
    out.push({ item, score, weak: score < refScore * WEAK_RATIO, matchedTerms: [...terms] });
  }
  return out;
}
