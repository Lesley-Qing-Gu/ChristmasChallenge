# 边读边学 · Read & Learn

A reading tool for language learners. Paste or upload a text (or take a photo of one), tap any word or drag across a phrase to look it up, save words to word books, review them with flashcards, and export to Anki.

- Interface, meanings and translations in your own language (Chinese and English built in; other languages are translated once by the AI and cached).
- Learn Swedish, English, German, French, Spanish, Italian and other languages that separate words with spaces.

## Bring your own API key

This page has no server. Each visitor enters their own API key from either provider:

- **Claude** (keys start with `sk-ant-`): create one at https://platform.claude.com/settings/keys. Requests go to `api.anthropic.com`. Haiku 5.5 is the default; reading photos switches to Sonnet 5.5.
- **OpenAI** (other `sk-` keys): create one at https://platform.openai.com/api-keys. Requests go to `api.openai.com` (Chat Completions). GPT-6 Luna is the default.

The key decides the provider. The key is stored only in that visitor's browser and sent only to that provider. Usage is billed to the visitor's own account.

Words and texts are stored in the browser's local storage. Use **Settings → Export backup** before switching devices or clearing browser data.

## Deploy on GitHub Pages

1. Put `index.html` (and optionally `logo.svg`) in a repository.
2. Go to **Settings → Pages**, choose the branch and the root folder, and save.
3. Open the URL GitHub shows you.
