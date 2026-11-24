# SmallTalk 🗣️

Speaking practice for language learners, mobile first. Add it to your home screen and it works like an app.

- Pick the language you speak and the one you're learning. Eight languages: Swedish, English, French, German, Spanish, Portuguese, Japanese and Mandarin Chinese.
- Translations, explanations and feedback come in your own language (any of the eight); the interface itself is in English or Chinese.
- Each day, Moose goes somewhere new: a café, the doctor, a job interview, a chat with the neighbour, or any situation you type in.
- Choose a level and a conversation partner (patient, natural, fast and casual, or hard to deal with), and get a natural dialogue with vocabulary, pronunciation tips and a cultural note. Then keep talking or ask questions about it.
- Speaking practice: answer a question by typing or talking, and get feedback on grammar and naturalness, plus a more natural way to say it.
- Read aloud and dictation use the browser's built-in speech features.

## Bring your own API key

This page has no server. Each visitor adds their own key in **Settings**:

- **Claude** (keys start with `sk-ant-`): create one at https://platform.claude.com/settings/keys. Requests go to `api.anthropic.com`.
- **OpenAI** (other `sk-` keys): create one at https://platform.openai.com/api-keys. Requests go to `api.openai.com`.

The key decides the provider. It is stored only in that browser and sent only to that provider, and usage is billed to the visitor's own account. Progress and saved situations live in the browser's local storage.

When the same page is opened as a claude.ai artifact, it uses Claude's built-in features instead, on the viewer's own Claude account.

## Voice

- **Read aloud** uses the system voices. Most phones and computers have Swedish, English and Japanese voices, though they vary by device.
- **Dictation** uses the browser's speech recognition (Chrome, Edge and Safari on iPhone; not Firefox). It listens in the language you're learning, so you can correct the text before sending.
- Speaking feedback covers grammar and phrasing, not pronunciation, because the recording itself is not analysed.

## Files

```
index.html             the whole app
manifest.webmanifest   PWA manifest (add to home screen)
sw.js                  offline cache for the app shell
icons/                 app icons
```
