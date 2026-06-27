// ===== options.js =====

// 同步立即应用英文（CSP 禁止 HTML 内联脚本，故在此处执行）
I18n.apply();

const PROVIDERS = {
  ollama: {
    name:           "Ollama",
    hints:          ["qwen3:8b", "qwen2.5:7b", "llama3.2:3b", "llama3.1:8b", "deepseek-r1:7b", "gemma3:4b", "mistral:7b"],
    keyPlaceholder: "ollama（本地服务无需 Key，留空即可）",
    keyDesc:        "Ollama 本地服务不校验 API Key，留空或填任意字符均可。",
    defaultKey:     "ollama",
  },
  cliproxy: {
    name:           "CLI Proxy API",
    hints:          ["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-5", "o3-mini", "gemini-2.0-flash"],
    keyPlaceholder: "sk-...",
    keyDesc:        "填写 CLI Proxy API 所要求的访问密钥。",
    endpointPlaceholder: "https://your-proxy.example.com/v1/chat/completions",
    endpointDesc:   "CLI Proxy API 的聊天补全接口地址。通常填写完整的 OpenAI 兼容 chat/completions 端点。",
    defaultKey:     "",
    needsEndpoint:  true,
  },
  openrouter: {
    name:           "OpenRouter",
    hints:          [
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-r1:free",
      "google/gemini-2.0-flash-exp:free",
      "google/gemma-4-31b-it:free",
      "openrouter/auto",
      "meta-llama/llama-3-8b-instruct",
    ],
    keyPlaceholder: "sk-or-v1-...",
    keyDesc:        "在 openrouter.ai → Keys 页面创建 API Key。",
    defaultKey:     "",
  },
  deepseek: {
    name:           "DeepSeek",
    hints:          ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"],
    keyPlaceholder: "sk-...",
    keyDesc:        "在 platform.deepseek.com → API Keys 页面获取。",
    defaultKey:     "",
  },
  siliconflow: {
    name:           "SiliconFlow",
    hints:          ["Qwen/Qwen3-8B", "Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1", "THUDM/GLM-4-9B-Chat"],
    keyPlaceholder: "sk-...",
    keyDesc:        "在 cloud.siliconflow.cn → API Keys 页面创建。",
    defaultKey:     "",
  },
  aistudio: {
    name:           "Google AI Studio",
    hints:          ["gemini-2.0-flash", "gemini-2.5-pro-exp-03-25", "gemini-1.5-pro", "gemini-1.5-flash", "gemma-4-31b-it"],
    keyPlaceholder: "AIzaSy...",
    keyDesc:        "在 aistudio.google.com → Get API Key 页面创建。",
    defaultKey:     "",
  },
  copilot: {
    name:           "GitHub Copilot",
    hints:          ["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-5", "o3-mini", "gemini-2.0-flash"],
    keyPlaceholder: "",
    keyDesc:        "",
    defaultKey:     "",
    noApiKey:       true, // 授权由 GitHub 设备流管理
  },
};

const DEFAULT_API_KEYS = { ollama: "ollama", cliproxy: "", openrouter: "", deepseek: "", siliconflow: "", aistudio: "", copilot: "" };
const DEFAULT_ENDPOINTS = { cliproxy: "" };

