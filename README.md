# Terminal Header & Session Title (`terminal-header`) — Project Σ Extension

Sets the **Termux session drawer title** (e.g. `[1] Project Σ WebServer`) and desktop terminal window titlebar using standard OSC 2 / OSC 0 escape sequences (`\x1b]2;...\x1b\x5c`, matching SillyTavern's `setWindowTitle`), and prints a clean startup banner with local and LAN URLs when Project Σ boots.

## Features
- **Termux Session Drawer Label**: Automatically names the running Termux session `Project Σ WebServer` (or any custom title configured in **Settings > Extensions**).
- **SillyTavern-Style Startup Banner**: Prints a framed `Go to: http://127.0.0.1:7788 to open Project Σ` banner (plus any LAN IPv4 addresses when bound to `0.0.0.0`) right after Project Σ starts listening.
- **Auto-Open on Boot (Termux)**: Once the server answers `/api/health`, opens `http://localhost:<port>/` in the Android browser (or the installed Sigma PWA) via `termux-open-url`. Project Σ's own `start.sh` only does this on desktops. Toggle in **Settings > Extensions**.
- **Live AI Generation Indicator**: Optional toggle to prefix the Termux session title with `⚡` and the active model name while a chat reply is generating.
- **Real-Time Controls**: Change the session title or re-print the banner to the terminal anytime from **Settings > Extensions** without restarting the server.
