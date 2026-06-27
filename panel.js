// ===== panel.js：Gemini 风格侧边栏完整逻辑 =====

// 在任何异步操作之前，立即将语言设为英文并应用到 DOM
// （CSP 禁止 HTML 内联脚本，故在此处同步执行）
I18n.setLang('en');
I18n.apply();

const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');

// ── Provider 配置（纯前端，无需服务器）─────────────────────────
const PROVIDERS = {
  ollama: {
    name:       "Ollama",
    format:     "openai",
    url:        "http://localhost:11434/v1/chat/completions",
    defaultKey: "ollama",
  },
  cliproxy: {
    name:       "CLI Proxy API",
    format:     "openai",
    url:        "",
    defaultKey: "",
    needsEndpoint: true,
  },
  openrouter: {
    name:       "OpenRouter",
    format:     "openai",
    url:        "https://openrouter.ai/api/v1/chat/completions",
    defaultKey: "",
  },
  deepseek: {
    name:       "DeepSeek",
    format:     "openai",
    url:        "https://api.deepseek.com/chat/completions",
    defaultKey: "",
  },
  siliconflow: {
    name:       "SiliconFlow",
    format:     "openai",
    url:        "https://api.siliconflow.cn/v1/chat/completions",
    defaultKey: "",
  },
  aistudio: {
    name:       "Google AI Studio",
    format:     "gemini",
    url:        "https://generativelanguage.googleapis.com/v1beta/models",
    defaultKey: "",
  },
  copilot: {
    name:       "GitHub Copilot",
    format:     "copilot",
    url:        "https://api.githubcopilot.com/chat/completions",
    defaultKey: "",
  },
};

const SYSTEM_PROMPT =
  "你是嵌入在浏览器侧边栏的智能助手，同时也是页面操作工具。\n" +
  "用户会提供当前页面的「DOM HTML」，你需要根据 DOM 结构来定位要操作的元素。\n\n" +
  "需要操作页面时，先用自然语言描述将要做的事，然后在回复末尾输出操作指令：\n" +
  "  点击: <ACTION>{\"type\":\"click\",\"selector\":\"button.submit-btn\"}</ACTION>\n" +
  "  Ctrl+点击: <ACTION>{\"type\":\"click\",\"selector\":\"a.result\",\"modifiers\":[\"ctrl\"]}</ACTION>\n" +
  "  双击: <ACTION>{\"type\":\"double_click\",\"selector\":\".editable-cell\"}</ACTION>\n" +
  "  右键: <ACTION>{\"type\":\"right_click\",\"selector\":\".item\"}</ACTION>\n" +
  "  输入: <ACTION>{\"type\":\"type\",\"selector\":\"input[name='q']\",\"text\":\"搜索内容\"}</ACTION>\n" +
  "  选择: <ACTION>{\"type\":\"select\",\"selector\":\"select#category\",\"value\":\"选项\"}</ACTION>\n" +
  "  按键: <ACTION>{\"type\":\"key\",\"key\":\"Enter\"}</ACTION>\n" +
  "  指定元素按键: <ACTION>{\"type\":\"key\",\"selector\":\".dropdown\",\"key\":\"ArrowDown\"}</ACTION>\n" +
  "  跳转: <ACTION>{\"type\":\"navigate\",\"url\":\"https://example.com\"}</ACTION>\n" +
  "  滚动: <ACTION>{\"type\":\"scroll\",\"y\":300}</ACTION>\n" +
  "  悬停: <ACTION>{\"type\":\"hover\",\"selector\":\".menu-item\"}</ACTION>\n" +
  "  清空: <ACTION>{\"type\":\"clear\",\"selector\":\"input#search\"}</ACTION>\n\n" +
  "重要规则：\n" +
  "- selector 使用 CSS 选择器字符串定位元素，如 #id、.classname、button[name='submit']、div > span:nth-of-type(2)\n" +
  "- selector 必须从 DOM HTML 中推断，不要凭空猜测\n" +
  "- 优先使用稳定的属性：id > name > aria-label > data-testid > class\n" +
  "- 如果下一步依赖上一步的结果（如等待页面跳转后再定位元素），每次只输出一个 <ACTION>；如果多步操作是确定的（如依次填写多个字段），可在同一回复中输出多个 <ACTION>，系统会全部顺序执行后再反馈新页面状态\n" +
  "- 不需要操作页面时，只用 Markdown 正常回答，不要输出 <ACTION> 标签\n" +
  "- 如果在 DOM 中找不到合适的元素，告知用户而不是猜测\n" +
  "- 某些元素（如悬浮菜单、hover 才出现的按钮）在初始 DOM 中不存在，需要先 hover 父元素触发渲染，再操作目标元素\n";

const DEFAULT_CONFIG = {
  provider: "deepseek",
  model:    "deepseek-v4-flash",
  apiKeys:  { ollama: "ollama", cliproxy: "", openrouter: "", deepseek: "", siliconflow: "", aistudio: "", copilot: "" },
  endpoints:{ cliproxy: "" },
  theme:    "light",
};

// 每轮 action 执行完毕后反馈给模型的续接提示（{{actions}} 替换为动作执行摘要）
const DEFAULT_LOOP_FEEDBACK_PROMPT =
  "{{actions}}. Please continue completing the user's task. " +
  "If the task is fully completed, inform the user of the result and do not output any more <ACTION>.";

