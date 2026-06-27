// ===== i18n.js =====
// 国际化工具：支持中文 / 英文，语言偏好存储在 chrome.storage.sync
// 暴露 window.I18n：t(key)、setLang(lang)、apply([root])

(function (global) {
  'use strict';

  const STRINGS = {
    zh: {
      // ── Panel ──────────────────────────────────────────────────
      welcome_title:       '你好，我是 Chromium',
      welcome_desc:        '我可以帮你操作网页、回答问题或总结内容。',
      chip_summarize:      '总结这个页面',
      chip_click_login:    '帮我点击登录按钮',
      chip_what_page:      '这个页面是做什么的？',
      chip_extract_links:  '提取页面中的链接',
      input_placeholder:   '向 Chromium 提问…',
      disclaimer:          'Chromium 可能会出错，请核实重要信息。',
      loading_config:      '加载配置中…',
      btn_new_title:       '新建对话',
      btn_settings_title:  '配置模型 / API Key',
      btn_send_title:      '发送',
      model_not_set:       '未设置模型',
      remove_chip:         '移除',
      // ── Options ──────────────────────────────────────────────────
      settings_title:      '⚙ Chromium 配置',
      settings_subtitle:   '选择 API 平台，填写模型名称和 API Key 后点击保存。切换平台时会自动加载对应已保存的 Key。',
      btn_back:            '← 返回聊天',
      label_provider:      'API 平台',
      label_model:         '模型名称',
      model_placeholder:   '输入模型名称',
      hints_label:         '常用模型（点击填入）：',
      hint_chip_title:     '点击填入',
      label_apikey:        'API Key',
      label_endpoint:      '端点地址',
      toggle_key_title:    '显示 / 隐藏',
      label_system_prompt: '系统提示词（System Prompt）',
      sys_prompt_ph:       '留空则不向模型传递系统提示词',
      sys_prompt_desc:     '可自定义系统提示词，留空则不传给模型。',
      btn_reset_prompt:    '恢复默认',
      label_loop_feedback: '循环反馈提示词（Loop Feedback Prompt）',
      loop_feedback_ph:    '留空则不向模型发送续接消息',
      loop_feedback_desc:  '每轮 Agent 操作执行完毕后发回给模型的指令。{{actions}} 会替换为本轮执行的动作摘要。留空则不发送续接消息。',
      btn_reset_loop_feedback: '恢复默认',
      label_skills:        '自定义 Skills',
      skills_desc:         '每个 Skill 的名称和内容会以列表形式追加到系统提示词末尾，一起发送给模型。',
      label_language:      '语言',
      label_theme:         '主题',
      theme_device:        '系统',
      theme_light:         '浅色',
      theme_dark:          '暗色',
      btn_save:            '保存',
      btn_back_bottom:     '返回',
      save_success:        '✓ 已保存',
      skill_name_ph:       'Skill 名称',
      skill_content_ph:    'Skill 内容（发送给模型的提示文本）…',
      skill_remove_title:  '删除此 Skill',
      btn_add_skill:       '＋ 添加 Skill',
      btn_add_model_hint:  '添加模型',
      btn_add_page_title:  '添加当前页面',
      model_hint_placeholder: '输入模型名…',
      endpoint_ph_cli_proxy: 'https://your-proxy.example.com/v1/chat/completions',
      endpoint_desc_cli_proxy: 'CLI Proxy API 的聊天补全接口地址。通常填写完整的 OpenAI 兼容 chat/completions 端点。',
      // ── 历史轮数 + Agent 步数 ───────────────────────────────────────────
      label_history_rounds: '历史对话轮数',
      history_rounds_ph:    '留空不限制，0 不保留',
      history_rounds_desc:  '发送消息时携带前面多少轮对话作为上下文。留空表示不限制；填 0 表示不保留历史。不限制时可能触发上下文长度上限。',
      label_agent_max_steps: 'Agent 最大步数',
      agent_max_steps_ph:   '留空表示不限制',
      agent_max_steps_desc: 'Agent 连续自动执行操作的最大步数。留空表示不限制；填 0 表示不执行任何动作。',
      // ── API Key placeholders & descriptions ──────────────────────
      key_ph_ollama:       'ollama（本地服务无需 Key，留空即可）',
      key_ph_cliproxy:     'sk-...',
      key_ph_openrouter:   'sk-or-v1-...',
      key_ph_deepseek:     'sk-...',
      key_ph_siliconflow:  'sk-...',
      key_ph_aistudio:     'AIzaSy...',
      key_desc_ollama:     'Ollama 本地服务不校验 API Key，留空或填任意字符均可。',
      key_desc_cliproxy:   'CLI Proxy API 的访问密钥，用于让代理服务识别你的调用权限。',
      key_desc_openrouter: '在 openrouter.ai → Keys 页面创建 API Key。',
      key_desc_deepseek:   '在 platform.deepseek.com → API Keys 页面获取。',
      key_desc_siliconflow:'在 cloud.siliconflow.cn → API Keys 页面创建 API Key。',
      key_desc_aistudio:   '在 aistudio.google.com → Get API Key 页面创建。',
      // ── GitHub Copilot 授权 ──────────────────────────────────────
      gh_label_auth:       'GitHub Copilot 授权',
      gh_not_connected:    '未连接 GitHub 账号',
      gh_connected_as:     '已连接',
      gh_connect_btn:      '连接 GitHub 账号',
      gh_disconnect:       '断开连接',
      gh_code_tip:         '请访问',
      gh_code_tip2:        '并输入验证码：',
      gh_copy_code:        '复制',
      gh_open_github:      '打开授权页面',
      gh_waiting:          '等待授权中，请在浏览器中完成操作…',
      gh_auth_success:     '✓ 授权成功！',
      gh_auth_expired:     '验证码已过期，请重新点击连接',
      gh_auth_denied:      '用户取消了授权',
      gh_auth_error:       '授权失败，请重试',
      // ── Element picker ───────────────────────────────────────────
      picker_selected_el:       '已选取元素',
      picker_el_name:           '元素名称',
      picker_copy:              '复制',
      picker_copied:            '✓ 已复制',
      picker_action_templates:  'ACTION 模板',
      picker_action_desc:       '复制后可直接粘贴到对话框，作为操作指令使用',
      picker_act_click:         '点击',
      picker_act_type:          '输入',
      picker_act_clear:         '清空',
      picker_act_select:        '选择',
      picker_act_hover:         '悬停',
      picker_continue:          '继续选择下一个元素…',
      // ── Action delay ────────────────────────────────────────────
      label_action_delay:  '动作延迟（毫秒）',
      action_delay_ph:     '500（默认）',
      action_delay_desc:   '每个动作执行完毕后等待的时间（ms）。增大此值可避免操作过快导致页面未响应。留空或 0 表示不延迟。',
    },

    en: {
      // ── Panel ──────────────────────────────────────────────────
      welcome_title:       "Hi, I'm Chromium",
      welcome_desc:        'I can help you interact with web pages, answer questions, or summarize content.',
      chip_summarize:      'Summarize this page',
      chip_click_login:    'Click the login button',
      chip_what_page:      'What is this page about?',
      chip_extract_links:  'Extract links from this page',
      input_placeholder:   'Ask Chromium...',
      disclaimer:          'Chromium can make mistakes. Check important info.',
      loading_config:      'Loading config...',
      btn_new_title:       'New chat',
      btn_settings_title:  'Configure model / API Key',
      btn_send_title:      'Send',
      model_not_set:       'Model not set',
      remove_chip:         'Remove',
      // ── Options ──────────────────────────────────────────────────
      settings_title:      '⚙ Chromium Settings',
      settings_subtitle:   'Select an API platform, fill in the model name and API Key, then click Save. Saved keys load automatically when switching platforms.',
      btn_back:            '← Back to Chat',
      label_provider:      'API Platform',
      label_model:         'Model Name',
      model_placeholder:   'Enter model name',
      hints_label:         'Common models (click to fill):',
      hint_chip_title:     'Click to fill',
      label_apikey:        'API Key',
      label_endpoint:      'Endpoint URL',
      toggle_key_title:    'Show / Hide',
      label_system_prompt: 'System Prompt',
      sys_prompt_ph:       'Leave blank to send no system prompt to the model',
      sys_prompt_desc:     'Customizable system prompt. Leave blank to omit it entirely.',
      btn_reset_prompt:    'Reset to Default',
      label_loop_feedback: 'Loop Feedback Prompt',
      loop_feedback_ph:    'Leave blank to send no continuation message to the model',
      loop_feedback_desc:  'Instruction sent back to the model after each Agent action round. {{actions}} is replaced with a summary of the executed actions. Leave blank to skip.',
      btn_reset_loop_feedback: 'Reset to Default',
      label_skills:        'Custom Skills',
      skills_desc:         "Each skill's name and content will be appended to the system prompt and sent to the model.",
      label_language:      'Language',
      label_theme:         'Theme',
      theme_device:        'Device',
      theme_light:         'Light',
      theme_dark:          'Dark',
      btn_save:            'Save',
      btn_back_bottom:     'Back',
      save_success:        '✓ Saved',
      skill_name_ph:       'Skill name',
      skill_content_ph:    'Skill content (prompt text sent to the model)…',
      skill_remove_title:  'Remove skill',
      btn_add_skill:       '+ Add Skill',
      btn_add_model_hint:  'Add model',
      btn_add_page_title:  'Add current page',
      model_hint_placeholder: 'Enter model name…',
      endpoint_ph_cli_proxy: 'https://your-proxy.example.com/v1/chat/completions',
      endpoint_desc_cli_proxy: 'The chat completions endpoint for CLI Proxy API. Usually this is the full OpenAI-compatible chat/completions URL.',
      // ── History Rounds + Agent Max Steps ────────────────────────────────
      label_history_rounds: 'History Rounds',
      history_rounds_ph:    'Leave blank for unlimited',
      history_rounds_desc:  'Number of past rounds included as context. Leave blank for unlimited; set to 0 to retain no history. Unlimited may hit the context length limit.',
      label_agent_max_steps: 'Agent Max Steps',
      agent_max_steps_ph:   'Leave blank for unlimited',
      agent_max_steps_desc: 'Maximum consecutive steps the agent may execute automatically. Leave blank for unlimited; set to 0 to execute no actions.',
      // ── API Key placeholders & descriptions ──────────────────────
      key_ph_ollama:       'ollama (no Key required for local service)',
      key_ph_cliproxy:     'sk-...',
      key_ph_openrouter:   'sk-or-v1-...',
      key_ph_deepseek:     'sk-...',
      key_ph_siliconflow:  'sk-...',
      key_ph_aistudio:     'AIzaSy...',
      key_desc_ollama:     'Ollama local service does not require an API Key — leave blank or use any value.',
      key_desc_cliproxy:   'The access key required by your CLI Proxy API service.',
      key_desc_openrouter: 'Create an API Key at openrouter.ai → Keys.',
      key_desc_deepseek:   'Get your API Key at platform.deepseek.com → API Keys.',
      key_desc_siliconflow:'Create an API Key at cloud.siliconflow.cn → API Keys.',
      key_desc_aistudio:   'Create an API Key at aistudio.google.com → Get API Key.',
      // ── GitHub Copilot Auth ──────────────────────────────────────
      gh_label_auth:       'GitHub Copilot Auth',
      gh_not_connected:    'Not connected to GitHub',
      gh_connected_as:     'Connected',
      gh_connect_btn:      'Connect GitHub Account',
      gh_disconnect:       'Disconnect',
      gh_code_tip:         'Go to',
      gh_code_tip2:        'and enter the code:',
      gh_copy_code:        'Copy',
      gh_open_github:      'Open Auth Page',
      gh_waiting:          'Waiting for authorization in browser…',
      gh_auth_success:     '✓ Authorized!',
      gh_auth_expired:     'Code expired. Click Connect again.',
      gh_auth_denied:      'Authorization cancelled by user.',
      gh_auth_error:       'Authorization failed. Please retry.',
      // ── Element picker ───────────────────────────────────────────
      picker_selected_el:       'Element Selected',
      picker_el_name:           'Element Name',
      picker_copy:              'Copy',
      picker_copied:            '✓ Copied',
      picker_action_templates:  'ACTION Templates',
      picker_action_desc:       'Copy and paste directly into the chat as an action command',
      picker_act_click:         'Click',
      picker_act_type:          'Type',
      picker_act_clear:         'Clear',
      picker_act_select:        'Select',
      picker_act_hover:         'Hover',
      picker_continue:          'Click another element to continue selecting…',
      // ── Action delay ────────────────────────────────────────────
      label_action_delay:  'Action Delay (ms)',
      action_delay_ph:     '500 (default)',
      action_delay_desc:   'Wait time (ms) after each action executes. Increase to avoid issues with fast interactions. Leave blank or 0 for no delay.',
    },
  };

  function _autoLang() {
    return 'en';
  }

  const I18n = {
    lang: 'en',

    t(key) {
      return (STRINGS[this.lang] || STRINGS.zh)[key] || key;
    },

    setLang(lang) {
      if (lang === 'zh' || lang === 'en') {
        this.lang = lang;
      } else {
        this.lang = 'en';
      }
    },

    // 将 data-i18n / data-i18n-placeholder / data-i18n-title 翻译应用到 DOM
    apply(root) {
      const r = root || document;
      r.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = this.t(el.dataset.i18n);
      });
      r.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = this.t(el.dataset.i18nPlaceholder);
      });
      r.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = this.t(el.dataset.i18nTitle);
      });
    },
  };

  global.I18n = I18n;

})(typeof window !== 'undefined' ? window : globalThis);
