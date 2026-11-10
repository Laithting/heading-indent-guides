'use strict';

const obsidian = require('obsidian');
const { Plugin, PluginSettingTab, Setting } = obsidian;
const { ViewPlugin, Decoration, layer, RectangleMarker } = require('@codemirror/view');
const { RangeSetBuilder } = require('@codemirror/state');

// 設定頁面文字。預設跟著 Obsidian 的介面語言，沒有翻譯的語言顯示英文。
// key 用小寫，對應 Obsidian 的語言代碼（getLanguage() 或 moment 語系）。
const STRINGS = {
  en: {
    name: 'English',
    language: 'Settings language',
    languageDesc: 'Language of this settings page. Auto follows the Obsidian interface language.',
    auto: 'Auto',
    guides: 'Vertical guide lines',
    guidesDesc: 'Draw a vertical line to the left of the content under each heading level.',
    headings: 'Clearer headings',
    headingsDesc: 'Make heading sizes and weights more distinct, and underline H1.',
    highest: 'Treat the highest heading as H1',
    highestDesc: 'If a note only uses ## and below, ## becomes the first level, so nothing is indented by an extra step.',
    indents: 'Indent per level (px)',
    under: (n) => `Content under H${n}`,
    perNote: 'To turn indentation off for one note, add heading-indent: false to its frontmatter.',
  },
  'zh-tw': {
    name: '繁體中文',
    language: '設定頁面語言',
    languageDesc: '這個設定頁面的語言。「自動」會跟著 Obsidian 的介面語言。',
    auto: '自動',
    guides: '垂直參考線',
    guidesDesc: '在每一層標題底下的內文左邊畫直線。',
    headings: '加大標題差異',
    headingsDesc: '調大各級標題的字體大小和粗細，並在 H1 下方加底線。',
    highest: '把最大的標題當成 H1',
    highestDesc: '例如整篇筆記最大只用到 ##，就把 ## 當第一層，不會多縮一格。',
    indents: '各層縮排（px）',
    under: (n) => `H${n} 底下的內文`,
    perNote: '單篇筆記想關掉縮排：在 frontmatter 加上 heading-indent: false。',
  },
  zh: {
    name: '简体中文',
    language: '设置页面语言',
    languageDesc: '此设置页面的语言。“自动”会跟随 Obsidian 的界面语言。',
    auto: '自动',
    guides: '垂直参考线',
    guidesDesc: '在每一级标题下方内容的左侧画一条竖线。',
    headings: '加大标题差异',
    headingsDesc: '加大各级标题的字号和粗细差异，并在 H1 下方加下划线。',
    highest: '把最高级标题当作 H1',
    highestDesc: '例如笔记最高只用到 ##，就把 ## 当作第一级，不会多缩进一级。',
    indents: '各级缩进（px）',
    under: (n) => `H${n} 下方的内容`,
    perNote: '要关闭单篇笔记的缩进：在 frontmatter 中加入 heading-indent: false。',
  },
  ja: {
    name: '日本語',
    language: '設定画面の言語',
    languageDesc: 'この設定画面の言語です。「自動」は Obsidian の表示言語に合わせます。',
    auto: '自動',
    guides: '縦のガイド線',
    guidesDesc: '各見出しレベルの本文の左側に縦線を表示します。',
    headings: '見出しを見分けやすくする',
    headingsDesc: '見出しの文字サイズと太さの差を大きくし、H1 に下線を引きます。',
    highest: '最上位の見出しを H1 として扱う',
    highestDesc: 'ノートで ## 以下しか使っていない場合、## を第 1 レベルとして扱い、余分にインデントしません。',
    indents: 'レベルごとのインデント（px）',
    under: (n) => `H${n} の下の本文`,
    perNote: '特定のノートでインデントを無効にするには、frontmatter に heading-indent: false を追加します。',
  },
  ko: {
    name: '한국어',
    language: '설정 화면 언어',
    languageDesc: '이 설정 화면의 언어입니다. "자동"은 Obsidian 인터페이스 언어를 따릅니다.',
    auto: '자동',
    guides: '세로 안내선',
    guidesDesc: '각 제목 수준 아래 내용의 왼쪽에 세로선을 표시합니다.',
    headings: '제목 구분 강화',
    headingsDesc: '제목의 글자 크기와 굵기 차이를 키우고 H1에 밑줄을 긋습니다.',
    highest: '가장 높은 제목을 H1로 취급',
    highestDesc: '노트에서 ## 이하만 사용하면 ##을 첫 번째 수준으로 취급해 한 단계 더 들여쓰지 않습니다.',
    indents: '수준별 들여쓰기(px)',
    under: (n) => `H${n} 아래 내용`,
    perNote: '특정 노트에서 들여쓰기를 끄려면 frontmatter에 heading-indent: false를 추가하세요.',
  },
  es: {
    name: 'Español',
    language: 'Idioma de la configuración',
    languageDesc: 'Idioma de esta página de configuración. Automático sigue el idioma de la interfaz de Obsidian.',
    auto: 'Automático',
    guides: 'Líneas guía verticales',
    guidesDesc: 'Dibuja una línea vertical a la izquierda del contenido de cada nivel de encabezado.',
    headings: 'Encabezados más claros',
    headingsDesc: 'Aumenta la diferencia de tamaño y grosor entre encabezados y subraya el H1.',
    highest: 'Tratar el encabezado más alto como H1',
    highestDesc: 'Si una nota solo usa ## o niveles inferiores, ## pasa a ser el primer nivel y nada se sangra de más.',
    indents: 'Sangría por nivel (px)',
    under: (n) => `Contenido bajo H${n}`,
    perNote: 'Para desactivar la sangría en una nota, añade heading-indent: false a su frontmatter.',
  },
  fr: {
    name: 'Français',
    language: 'Langue des paramètres',
    languageDesc: 'Langue de cette page de paramètres. Automatique suit la langue de l’interface d’Obsidian.',
    auto: 'Automatique',
    guides: 'Lignes guides verticales',
    guidesDesc: 'Trace une ligne verticale à gauche du contenu de chaque niveau de titre.',
    headings: 'Titres plus distincts',
    headingsDesc: 'Accentue les différences de taille et de graisse entre les titres et souligne le H1.',
    highest: 'Traiter le titre le plus haut comme H1',
    highestDesc: 'Si une note n’utilise que ## et les niveaux inférieurs, ## devient le premier niveau, sans retrait supplémentaire.',
    indents: 'Retrait par niveau (px)',
    under: (n) => `Contenu sous H${n}`,
    perNote: 'Pour désactiver le retrait dans une note, ajoutez heading-indent: false à son frontmatter.',
  },
  de: {
    name: 'Deutsch',
    language: 'Sprache der Einstellungen',
    languageDesc: 'Sprache dieser Einstellungsseite. Automatisch folgt der Sprache der Obsidian-Oberfläche.',
    auto: 'Automatisch',
    guides: 'Vertikale Hilfslinien',
    guidesDesc: 'Zeichnet links neben dem Inhalt jeder Überschriftenebene eine senkrechte Linie.',
    headings: 'Deutlichere Überschriften',
    headingsDesc: 'Vergrößert die Unterschiede in Schriftgröße und -stärke zwischen Überschriften und unterstreicht H1.',
    highest: 'Höchste Überschrift als H1 behandeln',
    highestDesc: 'Verwendet eine Notiz nur ## und tiefer, wird ## zur ersten Ebene, sodass nichts zusätzlich eingerückt wird.',
    indents: 'Einzug pro Ebene (px)',
    under: (n) => `Inhalt unter H${n}`,
    perNote: 'Um den Einzug für eine Notiz auszuschalten, füge heading-indent: false zu ihrem Frontmatter hinzu.',
  },
  'pt-br': {
    name: 'Português (Brasil)',
    language: 'Idioma das configurações',
    languageDesc: 'Idioma desta página de configurações. Automático segue o idioma da interface do Obsidian.',
    auto: 'Automático',
    guides: 'Linhas-guia verticais',
    guidesDesc: 'Desenha uma linha vertical à esquerda do conteúdo de cada nível de título.',
    headings: 'Títulos mais distintos',
    headingsDesc: 'Aumenta a diferença de tamanho e peso entre os títulos e sublinha o H1.',
    highest: 'Tratar o título mais alto como H1',
    highestDesc: 'Se uma nota usa apenas ## ou níveis abaixo, ## vira o primeiro nível e nada recebe recuo extra.',
    indents: 'Recuo por nível (px)',
    under: (n) => `Conteúdo sob H${n}`,
    perNote: 'Para desativar o recuo em uma nota, adicione heading-indent: false ao frontmatter dela.',
  },
  ru: {
    name: 'Русский',
    language: 'Язык настроек',
    languageDesc: 'Язык этой страницы настроек. «Автоматически» — как в интерфейсе Obsidian.',
    auto: 'Автоматически',
    guides: 'Вертикальные направляющие',
    guidesDesc: 'Рисует вертикальную линию слева от содержимого каждого уровня заголовков.',
    headings: 'Более заметные заголовки',
    headingsDesc: 'Увеличивает разницу в размере и насыщенности заголовков и подчёркивает H1.',
    highest: 'Считать самый высокий заголовок H1',
    highestDesc: 'Если в заметке используются только ## и ниже, ## становится первым уровнем, и лишнего отступа не будет.',
    indents: 'Отступ для каждого уровня (px)',
    under: (n) => `Содержимое под H${n}`,
    perNote: 'Чтобы отключить отступы в одной заметке, добавьте heading-indent: false во frontmatter.',
  },
};

