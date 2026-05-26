// ===== element-scanner.js =====
// DOM 选择器 + 页面序列化工具
// 由 manifest.json 在 content.js 之前注入，暴露 window.ElementScanner

(function (global) {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  // CSS 选择器生成：返回能唯一定位元素的最短选择器
  // ──────────────────────────────────────────────────────────────
  function getSelector(el) {
    if (!el || el === document.body) return 'body';
    if (el === document.documentElement) return 'html';

    // 1. #id（仅当 ID 在整页唯一）
    if (el.id && /^[a-zA-Z_][\w-]*$/.test(el.id)) {
      try {
        if (document.querySelectorAll('#' + CSS.escape(el.id)).length === 1)
          return '#' + CSS.escape(el.id);
      } catch (_) {}
    }

    // 2. name 属性（表单元素）
    const nameAttr = el.getAttribute('name');
    if (nameAttr && /^[a-zA-Z]/.test(nameAttr)) {
      const sel = el.tagName.toLowerCase() + '[name="' + nameAttr.replace(/"/g, '\\"') + '"]';
      try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (_) {}
    }

    // 3. aria-label（短标签更稳定）
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.length < 60) {
      const sel = el.tagName.toLowerCase() + '[aria-label="' + ariaLabel.replace(/"/g, '\\"') + '"]';
      try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (_) {}
    }

    // 4. data-testid
    const testId = el.getAttribute('data-testid');
    if (testId) {
      const sel = '[data-testid="' + testId.replace(/"/g, '\\"') + '"]';
      try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (_) {}
    }

    // 5. class 组合（最多取前 2 个有效 class）
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/)
        .filter(c => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c));
      if (classes.length > 0) {
        const sel = el.tagName.toLowerCase() + '.' + classes.map(c => CSS.escape(c)).join('.');
        try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (_) {}
      }
    }

    // 6. 向上爬树构建 tag:nth-of-type 路径（最多 6 层）
    return _buildNthPath(el, 6);
  }

  // 为单个节点生成带类名（或 nth-of-type 兜底）的选择器片段
  function _segmentOf(node) {
    const tag     = node.tagName.toLowerCase();
    const classes = node.className && typeof node.className === 'string'
      ? node.className.trim().split(/\s+/).filter(c => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c))
      : [];
    if (classes.length > 0) {
      return tag + '.' + classes.map(c => CSS.escape(c)).join('.');
    }
    const parent = node.parentElement;
    if (!parent) return tag;
    const siblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
    if (siblings.length === 1) return tag;
    return tag + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
  }

  function _buildNthPath(el, maxLevels) {
    // 第一段固定为目标元素自身，确保最终选择器始终指向 el
    const parts = [_segmentOf(el)];

    let node   = el.parentElement;
    let levels = 0;
    while (node && node !== document.documentElement && levels < maxLevels) {
      parts.unshift(_segmentOf(node));
      const candidate = parts.join(' > ');
      try { if (document.querySelectorAll(candidate).length === 1) return candidate; } catch (_) {}
      node = node.parentElement;
      levels++;
    }
    return parts.join(' > ') || el.tagName.toLowerCase();
  }

  // ──────────────────────────────────────────────────────────────
  // 元素名称提取：返回可读名称供弹框显示
  // 优先级：aria-label → aria-labelledby → name → placeholder
  //          → title → alt → innerText → 最近 class → tag
  // ──────────────────────────────────────────────────────────────
  function getElementName(el) {
    if (!el) return '';

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const txt = labelledBy.split(/\s+/)
        .map(id => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean).join(' ');
      if (txt) return txt;
    }

    const nameAttr = el.getAttribute('name');
    if (nameAttr) return nameAttr;

    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder;

    const title = el.getAttribute('title');
    if (title) return title;

    const alt = el.getAttribute('alt');
    if (alt) return alt;

    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 0 && text.length <= 80) return text;
    if (text.length > 80) return text.slice(0, 80) + '\u2026';

    // 向上找第一个有意义的 class 名（返回所有有效类名，空格分隔）
    let node = el;
    while (node && node !== document.body) {
      if (node.className && typeof node.className === 'string') {
        const classes = node.className.trim().split(/\s+/)
          .filter(c => c.length > 3 && /^[a-zA-Z][a-zA-Z0-9-_]*$/.test(c));
        if (classes.length > 0) return classes.join('.');
      }
      node = node.parentElement;
    }

    return el.tagName.toLowerCase();
  }

  // ──────────────────────────────────────────────────────────────
  // DOM 序列化：生成供 LLM 阅读的简化 HTML
  // ──────────────────────────────────────────────────────────────
  const _SKIP_TAGS = new Set([
    'script', 'style', 'noscript', 'template', 'svg', 'defs',
    'canvas', 'video', 'audio', 'head', 'meta', 'link',
  ]);
  const _KEEP_ATTRS = new Set([
    'id', 'name', 'type', 'href', 'placeholder', 'aria-label',
    'aria-labelledby', 'aria-describedby', 'role', 'value', 'for',
    'action', 'method', 'disabled', 'checked', 'selected',
    'data-testid', 'tabindex', 'alt', 'title',
  ]);
  const _VOID_TAGS = new Set([
    'input', 'img', 'br', 'hr', 'area', 'base', 'col',
    'embed', 'param', 'source', 'track', 'wbr',
  ]);
  const _KEEP_EMPTY_TAGS = new Set([
    'button', 'a', 'input', 'select', 'textarea', 'iframe',
    'main', 'nav', 'header', 'footer', 'aside', 'section', 'dialog', 'form',
  ]);

  function _serializeNode(node, depth, maxDepth) {
    if (depth > maxDepth) return '';
    const pad = '  '.repeat(depth);

    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent.replace(/\s+/g, ' ').trim();
      if (!t) return '';
      return pad + (t.length > 120 ? t.slice(0, 120) + '\u2026' : t);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    if (_SKIP_TAGS.has(tag)) return '';

    const attrs = [];
    for (const attr of node.attributes) {
      if (_KEEP_ATTRS.has(attr.name)) {
        const v = attr.value.replace(/"/g, '&quot;').slice(0, 100);
        attrs.push(attr.name + '="' + v + '"');
      } else if (attr.name === 'class') {
        const cls = attr.value.trim().split(/\s+/)
          .filter(c => /^[a-zA-Z]/.test(c)).slice(0, 3).join(' ');
        if (cls) attrs.push('class="' + cls + '"');
      }
    }
    const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';

    if (_VOID_TAGS.has(tag)) return pad + '<' + tag + attrStr + ' />';

    const childLines = [];
    for (const child of node.childNodes) {
      const s = _serializeNode(child, depth + 1, maxDepth);
      if (s) childLines.push(s);
    }
    if (node.shadowRoot) {
      const s = _serializeNode(node.shadowRoot, depth + 1, maxDepth);
      if (s) childLines.push(s);
    }

    const inner = childLines.join('\n');
    if (!inner.trim()) {
      // 保留：在 _KEEP_EMPTY_TAGS 中、有 role、有 aria-label、或有 class（如图标 <i>）
      const hasClass = attrs.some(a => a.startsWith('class='));
      if (!_KEEP_EMPTY_TAGS.has(tag) && !node.getAttribute('role') && !node.getAttribute('aria-label') && !hasClass)
        return '';
      return pad + '<' + tag + attrStr + '></' + tag + '>';
    }
    return pad + '<' + tag + attrStr + '>\n' + inner + '\n' + pad + '</' + tag + '>';
  }

  function getPageDOM(maxDepth, maxChars) {
    maxDepth = maxDepth || 14;
    maxChars = maxChars || 400000;
    try {
      const html = _serializeNode(document.body, 0, maxDepth);
      return html.slice(0, maxChars);
    } catch (e) {
      return '<!-- DOM 序列化失败: ' + e.message + ' -->';
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 执行 Action — 使用 action.selector（CSS 选择器字符串）定位
  // 支持：click, double_click, right_click, type, select,
  //        navigate, scroll, hover, focus, clear, key
  // click/double_click/right_click/key 均支持可选 modifiers 数组
  //   例：["ctrl"] ["shift"] ["ctrl","shift"]
  // key 的 selector 可省略，省略时作用于当前焦点元素
  // ──────────────────────────────────────────────────────────────
  async function executeAction(action) {
    const { type } = action;

    function resolveEl() {
      if (action.selector) {
        try { return document.querySelector(action.selector); } catch (_) {}
      }
      return null;
    }

    // ── 无需 DOM 元素的操作 ─────────────────────────────────────
    if (type === 'navigate') {
      location.href = action.url;
      return;
    }
    if (type === 'scroll') {
      const by = action.y != null ? action.y : 300;
      window.scrollBy(action.x || 0, by);
      return;
    }
    // key：selector 可选，省略则作用于当前焦点元素
    if (type === 'key') {
      const target = (action.selector ? resolveEl() : null)
                     || document.activeElement
                     || document.body;
      const mods = action.modifiers || [];
      const keyOpts = {
        key:      action.key,
        bubbles:  true,
        cancelable: true,
        ctrlKey:  mods.includes('ctrl'),
        shiftKey: mods.includes('shift'),
        altKey:   mods.includes('alt'),
        metaKey:  mods.includes('meta'),
      };
      target.dispatchEvent(new KeyboardEvent('keydown',  keyOpts));
      target.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
      target.dispatchEvent(new KeyboardEvent('keyup',    keyOpts));
      return;
    }

    // ── 需要 DOM 元素的操作 ─────────────────────────────────────
    const el = resolveEl();
    if (!el) throw new Error('Element not found: ' + JSON.stringify(action.selector));

    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 200));

    switch (type) {
      case 'click': {
        const mods = action.modifiers || [];
        const opts = {
          bubbles: true, cancelable: true,
          ctrlKey:  mods.includes('ctrl'),
          shiftKey: mods.includes('shift'),
          altKey:   mods.includes('alt'),
          metaKey:  mods.includes('meta'),
        };
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.dispatchEvent(new MouseEvent('mouseup',   opts));
        if (mods.length > 0) {
          // 有修饰键时用 dispatchEvent 传递修饰状态（el.click() 不支持）
          el.dispatchEvent(new MouseEvent('click', opts));
        } else {
          el.click();  // 无修饰键保持原生 click() 确保触发默认行为
        }
        break;
      }

      case 'double_click': {
        const mods = action.modifiers || [];
        const opts = {
          bubbles: true, cancelable: true, detail: 2,
          ctrlKey:  mods.includes('ctrl'),
          shiftKey: mods.includes('shift'),
          altKey:   mods.includes('alt'),
          metaKey:  mods.includes('meta'),
        };
        el.dispatchEvent(new MouseEvent('mousedown', { ...opts, detail: 1 }));
        el.dispatchEvent(new MouseEvent('mouseup',   { ...opts, detail: 1 }));
        el.dispatchEvent(new MouseEvent('click',     { ...opts, detail: 1 }));
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.dispatchEvent(new MouseEvent('mouseup',   opts));
        el.dispatchEvent(new MouseEvent('dblclick',  opts));
        break;
      }

      case 'right_click':
        el.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true, cancelable: true, button: 2,
        }));
        break;

      case 'type':
        el.focus();
        if ('value' in el) {
          el.value = '';
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          el.value = action.text || '';
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.isContentEditable) {
          el.textContent = action.text || '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        break;

      case 'select':
        if (el.tagName === 'SELECT') {
          const opt = Array.from(el.options)
            .find(o => o.value === action.value || o.text === action.value);
          if (opt) {
            opt.selected = true;
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        break;

      case 'hover':
        el.dispatchEvent(new MouseEvent('mouseover',  { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        break;

      case 'focus':
        el.focus();
        break;

      case 'clear':
        if ('value' in el) {
          el.value = '';
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;

      default:
        throw new Error('Unknown action type: ' + type);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 导出
  // ──────────────────────────────────────────────────────────────
  global.ElementScanner = {
    getSelector,
    getElementName,
    getPageDOM,
    executeAction,
  };

  console.log('[ElementScanner] DOM Picker v4 loaded');

})(typeof window !== 'undefined' ? window : globalThis);