async function loadConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get(null, stored => {
      // 首次加载（userLang 尚未写入）时强制保存 'en'，相当于自动执行一次"语言=英文"的保存
      if (!stored.userLang) {
        chrome.storage.sync.set({ language: 'en', userLang: 'en' });
        stored.userLang = 'en'; // 确保在当前 tick 的结果中也立即生效
      }
      resolve({
        provider:      stored.provider     || DEFAULT_CONFIG.provider,
        model:         stored.model        || DEFAULT_CONFIG.model,
        apiKeys:       Object.assign({}, DEFAULT_CONFIG.apiKeys, stored.apiKeys || {}),
        endpoints:     Object.assign({}, DEFAULT_CONFIG.endpoints, stored.endpoints || {}),
        theme:         normalizeTheme(stored.theme),
        systemPrompt:  stored.systemPrompt ?? SYSTEM_PROMPT,
        skills:        Array.isArray(stored.skills) ? stored.skills : [],
        language:      stored.userLang || 'en',
        historyRounds:        stored.historyRounds != null ? stored.historyRounds : 3,
        agentMaxSteps:        stored.agentMaxSteps != null ? stored.agentMaxSteps : '',
        actionDelay:          stored.actionDelay  != null ? stored.actionDelay   : 500,
        loopFeedbackPrompt:   stored.loopFeedbackPrompt !== undefined ? stored.loopFeedbackPrompt : DEFAULT_LOOP_FEEDBACK_PROMPT,
      });
    });
  });
}

// 构建有效系统提示词（Skills 列表追加到末尾）
function buildEffectiveSystemPrompt(cfg) {
  let prompt = cfg.systemPrompt || "";
  if (cfg.skills && cfg.skills.length > 0) {
    prompt += "\n\n---\n## Available Skills\n";
    cfg.skills.forEach(skill => {
      if (skill.name || skill.content) {
        prompt += `\n### ${skill.name || "(untitled)"}\n${skill.content || ""}\n`;
      }
    });
  }
  return prompt;
}