// moment 的語系代碼跟 Obsidian 的不完全一樣
const LANGUAGE_ALIASES = { 'zh-cn': 'zh', 'zh-hk': 'zh-tw', pt: 'pt-br' };

function interfaceLanguage() {
  // 舊版 Obsidian 沒有 getLanguage，改看 moment 的語系（Obsidian 會跟介面語言同步）
  return typeof obsidian.getLanguage === 'function' ? obsidian.getLanguage() : obsidian.moment.locale();
}

function strings(choice) {
  let lang = String(choice && choice !== 'auto' ? choice : interfaceLanguage()).toLowerCase();
  lang = LANGUAGE_ALIASES[lang] || lang;
  return STRINGS[lang] || STRINGS[lang.split('-')[0]] || STRINGS.en;
}

const DEFAULT_SETTINGS = {
  indents: [30, 50, 70, 90, 110, 130], // H1~H6 底下內文的縮排（px）
  treatHighestAsH1: true,              // 把筆記裡最大的標題當成 H1
  showGuides: true,                    // 垂直參考線
  styleHeadings: true,                 // 加大各級標題的大小、粗細差異
  language: 'auto',                    // 設定頁面語言
};

const DEPTH_CLASSES = ['hli-d1', 'hli-d2', 'hli-d3', 'hli-d4', 'hli-d5', 'hli-d6', 'hli-head', 'hli-data'];
const HEADING_RE = /^(#{1,6})(?:[ \t]|$)/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * 掃描整份 Markdown，找出所有標題（略過 frontmatter 和程式碼區塊）。
 * 回傳 { headings: [{ line, level }], disabled }，line 從 0 起算。
 */
function scanHeadings(text, treatHighestAsH1) {
  const lines = text.split('\n');
  const headings = [];
  let disabled = false;
  let i = 0;

  if (lines[0] !== undefined && lines[0].trimEnd() === '---') {
    for (i = 1; i < lines.length && lines[i].trimEnd() !== '---'; i++) {
      if (/^heading-indent:\s*false\s*$/.test(lines[i])) disabled = true;
    }
    i++;
  }

  let fence = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const f = FENCE_RE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1]) fence = null;
      continue;
    }
    if (f) {
      fence = f[1];
      continue;
    }
    const h = HEADING_RE.exec(line);
    if (h) headings.push({ line: i, level: h[1].length });
  }

  if (treatHighestAsH1 && headings.length) {
    const top = Math.min(...headings.map((h) => h.level));
    for (const h of headings) h.level -= top - 1;
  }
  return { headings, disabled };
}

