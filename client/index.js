// Terminal Header & Session Title extension (client half) for Project Sigma.
// Provides live Termux session drawer title customization & startup banner controls in Settings > Extensions.

export default {
    init(ctx) {
        const esc = s => ctx.CoreAPI.escapeHtml(String(s ?? ''));

        ctx.ui.addSettingsSection(el => {
            let statusData = null;
            let busy = false;
            let feedbackMsg = '';

            const formatUptime = sec => {
                const s = Number(sec) || 0;
                const h = Math.floor(s / 3600);
                const m = Math.floor((s % 3600) / 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
            };

            const renderStatus = () => {
                if (!statusData) {
                    return '<div class="settings-hint">Loading terminal session status…</div>';
                }
                const envBadge = statusData.isTermux
                    ? `📱 Termux${statusData.termuxVersion ? ` v${esc(statusData.termuxVersion)}` : ''} (PID ${esc(statusData.pid)})`
                    : `🖥️ ${esc(statusData.platform)} (PID ${esc(statusData.pid)})`;
                const lanList = Array.isArray(statusData.lanUrls) && statusData.lanUrls.length
                    ? statusData.lanUrls.map(l => `<code>${esc(l.url)}</code> (${esc(l.iface)})`).join(', ')
                    : 'loopback only';

                return `
                    <div class="settings-hint" style="margin-bottom:8px;overflow-wrap:anywhere;word-break:break-word;">
                        <div><strong>Active Session Title:</strong> <code>${esc(statusData.currentTitle)}</code></div>
                        <div style="margin-top:4px;"><strong>Environment:</strong> ${envBadge} · Uptime: ${esc(formatUptime(statusData.uptimeSeconds))}</div>
                        <div style="margin-top:4px;"><strong>Local URL:</strong> <code>${esc(statusData.localUrl)}</code> · <strong>LAN:</strong> ${lanList}</div>
                        ${feedbackMsg ? `<div style="margin-top:6px;color:var(--accent-color, #6ee7b7);">${esc(feedbackMsg)}</div>` : ''}
                    </div>`;
            };

            const draw = () => {
                const windowTitle = String(ctx.settings.get('windowTitle') || 'Project Σ WebServer');
                const showStartupBanner = ctx.settings.get('showStartupBanner') === true;
                const showActiveGeneration = ctx.settings.get('showActiveGeneration') !== false;
                const autoOpenBrowser = ctx.settings.get('autoOpenBrowser') !== false;

                el.innerHTML = `
                    <div class="settings-row">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                            <strong>Termux Session Header &amp; Startup Banner</strong>
                            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                <button type="button" class="glass-btn" data-th-apply style="padding:4px 10px;font-size:0.85em;"${busy ? ' disabled' : ''}>Apply Title Now</button>
                                <button type="button" class="glass-btn" data-th-banner style="padding:4px 10px;font-size:0.85em;"${busy ? ' disabled' : ''}>Print Banner to Terminal</button>
                            </div>
                        </div>
                        ${renderStatus()}
                    </div>
                    <div class="settings-row">
                        <label for="th-window-title">Termux Session / Window Title</label>
                        <input id="th-window-title" type="text" class="glass-input" data-th-title value="${esc(windowTitle)}" placeholder="Project Σ WebServer">
                        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
                            <button type="button" class="glass-btn" data-th-preset="Project Σ WebServer" style="padding:2px 8px;font-size:0.8em;">Project Σ WebServer</button>
                            <button type="button" class="glass-btn" data-th-preset="Sigma WebServer" style="padding:2px 8px;font-size:0.8em;">Sigma WebServer</button>
                            <button type="button" class="glass-btn" data-th-preset="Project Σ (RP Server)" style="padding:2px 8px;font-size:0.8em;">Project Σ (RP Server)</button>
                        </div>
                        <span class="settings-hint" style="overflow-wrap:anywhere;">Sets the label shown next to <code>[1]</code>, <code>[2]</code>, <code>[3]</code> in Termux's left session drawer (via OSC 2 <code>\\x1b]2;...\\x1b\\x5c</code>) and terminal window titlebars on desktop.</span>
                    </div>
                    <div class="settings-row">
                        <label><input type="checkbox" class="cl-switch-input" data-th-bool="showStartupBanner"${showStartupBanner ? ' checked' : ''}><span class="cl-switch" aria-hidden="true"></span><span>Print SillyTavern-style startup banner in terminal</span></label>
                        <span class="settings-hint" style="overflow-wrap:anywhere;">Prints the framed <code>Go to: http://127.0.0.1:7788 to open Project Σ</code> box (plus LAN IPs) to the Termux console on boot.</span>
                    </div>
                    <div class="settings-row">
                        <label><input type="checkbox" class="cl-switch-input" data-th-bool="autoOpenBrowser"${autoOpenBrowser ? ' checked' : ''}><span class="cl-switch" aria-hidden="true"></span><span>Open Project Σ in the Android browser / PWA on boot (Termux)</span></label>
                        <span class="settings-hint" style="overflow-wrap:anywhere;">Once the server answers, runs <code>termux-open-url http://localhost:&lt;port&gt;/</code> (needs the <code>termux-tools</code> package). Does nothing outside Termux.</span>
                    </div>
                    <div class="settings-row">
                        <label><input type="checkbox" class="cl-switch-input" data-th-bool="showActiveGeneration"${showActiveGeneration ? ' checked' : ''}><span class="cl-switch" aria-hidden="true"></span><span>Show live AI generation indicator in session title</span></label>
                        <span class="settings-hint" style="overflow-wrap:anywhere;">Briefly prefixes the Termux session title with <code>⚡</code> and the active model name when generating a chat reply.</span>
                    </div>`;

                const titleInput = el.querySelector('[data-th-title]');
                if (titleInput) {
                    titleInput.addEventListener('change', () => {
                        const val = titleInput.value.trim() || 'Project Σ WebServer';
                        ctx.settings.set('windowTitle', val);
                        applyTitle({ windowTitle: val, printBanner: false });
                    });
                }

                for (const presetBtn of el.querySelectorAll('[data-th-preset]')) {
                    presetBtn.addEventListener('click', () => {
                        const val = presetBtn.dataset.thPreset;
                        ctx.settings.set('windowTitle', val);
                        applyTitle({ windowTitle: val, printBanner: false });
                    });
                }

                for (const chk of el.querySelectorAll('[data-th-bool]')) {
                    chk.addEventListener('change', () => {
                        ctx.settings.set(chk.dataset.thBool, Boolean(chk.checked));
                        applyTitle({ printBanner: false });
                    });
                }

                const applyBtn = el.querySelector('[data-th-apply]');
                if (applyBtn) {
                    applyBtn.addEventListener('click', () => {
                        const val = titleInput ? titleInput.value.trim() : windowTitle;
                        if (val) ctx.settings.set('windowTitle', val);
                        applyTitle({ windowTitle: val || 'Project Σ WebServer', printBanner: false });
                    });
                }

                const bannerBtn = el.querySelector('[data-th-banner]');
                if (bannerBtn) {
                    bannerBtn.addEventListener('click', () => {
                        const val = titleInput ? titleInput.value.trim() : windowTitle;
                        applyTitle({ windowTitle: val || 'Project Σ WebServer', printBanner: true });
                    });
                }
            };

            const fetchStatus = async () => {
                try {
                    statusData = await ctx.server.call('/status', 'GET');
                } catch {
                    statusData = null;
                }
                draw();
            };

            const applyTitle = async ({ windowTitle, printBanner = false } = {}) => {
                if (busy) return;
                busy = true;
                feedbackMsg = '';
                draw();
                try {
                    const res = await ctx.server.call('/apply', 'POST', { windowTitle, printBanner });
                    feedbackMsg = printBanner
                        ? `Updated session title to "${res.currentTitle}" and printed startup banner to terminal!`
                        : `Updated Termux session title to "${res.currentTitle}"!`;
                    statusData = await ctx.server.call('/status', 'GET');
                } catch (err) {
                    feedbackMsg = `Failed to update terminal header: ${err?.message || 'error'}`;
                } finally {
                    busy = false;
                    draw();
                }
            };

            draw();
            fetchStatus();
        });
    },
};
