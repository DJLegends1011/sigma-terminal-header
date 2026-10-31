// Terminal Header & Session Title extension (server half) for Project Sigma.
// Sets the Termux session drawer / terminal window title via OSC 2 & OSC 0 escape sequences
// (matching SillyTavern's `setWindowTitle`) and prints a clean startup banner with local & LAN URLs.

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_TITLE = 'Project Σ WebServer';
const CONFIG_FILE = 'terminal-header.json';

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
};

function sanitizeTitle(raw) {
    // Strip control characters and ANSI sequences so OSC title sequences stay well-formed
    const cleaned = String(raw || DEFAULT_TITLE)
        .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
        .trim();
    return cleaned.slice(0, 80) || DEFAULT_TITLE;
}

export function setTerminalWindowTitle(title) {
    const safe = sanitizeTitle(title);
    try {
        process.title = safe;
    } catch { /* ignore */ }
    if (process.platform !== 'win32' && process.stdout?.writable) {
        // OSC 2 (`\x1b]2;...\x1b\x5c`, used by SillyTavern on Termux) + OSC 0 (`\x1b]0;...\x07`)
        process.stdout.write(`\x1b]2;${safe}\x1b\x5c\x1b]0;${safe}\x07`);
    }
    return safe;
}

function readServerHostPort() {
    let host = process.env.CL_HOST || process.env.HOST || '';
    let port = Number(process.env.CL_PORT || process.env.PORT) || 0;

    if (!host || !port) {
        try {
            const yamlPath = path.join(process.cwd(), 'data', 'server.yaml');
            if (fs.existsSync(yamlPath)) {
                const raw = fs.readFileSync(yamlPath, 'utf8');
                if (!host) {
                    const hm = raw.match(/^\s*host\s*:\s*["']?([^\s#"']+)["']?/m);
                    if (hm) host = hm[1];
                }
                if (!port) {
                    const pm = raw.match(/^\s*port\s*:\s*(\d+)/m);
                    if (pm) port = Number(pm[1]);
                }
            }
        } catch { /* ignore */ }
    }

    return {
        host: host || '127.0.0.1',
        port: port || 3000,
    };
}

function getLanIPv4Addresses() {
    const out = [];
    const nets = os.networkInterfaces();
    for (const [iface, addrs] of Object.entries(nets)) {
        if (!Array.isArray(addrs)) continue;
        for (const info of addrs) {
            if (info.family === 'IPv4' && !info.internal && info.address) {
                out.push({ iface, address: info.address });
            }
        }
    }
    return out;
}

export function printStartupBanner({ host, port, title }) {
    const isWildcard = host === '0.0.0.0' || host === '::';
    const localHost = isWildcard ? '127.0.0.1' : host;
    const browserUrl = `http://${localHost}:${port}`;
    const lanAddrs = isWildcard ? getLanIPv4Addresses() : [];

    const listenLine = `${ANSI.bold}${title || 'Project Σ'}${ANSI.reset} is listening on${ANSI.green} IPv4: ${localHost}:${port}${ANSI.reset}`;
    const plainGoTo = `Go to: ${browserUrl} to open Project Σ`;
    const colorGoTo = `Go to: ${ANSI.blue}${ANSI.bold}${browserUrl}${ANSI.reset} to open Project Σ`;
    const sep = '='.repeat(Math.max(44, plainGoTo.length));

    console.log('');
    console.log(listenLine);
    for (const lan of lanAddrs) {
        console.log(`  ${ANSI.dim}LAN (${lan.iface}):${ANSI.reset} ${ANSI.cyan}http://${lan.address}:${port}${ANSI.reset}`);
    }
    console.log(`\n${sep}\n`);
    console.log(colorGoTo);
    console.log(`\n${sep}\n`);
}