/**
 * 某一行該往右推幾層。標題行推到上一層的位置，內文推到所屬標題的層級。
 */
function depthAt(scan, lineNo) {
  const { headings } = scan;
  let lo = 0;
  let hi = headings.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (headings[mid].line <= lineNo) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return { depth: 0, isHeading: false };
  const h = headings[found];
  if (h.line === lineNo) return { depth: h.level - 1, isHeading: true };
  return { depth: h.level, isHeading: false };
}

function setDepthClasses(el, depth, isHeading) {
  el.classList.remove(...DEPTH_CLASSES);
  if (depth > 0) el.classList.add(`hli-d${depth}`, isHeading ? 'hli-head' : 'hli-data');
}

/**
 * 即時預覽 / 原始碼模式：用 CodeMirror 的 line decoration 加類別來縮排，
 * 垂直參考線則畫在獨立的圖層上，表格、標題、嵌入區塊旁邊也能連續顯示。
 */
function livePreviewExtension(plugin) {
  const decos = {};
  for (let d = 1; d <= 6; d++) {
    decos[`${d}h`] = Decoration.line({ class: `hli-d${d} hli-head` });
    decos[`${d}d`] = Decoration.line({ class: `hli-d${d} hli-data` });
  }

  const indentPlugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.version = plugin.version;
        this.scan = scanHeadings(view.state.doc.toString(), plugin.settings.treatHighestAsH1);
        this.decorations = this.build(view);
        this.scheduleWidgets(view);
      }

      update(u) {
        const settingsChanged = this.version !== plugin.version;
        this.settingsChanged = settingsChanged;
        if (u.docChanged || settingsChanged) {
          this.version = plugin.version;
          this.scan = scanHeadings(u.state.doc.toString(), plugin.settings.treatHighestAsH1);
        }
        if (u.docChanged || u.viewportChanged || settingsChanged) {
          this.decorations = this.build(u.view);
        }
        this.scheduleWidgets(u.view);
      }

      build(view) {
        const builder = new RangeSetBuilder();
        if (this.scan.disabled) return builder.finish();
        const doc = view.state.doc;
        let lastFrom = -1;
        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = doc.lineAt(pos);
            if (line.from > lastFrom) {
              const { depth, isHeading } = depthAt(this.scan, line.number - 1);
              if (depth > 0) builder.add(line.from, line.from, decos[`${depth}${isHeading ? 'h' : 'd'}`]);
              lastFrom = line.from;
            }
            pos = line.to + 1;
          }
        }
        return builder.finish();
      }

      // 表格、callout、嵌入等區塊不是一般的行，另外直接在 DOM 上加類別
      scheduleWidgets(view) {
        if (this.pending) return;
        this.pending = true;
        requestAnimationFrame(() => {
          this.pending = false;
          if (!view.dom.isConnected) return;
          for (const el of view.contentDOM.children) {
            if (el.classList.contains('cm-line')) continue;
            let lineNo;
            try {
              lineNo = view.state.doc.lineAt(view.posAtDOM(el)).number - 1;
            } catch (e) {
              continue;
            }
            const { depth } = this.scan.disabled ? { depth: 0 } : depthAt(this.scan, lineNo);
            setDepthClasses(el, depth, false);
          }
        });
      }
    },
    { decorations: (v) => v.decorations }
  );

  const guideLayer = layer({
    above: false,
    class: 'hli-guide-layer',
    update(u) {
      const state = u.view.plugin(indentPlugin);
      return u.docChanged || u.viewportChanged || u.geometryChanged || u.heightChanged || (state && state.settingsChanged);
    },
    markers(view) {
      const state = view.plugin(indentPlugin);
      if (!state || state.scan.disabled || !plugin.settings.showGuides) return [];
      return guideMarkers(view, state.scan, plugin.settings.indents);
    },
  });

  return [indentPlugin, guideLayer];
}

