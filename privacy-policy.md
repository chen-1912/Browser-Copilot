# Privacy Policy for Mini Browser Agent

_Last updated: June 2026_

## Overview

Mini Browser Agent ("the Extension") is a browser-side AI assistant that helps users interact with web pages through natural language. This policy explains what data the Extension handles and how.

## Data We Do NOT Collect

The Extension does **not**:
- Transmit any user data to the developer's servers
- Collect analytics or telemetry
- Share any information with third parties beyond the AI providers you explicitly configure

## Data Stored Locally (chrome.storage)

The Extension stores the following data locally in your browser using `chrome.storage.sync` and `chrome.storage.session`:

| Data | Purpose |
|---|---|
| AI provider & model selection | Remember your last-used configuration |
| API keys (per provider) | Authenticate requests to AI APIs on your behalf |
| Custom system prompt | Personalize AI behavior |
| Language preference | UI language (English / Chinese) |
| Conversation history | Display previous messages within the current session |
| Custom skills | User-defined task snippets |
| Action delay, step limit, history rounds | Behavior configuration |

`chrome.storage.sync` data may be synced across your Chrome-signed-in devices by Google. The developer has no access to this data.

## Page Content

When you send a message or click "Add Page", the Extension reads the **current tab's DOM HTML** and sends it as part of your prompt to the AI provider you have configured. This data goes directly from your browser to the AI API — it does not pass through any developer-controlled server.

## Third-Party AI APIs

Depending on your configuration, prompts and page content are sent to one of:

- **Ollama** (local, no external transmission)
- **DeepSeek** — [Privacy Policy](https://www.deepseek.com/privacy_policy)
- **OpenRouter** — [Privacy Policy](https://openrouter.ai/privacy)
- **Google AI Studio (Gemini)** — [Privacy Policy](https://policies.google.com/privacy)
- **GitHub Copilot** — [Privacy Policy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

You are responsible for reviewing the privacy policies of the AI provider you choose.

## GitHub Authentication (Copilot only)

If you use the GitHub Copilot provider, the Extension performs a standard OAuth Device Flow with GitHub to obtain an access token. This token is stored locally in `chrome.storage.sync` and used solely to authenticate Copilot API requests. No GitHub account data is read or stored beyond the token itself.

## Permissions Justification

- **activeTab / scripting / host permissions (`<all_urls>`)**: Required to read page DOM and execute AI-directed actions (click, type, scroll, navigate) on pages you are actively using.
- **contextMenus**: Provides the right-click "Pick Element" feature.
- **sidePanel**: Hosts the AI chat interface alongside the page.
- **storage**: Persists your settings and session history locally.

## Children's Privacy

The Extension is not directed at children under 13. We do not knowingly collect any data from children.

## Changes to This Policy

Updates will be reflected in the "Last updated" date above. Continued use of the Extension after changes constitutes acceptance.

## Contact

For questions about this privacy policy, please open an issue at the Extension's source repository or contact via the Chrome Web Store developer contact email.