export function register(router, ctx) {
    const sharedFiles = ctx.files.shared();

    const readCachedConfig = () => {
        try {
            return sharedFiles.readJson(CONFIG_FILE, null) || {};
        } catch {
            return {};
        }
    };

    const writeCachedConfig = (cfg) => {
        try {
            sharedFiles.writeJson(CONFIG_FILE, cfg);
        } catch { /* ignore */ }
    };

    const resolveSettingsFromDb = (db) => {
        const cached = readCachedConfig();
        if (!db) {
            return {
                windowTitle: sanitizeTitle(cached.windowTitle || DEFAULT_TITLE),
                showStartupBanner: cached.showStartupBanner === true,
                showActiveGeneration: cached.showActiveGeneration !== false,
            };
        }
        const cfg = {
            windowTitle: sanitizeTitle(ctx.setting(db, 'windowTitle') || DEFAULT_TITLE),
            showStartupBanner: ctx.setting(db, 'showStartupBanner') === true,
            showActiveGeneration: ctx.setting(db, 'showActiveGeneration') !== false,
        };
        writeCachedConfig(cfg);
        return cfg;
    };

    let currentTitle = sanitizeTitle(readCachedConfig().windowTitle || DEFAULT_TITLE);
    let lastPort = readServerHostPort().port;
    let lastHost = readServerHostPort().host;
    let restoreTimer = null;

    // Set the Termux session title immediately during server extension mount
    setTerminalWindowTitle(currentTitle);

    // Print the startup banner right after Project Σ's `app.listen` log line
    const bootTimer = setTimeout(() => {
        const { host, port } = readServerHostPort();
        lastHost = host;
        lastPort = port;
        const cfg = resolveSettingsFromDb(null);
        currentTitle = setTerminalWindowTitle(cfg.windowTitle);
        if (cfg.showStartupBanner) {
            printStartupBanner({ host, port, title: currentTitle });
        }
    }, 80);
    bootTimer.unref?.();

    // Update the Termux session title live whenever settings change in the database
    ctx.events.on((records, { db }) => {
        if (!db) return;
        const changed = Array.isArray(records) && records.some(r => r.entity === 'setting');
        if (changed) {
            const cfg = resolveSettingsFromDb(db);
            currentTitle = setTerminalWindowTitle(cfg.windowTitle);
        }
    });

    // Optional live indicator in the Termux session drawer when an LLM request starts
    ctx.hooks.add('llm.request', (req, facts) => {
        const cfg = resolveSettingsFromDb(facts?.db);
        currentTitle = cfg.windowTitle;
        if (cfg.showActiveGeneration && facts?.purpose === 'chat') {
            const modelTag = req.model ? ` · ${String(req.model).slice(0, 22)}` : '';
            setTerminalWindowTitle(`⚡ ${currentTitle}${modelTag}`);
            clearTimeout(restoreTimer);
            restoreTimer = setTimeout(() => {
                setTerminalWindowTitle(currentTitle);
            }, 15000);
            restoreTimer.unref?.();
        } else {
            setTerminalWindowTitle(currentTitle);
        }
        return req;
    });

    router.get('/status', (req, res) => {
        if (req.socket?.localPort) lastPort = req.socket.localPort;
        const cfg = resolveSettingsFromDb(req.db);
        currentTitle = setTerminalWindowTitle(cfg.windowTitle);
        const isWildcard = lastHost === '0.0.0.0' || lastHost === '::';
        const localHost = isWildcard ? '127.0.0.1' : lastHost;
        res.json({
            ok: true,
            pid: process.pid,
            platform: process.platform,
            isTermux: Boolean(process.env.TERMUX_VERSION || process.env.PREFIX?.includes('com.termux')),
            termuxVersion: process.env.TERMUX_VERSION || null,
            currentTitle,
            localUrl: `http://${localHost}:${lastPort}`,
            lanUrls: getLanIPv4Addresses().map(x => ({ iface: x.iface, url: `http://${x.address}:${lastPort}` })),
            uptimeSeconds: Math.round(process.uptime()),
        });
    });

    router.post('/apply', (req, res) => {
        if (req.socket?.localPort) lastPort = req.socket.localPort;
        const cfg = resolveSettingsFromDb(req.db);
        const requestedTitle = typeof req.body?.windowTitle === 'string' && req.body.windowTitle.trim()
            ? sanitizeTitle(req.body.windowTitle)
            : cfg.windowTitle;
        currentTitle = setTerminalWindowTitle(requestedTitle);
        writeCachedConfig({ ...cfg, windowTitle: currentTitle });

        if (req.body?.printBanner === true) {
            printStartupBanner({ host: lastHost, port: lastPort, title: currentTitle });
        }

        res.json({
            ok: true,
            currentTitle,
            printedBanner: Boolean(req.body?.printBanner),
        });
    });
}
