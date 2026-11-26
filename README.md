# QuietScroll for X

A tiny, zero-dependency Firefox extension that automatically re-mutes videos on **X (Twitter)** when you scroll past them — so the next auto-playing video in your timeline always starts muted.

<details>
<summary><strong>🇧🇷 Leia em Português (PT-BR)</strong></summary>

### Por que usar?
O novo player de vídeo do X mantém o áudio ligado durante toda a sessão: se você desmutar um único vídeo na timeline e continuar rolando a página, todos os próximos vídeos começam a tocar com som automaticamente.

O **QuietScroll for X** resolve isso de forma invisível e ultraleve:
- Clique no vídeo (ou aperte a tecla `M`) para ouvir normalmente enquanto ele estiver visível.
- Assim que você rolar a timeline e o vídeo sair da tela, o áudio volta para **mutado** antes do próximo vídeo iniciar.
- Sincroniza com o estado interno do React do X (sem dessincronização de precisar clicar duas vezes para desmutar).
- Bloqueia "estouros" curtos de áudio mesmo em rolagens muito rápidas.
- Ignora GIFs, preserva o áudio em tela cheia / Picture-in-Picture (PiP) e respeita trocas de aba.
- **Extremamente leve e privado:** Vanilla JS puro (~12 KB no total), 0 dependências, 0 timers de polling em segundo plano e **zero coleta de dados**.

#### Testando localmente no Firefox
1. Abra `about:debugging#/runtime/this-firefox` no Firefox.
2. Clique em **Carregar extensão temporária…** (*Load Temporary Add-on…*).
3. Selecione o arquivo `manifest.json` dentro desta pasta.
4. Acesse [x.com](https://x.com), desmute um vídeo e role até o próximo.

#### Empacotando para publicar no Firefox Add-ons (AMO)
Use o `tar` nativo (Windows 10/11, macOS ou Linux) para gerar um `.zip` compatível com barras `/` no padrão exigido pela Mozilla:

```powershell
tar -a -c -f quietscroll-for-x.zip manifest.json icons src
```

</details>

---

## Why?

X's web video player persists your unmuted state across the entire session: once you unmute a single video on your timeline and keep scrolling, every subsequent auto-playing video blasts audio automatically.

**QuietScroll for X** restores per-video sanity:
- **Unmute naturally:** Click any video's unmute control or press `M` to watch with sound.
- **Auto-mute on scroll:** As soon as the video leaves the viewport, audio resets to muted before the next video starts.
- **Zero UI desync:** Synchronizes directly with X's internal player state so you never have to double-click to unmute the next video.
- **Anti-blip protection:** Synchronous `HTMLMediaElement` guards prevent brief audio bursts even during fast timeline virtualization.
- **Smart edge-case handling:** Ignores silent GIFs, keeps audio playing in Fullscreen, Picture-in-Picture (PiP), lightbox modals, and background tabs, and includes a one-click toolbar toggle to pause/resume.
- **Ultra-lightweight:** Pure Vanilla JS (~12 KB total), 0 dependencies, 0 DOM-wide `MutationObserver` loops, 0 background polling.

## How It Works

QuietScroll uses a lightweight two-layer architecture running at `document_start`:

1. **Viewport Observer (`IntersectionObserver`):** Observes *only* the single video you explicitly unmuted. When its visibility drops below 15% (or X's virtualized list unmounts it), QuietScroll mutes it and resets X's player state.
2. **Synchronous Media Guard (`HTMLMediaElement.prototype`):** Intercepts `.muted` and `.play()` (plus native `autoplay` events) so unauthorized videos are muted synchronously before the first audio frame is decoded.

## Local Development & Testing

1. Open `about:debugging#/runtime/this-firefox` in Firefox (140+ on Desktop, 142+ on Android).
2. Click **Load Temporary Add-on…**.
3. Select [`manifest.json`](manifest.json) from this repository.
4. Open [x.com](https://x.com), unmute a timeline video, and scroll down to the next video.

> **Debug tip:** Run `window.__quietScrollDebug = true` in the Firefox DevTools Console on `x.com` to inspect state transitions.

## Packaging for Firefox Add-ons (AMO)

Create the submission archive from the project root using standard forward-slash paths (supported natively on Windows 10/11, macOS, and Linux via `tar`, or with `web-ext`):

```bash
tar -a -c -f quietscroll-for-x.zip manifest.json icons src
```

*(Avoid Windows PowerShell 5.1's `Compress-Archive`, which writes `\` path separators that Mozilla's validator rejects.)*

Then upload `quietscroll-for-x.zip` on the [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/).

## Privacy & Permissions

- **Zero data collection:** Makes **0 network requests**, contains **0 analytics/telemetry**, and declares `data_collection_permissions.required: ["none"]`.
- **Minimal permissions:**
  - `storage`: Stores a single local boolean (`enabled`) for the toolbar toggle switch.
  - Content scripts restricted strictly to `https://x.com/*` and `https://twitter.com/*`.

## Project Structure

```text
├── icons/
│   └── icon.svg             # Extension & toolbar vector icon
├── src/
│   ├── content-bridge.js    # ISOLATED world bridge for browser.storage state
│   ├── content-main.js      # MAIN world media guard & IntersectionObserver
│   └── popup/               # Toolbar toggle popup (HTML/CSS/JS)
├── manifest.json            # Manifest V3 configuration (Firefox Desktop & Android)
├── LICENSE                  # MIT License
└── README.md
```

## Disclaimer

Independent open-source project. Not affiliated with, authorized, or endorsed by X Corp.

## License

Released under the [MIT License](LICENSE).