// 内置系统提示词（发布前将该常量更新为目标内容）
const DEFAULT_SYSTEM_PROMPT =
  "You are an intelligent assistant embedded in the browser sidebar, and also a page interaction tool.\n" +
  "The user will provide the current page's \"DOM HTML\". Use the DOM structure to identify and locate elements to act on.\n\n" +
  "When you need to interact with the page, briefly describe what you are about to do, then append the action command at the end of your response:\n" +
  "  Click:         <ACTION>{\"type\":\"click\",\"selector\":\"button.submit-btn\"}</ACTION>\n" +
  "  Ctrl+Click:    <ACTION>{\"type\":\"click\",\"selector\":\"a.result\",\"modifiers\":[\"ctrl\"]}</ACTION>\n" +
  "  Double-click:  <ACTION>{\"type\":\"double_click\",\"selector\":\".editable-cell\"}</ACTION>\n" +
  "  Right-click:   <ACTION>{\"type\":\"right_click\",\"selector\":\".item\"}</ACTION>\n" +
  "  Type:          <ACTION>{\"type\":\"type\",\"selector\":\"input[name='q']\",\"text\":\"search content\"}</ACTION>\n" +
  "  Select:        <ACTION>{\"type\":\"select\",\"selector\":\"select#category\",\"value\":\"option\"}</ACTION>\n" +
  "  Press key:     <ACTION>{\"type\":\"key\",\"key\":\"Enter\"}</ACTION>\n" +
  "  Key on el:     <ACTION>{\"type\":\"key\",\"selector\":\".dropdown\",\"key\":\"ArrowDown\"}</ACTION>\n" +
  "  Navigate:      <ACTION>{\"type\":\"navigate\",\"url\":\"https://example.com\"}</ACTION>\n" +
  "  Scroll:        <ACTION>{\"type\":\"scroll\",\"y\":300}</ACTION>\n" +
  "  Hover:         <ACTION>{\"type\":\"hover\",\"selector\":\".menu-item\"}</ACTION>\n" +
  "  Clear:         <ACTION>{\"type\":\"clear\",\"selector\":\"input#search\"}</ACTION>\n\n" +
  "Rules:\n" +
  "- selector must be a CSS selector string derived from the DOM HTML \u2014 do not guess\n" +
  "- Prefer stable attributes: id > name > aria-label > data-testid > class\n" +
  "- Output one or more <ACTION> tags per turn; if a next action depends on the previous result (e.g. waiting for a page to load before locating an element), output them one at a time; if several actions are deterministic (e.g. filling multiple fields in sequence), you may output multiple <ACTION> tags in a single reply — all will be executed in order before the updated page state is fed back to you\n" +
  "- If no page interaction is needed, reply in Markdown only \u2014 do not output <ACTION>\n" +
  "- If a suitable element is not found in the DOM, tell the user instead of guessing\n" +
  "- Some elements (e.g. hover menus) are absent from the initial DOM; hover over the parent first to trigger rendering, then act on the target\n";

// 内置循环反馈提示词默认值
const DEFAULT_LOOP_FEEDBACK_PROMPT =
  "{{actions}}. Please continue completing the user's task. " +
  "If the task is fully completed, inform the user of the result and do not output any more <ACTION>.";

// ── DOM 引用 ──
const providerSelect    = document.getElementById("provider-select");
const modelInput        = document.getElementById("model-input");
const modelHints        = document.getElementById("model-hints");
const apikeyInput       = document.getElementById("apikey-input");
const endpointInput     = document.getElementById("endpoint-input");
const toggleKeyBtn      = document.getElementById("toggle-key");
const toggleKeyIcon     = document.getElementById("toggle-key-icon");
const keyDesc           = document.getElementById("key-desc");
const endpointDesc      = document.getElementById("endpoint-desc");
const saveBtn           = document.getElementById("save-btn");
const saveMsg           = document.getElementById("save-msg");
const systemPromptInput = document.getElementById("system-prompt");
const skillsList        = document.getElementById("skills-list");
const addSkillBtn       = document.getElementById("add-skill-btn");
const languageSelect    = document.getElementById("language-select");
const themeSelect       = document.getElementById("theme-select");
const historyRoundsInput = document.getElementById("history-rounds");
const agentMaxStepsInput = document.getElementById("agent-max-steps");
const actionDelayInput   = document.getElementById("action-delay");
const loopFeedbackPromptInput = document.getElementById("loop-feedback-prompt");

// ── GitHub Copilot DOM 引用 ──
const apikeySection    = document.getElementById("apikey-section");
const endpointSection  = document.getElementById("endpoint-section");
const ghCopilotSection = document.getElementById("gh-copilot-section");
const ghStatusText     = document.getElementById("gh-status-text");
const ghAuthFlow       = document.getElementById("gh-auth-flow");
const ghVerifyLink     = document.getElementById("gh-verify-link");
const ghUserCode       = document.getElementById("gh-user-code");
const ghCopyBtn        = document.getElementById("gh-copy-btn");
const ghOpenBtn        = document.getElementById("gh-open-btn");
const ghWaitingText    = document.getElementById("gh-waiting-text");
const ghConnectBtn     = document.getElementById("gh-connect-btn");
const ghDisconnectBtn  = document.getElementById("gh-disconnect-btn");