/**
 * 每個標題的段落（到下一個同級或更高一級的標題為止）畫一條直線，
 * 位置在該層內文左邊 --hli-gap 的地方。只畫目前看得到的範圍。
 */
function guideMarkers(view, scan, indents) {
  const { headings } = scan;
  const doc = view.state.doc;
  const style = getComputedStyle(view.contentDOM);
  const gap = parseFloat(style.getPropertyValue('--hli-gap')) || 12;
  const width = parseFloat(style.getPropertyValue('--hli-w')) || 1;

  const scrollRect = view.scrollDOM.getBoundingClientRect();
  const baseLeft = scrollRect.left - view.scrollDOM.scrollLeft;
  const baseTop = scrollRect.top - view.scrollDOM.scrollTop;
  const left0 = view.contentDOM.getBoundingClientRect().left + parseFloat(style.paddingLeft) - baseLeft;
  const top0 = view.documentTop - baseTop;
  const { from: vpFrom, to: vpTo } = view.viewport;

  const markers = [];
  for (let i = 0; i < headings.length; i++) {
    const { line, level } = headings[i];
    if (level < 1 || level > 6) continue;
    let end = doc.lines - 1;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= level) {
        end = headings[j].line - 1;
        break;
      }
    }
    if (end <= line) continue;
    const from = Math.max(doc.line(line + 2).from, vpFrom);
    const to = Math.min(doc.line(end + 1).to, vpTo);
    if (from > to) continue;
    const top = view.lineBlockAt(from).top;
    const bottom = view.lineBlockAt(to).bottom;
    const x = left0 + indents[level - 1] - gap;
    markers.push(new RectangleMarker('hli-guide', x, top0 + top, width, bottom - top));
  }
  return markers;
}

