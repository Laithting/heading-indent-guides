'use strict';

const obsidian = require('obsidian');
const { Plugin, PluginSettingTab, Setting } = obsidian;
const { ViewPlugin, Decoration, layer, RectangleMarker } = require('@codemirror/view');
const { RangeSetBuilder } = require('@codemirror/state');

// 設定頁面文字：Obsidian 介面是繁體中文時顯示中文，其他語言顯示英文
const STRINGS = {
  en: {
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
  'zh-TW': {
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
};

function strings() {
  const lang = typeof obsidian.getLanguage === 'function' ? obsidian.getLanguage() : window.localStorage.getItem('language');
  return STRINGS[lang] || STRINGS.en;
}

const DEFAULT_SETTINGS = {
  indents: [30, 50, 70, 90, 110, 130], // H1~H6 底下內文的縮排（px）
  treatHighestAsH1: true,              // 把筆記裡最大的標題當成 H1
  showGuides: true,                    // 垂直參考線
  styleHeadings: true,                 // 加大各級標題的大小、粗細差異
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
    const str = strings();

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