// ─────────────────────────────────────────────
// 辅助：从对话历史构建 LLM 消息（不含页面 DOM 和附件内容）
// ─────────────────────────────────────────────
function buildLLMHistory(cfg) {
  const rawRounds = cfg.historyRounds;
  const unlimited = (rawRounds === '' || rawRounds == null);
  const rounds    = unlimited ? Infinity : (parseInt(rawRounds) || 0);
  if (rounds <= 0 || conversationHistory.length === 0) return [];

  const eligible = unlimited ? conversationHistory : conversationHistory.slice(-rounds);
  const result = [];
  for (const round of eligible) {
    if (round.roundMessages && round.roundMessages.length > 0) {
      // 新格式：包含 Agent 循环内完整对话（无页面/附件内容）
      result.push(...round.roundMessages);
    } else {
      // 兼容旧格式
      result.push({ role: 'user',      content: round.userText  });
      result.push({ role: 'assistant', content: round.agentText });
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// 辅助：持久化对话到 chrome.storage.session（浏览器关闭前有效）
// ─────────────────────────────────────────────
async function saveSession() {
  try {
    await new Promise((resolve, reject) => {
      chrome.storage.session.set(
        { chatSession: { conversationHistory, sessionMessages } },
        () => chrome.runtime.lastError
          ? reject(new Error(chrome.runtime.lastError.message))
          : resolve()
      );
    });
  } catch (e) {
    console.warn('[panel] saveSession failed:', e);
  }
}

// ─────────────────────────────────────────────
// 辅助：恢复上次对话（侧边栏重新打开时调用）
// ─────────────────────────────────────────────
async function restoreSession() {
  try {
    const data = await new Promise((resolve, reject) => {
      chrome.storage.session.get('chatSession', (items) => {
        chrome.runtime.lastError
          ? reject(new Error(chrome.runtime.lastError.message))
          : resolve(items);
      });
    });
    const session = data?.chatSession;
    if (!session?.sessionMessages?.length) return;

    conversationHistory = session.conversationHistory || [];
    sessionMessages     = session.sessionMessages     || [];

    welcomeEl.style.display = 'none';
    for (const msg of sessionMessages) {
      if (msg.type === 'user') {
        const el = document.createElement('div');
        el.className   = 'msg-user';
        el.textContent = msg.text;
        messagesEl.appendChild(el);
      } else if (msg.type === 'agent' || msg.type === 'agent-steps') {
        const wrap    = document.createElement('div');
        wrap.className = 'msg-agent-wrap';
        const icon    = document.createElement('div');
        icon.className = 'msg-agent-icon';
        const content = document.createElement('div');
        content.className = 'msg-agent';

        if (msg.type === 'agent-steps') {
          // 多步 Agent 轮次：逐步重建分隔线 + 文本 + 操作芯片
          (msg.steps || []).forEach((step, i) => {
            if (i > 0) {
              const sep = document.createElement('div');
              sep.style.cssText = [
                'margin:6px 0 4px', `border-top:1px dashed ${themeVar('--border')}`,
                'font-size:11px', `color:${themeVar('--muted-2')}`, 'padding-top:4px',
              ].join(';');
              sep.textContent = '↩ Continuing…';
              content.appendChild(sep);
            }
            const stepEl = document.createElement('div');
            stepEl.innerHTML = renderMarkdown(step.text || '');
            content.appendChild(stepEl);
            // 支持新格式（actions 数组）和旧格式（单个 action 字符串）吉化入）
            const stepActions = step.actions || (step.action ? [step.action] : []);
            for (const actionStr of stepActions) {
              const chip = document.createElement('div');
              chip.style.cssText = [
                'margin-top:8px', 'padding:5px 10px',
                `background:${themeVar('--surface-2')}`, `border-left:3px solid ${themeVar('--blue')}`,
                'border-radius:4px', 'font-size:11.5px', `color:${themeVar('--text')}`,
                'font-family:Consolas,monospace', 'word-break:break-all',
              ].join(';');
              chip.textContent = '⚡ ' + actionStr;
              content.appendChild(chip);
            }
          });
        } else {
          // 兼容旧格式（纯文本 or HTML）
          content.innerHTML = msg.html != null ? msg.html : renderMarkdown(msg.text || '');
        }

        wrap.appendChild(icon);
        wrap.appendChild(content);
        messagesEl.appendChild(wrap);
      }
    }
    scrollToBottom();
  } catch (e) {
    console.warn('[panel] restoreSession failed:', e);
  }
}

// ── 状态 ──
let isWaiting         = false;
let abortController   = null;
let attachedFiles     = [];
let conversationHistory = []; // [{ userText, agentText }] 跨轮次历史（不含 DOM）
let sessionMessages     = []; // [{ type, text?, html? }] 用于界面恢复

// ── DOM 引用 ──
const mainEl        = document.getElementById("main");
const welcomeEl     = document.getElementById("welcome");
const messagesEl    = document.getElementById("messages");
const inputEl       = document.getElementById("agent-input");
const runBtn        = document.getElementById("agent-run");
const btnNew        = document.getElementById("btn-new");
const attachmentsEl = document.getElementById("attachments");
const footerEl      = document.getElementById("footer");
const modelInfoEl   = document.getElementById("model-info");
const btnAddPage    = document.getElementById("btn-add-page");

// 立即用默认值覆盖「加载配置中」占位文字
{
  const _c = PROVIDERS[DEFAULT_CONFIG.provider];
  modelInfoEl.textContent = (_c ? _c.name : DEFAULT_CONFIG.provider) + ' · ' + DEFAULT_CONFIG.model;
}

// ── 初始化：显示当前配置 ──
loadConfig().then(cfg => {
  applyTheme(cfg.theme);
  if (I18n.lang !== cfg.language) {
    I18n.setLang(cfg.language);
    I18n.apply();
  }
  const conf = PROVIDERS[cfg.provider];
  modelInfoEl.textContent = (conf ? conf.name : cfg.provider) + " · " + (cfg.model || I18n.t('model_not_set'));
});

// ─────────────────────────────────────────────
// 附件管理
// ─────────────────────────────────────────────

// 重新渲染附件芯片列表
function renderAttachments() {
  attachmentsEl.innerHTML = "";
  attachedFiles.forEach((file, idx) => {
    const chip = document.createElement("div");
    chip.className = "file-chip";
    chip.title = file.name;

    const icon = document.createElement("span");
    icon.className = "file-chip-icon";
    icon.textContent = file.isPage ? "🌐" : "📄";

    const name = document.createElement("span");
    name.className = "file-chip-name";
    name.textContent = file.name;

    const removeBtn = document.createElement("button");
    removeBtn.className = "file-chip-remove";
    removeBtn.textContent = "×";
    removeBtn.title = I18n.t('remove_chip');
    removeBtn.addEventListener("click", () => {
      attachedFiles.splice(idx, 1);
      renderAttachments();
    });

    chip.appendChild(icon);
    chip.appendChild(name);
    chip.appendChild(removeBtn);
    attachmentsEl.appendChild(chip);
  });
  // 将加号按钮始终放在最后一个芯片之后，随芯片一起换行
  attachmentsEl.appendChild(btnAddPage);
}

// 获取当前标签页内容并作为默认附件
// refreshOnly=true：仅刷新已有页面附件，不重新添加用户已手动删除的页面
async function addCurrentPage(refreshOnly = false) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    let pageContent = "";
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_CONTENT" });
      pageContent = resp?.content ?? "";
    } catch {
      // content script 未注入（扩展重载后的旧标签页），尝试动态注入后重试
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['i18n.js'] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['element-scanner.js'] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        // 等待脚本初始化完成
        await new Promise(r => setTimeout(r, 150));
        const resp2 = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_CONTENT" });
        pageContent = resp2?.content ?? "";
      } catch {
        // 动态注入也失败（chrome:// 等不可注入页面），用 URL+标题兜底
        pageContent = `标题：${tab.title}\nURL：${tab.url}`;
      }
    }

    const fileObj = { name: tab.title || tab.url, content: pageContent, isPage: true };
    if (refreshOnly) {
      const existing = attachedFiles.findIndex(f => f.isPage);
      if (existing >= 0) {
        attachedFiles[existing] = fileObj;     // 刷新模式：仅更新已有页面，用户删除后不重新添加
      }
      // else: 用户已删除页面附件，不重新添加
    } else {
      attachedFiles.unshift(fileObj);          // 按钮点击：始终添加新页面
    }
    renderAttachments();
    return fileObj;  // 返回文件对象供内部使用
  } catch (e) {
    console.warn("addCurrentPage failed:", e);
    return null;
  }
}

// 加号按钮：强制添加/刷新当前页面附件
btnAddPage.addEventListener("click", () => addCurrentPage(false));

// 初始化：恢复上次会话，然后刷新当前页面附件
restoreSession().then(() => addCurrentPage());

// ─────────────────────────────────────────────
// 辅助：向消息列表追加用户气泡
// ─────────────────────────────────────────────
function appendUserMessage(text) {
  // 有消息时隐藏欢迎页
  welcomeEl.style.display = "none";

  const el = document.createElement("div");
  el.className = "msg-user";
  el.textContent = text; // 用户消息直接显示纯文本，安全
  messagesEl.appendChild(el);
  scrollToBottom();
}

