// ===== content.js =====
// 处理来自 panel.js / background.js 的消息
// 依赖 element-scanner.js（先于本文件注入）

(function () {
  'use strict';

  // ── 模块状态 ─────────────────────────────────────────────────
  let _lastRightClickedEl = null;  // 最后一次右键点击的目标元素
  let _pickerActive       = false; // 元素选取器是否激活

  // ── 记录右键目标 ─────────────────────────────────────────────
  document.addEventListener('contextmenu', (e) => {
    _lastRightClickedEl = e.target;
  }, true);

  // ═══════════════════════════════════════════════════════════════
  // 元素选取器（类 F12 选择模式）
  // ═══════════════════════════════════════════════════════════════

  let _highlightBox = null;
  let _tooltip      = null;

  function _ensureOverlay() {
    if (!_highlightBox) {
      _highlightBox = document.createElement('div');
      _highlightBox.id = '_ma_picker_box';
      _highlightBox.style.cssText = [
        'position:fixed',
        'pointer-events:none',
        'z-index:2147483646',
        'outline:2px solid #1a73e8',
        'background:rgba(26,115,232,0.10)',
        'border-radius:2px',
        'transition:all 60ms ease',
        'display:none',
      ].join(';');
      document.documentElement.appendChild(_highlightBox);
    }
    if (!_tooltip) {
      _tooltip = document.createElement('div');
      _tooltip.id = '_ma_picker_tip';
      _tooltip.style.cssText = [
        'position:fixed',
        'pointer-events:none',
        'z-index:2147483647',
        'background:#202124',
        'color:#e8eaed',
        'font-size:12px',
        'font-family:monospace',
        'padding:4px 8px',
        'border-radius:4px',
        'max-width:400px',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'display:none',
        'box-shadow:0 2px 8px rgba(0,0,0,0.4)',
      ].join(';');
      document.documentElement.appendChild(_tooltip);
    }
  }

  function _updateHighlight(el) {
    if (!el || el === document.documentElement || el === document.body) return;
    _ensureOverlay();
    const rect = el.getBoundingClientRect();
    _highlightBox.style.left   = rect.left   + 'px';
    _highlightBox.style.top    = rect.top    + 'px';
    _highlightBox.style.width  = rect.width  + 'px';
    _highlightBox.style.height = rect.height + 'px';
    _highlightBox.style.display = 'block';

    const name     = ElementScanner.getElementName(el);
    const selector = ElementScanner.getSelector(el);
    _tooltip.textContent = el.tagName.toLowerCase() + ' \u00b7 ' + name + ' \u00b7 ' + selector;

    // 将 tooltip 放在元素上方或下方（避免超出视窗）
    const tipTop = rect.top > 30 ? rect.top - 26 : rect.bottom + 4;
    _tooltip.style.left    = Math.max(4, rect.left) + 'px';
    _tooltip.style.top     = tipTop + 'px';
    _tooltip.style.display = 'block';
  }

  function _hideHighlight() {
    if (_highlightBox) _highlightBox.style.display = 'none';
    if (_tooltip)      _tooltip.style.display      = 'none';
  }

  // 事件处理器（用变量存储以便 removeEventListener）
  function _onPickerMouseover(e) {
    if (!_pickerActive) return;
    e.stopPropagation();
    _updateHighlight(e.target);
  }

  function _onPickerClick(e) {
    if (!_pickerActive) return;
    e.preventDefault();
    e.stopPropagation();
    _deactivatePicker();
    _showElementInfoDialog(e.target);
  }

  function _onPickerKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      _deactivatePicker();
    }
  }

  function _activatePicker() {
    if (_pickerActive) return;
    _pickerActive = true;
    _ensureOverlay();
    document.documentElement.style.cursor = 'crosshair';
    document.addEventListener('mouseover', _onPickerMouseover, true);
    document.addEventListener('click',     _onPickerClick,     true);
    document.addEventListener('keydown',   _onPickerKeydown,   true);
    console.log('[Chromium] 元素选取器已激活，点击元素查看信息，ESC 退出');
  }

  function _deactivatePicker() {
    if (!_pickerActive) return;
    _pickerActive = false;
    document.documentElement.style.cursor = '';
    document.removeEventListener('mouseover', _onPickerMouseover, true);
    document.removeEventListener('click',     _onPickerClick,     true);
    document.removeEventListener('keydown',   _onPickerKeydown,   true);
    _hideHighlight();
  }

  // ═══════════════════════════════════════════════════════════════
  // 元素信息弹框（显示 name + selector + 复制按钮）
  // ═══════════════════════════════════════════════════════════════

  function _escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _showElementInfoDialog(el) {
    if (!el) return;
    document.getElementById('_ma_info_overlay')?.remove();

    const name     = ElementScanner.getElementName(el);
    const selector = ElementScanner.getSelector(el);
    const tag      = el.tagName.toLowerCase();
    const id       = el.id ? '#' + el.id : '';
    const cls      = typeof el.className === 'string'
      ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).map(c => '.' + c).join('')
      : '';

    // 根据元素类型构建 ACTION 模板列表
    const isInputEl  = ['input', 'textarea'].includes(tag);
    const isSelectEl = tag === 'select';

    // 按优先级构建 selector 变体列表：id > name > aria-label > data-testid > class
    const _escAV = v => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const selectorVariants = [];
    if (el.id && /^[a-zA-Z_][\w-]*$/.test(el.id)) {
      try {
        if (document.querySelectorAll('#' + CSS.escape(el.id)).length === 1)
          selectorVariants.push({ attr: 'id', sel: '#' + el.id });
      } catch (e) {}
    }
    const _nameAttr = el.getAttribute('name');
    if (_nameAttr && /^[a-zA-Z]/.test(_nameAttr))
      selectorVariants.push({ attr: 'name', sel: tag + '[name="' + _escAV(_nameAttr) + '"]' });
    const _ariaLabel = el.getAttribute('aria-label');
    if (_ariaLabel && _ariaLabel.length < 60)
      selectorVariants.push({ attr: 'aria-label', sel: tag + '[aria-label="' + _escAV(_ariaLabel) + '"]' });
    const _testId = el.getAttribute('data-testid');
    if (_testId)
      selectorVariants.push({ attr: 'data-testid', sel: '[data-testid="' + _escAV(_testId) + '"]' });
    const _varCls = typeof el.className === 'string'
      ? el.className.trim().split(/\s+/).filter(c => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c)).slice(0, 2)
      : [];
    if (_varCls.length > 0)
      selectorVariants.push({ attr: 'class', sel: tag + '.' + _varCls.join('.') });
    if (selectorVariants.length === 0)
      selectorVariants.push({ attr: 'selector', sel: selector });

    // 每个变体生成一组 action 行
    const variantGroups = selectorVariants.map((variant, vi) => ({
      attr: variant.attr,
      rows: [
        { id: '_ma_act_' + vi + '_c', label: I18n.t('picker_act_click'),  action: { type: 'click',  selector: variant.sel } },
        ...(isInputEl ? [
          { id: '_ma_act_' + vi + '_t', label: I18n.t('picker_act_type'),  action: { type: 'type',   selector: variant.sel, text: '' } },
          { id: '_ma_act_' + vi + '_x', label: I18n.t('picker_act_clear'), action: { type: 'clear',  selector: variant.sel } },
        ] : []),
        ...(isSelectEl ? [
          { id: '_ma_act_' + vi + '_s', label: I18n.t('picker_act_select'), action: { type: 'select', selector: variant.sel, value: '' } },
        ] : []),
        { id: '_ma_act_' + vi + '_h', label: I18n.t('picker_act_hover'),  action: { type: 'hover',  selector: variant.sel } },
      ],
    }));

    const actionGroupsHtml = variantGroups.map(group => {
      const rowsHtml = group.rows.map(item => {
        const str = '<ACTION>' + JSON.stringify(item.action) + '</ACTION>';
        return [
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">',
          '<span style="flex-shrink:0;font-size:11px;color:#5f6368;width:30px;text-align:right;">',
          _escHtml(item.label),
          '</span>',
          '<code style="flex:1;font-size:11px;color:#37474f;background:#f8f9fa;',
          'padding:5px 8px;border-radius:5px;word-break:break-all;line-height:1.45;',
          'border:1px solid #e8eaed;font-family:Consolas,monospace;">',
          _escHtml(str),
          '</code>',
          '<button id="' + item.id + '" style="flex-shrink:0;padding:5px 10px;background:#1a73e8;',
          'color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;',
          'font-weight:500;white-space:nowrap;">' + I18n.t('picker_copy') + '</button>',
          '</div>',
        ].join('');
      }).join('');
      return [
        '<div style="margin-bottom:10px;">',
        '<div style="font-size:10px;color:#9aa0a6;font-family:Consolas,monospace;margin-bottom:4px;',
        'padding:1px 5px;background:#f1f3f4;border-radius:3px;display:inline-block;">',
        _escHtml(group.attr),
        '</div>',
        rowsHtml,
        '</div>',
      ].join('');
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = '_ma_info_overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.40)',
      'z-index:2147483647', 'display:flex', 'align-items:center',
      'justify-content:center',
      'font-family:"Google Sans","Segoe UI",Roboto,Arial,sans-serif',
    ].join(';');

    overlay.innerHTML = [
      '<div style="background:#fff;border-radius:12px;width:500px;max-width:96vw;',
      'max-height:90vh;overflow-y:auto;',
      'box-shadow:0 8px 40px rgba(0,0,0,0.22);">',

      // 标题栏（sticky）
      '<div style="display:flex;align-items:center;justify-content:space-between;',
      'padding:16px 20px;border-bottom:1px solid #e8eaed;',
      'position:sticky;top:0;background:#fff;z-index:1;">',
      '<span style="font-size:16px;font-weight:600;color:#202124;">&#x1F50D; ' + I18n.t('picker_selected_el') + '</span>',
      '<button id="_ma_info_close" style="background:none;border:none;cursor:pointer;',
      'font-size:20px;color:#5f6368;padding:2px 6px;border-radius:50%;">\u2715</button>',
      '</div>',

      // 标签行
      '<div style="padding:16px 20px 0;">',
      '<div style="font-family:monospace;font-size:13px;color:#1967d2;background:#e8f0fe;',
      'display:inline-block;padding:3px 8px;border-radius:4px;margin-bottom:16px;">',
      _escHtml(tag + id + cls),
      '</div>',
      '</div>',

      // 名称
      '<div style="padding:0 20px 14px;">',
      '<div style="font-size:11px;color:#5f6368;font-weight:500;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px;">' + I18n.t('picker_el_name') + '</div>',
      '<div style="font-size:14px;color:#202124;word-break:break-word;">',
      _escHtml(name),
      '</div>',
      '</div>',

      // CSS Selector
      '<div style="padding:0 20px 14px;">',
      '<div style="font-size:11px;color:#5f6368;font-weight:500;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px;">CSS Selector</div>',
      '<div style="display:flex;align-items:center;gap:8px;">',
      '<code id="_ma_sel_text" style="flex:1;font-size:12px;color:#37474f;background:#f8f9fa;',
      'padding:7px 10px;border-radius:6px;word-break:break-all;line-height:1.5;',
      'border:1px solid #e8eaed;">',
      _escHtml(selector),
      '</code>',
      '<button id="_ma_copy_btn" style="flex-shrink:0;padding:7px 12px;background:#1a73e8;',
      'color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;',
      'font-weight:500;white-space:nowrap;">' + I18n.t('picker_copy') + '</button>',
      '</div>',
      '</div>',

      // 分割线
      '<div style="border-top:1px solid #e8eaed;margin:0 20px;"></div>',

      // ACTION 模板区域
      '<div style="padding:14px 20px 18px;">',
      '<div style="font-size:11px;color:#5f6368;font-weight:500;margin-bottom:3px;',
      'text-transform:uppercase;letter-spacing:.5px;">' + I18n.t('picker_action_templates') + '</div>',
      '<div style="font-size:11.5px;color:#80868b;margin-bottom:10px;">',
      _escHtml(I18n.t('picker_action_desc')) + '</div>',
      actionGroupsHtml,
      '</div>',

      '</div>',
    ].join('');

    document.body.appendChild(overlay);

    overlay.querySelector('#_ma_info_close').onclick = () => { overlay.remove(); _activatePicker(); };
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); _activatePicker(); } });

    // CSS Selector 复制按钮
    const copyBtn = overlay.querySelector('#_ma_copy_btn');
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(selector).then(() => {
        copyBtn.textContent = I18n.t('picker_copied');
        copyBtn.style.background = '#188038';
        setTimeout(() => {
          copyBtn.textContent = I18n.t('picker_copy');
          copyBtn.style.background = '#1a73e8';
        }, 1800);
      }).catch(() => {
        // 回退：创建临时 textarea
        const ta = document.createElement('textarea');
        ta.value = selector;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        copyBtn.textContent = I18n.t('picker_copied');
        setTimeout(() => { copyBtn.textContent = I18n.t('picker_copy'); }, 1800);
      });
    };

    // ACTION 模板各行复制按钮
    for (const group of variantGroups) {
      for (const item of group.rows) {
        const btn = overlay.querySelector('#' + item.id);
        if (!btn) continue;
        const actionStr = '<ACTION>' + JSON.stringify(item.action) + '</ACTION>';
        btn.onclick = () => {
          navigator.clipboard.writeText(actionStr).then(() => {
            btn.textContent = I18n.t('picker_copied');
            btn.style.background = '#188038';
            setTimeout(() => {
              btn.textContent = I18n.t('picker_copy');
              btn.style.background = '#1a73e8';
            }, 1800);
          }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = actionStr;
            ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            btn.textContent = I18n.t('picker_copied');
            setTimeout(() => { btn.textContent = I18n.t('picker_copy'); }, 1800);
          });
        };
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 消息处理
  // ═══════════════════════════════════════════════════════════════
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // ── 激活元素选取器 ───────────────────────────────────────────
    if (message.type === 'ACTIVATE_PICKER') {
      _activatePicker();
      sendResponse({ status: 'ok' });
      return true;
    }

    // ── 获取页面 DOM（供模型分析）───────────────────────────────
    if (message.type === 'GET_PAGE_CONTENT') {
      try {
        const dom = ElementScanner.getPageDOM();
        const content = [
          '标题：' + document.title,
          'URL：' + location.href,
          '',
          '[页面 DOM]',
          dom,
        ].join('\n');
        sendResponse({ content, elementCount: -1 });
      } catch (e) {
        console.error('[content.js] GET_PAGE_CONTENT 失败:', e);
        sendResponse({ content: 'DOM 获取失败: ' + e.message, elementCount: 0 });
      }
      return true;
    }

    // ── 执行 Agent Action ────────────────────────────────────────
    if (message.type === 'EXECUTE_ACTION') {
      ElementScanner.executeAction(message.action)
        .then(() => new Promise(r =>
          chrome.storage.sync.get('actionDelay', data => {
            const delay = parseInt(data.actionDelay);
            setTimeout(r, isNaN(delay) ? 500 : delay);
          })
        ))
        .then(() => sendResponse({ status: 'ok' }))
        .catch(err => {
          console.error('[content.js] executeAction 失败:', err);
          sendResponse({ status: 'error', message: err.message });
        });
      return true;
    }

    return true;
  });

  console.log('[Chromium] content script loaded (DOM Picker v4)');

})();
