chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// 右键菜单标题（中英文）
function _menuTitle(lang) {
  return lang === 'en' ? 'Pick Element' : '选择元素';
}
function _updateMenuTitle() {
  chrome.storage.sync.get('language', ({ language }) => {
    chrome.contextMenus.update('rename-element', { title: _menuTitle(language || 'en') }, () => {
      void chrome.runtime.lastError; // 菜单尚未就绪时忽略错误
    });
  });
}

// 创建右键菜单（扩展安装/更新/重载时注册）
// 同时将语言强制设为 English 并标记为已显式保存，确保面板默认显示英文
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ language: 'en', userLang: 'en' }, () => {
    chrome.contextMenus.create({
      id: 'rename-element',
      title: _menuTitle('en'),
      contexts: ['all'],
      visible: true,
    });
  });
});

// 浏览器启动 / 语言切换时同步菜单标题
chrome.runtime.onStartup.addListener(_updateMenuTitle);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.language) _updateMenuTitle();
});

// 右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'rename-element' && tab?.id) {
    // 先尝试直接发消息；若 content script 未注入（扩展重载后的旧标签页），
    // 则动态补注入再重发
    chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_PICKER' }, (resp) => {
      if (chrome.runtime.lastError) {
        // content script 未就绪，动态注入后重试（i18n.js → element-scanner.js → content.js）
        chrome.scripting.executeScript(
          { target: { tabId: tab.id }, files: ['i18n.js'] },
          () => {
            if (chrome.runtime.lastError) {
              console.warn('[background] 无法注入 i18n.js:', chrome.runtime.lastError.message);
              return;
            }
            chrome.scripting.executeScript(
              { target: { tabId: tab.id }, files: ['element-scanner.js'] },
              () => {
                if (chrome.runtime.lastError) {
                  console.warn('[background] 无法注入 element-scanner.js:', chrome.runtime.lastError.message);
                  return;
                }
                chrome.scripting.executeScript(
                  { target: { tabId: tab.id }, files: ['content.js'] },
                  () => {
                    if (chrome.runtime.lastError) {
                      console.warn('[background] 无法注入 content.js:', chrome.runtime.lastError.message);
                      return;
                    }
                    // 稍等 script 初始化完成再发消息
                    setTimeout(() => {
                      chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_PICKER' }, () => {
                        if (chrome.runtime.lastError) {
                          console.warn('[background] 注入后仍失败（可能是不可注入的页面）:', chrome.runtime.lastError.message);
                        }
                      });
                    }, 100);
                  }
                );
              }
            );
          }
        );
      }
    });
  }
});
