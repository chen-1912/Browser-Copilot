# Chromium Sidebar AI Assistant

Chromium Sidebar AI Assistant is a browser sidebar companion that allows you to bring your own API keys. It can help you summarize web pages and perform simple automation tasks.

The assistant supports the following atomic actions:

| Action | JSON Schema |
| --- | --- |
| **Click** | `{"type":"click","selector":"button.submit-btn"}` |
| **Ctrl+Click** | `{"type":"click","selector":"a.result","modifiers":["ctrl"]}` |
| **Double-click** | `{"type":"double_click","selector":".editable-cell"}` |
| **Right-click** | `{"type":"right_click","selector":".item"}` |
| **Type** | `{"type":"type","selector":"input[name='q']","text":"search content"}` |
| **Select** | `{"type":"select","selector":"select#category","value":"option"}` |
| **Press Key** | `{"type":"key","key":"Enter"}` |
| **Key on Element** | `{"type":"key","selector":".dropdown","key":"ArrowDown"}` |
| **Navigate** | `{"type":"navigate","url":"[https://example.com](https://example.com)"}` |
| **Scroll** | `{"type":"scroll","y":300}` |
| **Hover** | `{"type":"hover","selector":".menu-item"}` |
| **Clear** | `{"type":"clear","selector":"input#search"}` |

By customizing **Skills**, you can orchestrate these atomic actions to handle more complex workflows. For example, I use it to clean up my incredibly messy bookmarks:


https://github.com/user-attachments/assets/e5c9e846-9f95-48e1-b1c8-a6a50472d4ea



### Other Use Cases

1. **General Q&A:** Chat directly with the LLM.
2. **Page Summarization:** Summarize web pages or online documentation.
3. **Auto-Login:** Use Skills to store credentials and log into websites that frequently log you out.
4. **Smart Navigation:** Jump to websites when you can only vaguely remember their features.
5. **Testing Automation:** Fill in fixed mock data during product regression testing.
6. *...and whatever else you can dream up!*

More features are waiting for you to develop. Feel free to submit bug reports and optimization suggestions!

---

## ⚠️ Notes & Limitations

1. **Token Consumption:** When analyzing a page, the assistant sends the complete HTML file, which can be quite token-heavy.
2. **Scope of Control:** The extension can manipulate elements *within* the webpage. However, it currently does **not** support browser-level operations (e.g., right-click context menus, switching tabs, opening native bookmarks) or tool-dependent actions (e.g., reading images, Word documents, or performing web searches).
3. **Beta Actions:** Some `ACTIONS` have not been thoroughly tested yet. If something breaks, please feel free to open an issue.

---

## 💡 Tips & Tricks

1. **Choosing the Right Model:**
* If you have **GitHub Copilot**, you can bind it to call Copilot models—at least one of them usually offers unlimited usage.
* If you prefer paid APIs, **DeepSeek API** is highly recommended. It's incredibly fast and extremely budget-friendly.


2. **Local Models:** **Ollama** is the easiest way to run locally deployed models. However, smaller models (like *Qwen-0.6B*) often struggle to follow complex instructions reliably.
3. **Prompt & Workflow Optimization:** Sometimes, a clever combination of prompts, chat history length, and action delays can work wonders.
* *Token-Saving Tip:* When sorting bookmarks, step-by-step execution drains tokens fast. Instead, ask the LLM to generate actions in batches and execute them sequentially. This saves massive token overhead by avoiding re-sending the HTML page.
* *Identifying Elements:* If you're unsure how to target a specific element, you can right-click and use **"Inspect Element"** (挑选元素) to check its attributes (name, class, etc.). Alternatively, you can let the model run a few steps first, copy its generated JSON actions, and paste them directly into your prompt for future fixed workflows.


4. **Handling "Over-Enthusiastic" Models:** Some models get a bit too eager. If you give a vague prompt and the model doesn't know what the "completion criteria" looks like, it might get stuck in an endless Agent loop.
* *Example:* If you say, *"Where was that Google AI Studio billing page again? Help me jump there,"* you might just want it to land on the homepage. However, the model (looking at you, *GitHub Copilot gpt-5-mini*) might keep frantically clicking and guessing trying to reach your personal invoice page, even if it has no idea what the next step actually is.
