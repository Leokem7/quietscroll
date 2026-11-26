# QuietScroll

Browser extension for Firefox and Chromium browsers that automatically re-mutes timeline videos as you scroll past them, so the next auto-playing video always starts muted.

<details>
<summary>🇧🇷 Português (PT-BR)</summary>

Quando você desmuta um vídeo no feed e continua rolando a página, o player web mantém o som ligado na sessão inteira — todos os próximos vídeos começam a tocar com áudio automaticamente.

O **QuietScroll** volta o áudio para o mudo assim que o vídeo sai da tela:
- Desmute normalmente pelo botão de som ou pela tecla `M`.
- Ao rolar além do vídeo, o áudio volta para mutado antes do próximo vídeo iniciar.
- Sincroniza o estado interno do player (sem precisar clicar duas vezes para desmutar depois).
- Ignora GIFs e mantém o som em tela cheia, Picture-in-Picture (PiP), modais e abas em segundo plano.
- Compatível com **Firefox** (Desktop e Android) e navegadores baseados em **Chromium** (Chrome, Edge, Brave, Vivaldi).
- Sem dependências externas e sem coleta de dados.

</details>

## Why

When you unmute a single video in your feed and keep scrolling, the web player persists that unmuted state for the rest of your session — every video that auto-plays afterward starts with sound on.

QuietScroll keeps audio scoped to the video you actually chose to unmute:
- Click unmute or press `M` to watch with sound while the video is on screen.
- Scroll past it, and audio resets to muted before the next video starts playing.
- Syncs with the player's internal state so you don't have to click twice to unmute the next video.
- Ignores looping GIFs and leaves audio untouched in Fullscreen, Picture-in-Picture (PiP), modals, and background tabs.
- Includes a toolbar toggle to pause or resume the extension at any time.

## Install

- **Firefox (Desktop 140+ & Android 142+):** Coming soon on Firefox Add-ons (AMO).
- **Chrome / Edge / Brave (111+):** Clone or download this repository, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the project folder.

## How It Works

Two small scripts run at `document_start`:

1. `IntersectionObserver` watches only the video you explicitly unmuted. When its visibility drops below 15% (or the virtualized feed unmounts it), the video is muted and the player's UI state is reset.
2. A synchronous guard on `HTMLMediaElement.prototype` (`muted` and `play()`) blocks brief audio blips on fast scrolls before the next video decodes audio.

## Privacy & Permissions

QuietScroll makes no network requests and collects no telemetry or user data (`data_collection_permissions.required: ["none"]`).

- `storage`: stores a single local `enabled` boolean for the toolbar toggle.
- Host access is restricted strictly to the target feed domains declared in [`manifest.json`](manifest.json).

## Development

- **Firefox:** Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → select [`manifest.json`](manifest.json).
- **Chrome / Edge / Brave:** Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the repository root.
- **Debug logs:** Run `window.__quietScrollDebug = true` in the page DevTools Console.

To package a `.zip` archive with forward-slash paths:

```bash
tar -a -c -f quietscroll.zip manifest.json icons src LICENSE
```

## License

[MIT](LICENSE)

## Disclaimer

Independent open-source project. Not affiliated with, authorized, or endorsed by X Corp. (formerly Twitter).

Built with the assistance of AI (**Google Gemini**).