// ─────────────────────────────────────────────
// 辅助：向消息列表追加 Agent 气泡（含图标）
// 返回内容容器，方便后续流式更新
// ─────────────────────────────────────────────
function appendAgentMessage(html = "") {
  const wrap = document.createElement("div");
  wrap.className = "msg-agent-wrap";

  // 左侧 Gemini 彩色小图标
  const icon = document.createElement("div");
  icon.className = "msg-agent-icon";

  // 右侧内容区
  const content = document.createElement("div");
  content.className = "msg-agent typing-cursor"; // 打字光标
  content.innerHTML = html;

  wrap.appendChild(icon);
  wrap.appendChild(content);
  messagesEl.appendChild(wrap);
  scrollToBottom();

  return content; // 返回内容节点，流式输出时用来更新
}

// ─────────────────────────────────────────────
// 辅助：滚动到底部
// ─────────────────────────────────────────────
function scrollToBottom() {
  mainEl.scrollTop = mainEl.scrollHeight;
}

// ─────────────────────────────────────────────
// 辅助：用 marked 把 Markdown 渲染为 HTML
// ─────────────────────────────────────────────
function renderMarkdown(text) {
  // marked 已通过 CDN 在 panel.html 中引入
  return typeof marked !== "undefined" ? marked.parse(text) : text;
}

function normalizeTheme(theme) {
  return theme === 'dark' || theme === 'light' || theme === 'device' ? theme : DEFAULT_CONFIG.theme;
}

function resolveTheme(theme) {
  const normalizedTheme = normalizeTheme(theme);
  if (normalizedTheme === 'device') {
    return systemThemeMedia.matches ? 'dark' : 'light';
  }
  return normalizedTheme;
}

function applyTheme(theme) {
  document.body.dataset.theme = resolveTheme(theme);
}

function themeVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

// ─────────────────────────────────────────────
// 辅助：切换发送/停止按鈕状态
// ─────────────────────────────────────────────
const SEND_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
const STOP_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';

function setRunBtnState(state) {
  if (state === 'stop') {
    runBtn.innerHTML  = STOP_ICON;
    runBtn.style.background = themeVar('--muted');
    runBtn.disabled   = false;
  } else {
    runBtn.innerHTML  = SEND_ICON;
    runBtn.style.background = '';
    runBtn.disabled   = false;
  }
}

// ─────────────────────────────────────────────
// 辅助：构建发给服务端的完整 user content（含附件）
// ─────────────────────────────────────────────
function buildUserContent(cmd, files) {
  const nonPageFiles = (files || []).filter(f => !f.isPage);
  if (!nonPageFiles.length) return cmd;
  const parts = nonPageFiles.map(f => `=== ${f.name} ===\n${f.content}`);
  return parts.join("\n\n") + `\n\n---\n\nUser question: ${cmd}`;
}

// ─────────────────────────────────────────────
// 辅助：所有 action 执行完毕后构建续接 user 消息（含重扫页面状态）
// loopFeedbackPrompt 为空字符串时返回空（不向模型发送续接消息）
// ─────────────────────────────────────────────
function buildContinuationContent(actions, loopFeedbackPrompt) {
  // 设置里没填（空字符串）→ 返回空
  if (loopFeedbackPrompt === '') return '';
  const template = (loopFeedbackPrompt != null) ? loopFeedbackPrompt : DEFAULT_LOOP_FEEDBACK_PROMPT;
  const count = actions.length;
  const list  = actions.map(a => JSON.stringify(a)).join(', ');
  const actionsDesc = count === 1
    ? `Action ${list} has been executed`
    : `${count} actions [${list}] have all been executed in sequence`;
  return template.replace('{{actions}}', actionsDesc);
}

// ─────────────────────────────────────────────
// 辅助：将当前页面内容临时注入到最后一条 user 消息（不修改原数组）
// ─────────────────────────────────────────────
function injectPageIntoMessages(messages, pageFileOverride) {
  const pageFile = pageFileOverride !== undefined ? pageFileOverride : attachedFiles.find(f => f.isPage);
  if (!pageFile || !pageFile.content) return messages;
  const msgs = messages.map(m => ({ ...m }));
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') {
      msgs[i] = { ...msgs[i], content: `=== Current Page ===\n${pageFile.content}\n\n---\n\n${msgs[i].content}` };
      break;
    }
  }
  return msgs;
}

// ─────────────────────────────────────────────
// 辅助：显示请求报文弹框
// ─────────────────────────────────────────────
function showPayloadModal(payload) {
  document.getElementById('_payload_overlay')?.remove();

  const border = themeVar('--border');
  const overlayBg = themeVar('--overlay');
  const modalPanel = themeVar('--modal-panel');
  const modalHeader = themeVar('--modal-header');
  const modalText = themeVar('--modal-text');
  const modalCode = themeVar('--modal-code');
  const muted = themeVar('--muted');

  const overlay = document.createElement('div');
  overlay.id = '_payload_overlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', `background:${overlayBg}`,
    'z-index:9999', 'display:flex', 'align-items:center', 'justify-content:center',
  ].join(';');

  overlay.innerHTML = `
<div style="background:${modalPanel};border-radius:12px;width:92%;max-width:720px;
  max-height:82vh;display:flex;flex-direction:column;
  box-shadow:0 8px 40px ${overlayBg};overflow:hidden;">
  <div style="display:flex;align-items:center;justify-content:space-between;
    padding:12px 16px;border-bottom:1px solid ${border};flex-shrink:0;background:${modalHeader};">
    <span style="font-size:13px;font-weight:600;color:${modalText};
      font-family:'Google Sans','Segoe UI',sans-serif;">📋 Request Payload</span>
    <button id="_payload_close" style="background:none;border:none;cursor:pointer;
      font-size:18px;color:${muted};padding:2px 8px;border-radius:4px;line-height:1;">✕</button>
  </div>
  <pre id="_payload_pre" style="overflow:auto;padding:16px;margin:0;font-size:11.5px;
    line-height:1.65;color:${modalCode};background:${modalPanel};flex:1;
    white-space:pre-wrap;word-break:break-word;font-family:Consolas,monospace;"></pre>
</div>`;

  // 用 textContent 写入避免 XSS
  overlay.querySelector('#_payload_pre').textContent = JSON.stringify(payload, null, 2);

  document.body.appendChild(overlay);
  overlay.querySelector('#_payload_close').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ─────────────────────────────────────────────