// 当前所有平台已保存的 Key（切换平台时需要保留其他平台的值）
let currentApiKeys    = { ...DEFAULT_API_KEYS };
let currentEndpoints  = { ...DEFAULT_ENDPOINTS };
// 当前各平台的自定义常用模型列表
let currentCustomHints = {};

// 设备授权轮询中止信号
let _pollAbort = false;
const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');

// ─────────────────────────────────────────────
// 存储操作
// ─────────────────────────────────────────────
function loadConfig() {
  return new Promise(resolve => chrome.storage.sync.get(null, resolve));
}

function saveConfig(data) {
  return new Promise(resolve => chrome.storage.sync.set(data, resolve));
}

function normalizeTheme(theme) {
  return theme === 'dark' || theme === 'light' || theme === 'device' ? theme : 'light';
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

function getThemeColor(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

// ─────────────────────────────────────────────
// 切换平台时更新提示/Key 字段
// ─────────────────────────────────────────────
function onProviderChange() {
  const pid  = providerSelect.value;
  const conf = PROVIDERS[pid];

  // GitHub Copilot：隐藏 API Key 区，显示 GitHub 授权区
  if (conf.noApiKey) {
    apikeySection.style.display    = 'none';
    endpointSection.style.display  = 'none';
    ghCopilotSection.style.display = '';
  } else {
    apikeySection.style.display    = '';
    ghCopilotSection.style.display = 'none';

    // 更新 Key 字段（显示该平台已保存的 Key）
    apikeyInput.value       = currentApiKeys[pid] || "";
    apikeyInput.placeholder = I18n.t('key_ph_' + pid);
    keyDesc.textContent     = I18n.t('key_desc_' + pid);

    if (conf.needsEndpoint) {
      endpointSection.style.display = '';
      endpointInput.value = currentEndpoints[pid] || "";
      endpointInput.placeholder = I18n.t('endpoint_ph_' + pid);
      endpointDesc.textContent = I18n.t('endpoint_desc_' + pid);
    } else {
      endpointSection.style.display = 'none';
      endpointInput.value = '';
    }
  }

  // 渲染模型提示 chips
  renderHints();
}

// 渲染常用模型列表（支持删除 + 添加）
function renderHints() {
  const pid   = providerSelect.value;
  // 首次访问该平台时，用默认列表初始化
  if (!currentCustomHints[pid]) {
    currentCustomHints[pid] = [...(PROVIDERS[pid].hints || [])];
  }
  const hints = currentCustomHints[pid];

  modelHints.innerHTML = "";
  hints.forEach((hint, idx) => {
    const chip = document.createElement("div");
    chip.className = "hint-chip";

    const label = document.createElement("span");
    label.textContent = hint;
    label.addEventListener("click", () => {
      modelInput.value = hint;
      modelInput.focus();
    });

    const removeBtn = document.createElement("button");
    removeBtn.className   = "hint-chip-remove";
    removeBtn.textContent = "×";
    removeBtn.title       = "移除";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hints.splice(idx, 1);
      renderHints();
    });

    chip.appendChild(label);
    chip.appendChild(removeBtn);
    chip.addEventListener("click", (e) => {
      if (e.target !== removeBtn) {
        modelInput.value = hint;
        modelInput.focus();
      }
    });
    modelHints.appendChild(chip);
  });

  // 加号按钮
  const addBtn = document.createElement("button");
  addBtn.className   = "hint-add-btn";
  addBtn.textContent = "+";
  addBtn.title       = I18n.t('btn_add_model_hint');
  addBtn.addEventListener("click", () => {
    addBtn.remove();
    const inp = document.createElement("input");
    inp.type        = "text";
    inp.placeholder = I18n.t('model_hint_placeholder');
    inp.style.cssText = `font-size:11.5px;font-family:Consolas,monospace;border:1px solid ${getThemeColor('--blue')};border-radius:12px;padding:3px 10px;outline:none;width:150px;background:${getThemeColor('--surface')};color:${getThemeColor('--text')};`;
    const confirm = () => {
      const val = inp.value.trim();
      if (val) hints.push(val);
      renderHints();
    };
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter")  confirm();
      if (e.key === "Escape") renderHints();
    });
    inp.addEventListener("blur", confirm);
    modelHints.appendChild(inp);
    inp.focus();
  });
  modelHints.appendChild(addBtn);
}

