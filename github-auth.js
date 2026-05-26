// ===== github-auth.js =====
// GitHub Device Auth + Copilot Token 管理
// 暴露 window.GitHubAuth

(function (global) {
  'use strict';

  // GitHub Copilot VS Code 扩展的 OAuth App Client ID（公开值，同 OpenClaw 等开源项目）
  const CLIENT_ID = 'Iv1.b507a08c87ecfe98';
  const SCOPE     = 'read:user';

  // ── Step 1：请求设备码 ─────────────────────────────────────────
  // 返回 { device_code, user_code, verification_uri, expires_in, interval }
  async function startDeviceFlow() {
    const resp = await fetch('https://github.com/login/device/code', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ client_id: CLIENT_ID, scope: SCOPE }),
    });
    if (!resp.ok) throw new Error(`Device code request failed: ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data;
  }

  // ── Step 2：轮询 GitHub 直到用户在浏览器授权 ─────────────────
  // onPending(secondsRemaining)：每次等待时的回调，可用于更新 UI
  // 返回 OAuth access_token 字符串
  async function pollForToken(device_code, interval, onPending) {
    const waitMs = Math.max((interval || 5), 5) * 1000;
    while (true) {
      await new Promise(r => setTimeout(r, waitMs));
      const resp = await fetch('https://github.com/login/oauth/access_token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body:    JSON.stringify({
          client_id:   CLIENT_ID,
          device_code,
          grant_type:  'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });
      const data = await resp.json();
      if (data.access_token)                return data.access_token;
      if (data.error === 'authorization_pending') { if (onPending) onPending(); continue; }
      if (data.error === 'slow_down')             { await new Promise(r => setTimeout(r, 5000)); continue; }
      if (data.error === 'expired_token')         throw new Error('expired');
      if (data.error === 'access_denied')         throw new Error('denied');
      throw new Error(data.error_description || data.error || 'unknown');
    }
  }

  // ── 内部：用 OAuth token 换取短期 Copilot token ───────────────
  async function _fetchCopilotToken(oauthToken) {
    const resp = await fetch('https://api.github.com/copilot_internal/v2/token', {
      headers: {
        'Authorization':       `token ${oauthToken}`,
        'Accept':              'application/json',
        'Editor-Version':      'vscode/1.97.2',
        'Editor-Plugin-Version': 'copilot-chat/0.26.1',
        'User-Agent':          'GitHubCopilotChat/0.26.1',
      },
    });
    if (!resp.ok) {
      // 401/403 表示 OAuth token 本身已失效，需要重新授权
      if (resp.status === 401 || resp.status === 403) throw new Error('OAUTH_INVALID');
      throw new Error(`Copilot token request failed: ${resp.status}`);
    }
    const data = await resp.json();
    if (!data.token) throw new Error('No copilot token in response');
    // expires_at 是 Unix 时间戳（秒）
    return { token: data.token, expiresAt: data.expires_at };
  }

  // ── 公开：获取有效 Copilot token（自动刷新，约 30 min 有效期）──
  async function getValidCopilotToken() {
    const stored = await new Promise(r =>
      chrome.storage.sync.get(['githubOAuthToken', 'copilotToken', 'copilotTokenExpiry'], r)
    );
    if (!stored.githubOAuthToken) throw new Error('NOT_AUTHED');
    const now = Math.floor(Date.now() / 1000);
    // 过期前 60 秒就刷新
    if (stored.copilotToken && stored.copilotTokenExpiry && stored.copilotTokenExpiry - now > 60) {
      return stored.copilotToken;
    }
    const { token, expiresAt } = await _fetchCopilotToken(stored.githubOAuthToken);
    await new Promise(r => chrome.storage.sync.set({ copilotToken: token, copilotTokenExpiry: expiresAt }, r));
    return token;
  }

  // ── 公开：查询当前已连接的 GitHub 用户名（null = 未连接）───────
  async function getConnectedUser() {
    const stored = await new Promise(r => chrome.storage.sync.get('githubOAuthToken', r));
    if (!stored.githubOAuthToken) return null;
    try {
      const resp = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${stored.githubOAuthToken}`,
          'Accept':        'application/json',
        },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.login || null;
    } catch {
      return null;
    }
  }

  // ── 公开：保存 OAuth token ─────────────────────────────────────
  async function saveOAuthToken(token) {
    await new Promise(r => chrome.storage.sync.set({ githubOAuthToken: token }, r));
  }

  // ── 公开：登出（清除所有 Copilot 相关 token）─────────────────
  async function logout() {
    await new Promise(r =>
      chrome.storage.sync.remove(['githubOAuthToken', 'copilotToken', 'copilotTokenExpiry'], r)
    );
  }

  global.GitHubAuth = {
    startDeviceFlow,
    pollForToken,
    getValidCopilotToken,
    getConnectedUser,
    saveOAuthToken,
    logout,
  };

})(typeof window !== 'undefined' ? window : globalThis);