// 辅助：执行一轮 LLM 调用并流式输出到 agentContent
// 返回 { fullText, action }
// ─────────────────────────────────────────────
async function streamAgentTurn(history, agentContent, isContinuation, signal) {
  // 续轮时插入分隔条
  if (isContinuation) {
    const sep = document.createElement('div');
    sep.style.cssText = [
      'margin:6px 0 4px', `border-top:1px dashed ${themeVar('--border')}`,
      'font-size:11px', `color:${themeVar('--muted-2')}`, 'padding-top:4px',
    ].join(';');
    sep.textContent = '↩ Continuing…';
    agentContent.appendChild(sep);
    scrollToBottom();
  }

  // ── 加载配置 ──
  const cfg  = await loadConfig();
  const conf = PROVIDERS[cfg.provider];
  if (!conf) throw new Error(`Unknown provider: ${cfg.provider}`);

  const requestUrl = conf.needsEndpoint
    ? (cfg.endpoints && typeof cfg.endpoints[cfg.provider] === 'string' ? cfg.endpoints[cfg.provider].trim() : '')
    : conf.url;

  const apiKey = (cfg.apiKeys && cfg.apiKeys[cfg.provider]) || conf.defaultKey || "";
  if (!apiKey && cfg.provider !== "ollama" && cfg.provider !== "copilot") {
    throw new Error(`${conf.name}: API Key not configured. Please open the settings to configure it.`);
  }
  if (conf.needsEndpoint && !requestUrl) {
    throw new Error(`${conf.name}: Endpoint URL not configured. Please open the settings to configure it.`);
  }
  const model = cfg.model;
  if (!model) throw new Error("Model name not set. Please open the settings to configure it.");

  // 更新顶栏
  modelInfoEl.textContent = conf.name + " · " + model;

  const effectivePrompt = buildEffectiveSystemPrompt(cfg);
  const allMessages = effectivePrompt
    ? [{ role: "system", content: effectivePrompt }, ...history]
    : [...history];
  const requestPayload = { provider: cfg.provider, model, url: requestUrl, messages: allMessages };

  // 本轮流式输出容器
  const stepEl = document.createElement('div');
  agentContent.appendChild(stepEl);

  let fullText    = "";
  let inReasoning = false;

  if (conf.format === "copilot") {
    // ── GitHub Copilot (OpenAI 局式 + 特殊认证头) ─────────────────
    let copilotToken;
    try {
      copilotToken = await GitHubAuth.getValidCopilotToken();
    } catch (e) {
      if (e.message === 'NOT_AUTHED') {
        throw new Error('GitHub Copilot 未授权，请在设置中连接 GitHub 账号');
      }
      throw e;
    }

    const res = await fetch(conf.url, {
      method:  'POST',
      headers: {
        'Authorization':          `Bearer ${copilotToken}`,
        'Content-Type':           'application/json',
        'Editor-Version':         'vscode/1.97.2',
        'Editor-Plugin-Version':  'copilot-chat/0.26.1',
        'Copilot-Integration-Id': 'vscode-chat',
        'Openai-Intent':          'conversation-panel',
        'User-Agent':             'GitHubCopilotChat/0.26.1',
        'X-Github-Api-Version':   '2024-12-15',
      },
      signal,
      body: JSON.stringify({ model, messages: allMessages, stream: true, max_tokens: 4096 }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        // Copilot token 失效，清理缓存让下次重新获取
        await new Promise(r => chrome.storage.sync.remove(['copilotToken', 'copilotTokenExpiry'], r));
        throw new Error(`Copilot 认证失效 (${res.status})，请重新连接 GitHub 账号`);
      }
      throw new Error(`HTTP ${res.status}${body ? ': ' + body.slice(0, 300) : ''}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
          try {
            const parsed  = JSON.parse(jsonStr);
            const content = parsed?.choices?.[0]?.delta?.content || '';
            if (content) { fullText += content; stepEl.innerHTML = renderMarkdown(fullText); scrollToBottom(); }
          } catch { /* 非 JSON 行忽略 */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
      // AbortError：带着已累积的部分文本继续执行，下方 signal.aborted 检查会提前返回
    }

  } else if (conf.format === "gemini") {
    // ── Google Gemini ─────────────────────────────────────────
    const geminiUrl      = `${conf.url}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const geminiContents = history.map(m => ({
      role:  m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const res = await fetch(geminiUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body:    JSON.stringify({
        ...(effectivePrompt ? { systemInstruction: { parts: [{ text: effectivePrompt }] } } : {}),
        contents:         geminiContents,
        generationConfig: { maxOutputTokens: 2000 },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${body ? ": " + body.slice(0, 300) : ""}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim().startsWith("data: ")) continue;
          try {
            const chunk = JSON.parse(line.trim().slice(6));
            const text  = chunk?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (text) { fullText += text; stepEl.innerHTML = renderMarkdown(fullText); scrollToBottom(); }
          } catch { /* 非 JSON 行忽略 */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
    }

  } else {
    // ── OpenAI 兼容格式（Ollama / OpenRouter / DeepSeek）─────
    const isDeepSeek = cfg.provider === "deepseek";
    const reqBody    = {
      model,
      messages: allMessages,
      stream:   true,
    };
    if (cfg.provider === "ollama") {
      reqBody.options = { num_predict: 2000 };
    } else {
      reqBody.max_tokens = 2000;
    }

    const res = await fetch(requestUrl, {
      method:  "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type":  "application/json",
      },
      signal,
      body: JSON.stringify(reqBody),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${body ? ": " + body.slice(0, 300) : ""}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          const jsonStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
          try {
            const parsed    = JSON.parse(jsonStr);
            const delta     = parsed?.choices?.[0]?.delta;
            const reasoning = isDeepSeek ? (delta?.reasoning_content || "") : "";
            const content   = delta?.content || "";

            if (reasoning) {
              if (!inReasoning) { inReasoning = true; fullText += "*思考中...*\n\n> "; }
              fullText += reasoning.replace(/\n/g, "\n> ");
            } else if (content) {
              if (inReasoning) { inReasoning = false; fullText += "\n\n---\n\n"; }
              fullText += content;
            }
            if (reasoning || content) { stepEl.innerHTML = renderMarkdown(fullText); scrollToBottom(); }
          } catch { /* 非 JSON 行忽略 */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
    }
  }

  // 用户中途停止：带着已累积内容提前返回，不解析 action 也不添加报文按钮
  if (signal?.aborted) {
    return { fullText, actions: [] };
  }

  // 解析全部 <ACTION> 标签（支持一次多个动作）
  const actionMatches = [...fullText.matchAll(/<ACTION>([\s\S]*?)<\/ACTION>/g)];
  const actions = [];
  if (actionMatches.length > 0) {
    const displayText = fullText.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim();
    stepEl.innerHTML = renderMarkdown(displayText || (actionMatches.length > 1 ? 'Executing actions…' : 'Executing action…'));
    for (const match of actionMatches) {
      try {
        const parsed = JSON.parse(match[1].trim());
        actions.push(parsed);
        // 每个动作显示一个芯片
        const chip = document.createElement('div');
        chip.style.cssText = [
          'margin-top:8px', 'padding:5px 10px',
          `background:${themeVar('--surface-2')}`, `border-left:3px solid ${themeVar('--blue')}`,
          'border-radius:4px', 'font-size:11.5px', `color:${themeVar('--text')}`,
          'font-family:Consolas,monospace', 'word-break:break-all',
        ].join(';');
        chip.textContent = '⚡ ' + match[1].trim();
        agentContent.appendChild(chip);
      } catch (e) {
        console.warn('Failed to parse <ACTION>:', e);
      }
    }
    scrollToBottom();
  }

  // 每轮结束后追加"查看报文"按钮
  const payloadBtn = document.createElement('button');
  payloadBtn.className = 'msg-payload-btn';
  payloadBtn.style.cssText = [
    'margin-top:5px', 'padding:2px 8px', 'display:inline-block',
    'background:none', `border:1px solid ${themeVar('--border-strong')}`, 'border-radius:4px',
    'font-size:11px', `color:${themeVar('--muted')}`, 'cursor:pointer', 'font-family:inherit',
    'transition:all .15s',
  ].join(';');
  payloadBtn.textContent = '📋 View Payload';
  payloadBtn.onmouseenter = () => {
    payloadBtn.style.background = themeVar('--surface');
    payloadBtn.style.borderColor = themeVar('--blue');
    payloadBtn.style.color = themeVar('--blue');
  };
  payloadBtn.onmouseleave = () => {
    payloadBtn.style.background = 'none';
    payloadBtn.style.borderColor = themeVar('--border-strong');
    payloadBtn.style.color = themeVar('--muted');
  };
  payloadBtn.onclick = () => showPayloadModal(requestPayload);
  agentContent.appendChild(payloadBtn);
  scrollToBottom();

  return { fullText, actions };
}

// ─────────────────────────────────────────────
// 核心：发送消息（含 agentic loop）
// ─────────────────────────────────────────────
async function sendMessage() {
  if (isWaiting) return;
  const cmd = inputEl.value.trim();
  if (!cmd) return;

  // 1. 显示用户气泡
  appendUserMessage(cmd);

  // 2. 清空输入框并重置高度
  inputEl.value = "";
  inputEl.style.height = "auto";

  // 3. 创建 Agent 气泡
  const agentContent = appendAgentMessage("");

  // 4. 切换为停止按鈕
  isWaiting = true;
  abortController = new AbortController();
  setRunBtnState('stop');

  // 声明在 try 外部，确保 catch 块也能访问（let 是块级作用域，在 try 内声明则 catch 不可见）
  let roundAgentText = '';
  let roundSteps     = [];
  // roundMessages 保存本轮完整对话（消息不含页面 DOM 和附件）
  let roundMessages  = [{ role: 'user', content: cmd }];

  try {
    // 5. 刷新页面快照
    await addCurrentPage(true);

    // 6. 加载配置（含 historyRounds、agentMaxSteps）
    const cfg = await loadConfig();

    // 7. 从历史对话构建上文（仅用户文本，不含 DOM）
    const historyMessages = buildLLMHistory(cfg);

    // 8. 构建本轮消息（不含页面；页面在每次 LLM 调用前临时注入）
    const loopHistory = [
      ...historyMessages,
      { role: "user", content: buildUserContent(cmd, attachedFiles) },
    ];

    // 快照本轮页面文件（清空附件内容后供 loop 使用）
    let loopPageFile = attachedFiles.find(f => f.isPage) || null;

    // 发送后清空附件栏，让用户重新添加
    attachedFiles = [];
    renderAttachments();

    // 9. 确定 Agent 最大步数（空 = 不限；0 = 不执行任何动作）
    const rawMax  = cfg.agentMaxSteps;
    const maxSteps = (rawMax === '' || rawMax == null)
      ? Infinity
      : Math.max(0, parseInt(rawMax) || 0);

    // roundAgentText、roundSteps、roundMessages 已在 try 外声明，此处无需重复声明

    const _rawHist  = cfg.historyRounds;
    const histRounds = (_rawHist === '' || _rawHist == null) ? Infinity : (parseInt(_rawHist) || 0);
    const actionDelay = typeof cfg.actionDelay === 'number' ? cfg.actionDelay : 500;

    // 10. Agentic loop
    for (let step = 0; step < maxSteps; step++) {
      // 页面内容临时注入到最后一条 user 消息，不存入 loopHistory
      const { fullText, actions } = await streamAgentTurn(injectPageIntoMessages(loopHistory, loopPageFile), agentContent, step > 0, abortController.signal);
      loopHistory.push({ role: "assistant", content: fullText });
      roundMessages.push({ role: "assistant", content: fullText });
      roundAgentText = fullText;  // 持续更新，保留最后一次 LLM 回复

      // 将本步展示文本（去掉全部 ACTION 标签）和操作记录下来，供界面恢复
      const stepDisplay = fullText.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim();
      roundSteps.push({
        text:    stepDisplay || (actions.length > 0 ? (actions.length > 1 ? `Executing ${actions.length} actions…` : 'Executing action…') : ''),
        actions: actions.map(a => JSON.stringify(a)),  // 保存所有动作供恢复
      });

      if (actions.length === 0) break;  // 无操作指令 → 任务完成或需要用户确认

      // 逐个执行所有动作
      for (const action of actions) {
        await dispatchAction(action);
        // navigate 已在 dispatchAction 内等待页面加载完成，无需额外延迟
        // hover 需要较长等待让下拉菜单出现；其他动作按用户配置延迟
        const waitMs = action.type === 'navigate' ? 0
                     : action.type === 'hover'    ? Math.max(actionDelay, 800)
                     : actionDelay;
        if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
        if (abortController.signal.aborted) break;
      }

      if (abortController.signal.aborted) break;

      // 刷新页面快照（供下一步 injectPageIntoMessages 使用）
      loopPageFile = await addCurrentPage(true) || loopPageFile;

      // 续接消息（不含页面；页面由 injectPageIntoMessages 临时注入）
      const continuationMsg = buildContinuationContent(actions, cfg.loopFeedbackPrompt);
      if (continuationMsg) {
        loopHistory.push({ role: "user", content: continuationMsg });
        roundMessages.push({ role: "user", content: continuationMsg });
      }
    }

    agentContent.classList.remove("typing-cursor");
    const wasAborted = abortController?.signal.aborted;
    if (wasAborted) {
      // 中途停止：保留已输出内容，无内容时显示提示
      if (!agentContent.textContent.trim()) {
        agentContent.innerHTML = `<span style="color:${themeVar('--muted-2')}">⏹ Stopped</span>`;
      }
      // 不将 Stopped 文字写入 roundSteps，避免恢复时显示
    } else if (!agentContent.textContent.trim()) {
      agentContent.innerHTML = `<span style="color:${themeVar('--warning')}">⚠️ Server returned no content. The model may have returned an empty response, or the stream format is unexpected.</span>`;
    }

    // 11 & 12. 有内容时才保存（停止且无内容则不存入历史）
    if (roundSteps.length > 0) {
      conversationHistory.push({ userText: cmd, agentText: roundAgentText, roundMessages });
      sessionMessages.push({ type: 'user', text: cmd });
      sessionMessages.push({ type: 'agent-steps', steps: roundSteps });
      await saveSession();
    }

  } catch (err) {
    agentContent.classList.remove("typing-cursor");
    if (err.name === 'AbortError') {
      // 用户主动停止，保留已输出内容
      if (!agentContent.textContent.trim()) {
        agentContent.innerHTML = `<span style="color:${themeVar('--muted-2')}">⏹ Stopped</span>`;
      }
      // 无有任何已完成的步骤时，跳过保存（回复时水假无界面恢复）
      if (roundSteps.length === 0) {
        // 跳过保存
      } else {
        // 不将 Stopped 写入最后一步，恢复时不显示
        sessionMessages.push({ type: 'user', text: cmd });
        sessionMessages.push({ type: 'agent-steps', steps: roundSteps });
        conversationHistory.push({ userText: cmd, agentText: roundAgentText, roundMessages });
        await saveSession();
      }
    } else {
      const errMsg = (err && typeof err.message === 'string') ? err.message : String(err || '');
      const errName = (err && err.name) ? err.name : (typeof err === 'string' ? 'Error' : (err && err.constructor && err.constructor.name) || 'Error');
      const hint = (errMsg.includes("Key") || errMsg.includes("settings"))
        ? "Right-click the page → open the extension settings to configure API Key and model."
        : (err instanceof TypeError)
        ? "Network connection failed. Check the API URL and your network."
        : "";
      const errEl = document.createElement('div');
      errEl.style.cssText = [
        'margin-top:8px', 'padding:8px 10px',
        `background:${themeVar('--danger-bg')}`, `border-left:3px solid ${themeVar('--danger')}`,
        'border-radius:4px', 'font-size:12.5px', `color:${themeVar('--danger')}`, 'line-height:1.6',
      ].join(';');
      errEl.textContent = `❌ Request failed · ${errName}: ${errMsg}`;
      if (hint) {
        const hintEl = document.createElement('div');
        hintEl.style.cssText = `margin-top:4px;font-size:12px;color:${themeVar('--muted-2')};`;
        hintEl.textContent = 'Hint: ' + hint;
        errEl.appendChild(hintEl);
      }
      agentContent.appendChild(errEl);
      scrollToBottom();
      console.error("Agent request failed:", err);
    }
  } finally {
    isWaiting = false;
    abortController = null;
    setRunBtnState('send');
    inputEl.focus();
  }
}

// ─────────────────────────────────────────────
// 辅助：等待标签页加载完成（用于 navigate 后同步）
// ─────────────────────────────────────────────
function waitForTabLoad(tabId, timeout = 10000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }, timeout);
    function onUpdated(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    // 也立即检查一次，防止导航已经完成
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }).catch(() => {});
  });
}

// ─────────────────────────────────────────────
// 辅助：把 action 转发给当前活动标签页执行
// navigate 动作用 chrome.tabs.update 绕过 content script（实现在空白/特殊页上也可导航）
// ─────────────────────────────────────────────
async function dispatchAction(action) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // navigate 用 chrome.tabs.update 直接操作标签页 URL，
    // 不依赖 content script（空白页、chrome:// 页也能正常导航）
    if (action.type === 'navigate') {
      await chrome.tabs.update(tab.id, { url: action.url });
      // 稍候待浏览器开始转跑后，再检测完成事件
      await new Promise(r => setTimeout(r, 150));
      await waitForTabLoad(tab.id);
      // 等待 content script 初始化（document_idle 之后）
      await new Promise(r => setTimeout(r, 300));
      return;
    }

    return await chrome.tabs.sendMessage(tab.id, { type: "EXECUTE_ACTION", action });
  } catch (e) {
    console.warn("dispatchAction failed:", e);
  }
}

// ─────────────────────────────────────────────
// 事件绑定
// ─────────────────────────────────────────────

// 发送/停止按钮（等待中变为停止按钮）
runBtn.addEventListener("click", () => {
  if (isWaiting) {
    abortController?.abort();
  } else {
    sendMessage();
  }
});

// 配置按钮——在侧边栏内打开设置面板
// 每次打开都重载 iframe，确保显示的是已保存的设置，而不是上次未保存的表单状态
document.getElementById("btn-settings").addEventListener("click", () => {
  const frame = document.getElementById("settings-frame");
  frame.src = 'options.html';  // 重载以从 storage 读取最新保存值
  document.getElementById("settings-overlay").style.display = "flex";
});

// 接收 options.html（iframe）发来的关闭/保存消息
window.addEventListener("message", (e) => {
  if (e.data?.type === "settings-saved" || e.data?.type === "settings-close") {
    document.getElementById("settings-overlay").style.display = "none";
    // 仅保存时才重新加载配置，刷新语言 + 顶部模型信息栏
    if (e.data.type === "settings-saved") {
      loadConfig().then(cfg => {
        applyTheme(cfg.theme);
        I18n.setLang(cfg.language);
        I18n.apply();
        const p = PROVIDERS[cfg.provider] || PROVIDERS.ollama;
        modelInfoEl.textContent = `${p.name} · ${cfg.model || I18n.t('model_not_set')}`;
      });
    }
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;

  if (changes.theme) {
    applyTheme(normalizeTheme(changes.theme.newValue));
  }

  if (changes.userLang) {
    I18n.setLang(changes.userLang.newValue || 'en');
    I18n.apply();
  }

  if (changes.provider || changes.model) {
    loadConfig().then(cfg => {
      const p = PROVIDERS[cfg.provider] || PROVIDERS.ollama;
      modelInfoEl.textContent = `${p.name} · ${cfg.model || I18n.t('model_not_set')}`;
    });
  }
});

systemThemeMedia.addEventListener('change', () => {
  loadConfig().then(cfg => {
    if (cfg.theme === 'device') {
      applyTheme('device');
    }
  });
});

// Enter 发送，Shift+Enter 换行；自动增高
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
});

// 新建对话：清空消息列表，重新显示欢迎页
btnNew.addEventListener("click", () => {
  messagesEl.innerHTML = "";
  welcomeEl.style.display = "flex";
  inputEl.value = "";
  inputEl.style.height = "auto";
  attachedFiles = [];
  conversationHistory = [];
  sessionMessages = [];
  chrome.storage.local.remove('chatSession');
  renderAttachments();
  addCurrentPage();
  inputEl.focus();
});

// ─────────────────────────────
// 拖放文件进入
// ─────────────────────────────
footerEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  footerEl.classList.add("drag-over");
});
footerEl.addEventListener("dragleave", (e) => {
  // 只有离开 footer 整个区域才移除高亮
  if (!footerEl.contains(e.relatedTarget)) {
    footerEl.classList.remove("drag-over");
  }
});
footerEl.addEventListener("drop", (e) => {
  e.preventDefault();
  footerEl.classList.remove("drag-over");
  const files = Array.from(e.dataTransfer.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      attachedFiles.push({ name: file.name, content: ev.target.result, isPage: false });
      renderAttachments();
    };
    reader.readAsText(file);
  });
});

// 建议词点击：直接填入输入框并发送
document.getElementById("suggestions").addEventListener("click", (e) => {
  const chip = e.target.closest(".suggestion-chip");
  if (!chip) return;
  inputEl.value = chip.textContent;
  sendMessage();
});