// ─────────────────────────────────────────────
// Skill 卡片
// ─────────────────────────────────────────────
function addSkillCard(name = "", content = "") {
  const card = document.createElement("div");
  card.className = "skill-card";

  const header = document.createElement("div");
  header.className = "skill-header";

  const nameInput = document.createElement("input");
  nameInput.type          = "text";
  nameInput.className     = "skill-name";
  nameInput.placeholder   = I18n.t('skill_name_ph');
  nameInput.value         = name;
  nameInput.spellcheck    = false;
  nameInput.autocomplete  = "off";

  const removeBtn = document.createElement("button");
  removeBtn.type        = "button";
  removeBtn.className   = "skill-remove";
  removeBtn.textContent = "×";
  removeBtn.title       = I18n.t('skill_remove_title');
  removeBtn.addEventListener("click", () => card.remove());

  header.appendChild(nameInput);
  header.appendChild(removeBtn);

  const contentArea = document.createElement("textarea");
  contentArea.className   = "skill-content";
  contentArea.placeholder = I18n.t('skill_content_ph');
  contentArea.rows        = 3;
  contentArea.spellcheck  = false;
  contentArea.value       = content;

  card.appendChild(header);
  card.appendChild(contentArea);
  skillsList.appendChild(card);
}

function collectSkills() {
  return Array.from(skillsList.querySelectorAll(".skill-card")).map(card => ({
    name:    card.querySelector(".skill-name").value.trim(),
    content: card.querySelector(".skill-content").value.trim(),
  })).filter(s => s.name || s.content);
}

addSkillBtn.addEventListener("click", () => addSkillCard());

// ─────────────────────────────────────────────
// GitHub Copilot 设备授权
// ─────────────────────────────────────────────

// 刷新 GitHub Copilot 授权状态 UI
async function refreshGhStatus() {
  const user = await GitHubAuth.getConnectedUser();
  if (user) {
    ghStatusText.textContent     = `${I18n.t('gh_connected_as')}: @${user}`;
    ghStatusText.style.color     = getThemeColor('--success-strong');
    ghConnectBtn.style.display   = 'none';
    ghDisconnectBtn.style.display = '';
    ghAuthFlow.style.display     = 'none';
  } else {
    ghStatusText.textContent     = I18n.t('gh_not_connected');
    ghStatusText.style.color     = getThemeColor('--muted-2');
    ghConnectBtn.style.display   = '';
    ghDisconnectBtn.style.display = 'none';
    ghAuthFlow.style.display     = 'none';
  }
}

// 复制验证码
ghCopyBtn.addEventListener('click', () => {
  const code = ghUserCode.textContent;
  if (code) {
    navigator.clipboard.writeText(code).then(() => {
      ghCopyBtn.textContent = '✓';
      setTimeout(() => { ghCopyBtn.textContent = I18n.t('gh_copy_code'); }, 1500);
    });
  }
});