module.exports = class HeadingIndentGuides extends Plugin {
  async onload() {
    this.version = 0;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.indents = [...this.settings.indents];
    this.applySettings();

    this.registerEditorExtension(livePreviewExtension(this));

    // 閱讀模式與 PDF 匯出：每個區塊依原始碼行號算出層級
    this.registerMarkdownPostProcessor((el, ctx) => {
      const info = ctx.getSectionInfo(el);
      if (!info) return;
      if (this.cachedText !== info.text || this.cachedVersion !== this.version) {
        this.cachedText = info.text;
        this.cachedVersion = this.version;
        this.cachedScan = scanHeadings(info.text, this.settings.treatHighestAsH1);
      }
      const scan = this.cachedScan;
      const { depth, isHeading } = scan.disabled ? { depth: 0, isHeading: false } : depthAt(scan, info.lineStart);
      setDepthClasses(el, depth, isHeading);
    });

    this.addSettingTab(new HeadingIndentGuidesSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => this.refreshViews());
  }

  onunload() {
    const body = document.body;
    for (let i = 1; i <= 6; i++) body.style.removeProperty(`--hli-${i}`);
    body.classList.remove('hli-guides', 'hli-heading-style');
    this.refreshViews();
  }

  applySettings() {
    const body = document.body;
    this.settings.indents.forEach((px, i) => body.style.setProperty(`--hli-${i + 1}`, `${px}px`));
    body.classList.toggle('hli-guides', this.settings.showGuides);
    body.classList.toggle('hli-heading-style', this.settings.styleHeadings);
  }

  refreshViews() {
    this.version++;
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (view.previewMode) view.previewMode.rerender(true);
      const cm = view.editor && view.editor.cm;
      if (cm) cm.dispatch({});
    }
  }

  async saveAndApply() {
    await this.saveData(this.settings);
    this.applySettings();
    this.refreshViews();
  }
};

class HeadingIndentGuidesSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const s = this.plugin.settings;
    containerEl.empty();
    const str = strings(s.language);

    new Setting(containerEl)
      .setName(str.language)
      .setDesc(str.languageDesc)
      .addDropdown((d) => {
        d.addOption('auto', str.auto);
        for (const [code, t] of Object.entries(STRINGS)) d.addOption(code, t.name);
        d.setValue(s.language).onChange(async (v) => {
          s.language = v;
          await this.plugin.saveData(s);
          this.display();
        });
      });

    new Setting(containerEl)
      .setName(str.guides)
      .setDesc(str.guidesDesc)
      .addToggle((t) => t.setValue(s.showGuides).onChange(async (v) => {
        s.showGuides = v;
        await this.plugin.saveAndApply();
      }));

    new Setting(containerEl)
      .setName(str.headings)
      .setDesc(str.headingsDesc)
      .addToggle((t) => t.setValue(s.styleHeadings).onChange(async (v) => {
        s.styleHeadings = v;
        await this.plugin.saveAndApply();
      }));

    new Setting(containerEl)
      .setName(str.highest)
      .setDesc(str.highestDesc)
      .addToggle((t) => t.setValue(s.treatHighestAsH1).onChange(async (v) => {
        s.treatHighestAsH1 = v;
        await this.plugin.saveAndApply();
      }));

    new Setting(containerEl).setName(str.indents).setHeading();
    s.indents.forEach((px, i) => {
      new Setting(containerEl)
        .setName(str.under(i + 1))
        .addText((t) => t.setPlaceholder(String(DEFAULT_SETTINGS.indents[i])).setValue(String(px)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (Number.isNaN(n) || n < 0) return;
          s.indents[i] = n;
          await this.plugin.saveAndApply();
        }));
    });

    containerEl.createEl('p', { text: str.perNote, cls: 'setting-item-description' });
  }
}
