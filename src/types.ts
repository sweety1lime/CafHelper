// Кодексы законодательной базы Majestic RP (+ отдельные законы штата)
export type CodexId = "criminal" | "procedural" | "administrative" | "traffic" | "laws";

// nav — короткая подпись под аббревиатурой на кнопках вкладки «Кодексы»
export const CODEX_LABELS: Record<CodexId, { short: string; full: string; nav: string }> = {
  criminal: { short: "УК", full: "Уголовный кодекс", nav: "Уголовный" },
  procedural: { short: "ПК", full: "Процессуальный кодекс", nav: "Процесс." },
  administrative: { short: "КоАП", full: "Административный кодекс", nav: "Админ." },
  traffic: { short: "ДК", full: "Дорожный кодекс", nav: "Дорожный" },
  laws: { short: "Закон", full: "Законы и Конституция штата", nav: "Законы" },
};

export const CODEX_IDS: CodexId[] = ["criminal", "procedural", "administrative", "traffic", "laws"];

// Статья кодекса (плоская, после загрузки из JSON)
export interface Article {
  id: string; // `${codex}-${number}`
  codex: CodexId;
  chapter: string;
  number: string;
  title: string;
  text: string;
  punishment?: string;
  priority?: string; // приоритет розыска (УК)
  flags?: string; // F/R/CR — федеральная/розыск/через суд
  tags: string[];
}

// Формат файла кодекса в data/servers/<id>/<codex>.json
export interface CodexFile {
  codex: CodexId;
  name: string;
  updated: string;
  // true = текст не сверен с форумом сервера, в UI показывается предупреждение
  draft?: boolean;
  chapters: {
    title: string;
    articles: {
      number: string;
      title: string;
      text: string;
      punishment?: string;
      priority?: string;
      flags?: string;
      tags?: string[];
    }[];
  }[];
}

export interface ArticleRef {
  codex: CodexId;
  number: string;
  note?: string;
  // автоперенос с другого сервера не сверен человеком — UI показывает ⚠
  unverified?: boolean;
}

// Карточка-сценарий: пошаговая подсказка для типовой ситуации
export interface Scenario {
  id: string;
  title: string;
  keywords: string[];
  situation: string;
  steps: string[];
  articleRefs: ArticleRef[];
  phrases: string[]; // готовые реплики для копирования в чат
  pitfalls: string[]; // на чём ловят адвокаты
}

// Быстрая фраза — копируется в чат одним кликом с вкладки «Поиск»
export interface QuickPhrase {
  label: string;
  text: string;
}

export interface ScenarioFile {
  updated: string;
  // true = сценарии адаптированы скриптом с другого сервера и не сверены человеком
  draft?: boolean;
  quickPhrases?: QuickPhrase[];
  scenarios: Scenario[];
}

export interface ServerInfo {
  id: string;
  name: string;
  hasData: boolean;
}

// Мастер ситуаций: дерево «что происходит?» -> чипы -> собранный ответ.
// Общий для всех серверов: ссылается только на id сценариев и label быстрых
// фраз; номера статей живут в серверных scenarios.json (см. validate-data.mjs)
export interface WizardAnswerData {
  title: string;
  scenarioIds: string[];
  tips?: string[]; // сервер-нейтральные подсказки, БЕЗ номеров статей
  phraseLabels?: string[]; // ссылки на quickPhrases по label
}

export interface WizardOption {
  id: string;
  label: string;
  next?: string; // id следующего узла…
  answer?: WizardAnswerData; // …или готовый ответ (лист)
}

export interface WizardNode {
  id: string;
  question: string;
  options: WizardOption[];
}

export interface WizardFile {
  version: number;
  root: string;
  nodes: WizardNode[];
}

export interface SynonymGroup {
  terms: string[]; // жаргон, как пишет пользователь
  expand: string[]; // канонические слова, встречающиеся в текстах статей
}

// Всё, что нужно приложению для одного сервера
export interface ServerDataBundle {
  serverId: string;
  articles: Article[];
  scenarios: Scenario[];
  quickPhrases: QuickPhrase[];
  codexNames: Partial<Record<CodexId, string>>;
  updated: string;
  draft: boolean;
}

// ── Пины: закреплённый контент в отдельном мини-окне со своим хоткеем ──

// Снимок статьи для пина — самодостаточный, чтобы окну не грузить бандл сервера.
// articleId хранится ради будущего «обновить снимок» из свежей базы.
export interface PinnedArticle {
  articleId: string;
  ref: string; // готовая строка articleShortRef()
  text?: string;
  punishment?: string;
}

export interface PinBase {
  id: string; // часть label окна (`pin-<id>`), уникальна
  title: string;
  hotkey?: string; // глобальный хоткей показа/скрытия; пусто = только вручную
  autoHide?: boolean; // прятать при клике в игру (по умолчанию пины «липкие»)
}

export type Pin =
  | (PinBase & { kind: "phrase"; text: string })
  | (PinBase & { kind: "articles"; serverId: string; items: PinnedArticle[] });

export type PinKind = Pin["kind"];

// ── Правила проекта (OOC/RP): ограбления, похищения, DM/RK/PG и т.п. ──
// Общие для всех серверов, живут в data/common/rules.json.

export interface Rule {
  id: string;
  code?: string; // номер пункта в правилах, напр. "5.1", "3.5"
  title: string;
  text: string; // дословный текст (определение + исключения/примечания)
  punishment?: string; // мера: «Demorgan 120 мин / WARN / Ban 3-30 дней»
  forOfficer?: string; // угол сотрудника: как реагировать / это жалоба
  tags?: string[];
}

export interface RuleCategory {
  id: string;
  title: string;
  source: string; // ссылка на тему форума с оригиналом
  intro?: string;
  rules: Rule[];
}

export interface RulesFile {
  updated: string;
  categories: RuleCategory[];
}