// 连接 GitHub 账号（开始设备授权流程）
ghConnectBtn.addEventListener('click', async () => {
  _pollAbort = false;
  ghConnectBtn.disabled    = true;
  ghConnectBtn.textContent = '...';

  try {
    const { device_code, user_code, verification_uri, expires_in, interval } =
      await GitHubAuth.startDeviceFlow();

    // 显示验证码和授权链接
    ghUserCode.textContent   = user_code;
    ghVerifyLink.textContent = verification_uri;
    ghVerifyLink.href        = verification_uri;
    ghOpenBtn.href           = verification_uri;
    ghAuthFlow.style.display = '';
    ghWaitingText.textContent = I18n.t('gh_waiting');

    // 轮询直到授权完成或超时
    const expiresAt = Date.now() + expires_in * 1000;
    const oauthToken = await GitHubAuth.pollForToken(device_code, interval, () => {
      if (_pollAbort) throw new Error('aborted');
      if (Date.now() > expiresAt) throw new Error('expired');
    });

    // 授权成功
    await GitHubAuth.saveOAuthToken(oauthToken);
    ghWaitingText.textContent = I18n.t('gh_auth_success');
    ghWaitingText.style.color = getThemeColor('--success-strong');
    setTimeout(async () => {
      ghWaitingText.style.color = '';
      await refreshGhStatus();
    }, 1500);

  } catch (e) {
    ghAuthFlow.style.display = 'none';
    const msg = e.message === 'expired'  ? I18n.t('gh_auth_expired')
               : e.message === 'denied'  ? I18n.t('gh_auth_denied')
               : e.message === 'aborted' ? ''
               : I18n.t('gh_auth_error');
    if (msg) {
      ghStatusText.textContent = msg;
      ghStatusText.style.color = getThemeColor('--danger-strong');
    }
    ghConnectBtn.disabled    = false;
    ghConnectBtn.textContent = I18n.t('gh_connect_btn');
  }
});

// 断开连接
ghDisconnectBtn.addEventListener('click', async () => {
  _pollAbort = true;
  await GitHubAuth.logout();
  await refreshGhStatus();
});

// 语言切换即时生效
languageSelect.addEventListener("change", () => {
  I18n.setLang(languageSelect.value);
  I18n.apply();
  onProviderChange(); // 重新渲染 keyDesc 和 hints
});

themeSelect.addEventListener("change", () => {
  applyTheme(themeSelect.value);
});

systemThemeMedia.addEventListener('change', () => {
  if (themeSelect.value === 'device') {
    applyTheme('device');
  }
});

// ─────────────────────────────────────────────
// 侧边栏内嵌模式：检测是否在 iframe 中运行
// ─────────────────────────────────────────────
const inPanel = window.self !== window.top;
if (inPanel) {
  document.body.classList.add('in-panel');
  const closePanel = () => window.parent.postMessage({ type: 'settings-close' }, '*');
  document.getElementById('btn-back').addEventListener('click', closePanel);
  document.getElementById('btn-back-bottom').addEventListener('click', closePanel);
}

// ─────────────────────────────────────────────
// 保存
// ─────────────────────────────────────────────
async function onSave() {
  const pid = providerSelect.value;

  // copilot 的认证由 GitHubAuth 独立管理，不写入 apiKeys
  if (pid !== 'copilot') {
    currentApiKeys[pid] = apikeyInput.value.trim();
  }

  if (PROVIDERS[pid]?.needsEndpoint) {
    currentEndpoints[pid] = endpointInput.value.trim();
  }

  await saveConfig({
    provider:     pid,
    model:        modelInput.value.trim(),
    apiKeys:      { ...currentApiKeys },
    endpoints:    { ...currentEndpoints },
    customHints:  { ...currentCustomHints },
    systemPrompt: systemPromptInput.value.trim(),
    loopFeedbackPrompt: loopFeedbackPromptInput.value,
    skills:       collectSkills(),
    language:     languageSelect.value,
    userLang:     languageSelect.value,
    theme:        themeSelect.value,
    historyRounds: historyRoundsInput.value.trim(),
    agentMaxSteps: agentMaxStepsInput.value.trim(),
    actionDelay:   actionDelayInput.value !== '' ? (parseInt(actionDelayInput.value) || 0) : 0,
  });

  // 显示保存成功提示
  saveMsg.classList.add("visible");
  setTimeout(() => saveMsg.classList.remove("visible"), 2000);

  // 如果在侧边栏 iframe 中，通知父页面已保存
  if (inPanel) {
    window.parent.postMessage({ type: 'settings-saved' }, '*');
  }
}

// ─────────────────────────────────────────────
// 显示/隐藏 Key
// ─────────────────────────────────────────────
function syncToggleKeyIcon() {
  const isHidden = apikeyInput.type === "password";
  toggleKeyIcon.src = isHidden ? "assets/icons/show.svg" : "assets/icons/hide.svg";
  toggleKeyIcon.alt = isHidden ? "Show password" : "Hide password";
}

toggleKeyBtn.addEventListener("click", () => {
  if (apikeyInput.type === "password") {
    apikeyInput.type         = "text";
  } else {
    apikeyInput.type         = "password";
  }
  syncToggleKeyIcon();
});

syncToggleKeyIcon();

// 实时同步输入的 Key 到内存（切换平台前自动保留）
apikeyInput.addEventListener("input", () => {
  currentApiKeys[providerSelect.value] = apikeyInput.value;
});

endpointInput.addEventListener("input", () => {
  currentEndpoints[providerSelect.value] = endpointInput.value;
});

providerSelect.addEventListener("change", () => {
  modelInput.value = '';  // 切换平台时清空模型名称
  onProviderChange();
  if (providerSelect.value === 'copilot') refreshGhStatus();
});

// 恢复系统提示词默认值
document.getElementById('reset-prompt-btn').addEventListener('click', () => {
  systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
  systemPromptInput.focus();
});

// 恢复循环反馈提示词默认值
document.getElementById('reset-loop-feedback-btn').addEventListener('click', () => {
  loopFeedbackPromptInput.value = DEFAULT_LOOP_FEEDBACK_PROMPT;
  loopFeedbackPromptInput.focus();
});
saveBtn.addEventListener("click", onSave);

// ─────────────────────────────────────────────
// 初始化：读取已保存配置并填入表单
// ─────────────────────────────────────────────
(async () => {
  const stored = await loadConfig();

  // 先应用语言；用 userLang 键（新键，旧存储没有此值时默认英文）
  const effectiveLang = stored.userLang || 'en';
  // 仅当存储语言与已渲染语言不同时才重新 apply，避免 DOM 变更关闭已打开的下拉框
  if (I18n.lang !== effectiveLang) {
    I18n.setLang(effectiveLang);
    I18n.apply();
  }

  const effectiveTheme = normalizeTheme(stored.theme);
  applyTheme(effectiveTheme);

  if (stored.provider && PROVIDERS[stored.provider]) {
    providerSelect.value = stored.provider;
  }

  if (stored.model) {
    modelInput.value = stored.model;
  } else {
    // 首次未保存时，根据当前平台给出默认模型名
    const _defaultModels = { deepseek: 'deepseek-v4-flash', siliconflow: 'Qwen/Qwen3-8B', cliproxy: 'gpt-4o', ollama: 'qwen3:8b', aistudio: 'gemini-2.0-flash' };
    modelInput.value = _defaultModels[providerSelect.value] || '';
  }

  if (stored.apiKeys) {
    Object.assign(currentApiKeys, stored.apiKeys);
  }

  if (stored.endpoints && typeof stored.endpoints === 'object') {
    Object.assign(currentEndpoints, stored.endpoints);
  }

  if (stored.customHints && typeof stored.customHints === 'object') {
    Object.assign(currentCustomHints, stored.customHints);
  }

  // 系统提示词：显示已保存的值，首次未保存则显示默认值
  systemPromptInput.value = stored.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

  // 循环反馈提示词
  loopFeedbackPromptInput.value = stored.loopFeedbackPrompt !== undefined ? stored.loopFeedbackPrompt : DEFAULT_LOOP_FEEDBACK_PROMPT;

  if (Array.isArray(stored.skills) && stored.skills.length > 0) {
    stored.skills.forEach(s => addSkillCard(s.name || "", s.content || ""));
  }

  languageSelect.value = effectiveLang;
  themeSelect.value = effectiveTheme;

  historyRoundsInput.value = stored.historyRounds != null ? stored.historyRounds : 3;

  if (stored.agentMaxSteps != null && stored.agentMaxSteps !== '') {
    agentMaxStepsInput.value = stored.agentMaxSteps;
  }

  actionDelayInput.value = stored.actionDelay != null ? stored.actionDelay : 500;

  onProviderChange();  // 渲染当前平台的 Key / 提示

  // 如果当前平台是 copilot，刷新授权状态
  if ((stored.provider || 'ollama') === 'copilot') {
    refreshGhStatus();
  }
})();
