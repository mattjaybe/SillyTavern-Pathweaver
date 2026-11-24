// Pathweaver Extension - AI-powered story direction suggestions
// Uses SillyTavern.getContext() for stable API access (no ES6 imports)

(function () {
    'use strict';

    // ============================================================
    // HOT RELOAD CLEANUP
    // ============================================================
    if (window.pathweaver_cleanup) {
        try { window.pathweaver_cleanup(); } catch (e) { console.error('Pathweaver cleanup failed:', e); }
    }

    // ============================================================
    // MODULE CONFIGURATION
    // ============================================================

    const DEBUG = false; // Set to true for development logging
    /** Console prefix for streaming instrumentation - copy from DevTools to debug Connection Profile / Main API streaming */
    const STREAM_LOG = '[Pathweaver:Stream]';

    const MODULE_NAME = 'pathweaver';
    const EXTENSION_NAME = 'Pathweaver';

    // Get BASE_URL from script tag
    const scripts = document.querySelectorAll('script[src*="index.js"]');
    let BASE_URL = '';
    for (const script of scripts) {
        if (script.src.includes('Pathweaver')) {
            BASE_URL = script.src.split('/').slice(0, -1).join('/');
            break;
        }
    }

    // Built-in category definitions
    // Main toolbar categories
    const MAIN_CATEGORIES = {
        context: { name: 'Context-Aware', icon: 'fa-compass', tooltip: 'Context-based suggestions', builtin: true },
        twist: { name: 'Plot Twist', icon: 'fa-shuffle', tooltip: 'Unexpected plot twists', builtin: true },
        character: { name: 'New Character', icon: 'fa-user-plus', tooltip: 'Introduce characters', builtin: true },
        explicit: { name: 'Explicit', icon: 'fa-fire', tooltip: 'NSFW content', builtin: true, nsfw: true }
    };

    // Genre specific categories (Dropdown)
    const GENRE_CATEGORIES = {
        action: { name: 'Action', icon: 'fa-person-running', tooltip: 'High energy and combat', builtin: true },
        comedy: { name: 'Comedy', icon: 'fa-masks-theater', tooltip: 'Humor and levity', builtin: true },
        fantasy: { name: 'Fantasy', icon: 'fa-hat-wizard', tooltip: 'Magic and wonder', builtin: true },
        horror: { name: 'Horror', icon: 'fa-ghost', tooltip: 'Fear and dread', builtin: true },
        mystery: { name: 'Mystery', icon: 'fa-magnifying-glass', tooltip: 'Puzzles and secrets', builtin: true },
        noir: { name: 'Noir', icon: 'fa-user-secret', tooltip: 'Shadows and intrigue', builtin: true },
        romance: { name: 'Romance', icon: 'fa-heart', tooltip: 'Love and affection', builtin: true },
        'sci-fi': { name: 'Sci-Fi', icon: 'fa-rocket', tooltip: 'Futurism and tech', builtin: true },
        thriller: { name: 'Thriller', icon: 'fa-stopwatch', tooltip: 'Suspense and pressure', builtin: true },
    };

    // Font Awesome icons for custom styles
    // DEFAULT CATEGORY ICONS listed first so built-in styles always have their icon available
    const AVAILABLE_ICONS = [
        // ── Default icons used by built-in categories ──────────────────────
        // Main: Context-Aware, Plot Twist, New Character, Explicit
        'fa-compass', 'fa-shuffle', 'fa-user-plus', 'fa-fire',
        // Genre: Action, Comedy, Fantasy, Horror, Mystery, Noir, Romance, Sci-Fi, Thriller
        'fa-person-running', 'fa-masks-theater', 'fa-hat-wizard', 'fa-ghost',
        'fa-magnifying-glass', 'fa-user-secret', 'fa-heart', 'fa-rocket', 'fa-stopwatch',
        // ── General purpose ─────────────────────────────────────────────────
        'fa-star', 'fa-bolt', 'fa-moon', 'fa-sun', 'fa-cloud', 'fa-leaf',
        'fa-feather', 'fa-gem', 'fa-crown', 'fa-mask', 'fa-skull', 'fa-dragon',
        'fa-wand-sparkles', 'fa-glasses', 'fa-dice', 'fa-puzzle-piece',
        'fa-key', 'fa-lock', 'fa-book', 'fa-scroll', 'fa-map', 'fa-compass-drafting',
        'fa-palette', 'fa-music', 'fa-film', 'fa-gamepad', 'fa-anchor',
        // ── Extra icons ──────────────────────────────────────────────────────
        'fa-scissors', 'fa-shield', 'fa-wand-magic', 'fa-eye', 'fa-brain',
        'fa-tornado', 'fa-snowflake', 'fa-fire-flame-curved', 'fa-tree',
        'fa-hand-fist', 'fa-hourglass-half', 'fa-spider', 'fa-cat',
        'fa-chess-queen', 'fa-staff-snake'
    ];

    /** Title font dropdown: value -> { fontFamily, label } for display and option styling */
    const TITLE_FONT_OPTIONS = Object.freeze({
        none: { fontFamily: 'inherit', label: 'None (hidden)' },
        default: { fontFamily: "'Crimson Text', Georgia, serif", label: 'Default' },
        crimson: { fontFamily: "'Crimson Text', Georgia, serif", label: 'Crimson Text' },
        georgia: { fontFamily: "Georgia, 'Times New Roman', serif", label: 'Georgia' },
        merriweather: { fontFamily: "'Merriweather', Georgia, serif", label: 'Merriweather' },
        lora: { fontFamily: "'Lora', Georgia, serif", label: 'Lora' },
        inter: { fontFamily: "'Inter', system-ui, sans-serif", label: 'Inter' },
        nunito: { fontFamily: "'Nunito', system-ui, sans-serif", label: 'Nunito' },
        poppins: { fontFamily: "'Poppins', system-ui, sans-serif", label: 'Poppins' },
        roboto: { fontFamily: "'Roboto', system-ui, sans-serif", label: 'Roboto' }
    });

    function applyTitleFontSelectDisplay(selectEl) {
        if (!selectEl || !selectEl.value) return;
        const opt = TITLE_FONT_OPTIONS[selectEl.value];
        if (opt) selectEl.style.fontFamily = opt.fontFamily;
    }

    // Default settings
    const defaultSettings = Object.freeze({
        enabled: true,
        source: 'default',
        preset: '',
        ollama_url: 'http://localhost:11434',
        ollama_model: '',
        openai_url: 'http://localhost:1234/v1',
        openai_model: 'local-model',
        openai_preset: 'custom',
        openai_key: '',
        suggestions_count: 6,
        context_depth: 8,
        bar_minimized: false,
        insert_mode: false,
        insert_type_enabled: false,
        insert_type_ooc: false,
        insert_type_director: false,
        show_explicit: false,
        bar_font_size: 'default',  // 'small', 'default', 'large'
        bar_height: 'default',      // 'compact', 'default', 'max'
        bar_title_font: 'default',  // 'none' (hidden) | 'default' | 'crimson'|'georgia'|'merriweather'|'lora' (serif) | 'inter'|'nunito'|'poppins'|'roboto' (sans)
        suggestion_length: 'short', // 'short' (2-3 sentences) or 'long' (4-6 sentences)
        stream_suggestions: false,  // Stream generation per card (Ollama & OpenAI-compatible only)
        include_scenario: true,     // Include character scenario in context
        include_description: true,  // Include character description in context
        include_worldinfo: false,   // Include World Info lorebook in context
        custom_styles: [],
        time_skip_styles: [],       // style ids that have the time-skip variant enabled
        hide_animated_bar: false,
        surprise_depth_min: 2,      // minimum messages away (used for random range or fixed min)
        surprise_depth_max: 6,      // maximum messages away (used for random range or fixed max)
        surprise_randomize: true,   // randomize depth between min and max
        surprise_endless: false,     // auto-rearm a new surprise after each one fires
        reasoning_mode: false,      // Enable reasoning mode for models like DeepSeek
        max_output_tokens: 16384,    // Configurable max output tokens (default 16K for reasoning models)
        premise_include_user: true, // Premise generator: write {{user}} into the premises
        premise_style: 'general',   // Premise generator: last style used
        premise_count: 6,           // Premise generator: how many premises to generate (2/4/6)
        premise_concept: '',        // Premise generator: draft concept text
    });


    // Runtime state
    let settings = JSON.parse(JSON.stringify(defaultSettings));
    let actionBar = null;
    let suggestionsModal = null;
    let settingsModal = null;
    let abortController = null;
    let isGenerating = false;
    let promptCache = {};
    let barResizeObserver = null;
    let pendingMainApiRequest = null; // Main API request still running after a cancel
    let directorMode = 'single_scene'; // 'single_scene' or 'story_beats'
    let timeSkipMode = false; // toolbar Time Skip toggle; runtime only, resets on reload and chat change

    // Suggestion cache
    let cachedSuggestions = {};
    let cachedChatId = null;

    // Surprise feature state
    let activeSurprises = []; // array of { key, category, triggerAfter, baseMessageCount, text, injected }
    let surpriseKeyCounter = 0; // increments per armed surprise for unique ST prompt keys
    let surpriseAbortController = null;

    // ============================================================
    // LOGGING UTILITIES
    // ============================================================

    function log(...args) { if (DEBUG) console.log(`[${EXTENSION_NAME}]`, ...args); }
    function warn(...args) { console.warn(`[${EXTENSION_NAME}]`, ...args); }
    function error(...args) { console.error(`[${EXTENSION_NAME}]`, ...args); }

    // ============================================================
    // SETTINGS MANAGEMENT
    // ============================================================

    function getSettings() {
        const { extensionSettings } = SillyTavern.getContext();

        if (!extensionSettings[MODULE_NAME]) {
            extensionSettings[MODULE_NAME] = JSON.parse(JSON.stringify(defaultSettings));
        }

        for (const key of Object.keys(defaultSettings)) {
            if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) {
                extensionSettings[MODULE_NAME][key] = defaultSettings[key];
            }
        }

        return extensionSettings[MODULE_NAME];
    }

    function saveSettings() {
        // Most settings (length, voice, context) change what a suggestion looks like
        cachedSuggestions = {};
        const { saveSettingsDebounced } = SillyTavern.getContext();
        saveSettingsDebounced();
    }

    function loadSettings() {
        settings = getSettings();
        log('Settings loaded:', settings.enabled, settings.source);
    }

    // ============================================================
    // CATEGORY HELPERS
    // ============================================================

    function getAllCategories() {
        // Deep-copy so we can overlay customizations without mutating the originals
        const categories = {};
        for (const [k, v] of Object.entries(MAIN_CATEGORIES))  categories[k] = { ...v };
        for (const [k, v] of Object.entries(GENRE_CATEGORIES)) categories[k] = { ...v };

        // Apply saved icon customizations for built-in styles
        if (settings.builtin_icon_customizations) {
            for (const [id, icon] of Object.entries(settings.builtin_icon_customizations)) {
                if (categories[id]) categories[id].icon = icon;
            }
        }

        if (settings.custom_styles?.length) {
            for (const style of settings.custom_styles) {
                categories[style.id] = {
                    name: style.name,
                    icon: style.icon,
                    tooltip: style.name,
                    custom: true
                };
            }
        }

        return categories;
    }

    function hasTimeSkipVariant(category) {
        return !!settings.time_skip_styles?.includes(category);
    }

    /** True when at least one style shown in the bar has its time-skip variant enabled. */
    function hasVisibleTimeSkipStyles() {
        const allCategories = getAllCategories();
        return (settings.time_skip_styles || []).some(id => {
            const cat = allCategories[id];
            return cat && (!cat.nsfw || settings.show_explicit);
        });
    }

    function getSuggestionCacheKey(category, timeSkip) {
        return timeSkip ? `${category}::timeskip` : category;
    }

    // ============================================================
    // CONNECTION PROFILE UTILITIES (from EchoChamber pattern)
    // ============================================================

    /** Escape string for safe use in HTML attributes and text (e.g. profile names with quotes) */
    function escapeHtmlAttr(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    const esc = escapeHtmlAttr;

    function getConnectionProfiles() {
        try {
            const stContext = SillyTavern.getContext();
            const connectionManager = stContext?.extensionSettings?.connectionManager;

            if (connectionManager?.profiles?.length) {
                log('Found', connectionManager.profiles.length, 'connection profiles');
                return connectionManager.profiles;
            }

            log('No connection profiles found');
            return [];
        } catch (err) {
            warn('Error getting connection profiles:', err);
            return [];
        }
    }

    function populateConnectionProfiles() {
        // Target both the Settings Modal dropdown AND the Inline Drawer dropdown
        const selectors = [jQuery('#pw_sm_profile'), jQuery('#pw_profile_select')];

        try {
            const profiles = getConnectionProfiles();

            selectors.forEach(select => {
                if (!select.length) return;

                // Save current value to preserve selection during refresh
                const currentValue = select.val() || settings.preset;

                select.empty();
                select.append('<option value="">-- Select Profile --</option>');

                if (profiles.length) {
                    profiles.forEach(profile => {
                        const isSelected = currentValue === profile.name ? ' selected' : '';
                        const safeName = escapeHtmlAttr(profile.name);
                        select.append(`<option value="${safeName}"${isSelected}>${safeName}</option>`);
                    });
                } else {
                    select.append('<option value="" disabled>No profiles found</option>');
                }

                // Restore value if it exists in the new list
                if (currentValue && profiles.some(p => p.name === currentValue)) {
                    select.val(currentValue);
                }
            });

            log('Populated connection profiles:', profiles.length);

        } catch (err) {
            warn('Error loading connection profiles:', err);
            selectors.forEach(select => {
                if (!select.length) return;
                select.append('<option value="" disabled>Error loading profiles</option>');
            });
        }
    }

    // ============================================================
    // OLLAMA UTILITIES
    // ============================================================

    async function fetchOllamaModels() {
        try {
            const baseUrl = (settings.ollama_url || 'http://localhost:11434').replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            log('Ollama models:', data.models?.length || 0);
            return data.models || [];
        } catch (err) {
            warn('Failed to fetch Ollama models:', err.message);
            return [];
        }
    }

    // ============================================================
    // PROMPT LOADING
    // ============================================================

    const FALLBACK_STYLE_PROMPT = 'STYLE: General\nSuggest what could happen next in the story, grounded in the current scene.';

    async function fetchPromptFile(name) {
        try {
            const response = await fetch(`${BASE_URL}/prompts/${name}.md?v=${Date.now()}`);
            if (!response.ok) return null;
            return await response.text();
        } catch (err) {
            warn(`Failed to load prompt file ${name}.md:`, err);
            return null;
        }
    }

    /** Returns the style-specific part of the system prompt for a category. */
    async function loadPrompt(category) {
        if (promptCache[category]) {
            return promptCache[category];
        }

        // User customization of a built-in style
        if (settings.builtin_customizations?.[category]) {
            promptCache[category] = settings.builtin_customizations[category];
            return promptCache[category];
        }

        const customStyle = settings.custom_styles?.find(s => s.id === category);
        if (customStyle && customStyle.prompt && String(customStyle.prompt).trim()) {
            promptCache[category] = customStyle.prompt;
            return customStyle.prompt;
        }
        if (customStyle) warn(`Custom style "${category}" has no prompt; using template.`);

        const prompt = (!customStyle && await fetchPromptFile(category))
            || await fetchPromptFile('template')
            || FALLBACK_STYLE_PROMPT;
        promptCache[category] = prompt;
        return prompt;
    }

    // ============================================================
    // PROMPT BUILDING
    // ============================================================

    /** Replace {{char}}/{{user}} (and other ST macros when available) in a prompt. */
    function substituteMacros(text, storyContext) {
        if (!text) return '';
        let out = String(text);
        try {
            const { substituteParams } = SillyTavern.getContext();
            if (typeof substituteParams === 'function') {
                out = substituteParams(out, storyContext.userName, storyContext.charName);
            }
        } catch (err) {
            warn('substituteParams failed:', err);
        }
        return out
            .replace(/{{char}}/gi, storyContext.charName)
            .replace(/{{user}}/gi, storyContext.userName)
            .replace(/{{model}}/gi, storyContext.charName);
    }

    /**
     * Suggestions are sent as the user's own message. When the user wraps them
     * in [OOC: ] or [Director: ], they are instructions to the storyteller;
     * otherwise they are written as the user's character's next message.
     */
    function getSuggestionVoice() {
        return settings.insert_type_enabled && (settings.insert_type_ooc || settings.insert_type_director)
            ? 'narrative'
            : 'character';
    }

    function getVoiceRule() {
        if (getSuggestionVoice() === 'narrative') {
            return 'Write each description as a direction to the storyteller about what should happen next, in plain third-person present tense (for example: "The guard notices the forged seal and blocks the gate."). It will be sent as an out-of-character instruction, so describe events and choices, not finished prose.';
        }
        return 'Write each description as {{user}}\'s next message: what {{user}} does, says, or notices, matching the person, tense, and style {{user}} has been using in their own messages. {{user}} may narrate small things around them to set up the idea (a sound, an arrival, something they find), but must not decide what other established characters say, feel, or choose.';
    }

    function getLengthRule() {
        return settings.suggestion_length === 'long'
            ? 'Each description is 4-6 sentences.'
            : 'Each description is 2-3 sentences.';
    }

    const CONTINUITY_RULES = `- Continue from the exact moment the last message ends. Each suggestion is a plausible next beat from there, not a later scene or a summary of a whole arc.
- Anchor every suggestion in something specific from the recent messages: a person, object, place, line of dialogue, or unfinished action.`;

    const TIME_SKIP_RULES = `- Each suggestion skips ahead in time from the current moment and opens a new scene where the skip ends. Begin every description with an explicit time marker (for example "Three days later," or "By the first snowfall,").
- Vary the length of the skips across the suggestions, from a few hours to weeks or longer. Base each skip on something from the story that needs time to pass: a journey, healing, a deadline, a promised meeting, an unresolved thread.
- You may briefly and neutrally summarize what happened during the gap, but do not decide how other established characters felt or what they chose.`;

    function buildSuggestionSystemPrompt(stylePrompt, storyContext, timeSkip = false) {
        const prompt = `You write suggestions for what could happen next in an ongoing roleplay story between {{user}} (the user) and {{char}}. {{user}} will choose one suggestion and send its description as their next message.

${stylePrompt.trim()}

RULES:
${timeSkip ? TIME_SKIP_RULES : CONTINUITY_RULES}
- Stay consistent with established facts, the characters' personalities and relationships, the setting, and the story's current tone. Only use world details that appear in the provided context.
- Make the suggestions clearly different from each other: vary who acts, what changes, and where the scene goes. Never write several versions of the same idea.
- Use plain, specific language. Prefer a concrete action or an actual line of dialogue over mood, atmosphere, or abstract summary.
- ${getVoiceRule()}

OUTPUT FORMAT (follow exactly):
<one emoji> <title in plain text, under 8 words>
<description>
---
Put a line containing only --- between suggestions. No numbering, markdown, preamble, or closing remarks.`;
        return substituteMacros(prompt, storyContext);
    }

    function buildSurpriseSystemPrompt(stylePrompt, storyContext) {
        const prompt = `You secretly plan one upcoming development for an ongoing roleplay story between {{user}} (the user) and {{char}}. It will be given to the storytelling AI as a hidden instruction a few messages from now; the user will not see it in advance.

${stylePrompt.trim()}

RULES:
- It will be used a few messages from now, so tie it to something that will still matter then (a character, place, object, goal, or unresolved thread) rather than to the exact current moment.
- Stay consistent with established facts, the characters, the setting, and the story's tone. Only use world details that appear in the provided context.
- Be specific and concrete: say what happens, not what mood it should create.
- Tell the storyteller what to introduce. Do not write story prose and do not script {{user}}'s actions.

OUTPUT FORMAT: exactly one line and nothing else:
[System Note: <1-3 sentences>]`;
        return substituteMacros(prompt, storyContext);
    }

    function buildContextBlock(storyContext, { includeWorldInfo = true } = {}) {
        const { charName, userName } = storyContext;
        const parts = [];
        parts.push(`Characters: ${charName} (played by the AI); ${userName} (the user's character).`);
        if (settings.include_description && storyContext.description) {
            parts.push(`${charName}'s description:\n${storyContext.description.substring(0, 10000)}`);
        }
        if (storyContext.persona) {
            parts.push(`${userName}'s persona:\n${storyContext.persona.substring(0, 4000)}`);
        }
        if (settings.include_scenario && storyContext.scenario) {
            parts.push(`Scenario:\n${storyContext.scenario.substring(0, 4000)}`);
        }
        if (includeWorldInfo && storyContext.worldInfo) {
            parts.push(`World lore relevant to the recent messages:\n${storyContext.worldInfo.substring(0, 10000)}`);
        }
        parts.push(`Recent messages, oldest first. The last message is where the scene stands now:\n${storyContext.history}`);
        return parts.join('\n\n');
    }

    // ============================================================
    // CONTEXT EXTRACTION
    // ============================================================

    const REASONING_TAGS = 'thought|think|thinking|reasoning|reason';

    /** Remove reasoning/thinking blocks, including unclosed or orphaned tags. */
    function stripReasoning(text) {
        if (!text) return '';
        let out = String(text)
            .replace(new RegExp(`<(${REASONING_TAGS})\\b[^>]*>[\\s\\S]*?<\\/\\1>`, 'gi'), '');
        // A closing tag with no opening tag: everything before it was reasoning
        const orphanClose = out.search(new RegExp(`<\\/(${REASONING_TAGS})>`, 'i'));
        if (orphanClose !== -1) out = out.slice(out.indexOf('>', orphanClose) + 1);
        // An opening tag with no closing tag: reasoning is unfinished or truncated
        out = out.replace(new RegExp(`<(${REASONING_TAGS})\\b[^>]*>[\\s\\S]*$`, 'i'), '');
        return out.replace(new RegExp(`<\\/?(${REASONING_TAGS})\\s*\\/?>`, 'gi'), '').trim();
    }

    function getCharacterNames(stContext) {
        if (stContext.groupId && Array.isArray(stContext.groups)) {
            const group = stContext.groups.find(g => g.id === stContext.groupId);
            const names = (group?.members || [])
                .map(avatar => stContext.characters?.find(c => c.avatar === avatar)?.name)
                .filter(Boolean);
            if (names.length) return names.join(', ');
        }
        const char = stContext.characters?.[stContext.characterId];
        return char?.name || stContext.name2 || 'Character';
    }

    function getCardFields(stContext) {
        try {
            if (typeof stContext.getCharacterCardFields === 'function') {
                return stContext.getCharacterCardFields() || {};
            }
        } catch (err) {
            warn('getCharacterCardFields failed:', err);
        }
        const char = stContext.characters?.[stContext.characterId];
        return {
            description: char?.data?.description || char?.description || '',
            scenario: char?.data?.scenario || char?.scenario || '',
            persona: '',
        };
    }

    /** World Info entries SillyTavern would activate for the recent messages (dry run). */
    async function getActivatedWorldInfo(stContext, visibleChat) {
        if (typeof stContext.getWorldInfoPrompt !== 'function') return '';
        try {
            const scanChat = visibleChat.map(m => `${m.name}: ${m.mes}`).reverse();
            const result = await stContext.getWorldInfoPrompt(scanChat, Number(stContext.maxContext) || 8192, true);
            return (result?.worldInfoString || '').trim();
        } catch (err) {
            warn('Failed to get World Info:', err);
            return '';
        }
    }

    async function extractContext({ includeWorldInfo = settings.include_worldinfo } = {}) {
        const stContext = SillyTavern.getContext();
        const chat = stContext?.chat;

        if (!chat || chat.length === 0) return null;

        const cleanMessage = (text) => {
            if (!text) return '';
            const cleaned = stripReasoning(text).replace(/<[^>]*>/g, '');
            const txt = document.createElement('textarea');
            txt.innerHTML = cleaned;
            return txt.value.trim().substring(0, 10000);
        };

        // Hidden messages and system notices are not part of the story
        const visibleChat = chat.filter(msg => msg && !msg.is_system && typeof msg.mes === 'string' && msg.mes.trim());
        if (visibleChat.length === 0) return null;

        const depth = Math.max(2, Math.min(20, Number(settings.context_depth) || 8));
        const recentMessages = visibleChat.slice(-depth);

        const history = recentMessages
            .map(msg => `${msg.name}: ${cleanMessage(msg.mes)}`)
            .join('\n\n');

        const fields = getCardFields(stContext);
        const worldInfo = includeWorldInfo ? await getActivatedWorldInfo(stContext, visibleChat.slice(-depth)) : '';

        return {
            history,
            charName: getCharacterNames(stContext),
            userName: stContext.name1 || 'User',
            description: fields.description || '',
            scenario: fields.scenario || '',
            persona: fields.persona || '',
            worldInfo,
            chatId: stContext.chatId || stContext.groupId || null,
        };
    }

    /** True while SillyTavern itself is generating a chat reply. */
    function isHostGenerating() {
        return document.body?.dataset?.generating === 'true';
    }

    function getSuggestionMaxTokens(count) {
        const tokensPerSuggestion = settings.suggestion_length === 'long' ? 400 : 280;
        const needed = count * tokensPerSuggestion + 800;
        if (settings.reasoning_mode) {
            // Reasoning models spend part of the budget on thinking
            return Math.max(settings.max_output_tokens || 8192, needed);
        }
        return Math.min(8192, Math.max(2048, needed));
    }

    // ============================================================
    // GENERATION
    // ============================================================

    /**
     * Send a system + user prompt to the configured source and return the raw text.
     * For the default (Main API) source, the returned promise only settles when
     * SillyTavern has actually finished the request, even if the signal was aborted.
     */
    async function requestCompletion({ systemPrompt, userPrompt, maxTokens, signal, temperature = 0.8 }) {
        const stContext = SillyTavern.getContext();

        if (settings.source === 'profile') {
            const profile = getSelectedProfile(stContext);
            const response = await stContext.ConnectionManagerRequestService.sendRequest(
                profile.id,
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                maxTokens,
                { stream: false, signal, extractData: true, includePreset: true, includeInstruct: true },
            );
            if (typeof response === 'string') return response;
            if (typeof response?.content === 'string') return response.content;
            if (response?.choices?.[0]?.message?.content) return response.choices[0].message.content;
            return '';
        }

        if (settings.source === 'ollama') {
            const baseUrl = (settings.ollama_url || 'http://localhost:11434').replace(/\/$/, '');
            if (!settings.ollama_model) throw new Error('No Ollama model selected');
            const response = await fetch(`${baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: settings.ollama_model,
                    system: systemPrompt,
                    prompt: userPrompt,
                    stream: false,
                    options: { num_ctx: 8192, num_predict: maxTokens },
                }),
                signal,
            });
            if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
            const data = await response.json();
            return data.response || '';
        }

        if (settings.source === 'openai') {
            const baseUrl = (settings.openai_url || 'http://localhost:1234/v1').replace(/\/$/, '');
            const headers = { 'Content-Type': 'application/json' };
            if (settings.openai_key) headers['Authorization'] = `Bearer ${settings.openai_key}`;
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: settings.openai_model || 'local-model',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature,
                    max_tokens: maxTokens,
                    stream: false,
                }),
                signal,
            });
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        }

        // Default: the main API through SillyTavern
        const { generateRaw } = stContext;
        if (!generateRaw) throw new Error('generateRaw not available in context');
        if (isHostGenerating()) throw new Error('Wait for the current reply to finish, then try again.');
        // SillyBunny honors `signal`; upstream SillyTavern ignores it and keeps
        // generating. Settle right away on abort so the UI responds, but remember
        // the request so nothing new is sent until it has really finished.
        const request = generateRaw({ systemPrompt, prompt: userPrompt, responseLength: maxTokens, signal });
        const pending = request.catch(() => {}).finally(() => {
            if (pendingMainApiRequest === pending) pendingMainApiRequest = null;
        });
        pendingMainApiRequest = pending;
        const aborted = new Promise((_, reject) => {
            if (signal?.aborted) reject(new DOMException('Aborted', 'AbortError'));
            signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
        const result = await Promise.race([request, aborted]);
        return result || '';
    }

    /** Resolves once any Main API request Pathweaver started has finished. */
    function waitForMainApiRequest() {
        return pendingMainApiRequest || Promise.resolve();
    }

    function getSelectedProfile(stContext) {
        if (!settings.preset || !String(settings.preset).trim()) {
            throw new Error('Please select a connection profile');
        }
        const profile = stContext.extensionSettings?.connectionManager?.profiles?.find(p => p.name === settings.preset);
        if (!profile) throw new Error(`Profile '${settings.preset}' not found`);
        if (!stContext.ConnectionManagerRequestService) throw new Error('ConnectionManagerRequestService not available');
        return profile;
    }

    function buildSuggestionTask(category, customDirections, mode, timeSkip = false) {
        const count = settings.suggestions_count;
        if (category === 'director' && customDirections?.length) {
            const dirList = customDirections.map((d, i) => `${i + 1}. ${d}`).join('\n');
            if (mode === 'story_beats') {
                return {
                    count: customDirections.length,
                    task: `Write exactly ${customDirections.length} suggestions, one for each of the user's directions below, in the same order. Each suggestion carries out only its own direction; do not mix in events from the other directions.\n\nDIRECTIONS:\n${dirList}\n\n${getLengthRule()}`,
                };
            }
            return {
                count,
                task: `The user's directions for the next scene, in order:\n${dirList}\n\nWrite exactly ${count} different versions of this scene. Every version includes all of the directions in this order, but each one handles them differently (pacing, emphasis, how the characters react).\n\n${getLengthRule()}`,
            };
        }
        return {
            count,
            task: `Write exactly ${count} ${timeSkip ? 'time-skip ' : ''}suggestions. ${getLengthRule()}`,
        };
    }

    async function generateSuggestions(category, forceRefresh = false, customDirections = null, mode = 'single_scene', outputContainer = null, timeSkip = false) {
        log('Generating suggestions for:', category, timeSkip ? '(time skip)' : '');
        const cacheKey = getSuggestionCacheKey(category, timeSkip);

        if (isGenerating) {
            showToast('Pathweaver is still finishing the previous request.', 'warning');
            return;
        }

        const stContext = SillyTavern.getContext();
        const chatId = stContext?.chatId || stContext?.groupId || null;

        // Director results are never cached
        if (category !== 'director') {
            if (cachedChatId !== chatId) {
                cachedSuggestions = {};
                cachedChatId = chatId;
            }
            if (!forceRefresh && cachedSuggestions[cacheKey]) {
                displaySuggestions(cachedSuggestions[cacheKey], category, outputContainer);
                return;
            }
        }

        isGenerating = true;
        showLoadingState(category, outputContainer, 'Generating Suggestions...');
        abortController = new AbortController();
        const signal = abortController.signal;

        try {
            const storyContext = await extractContext();
            if (!storyContext) {
                showEmptyState('Start a conversation to get suggestions', outputContainer);
                return;
            }

            const stylePrompt = await loadPrompt(category);
            const systemPrompt = buildSuggestionSystemPrompt(stylePrompt, storyContext, timeSkip);
            const { count, task } = buildSuggestionTask(category, customDirections, mode, timeSkip);
            const userPrompt = `[STORY CONTEXT]\n${buildContextBlock(storyContext)}\n\n[TASK]\n${task}`;
            const maxTokens = getSuggestionMaxTokens(count);
            log(`Max tokens: ${maxTokens}`);

            if (settings.source === 'profile') getSelectedProfile(stContext);

            if (settings.stream_suggestions && STREAMING_SOURCES.includes(settings.source)) {
                try {
                    await runStreamingGeneration({
                        source: settings.source,
                        systemPrompt,
                        userPrompt,
                        maxTokens,
                        category,
                        cacheKey,
                        outputContainer,
                        signal,
                        maxSuggestions: count,
                    });
                    return;
                } catch (err) {
                    // Connection profiles don't all support streaming; retry without it
                    if (err.name === 'AbortError' || signal.aborted || settings.source !== 'profile') throw err;
                    streamLog('Streaming failed, falling back to non-streaming:', err?.message || String(err));
                    showLoadingState(category, outputContainer, 'Generating Suggestions...');
                }
            }

            const result = await requestCompletion({ systemPrompt, userPrompt, maxTokens, signal });
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

            const suggestions = await parseSuggestions(result, count);
            if (category !== 'director' && suggestions.length) cachedSuggestions[cacheKey] = suggestions;
            displaySuggestions(suggestions, category, outputContainer);
        } catch (err) {
            if (err.name === 'AbortError' || signal.aborted) {
                showEmptyState('Generation cancelled by user', outputContainer);
            } else {
                error('Generation failed:', err);
                showErrorState(err.message || 'API request failed', outputContainer);
            }
        } finally {
            abortController = null;
            await waitForMainApiRequest();
            isGenerating = false;
        }
    }

    // ============================================================
    // RESPONSE PARSING - Robust multi-strategy parser
    // ============================================================

    const EMOJI_PATTERN = '[\\u{1F000}-\\u{1F02B}\\u{1F0A0}-\\u{1F0FF}\\u{1F100}-\\u{1F1FF}\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}\\u{1F600}-\\u{1F64F}\\u{1F680}-\\u{1F6FF}\\u{2300}-\\u{23FF}\\u{2B00}-\\u{2BFF}\\u{2B50}\\u{1FA00}-\\u{1FAFF}]';
    const emojiRegex = new RegExp(EMOJI_PATTERN, 'u');
    const emojiRegexGlobal = new RegExp(EMOJI_PATTERN, 'gu');
    const EMOJI_SEQUENCE_REGEX = new RegExp(`^${EMOJI_PATTERN}(?:\\uFE0F|[\\u{1F3FB}-\\u{1F3FF}]|\\u200D${EMOJI_PATTERN}\\uFE0F?)*`, 'u');
    const BLOCK_SEPARATOR = /\n\s*---+\s*\n|\n\s*---+\s*$|^\s*---+\s*\n/;

    async function parseSuggestions(text, maxCount = settings.suggestions_count) {
        // Yield to UI thread to prevent blocking during parsing
        await new Promise(resolve => setTimeout(resolve, 0));

        const cleanedText = stripReasoning(text);
        if (!cleanedText) return [];

        // Strategy 1: split by --- separators
        let blocks = cleanedText.split(BLOCK_SEPARATOR);

        // Strategy 2: split by blank lines
        if (blocks.length <= 1) {
            blocks = cleanedText.split(/\n\n+/);
        }

        // Strategy 3: use each emoji as the start of a block
        if (blocks.length <= 2) {
            const emojiMatches = [...cleanedText.matchAll(emojiRegexGlobal)];
            if (emojiMatches.length >= 2) {
                blocks = [];
                for (let i = 0; i < emojiMatches.length; i++) {
                    const start = emojiMatches[i].index;
                    const end = i < emojiMatches.length - 1 ? emojiMatches[i + 1].index : cleanedText.length;
                    const block = cleanedText.substring(start, end).trim();
                    if (block.length > 10) blocks.push(block);
                }
            }
        }

        // Strategy 4: numbered lines like "1." or "1)"
        if (blocks.length <= 2) {
            const numberedBlocks = cleanedText.split(/\n(?=\d+[.)]\s)/);
            if (numberedBlocks.length > blocks.length) blocks = numberedBlocks;
        }

        const suggestions = blocks.map(parseOneBlock).filter(Boolean);
        log('Parsed', suggestions.length, 'suggestions');
        return suggestions.slice(0, maxCount);
    }

    // ============================================================
    // STREAMING: incremental parse and UI
    // ============================================================

    const STREAMING_SOURCES = ['ollama', 'openai', 'profile'];

    function stripMarkdown(text) {
        return text
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/^#+\s*/, '')
            .replace(/^\*+\s*|\s*\*+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /** Parse a single suggestion block into { emoji, title, description } or null */
    function parseOneBlock(blockText) {
        if (!blockText || typeof blockText !== 'string') return null;
        const trimmed = stripReasoning(blockText).replace(/<[^>]*>/g, '').trim();
        if (trimmed.length < 10) return null;

        let emoji = '✨';
        let title = '';
        let description = '';

        const emojiMatch = trimmed.match(emojiRegex);
        // Only treat the emoji as the card icon when it starts the title line
        if (emojiMatch && emojiMatch.index <= 8 && !trimmed.substring(0, emojiMatch.index).includes('\n')) {
            // Keep variation selectors, skin tones and ZWJ sequences with the emoji
            const rest = trimmed.substring(emojiMatch.index);
            emoji = rest.match(EMOJI_SEQUENCE_REGEX)?.[0] || emojiMatch[0];
            const afterEmoji = trimmed.substring(emojiMatch.index + emoji.length).trim();
            const newlineIndex = afterEmoji.indexOf('\n');
            if (newlineIndex > 0) {
                title = afterEmoji.substring(0, newlineIndex);
                description = afterEmoji.substring(newlineIndex + 1);
            } else {
                title = afterEmoji;
            }
        } else {
            const lines = trimmed.split('\n');
            title = lines[0];
            description = lines.slice(1).join(' ');
        }

        title = stripMarkdown(title.replace(/^\s*\d+[.)]\s*/, ''));
        description = stripMarkdown(description);
        if (!title || title.length < 2 || title.length > 150) return null;
        return {
            emoji,
            title: title.substring(0, 100),
            // Never insert placeholder text into the chat; fall back to the title
            description: description || title,
        };
    }

    /** Split streamed buffer into complete blocks and current partial (for --- or double newline) */
    function splitStreamBuffer(buffer) {
        const cleaned = stripReasoning(buffer);
        if (!cleaned) return { completeBlocks: [], partial: '' };
        for (const separator of [BLOCK_SEPARATOR, /\n\n+/]) {
            const parts = cleaned.split(separator);
            if (parts.length > 1) {
                return {
                    completeBlocks: parts.slice(0, -1).map(s => s.trim()).filter(s => s.length >= 10),
                    partial: parts[parts.length - 1].trim(),
                };
            }
        }
        return { completeBlocks: [], partial: cleaned };
    }

    function showStreamingState(outputContainer, category, slotCount) {
        const body = outputContainer || jQuery('#pw_modal_body');
        const allCategories = getAllCategories();
        const catName = escapeHtmlAttr(allCategories[category]?.name || category);
        const count = Math.max(1, Math.min(12, Number(slotCount) || 6));
        const cardsHtml = Array.from({ length: count }, (_, i) => {
            const isFirst = i === 0;
            const stateClass = isFirst ? 'pw_streaming_active' : 'pw_streaming_waiting';
            const title = isFirst ? 'Streaming…' : `Suggestion ${i + 1}`;
            const desc = isFirst ? 'First suggestion is being generated…' : (i === 1 ? 'Up next' : 'Waiting…');
            return `
                <div class="pw_suggestion_card pw_streaming_slot ${stateClass}" data-slot="${i}" data-streaming="1">
                    <div class="pw_card_header">
                        <span class="pw_card_emoji pw_streaming_icon">${isFirst ? '<i class="fa-solid fa-pen-nib"></i>' : `<span class="pw_slot_num">${i + 1}</span>`}</span>
                        <span class="pw_card_title">${title}</span>
                    </div>
                    <div class="pw_card_description pw_streaming_placeholder">${desc}</div>
                    <div class="pw_card_actions" style="visibility: hidden;"></div>
                </div>`;
        }).join('');
        body.html(`
            <div class="pw_status">
                <i class="fa-solid fa-circle-notch pw_spin"></i>
                <span>Streaming ${catName} suggestions...</span>
                <div class="pw_status_actions">
                    <button class="pw_status_btn cancel pw_throb" id="pw_cancel_gen">
                        <i class="fa-solid fa-xmark"></i> Cancel
                    </button>
                </div>
            </div>
            <div class="pw_suggestions_grid" id="pw_streaming_grid" data-streaming-slots="${count}">
                ${cardsHtml}
            </div>
        `);
        body.find('#pw_cancel_gen').off('click').on('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            if (abortController) abortController.abort();
        });
    }

    function updateStreamingCardContent(partialText, outputContainer) {
        const body = outputContainer || jQuery('#pw_modal_body');
        const grid = body.find('#pw_streaming_grid');
        if (!grid.length) return;
        const card = grid.find('.pw_streaming_active');
        if (!card.length) return;
        // .text() escapes, so no sanitizing is needed here
        const text = String(partialText || '').replace(/<[^>]*>/g, '');
        const firstLine = text.split('\n')[0].trim() || '…';
        card.find('.pw_card_title').text(firstLine.substring(0, 100));
        card.find('.pw_card_description').text(text).removeClass('pw_streaming_placeholder');
    }

    function appendStreamingCardAsComplete(suggestion, outputContainer, suggestionsArray) {
        const body = outputContainer || jQuery('#pw_modal_body');
        const grid = body.find('#pw_streaming_grid');
        if (!grid.length) return;
        const card = grid.find('.pw_streaming_active');
        const index = suggestionsArray.length;
        suggestionsArray.push(suggestion);

        if (card.length) {
            card.removeClass('pw_streaming_slot pw_streaming_active pw_streaming_waiting').removeAttr('data-streaming data-slot');
            card.find('.pw_card_emoji').text(suggestion.emoji || '✨');
            card.find('.pw_card_title').text(suggestion.title);
            card.find('.pw_card_description').text(suggestion.description);
            card.find('.pw_card_actions').attr('style', '').html(`
                <button class="pw_card_action_btn" data-action="copy" title="Copy to clipboard"><i class="fa-solid fa-copy"></i> Copy</button>
                <button class="pw_card_action_btn" data-action="insert" title="Insert into input field"><i class="fa-solid fa-plus"></i> Insert</button>
                <button class="pw_card_action_btn primary" data-action="send" title="Insert and send"><i class="fa-solid fa-paper-plane"></i> Send</button>
            `);
            card.attr('data-index', index);
            const nextActive = grid.find('.pw_streaming_waiting').first();
            if (nextActive.length) {
                nextActive.removeClass('pw_streaming_waiting').addClass('pw_streaming_active');
                nextActive.find('.pw_card_emoji').html('<i class="fa-solid fa-pen-nib"></i>');
                nextActive.find('.pw_card_title').text('Streaming…');
                nextActive.find('.pw_card_description').text('').removeClass('pw_streaming_placeholder');
            }
        }

        grid.find('.pw_suggestion_card[data-index]').off('click.pw_stream').on('click.pw_stream', function (e) {
            const idx = parseInt(jQuery(this).data('index'), 10);
            const s = suggestionsArray[idx];
            if (!s) return;
            const action = jQuery(e.target).closest('[data-action]').data('action');
            if (action === 'copy') copyToClipboard(s.description);
            else if (action === 'insert') insertSuggestion(s);
            else if (action === 'send') sendSuggestion(s);
        });
    }

    function removeStreamingPlaceholderCard(outputContainer) {
        const body = outputContainer || jQuery('#pw_modal_body');
        body.find('.pw_streaming_slot').remove();
    }

    /** Streaming diagnostics; only printed when DEBUG is on. */
    function streamLog(...args) {
        if (DEBUG) console.log(STREAM_LOG, ...args);
    }

    /** Read an SSE (OpenAI) or NDJSON (Ollama) byte stream and pass each text delta to onText. */
    async function consumeByteStream(body, onText) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handleLine = (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const isSse = trimmed.startsWith('data:');
            const payload = isSse ? trimmed.slice(5).trim() : trimmed;
            if (payload === '[DONE]') return;
            try {
                const obj = JSON.parse(payload);
                const text = obj.choices?.[0]?.delta?.content ?? obj.response ?? obj.message?.content;
                if (text) onText(text);
            } catch (_) { /* partial or non-JSON line */ }
        };

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            lines.forEach(handleLine);
        }
        handleLine(buffer);
    }

    async function runStreamingGeneration({ source, systemPrompt, userPrompt, maxTokens, category, cacheKey = category, outputContainer, signal, maxSuggestions }) {
        const body = outputContainer || jQuery('#pw_modal_body');
        const suggestionsArray = [];
        let contentBuffer = '';
        let processedBlockCount = 0;

        showStreamingState(outputContainer, category, maxSuggestions);

        const addParsed = (block) => {
            if (suggestionsArray.length >= maxSuggestions) return;
            const suggestion = parseOneBlock(block);
            if (suggestion) appendStreamingCardAsComplete(suggestion, outputContainer, suggestionsArray);
        };

        const processBuffer = () => {
            const { completeBlocks, partial } = splitStreamBuffer(contentBuffer);
            completeBlocks.slice(processedBlockCount).forEach(addParsed);
            processedBlockCount = completeBlocks.length;
            updateStreamingCardContent(partial, outputContainer);
        };

        const appendText = (text) => {
            contentBuffer += text;
            processBuffer();
        };

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];

        try {
            if (source === 'profile') {
                const stContext = SillyTavern.getContext();
                const profile = getSelectedProfile(stContext);
                let response = await stContext.ConnectionManagerRequestService.sendRequest(
                    profile.id, messages, maxTokens,
                    { stream: true, signal, extractData: true, includePreset: true, includeInstruct: true },
                );
                // SillyTavern returns a function that creates an async generator
                if (typeof response === 'function') response = await response();
                streamLog('Connection Profile response', { type: typeof response, constructor: response?.constructor?.name });

                if (typeof response === 'string' || typeof response?.content === 'string') {
                    // The API answered without streaming
                    contentBuffer = typeof response === 'string' ? response : response.content;
                    processBuffer();
                } else if (response && typeof response[Symbol.asyncIterator] === 'function') {
                    for await (const chunk of response) {
                        if (signal.aborted) break;
                        if (typeof chunk?.text === 'string') {
                            // SillyTavern yields the cumulative text so far
                            contentBuffer = chunk.text;
                            processBuffer();
                        } else if (typeof chunk === 'string') {
                            appendText(chunk);
                        }
                    }
                } else if (response?.body?.getReader) {
                    await consumeByteStream(response.body, appendText);
                } else {
                    throw new Error('Connection profile did not return a stream');
                }
            } else {
                let url;
                let headers = { 'Content-Type': 'application/json' };
                let payload;
                if (source === 'ollama') {
                    if (!settings.ollama_model) throw new Error('No Ollama model selected');
                    url = `${(settings.ollama_url || 'http://localhost:11434').replace(/\/$/, '')}/api/generate`;
                    payload = {
                        model: settings.ollama_model,
                        system: systemPrompt,
                        prompt: userPrompt,
                        stream: true,
                        options: { num_ctx: 8192, num_predict: maxTokens },
                    };
                } else {
                    url = `${(settings.openai_url || 'http://localhost:1234/v1').replace(/\/$/, '')}/chat/completions`;
                    if (settings.openai_key) headers['Authorization'] = `Bearer ${settings.openai_key}`;
                    payload = {
                        model: settings.openai_model || 'local-model',
                        messages,
                        temperature: 0.8,
                        max_tokens: maxTokens,
                        stream: true,
                    };
                }
                const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal });
                if (!response.ok) throw new Error(`${source === 'ollama' ? 'Ollama API' : 'API'} error: ${response.status}`);
                await consumeByteStream(response.body, appendText);
            }
        } finally {
            // Parse whatever is left, including the final block without a trailing ---
            const { completeBlocks, partial } = splitStreamBuffer(contentBuffer);
            completeBlocks.slice(processedBlockCount).forEach(addParsed);
            if (partial.length >= 10) addParsed(partial);
            removeStreamingPlaceholderCard(outputContainer);
        }

        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        body.find('.pw_status').remove();
        if (suggestionsArray.length > 0) {
            if (category !== 'director') cachedSuggestions[cacheKey] = suggestionsArray;
        } else {
            showEmptyState('No suggestions could be generated. Try again.', outputContainer);
        }
    }

    // ============================================================
    // UI - ACTION BAR
    // ============================================================

    function createActionBar() {
        log('Creating action bar (refactored)...');

        // Remove any existing bar
        jQuery('.pw_action_bar').remove();

        if (!settings.enabled) {
            log('Extension disabled, not creating bar');
            return;
        }

        const allCategories = getAllCategories();

        // Time Skip mode: styles without the variant are dimmed and blocked while it's on
        const showTimeSkipBtn = hasVisibleTimeSkipStyles();
        if (!showTimeSkipBtn) timeSkipMode = false;
        const isTimeSkipBlocked = key => timeSkipMode && !hasTimeSkipVariant(key);
        const blockedClass = key => isTimeSkipBlocked(key) ? ' pw_timeskip_blocked' : '';
        const disabledAttr = key => isTimeSkipBlocked(key) ? ' disabled' : '';

        // 4. Surprise Dropdown (built first so it can be inserted right after Director)
        const surpriseStyles = [
            ...Object.entries(MAIN_CATEGORIES),
            ...Object.entries(GENRE_CATEGORIES).sort((a, b) => a[1].name.localeCompare(b[1].name)),
        ]
            .filter(([, cat]) => !cat.nsfw || settings.show_explicit)
            .map(([key, cat]) => ({ id: key, name: cat.name, icon: allCategories[key]?.icon || cat.icon }))
            .concat((settings.custom_styles || []).map(style => ({ id: style.id, name: style.name, icon: style.icon })));
        const surpriseItems = surpriseStyles.map(style => `
                <button class="pw_dropdown_item pw_surprise_item" data-surprise-category="${esc(style.id)}">
                    <i class="fa-solid ${esc(style.icon)}"></i>
                    <span>${esc(style.name)}</span>
                </button>`).join('');

        const surpriseCount = activeSurprises.length;
        const surpriseIndicatorHtml = surpriseCount > 0
            ? `<span class="pw_surprise_active_dot" title="${surpriseCount} surprise${surpriseCount > 1 ? 's' : ''} armed"></span>`
            : '';

        const surpriseDropdownHtml = `
            <div class="pw_dropdown_container pw_surprise_container">
                <button class="pw_dropdown_btn pw_surprise_btn${surpriseCount > 0 ? ' pw_surprise_armed' : ''}" data-name="Surprise" title="Surprise Me">
                    <i class="fa-solid fa-wand-sparkles"></i>
                    ${surpriseIndicatorHtml}
                </button>
                <div class="pw_dropdown_menu pw_surprise_menu">
                    <div class="pw_surprise_menu_header">
                        <i class="fa-solid fa-wand-sparkles"></i> Surprise Me
                        <span class="pw_setting_tooltip_icon" title="Surprise Me secretly injects an AI-generated suggestion into the chat context a set number of messages before it fires. Pick a style, and Pathweaver will quietly arm a hidden prompt. When the countdown hits, the suggestion appears naturally — like the story took an unexpected turn on its own.">?</span>
                    </div>
                    ${settings.surprise_endless ? `<div class="pw_surprise_endless_badge">
                        <i class="fa-solid fa-infinity"></i> Endless Surprises active
                    </div>` : ''}
                    ${surpriseCount > 0 ? `<div class="pw_surprise_active_info">
                        <span class="pw_surprise_active_info_label">
                            <i class="fa-solid fa-circle-check" style="color: var(--pw-success);"></i>
                            ${surpriseCount} surprise${surpriseCount > 1 ? 's' : ''} armed
                        </span>
                        <button class="pw_surprise_clear_btn" id="pw_surprise_clear">Clear all</button>
                    </div>` : ''}
                    ${surpriseItems}
                </div>
            </div>`;

        // 1. Built-in Buttons — Director first, then Surprise Me, then main categories
        let builtinButtonsHtml = '';

        // Director Button (Special)
        builtinButtonsHtml += `
            <button class="pw_cat_btn pw_director_btn"
                    data-category="director"
                    data-name="Director"
                    title="Director: Take control of the story">
                <i class="fa-solid fa-clapperboard"></i>
            </button>`;

        // Surprise Me dropdown — immediately after Director
        builtinButtonsHtml += surpriseDropdownHtml;

        // Premise generator — a pinned premise shows a dot
        const premiseTitle = pinnedPremise
            ? `Premise: pinned "${pinnedPremise.premise.title}". Click to change or unpin.`
            : 'Premise: generate a story premise from your concept';
        builtinButtonsHtml += `
            <button class="pw_cat_btn pw_premise_btn${pinnedPremise ? ' pw_premise_pinned_btn' : ''}"
                    data-category="premise"
                    data-name="${pinnedPremise ? 'Premise (pinned)' : 'Premise'}"
                    title="${esc(premiseTitle)}">
                <i class="fa-solid fa-lightbulb"></i>
                ${pinnedPremise ? '<span class="pw_surprise_active_dot"></span>' : ''}
            </button>`;

        // Main Categories (Context, Twist, Character, Explicit)
        let categoryOptionsHtml = '<option value="director">Director Mode</option><option value="premise">Premise</option>';

        for (const [key, cat] of Object.entries(MAIN_CATEGORIES)) {
            if (cat.nsfw && !settings.show_explicit) continue;
            const bIcon = allCategories[key]?.icon || cat.icon;

            const btnHtml = `
                <button class="pw_cat_btn${blockedClass(key)}"
                        data-category="${key}"
                        data-name="${cat.name}"
                        title="${cat.name}: ${cat.tooltip}">
                    <i class="fa-solid ${bIcon}"></i>
                </button>`;

            builtinButtonsHtml += btnHtml;
            categoryOptionsHtml += `<option value="${key}"${disabledAttr(key)}>${cat.name}</option>`;
        }

        // 2. Custom Styles (Combined Dropdown)
        let customDropdownHtml = '';
        if (settings.custom_styles?.length) {
            let customItems = '';
            for (const style of settings.custom_styles) {
                customItems += `
                    <button class="pw_dropdown_item${blockedClass(style.id)}" data-category="${style.id}">
                        <i class="fa-solid ${style.icon}"></i>
                        <span>${esc(style.name)}</span>
                    </button>`;
                // Also add to the mobile/fallback select
                categoryOptionsHtml += `<option value="${style.id}"${disabledAttr(style.id)}>${esc(style.name)}</option>`;
            }

            customDropdownHtml = `
            <div class="pw_dropdown_container">
                <button class="pw_dropdown_btn" data-name="Custom Styles" title="Custom Styles">
                    <i class="fa-solid fa-layer-group"></i>
                </button>
                <div class="pw_dropdown_menu">
                    ${customItems}
                </div>
            </div>`;
        }

        // 3. Genre Dropdown (Visual)
        // Sort genres alphabetically
        const sortedGenres = Object.entries(GENRE_CATEGORIES).sort((a, b) => a[1].name.localeCompare(b[1].name));
        let genreItems = '';
        let hasVisibleGenres = false;

        for (const [key, cat] of sortedGenres) {
            if (cat.nsfw && !settings.show_explicit) continue;
            const gIcon = allCategories[key]?.icon || cat.icon;
            genreItems += `
                <button class="pw_dropdown_item${blockedClass(key)}" data-category="${key}">
                    <i class="fa-solid ${gIcon}"></i>
                    <span>${cat.name}</span>
                </button>`;

            categoryOptionsHtml += `<option value="${key}"${disabledAttr(key)}>${cat.name}</option>`;
            hasVisibleGenres = true;
        }

        const genreDropdownHtml = hasVisibleGenres ? `
            <div class="pw_dropdown_container">
                 <button class="pw_dropdown_btn" data-name="Genres" title="Genres">
                    <i class="fa-solid fa-masks-theater"></i>
                </button>
                <div class="pw_dropdown_menu">
                    ${genreItems}
                </div>
            </div>
        ` : '';

        const minimized = settings.bar_minimized ? ' minimized' : '';
        const arrowIcon = settings.bar_minimized ? 'fa-chevron-up' : 'fa-chevron-down';
        const minimizeTitle = settings.bar_minimized ? 'Show Pathweaver' : 'Hide Pathweaver';

        const fontClass = settings.bar_font_size !== 'default' ? ` pw_font_${settings.bar_font_size}` : '';
        const heightClass = settings.bar_height !== 'default' ? ` pw_height_${settings.bar_height}` : '';
        const titleFontClass = settings.bar_title_font === 'none' ? ' pw_bar_title_none' : (settings.bar_title_font !== 'default' ? ` pw_bar_title_font_${settings.bar_title_font}` : '');

        const hideAnimatedBarClass = settings.hide_animated_bar ? ' pw_hide_animated_bar' : '';
        const barHtml = `
        <div class="pw_action_bar${minimized}${fontClass}${heightClass}${titleFontClass}${hideAnimatedBarClass}">
            <span class="pw_bar_title">Pathweaver</span>
            <div class="pw_category_buttons">
                ${builtinButtonsHtml}
                ${customDropdownHtml}
                ${genreDropdownHtml}
            </div>
            <select class="pw_category_dropdown" title="Select a suggestion style">
                <option value="" disabled selected>Style...</option>
                ${categoryOptionsHtml}
                <optgroup label="Surprise Me">
                    ${surpriseStyles.map(style => `<option value="surprise:${esc(style.id)}">${esc(style.name)}</option>`).join('')}
                </optgroup>
            </select>
            <div class="pw_bar_right">
                <span class="pw_hover_label" id="pw_hover_label"></span>
                ${showTimeSkipBtn ? `<button class="pw_icon_btn pw_timeskip_btn${timeSkipMode ? ' active' : ''}" id="pw_bar_timeskip"
                        data-name="${timeSkipMode ? 'Time Skip: On' : 'Time Skip: Off'}"
                        title="Time Skip: ${timeSkipMode ? 'on. Suggestions jump ahead in time. Click to turn off.' : 'off. Click to make suggestions jump ahead in time.'}"
                        aria-pressed="${timeSkipMode}">
                    <i class="fa-solid fa-hourglass-half"></i>
                </button>` : ''}
                <button class="pw_icon_btn" id="pw_bar_settings" title="Pathweaver Settings">
                    <i class="fa-solid fa-gear"></i>
                </button>
            </div>
            <button class="pw_minimize_btn" id="pw_minimize_bar" title="${minimizeTitle}">
                <i class="fa-solid ${arrowIcon}"></i>
            </button>
        </div>`;

        // Always insert above the send form (top position only)
        const sendForm = jQuery('#send_form');
        if (sendForm.length) {
            sendForm.before(barHtml);
            log('Bar inserted above #send_form');
        } else {
            // Fallback to form_sheld
            const formSheld = jQuery('#form_sheld');
            if (formSheld.length) {
                formSheld.prepend(barHtml);
                log('Bar inserted into #form_sheld');
            } else {
                // Last resort: append to body
                jQuery('body').append(barHtml);
                log('Bar inserted into body (fallback)');
            }
        }

        actionBar = jQuery('.pw_action_bar');
        if (actionBar.length) {
            // SillyBunny puts its own chat bar directly above ours; the minimize
            // tab would cover its buttons, so it moves inside the bar there.
            actionBar.toggleClass('pw_host_sillybunny', !!document.getElementById('sb-bottom-chat-bar'));
            log('Action bar created successfully');
        } else {
            error('Failed to create action bar');
            return;
        }

        // Setup responsive switching between buttons and dropdown
        setupResponsiveBar();

        // ------------------------------------------------------------
        // EVENT HANDLERS
        // ------------------------------------------------------------

        const eventNs = '.pw_action_bar_events';
        jQuery(document).off(eventNs);

        // 1. Regular Buttons
        jQuery(document).on(`click${eventNs}`, '.pw_cat_btn', function (e) {
            const category = jQuery(this).data('category');
            if (category === 'director') {
                e.stopPropagation();
                showDirectorModal();
                return;
            }
            if (category === 'premise') {
                e.stopPropagation();
                showPremiseModal();
                return;
            }
            openStyleFromBar(category);
        });

        // 2. Dropdown Toggles
        jQuery(document).on('click.pw_action_bar_events touchend.pw_action_bar_events', '.pw_dropdown_btn', function (e) {
            e.stopPropagation();
            if (e.type === 'touchend') e.preventDefault();

            const btn = jQuery(this);
            const menu = btn.siblings('.pw_dropdown_menu');
            const isActive = btn.hasClass('active');

            // Close all others
            jQuery('.pw_dropdown_menu').removeClass('show');
            jQuery('.pw_dropdown_btn').removeClass('active');

            // Toggle this one if it wasn't already active
            if (!isActive) {
                btn.addClass('active');
                menu.addClass('show');
            }
        });

        // Handle item clicks
        jQuery(document).on('click.pw_action_bar_events touchend.pw_action_bar_events', '.pw_dropdown_item', function (e) {
            e.stopPropagation();
            if (e.type === 'touchend') e.preventDefault();

            const category = jQuery(this).data('category');
            // Close menus
            jQuery('.pw_dropdown_menu').removeClass('show');
            jQuery('.pw_dropdown_btn').removeClass('active');

            if (category) {
                openStyleFromBar(category);
            }
        });

        // 4. Close on Outside Click
        jQuery(document).on(`click${eventNs}`, function (e) {
            if (!jQuery(e.target).closest('.pw_dropdown_container').length) {
                jQuery('.pw_dropdown_menu').removeClass('show');
                jQuery('.pw_dropdown_btn').removeClass('active');
            }
        });


        // 5. Fallback Select
        jQuery(document).on(`change${eventNs}`, '.pw_category_dropdown', function () {
            const category = this.value;
            if (category) {
                if (category.startsWith('surprise:')) {
                    showSurpriseModal(category.slice('surprise:'.length));
                } else if (category === 'director') {
                    showDirectorModal();
                } else if (category === 'premise') {
                    showPremiseModal();
                } else {
                    openStyleFromBar(category);
                }
                this.selectedIndex = 0; // Reset
            }
        });

        // 7. Hover Labels (Delegated)
        jQuery(document).on(`mouseenter${eventNs}`, '.pw_cat_btn, .pw_dropdown_btn, .pw_timeskip_btn', function () {
            const name = jQuery(this).data('name');
            if (name) {
                jQuery('#pw_hover_label').text(name).addClass('visible');
            }
        }).on(`mouseleave${eventNs}`, '.pw_cat_btn, .pw_dropdown_btn, .pw_timeskip_btn', function () {
            jQuery('#pw_hover_label').removeClass('visible');
        });

        // 6. Settings & Minimize
        jQuery(document).on(`click${eventNs}`, '#pw_bar_settings', openSettingsModal);

        jQuery(document).on(`click${eventNs}`, '#pw_bar_timeskip', function () {
            timeSkipMode = !timeSkipMode;
            createActionBar();
            showToast(timeSkipMode ? 'Time Skip on' : 'Time Skip off');
        });

        jQuery(document).on(`click${eventNs} touchend${eventNs}`, '#pw_minimize_bar', function (e) {
            // touchend: prevent the double-fire from the subsequent synthetic click
            if (e.type === 'touchend') e.preventDefault();
            settings.bar_minimized = !settings.bar_minimized;
            saveSettings();
            createActionBar();
        });

        // 8. Surprise items
        jQuery(document).on('click.pw_action_bar_events touchend.pw_action_bar_events', '.pw_surprise_item', function (e) {
            e.stopPropagation();
            if (e.type === 'touchend') e.preventDefault();

            const category = jQuery(this).data('surprise-category');
            jQuery('.pw_dropdown_menu').removeClass('show');
            jQuery('.pw_dropdown_btn').removeClass('active');

            if (category) {
                showSurpriseModal(category);
            }
        });

        // 9. Clear surprise button
        jQuery(document).on('click.pw_action_bar_events', '#pw_surprise_clear', function (e) {
            e.stopPropagation();
            clearAllSurprises();
            renderSurpriseQueue();
            createActionBar();
            showToast('Surprises cleared!');
        });
    }

    function setupResponsiveBar() {
        if (barResizeObserver) {
            barResizeObserver.disconnect();
            barResizeObserver = null;
        }
        window.removeEventListener('resize', checkBarWidth);

        const bar = document.querySelector('.pw_action_bar');
        if (!bar) return;

        checkBarWidth();
        if (typeof ResizeObserver !== 'undefined') {
            barResizeObserver = new ResizeObserver(checkBarWidth);
            barResizeObserver.observe(bar);
        } else {
            window.addEventListener('resize', checkBarWidth);
        }
    }

    /** Switch between the icon buttons and the "Style..." dropdown based on available width. */
    function checkBarWidth() {
        const bar = document.querySelector('.pw_action_bar');
        const buttons = bar?.querySelector('.pw_category_buttons');
        const dropdown = bar?.querySelector('.pw_category_dropdown');
        if (!buttons || !dropdown) return;

        // Show the buttons without wrapping so we can measure them
        buttons.style.display = 'flex';
        buttons.style.flexWrap = 'nowrap';

        const barRight = bar.querySelector('.pw_bar_right');
        const title = bar.querySelector('.pw_bar_title');
        const usedWidth =
            (title && title.offsetWidth > 0 ? title.offsetWidth + 8 : 0) +
            (barRight ? barRight.offsetWidth + 8 : 52) +
            32; // minimize button + gaps
        const availableForButtons = bar.offsetWidth - usedWidth;

        // On touch screens the button row can't be scrolled sideways (SillyBunny
        // blocks horizontal swipes inside the chat form), so fall back to the
        // dropdown as soon as the buttons would overflow.
        const isTouch = window.matchMedia?.('(pointer: coarse)').matches;
        const overflows = buttons.scrollWidth > availableForButtons + 1;
        const useDropdown = availableForButtons < 80 || (isTouch && overflows);

        buttons.style.display = useDropdown ? 'none' : 'flex';
        dropdown.style.display = useDropdown ? 'block' : 'none';
        bar.classList.toggle('pw_bar_collapsed', useDropdown);
    }

    // ============================================================
    // UI - SUGGESTIONS MODAL
    // ============================================================

    function showDirectorModal() {
        // Remove existing modal to ensure fresh state and logic
        if (jQuery('#pw_director_modal').length) {
            jQuery('#pw_director_modal').remove();
        }

        const modalHtml = `
        <div class="pw_modal_overlay" id="pw_director_modal">
            <div class="pw_modal" style="max-width: 600px;">
                <div class="pw_modal_header">
                    <h3 class="pw_modal_title">
                        <i class="fa-solid fa-clapperboard" style="color: var(--pw-director-color);"></i>
                        Director Mode
                    </h3>
                    <button class="pw_modal_close" id="pw_close_director">&times;</button>
                </div>
                <!-- Overflow hidden for slide/flip; Flex column for layout -->
                <div class="pw_modal_body" style="overflow: hidden; display: flex; flex-direction: column;"> 
                    
                    <div class="pw_director_container">
                        
                        <!-- VIEW 1: INPUTS -->
                        <div class="pw_director_view visible" id="pw_director_inputs_view">
                            <div class="pw_director_mode_switch">
                                <div class="pw_mode_option ${directorMode === 'single_scene' ? 'active' : ''}" data-mode="single_scene">
                                    <div class="pw_mode_title"><i class="fa-solid fa-film"></i> Single Scene</div>
                                    <div class="pw_mode_desc">Several takes on one scene built from all inputs</div>
                                </div>
                                <div class="pw_mode_option ${directorMode === 'story_beats' ? 'active' : ''}" data-mode="story_beats">
                                    <div class="pw_mode_title"><i class="fa-solid fa-list-check"></i> Story Beats</div>
                                    <div class="pw_mode_desc">One suggestion per input beat</div>
                                </div>
                            </div>

                            <div class="pw_director_inputs" id="pw_director_inputs" style="max-height: 40vh; overflow-y: auto; padding-right: 5px;">
                                <!-- Inputs injected here -->
                            </div>
                            
                            <div class="pw_director_actions" style="justify-content: space-between; gap: 10px;">
                                <button class="pw_add_direction_btn" id="pw_reset_dir_btn" style="width: auto; flex: 1; border-color: var(--pw-glass-border); background: transparent;">
                                    <i class="fa-solid fa-rotate-left"></i> Reset
                                </button>
                                <button class="pw_add_direction_btn" id="pw_add_dir_btn" style="flex: 2;">
                                    <i class="fa-solid fa-plus"></i> Add Another Direction
                                </button>
                            </div>
                            
                            <div style="display: flex; gap: 10px; margin-top: 10px;">
                                <button class="pw_header_btn primary pw_director_generate_btn" id="pw_director_generate" style="margin-top:0;">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Suggestions
                                </button>
                                <button class="pw_header_btn" id="pw_show_results_btn" style="display:none; flex: 1; justify-content: center; align-items: center; gap: 8px;">
                                    Show Suggestions <i class="fa-solid fa-arrow-right"></i>
                                </button>
                            </div>
                        </div>

                        <!-- VIEW 2: RESULTS -->
                        <div class="pw_director_view hidden" id="pw_director_results_view">
                            <div class="pw_results_header">
                                <button class="pw_back_btn" id="pw_director_back">
                                    <i class="fa-solid fa-arrow-left"></i> Back to Director Mode
                                </button>
                                <!-- "Suggestions" text removed as requested -->
                            </div>
                            <div id="pw_director_results_content">
                                <!-- Results injected here -->
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>`;

        jQuery('body').append(modalHtml);
        const modal = jQuery('#pw_director_modal');
        const container = jQuery('#pw_director_inputs');
        const inputsView = jQuery('#pw_director_inputs_view');
        const resultsView = jQuery('#pw_director_results_view');

        const addBtn = jQuery('#pw_add_dir_btn');
        const showResultsBtn = jQuery('#pw_show_results_btn');
        let suggestionsGenerated = false;

        const placeholdersRandom = [
            "e.g. A masked stranger bursts through the tavern doors...",
            "e.g. The ancient amulet begins to glow pulsingly...",
            "e.g. A sudden thunderstorm forces them to seek shelter cave...",
            "e.g. He reveals a hidden dagger from his sleeve...",
            "e.g. The spaceship's alarm blares 'CRITICAL FAILURE'...",
            "e.g. She whispers a secret that changes everything..."
        ];

        const placeholdersContinuous = [
            "e.g. The detective enters the dimly lit office...",
            "e.g. She notices a folder left on the desk...",
            "e.g. She opens it to reveal the missing evidence...",
            "e.g. A sudden noise from the hallway startles her...",
            "e.g. She quickly hides the folder under her coat...",
            "e.g. The door creaks open slowly..."
        ];

        // Helper to add input
        const addInput = (focus = false) => {
            const count = container.children().length;
            if (count >= 6) return;

            let ph = '';
            if (directorMode === 'single_scene') {
                ph = placeholdersContinuous[count % placeholdersContinuous.length];
            } else {
                ph = placeholdersRandom[count % placeholdersRandom.length];
            }

            const html = `
                <div class="pw_director_input_group">
                    <div class="pw_director_input_label">${count + 1}</div>
                    <input type="text" class="pw_director_input" placeholder="${ph}" maxlength="200">
                    <button class="pw_director_remove_btn" title="Remove">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>`;
            const el = jQuery(html);
            container.append(el);

            el.find('.pw_director_remove_btn').on('click', function () {
                el.remove();
                renumberInputs();
            });

            if (focus) el.find('input').focus();
            checkLimit();
        };

        const renumberInputs = () => {
            container.find('.pw_director_input_label').each((i, el) => {
                jQuery(el).text(i + 1);
            });
            checkLimit();
        };

        const checkLimit = () => {
            const count = container.children().length;
            if (count >= 6) {
                addBtn.hide();
            } else {
                addBtn.show();
            }
        };

        // Initialize with 3 inputs
        addInput();
        addInput();
        addInput();

        // Events
        addBtn.on('click', () => addInput(true));

        jQuery('#pw_reset_dir_btn').on('click', () => {
            container.empty();
            addInput();
            addInput();
            addInput();
            suggestionsGenerated = false;
            showResultsBtn.hide();
        });

        jQuery('#pw_close_director').on('click', () => modal.removeClass('active'));
        modal.on('click', (e) => {
            if (e.target === modal[0]) modal.removeClass('active');
        });

        // Mode switching logic
        jQuery('.pw_mode_option').on('click', function () {
            jQuery('.pw_mode_option').removeClass('active');
            jQuery(this).addClass('active');
            directorMode = jQuery(this).data('mode');

            // Switch placeholders immediately if Inputs view is visible
            if (inputsView.hasClass('visible')) {
                // We need to re-render inputs to update placeholders
                // But we don't want to lose user text.
                // For now, just clearing and resetting is simplest to show new examples,
                // BUT preserving text is better.
                // The user request says "the examples inside should reflect...", implies placeholders.
                // We'll just update placeholders of empty inputs.
                container.find('input').each(function (i) {
                    if (!jQuery(this).val()) {
                        let newPh = '';
                        if (directorMode === 'single_scene') {
                            newPh = placeholdersContinuous[i % placeholdersContinuous.length];
                        } else {
                            newPh = placeholdersRandom[i % placeholdersRandom.length];
                        }
                        jQuery(this).attr('placeholder', newPh);
                    }
                });
            }
        });

        // FLIP LOGIC
        const showResults = () => {
            inputsView.removeClass('visible').addClass('hidden');
            resultsView.removeClass('hidden').addClass('visible');
        };

        const showInputs = () => {
            resultsView.removeClass('visible').addClass('hidden');
            inputsView.removeClass('hidden').addClass('visible');
            if (suggestionsGenerated) showResultsBtn.css('display', 'inline-flex');
        };

        jQuery('#pw_director_back').on('click', showInputs);
        showResultsBtn.on('click', showResults);

        jQuery('#pw_director_generate').on('click', () => {
            const directions = [];
            container.find('input').each(function () {
                const val = jQuery(this).val().trim();
                if (val) directions.push(val);
            });

            if (directions.length === 0) {
                showToast('Please enter at least one direction.', 'warning');
                return;
            }

            // Flip to results
            showResults();
            suggestionsGenerated = true;

            // Trigger generation rendered into the results content container
            generateSuggestions('director', true, directions, directorMode, jQuery('#pw_director_results_content'));
        });

        // Show
        setTimeout(() => modal.addClass('active'), 10);
    }

    function createSuggestionsModal() {
        if (jQuery('#pw_suggestions_modal').length) return;

        const modalHtml = `
        <div class="pw_modal_overlay" id="pw_suggestions_modal">
            <div class="pw_modal">
                <div class="pw_modal_header">
                    <h3 class="pw_modal_title">
                        <i class="fa-solid fa-compass"></i>
                        <span id="pw_modal_title_text">Story Directions</span>
                    </h3>
                    <div class="pw_modal_actions">
                        <button class="pw_header_btn" id="pw_refresh_btn" title="Generate new suggestions">
                            <i class="fa-solid fa-rotate"></i> Refresh
                        </button>
                        <button class="pw_modal_close" id="pw_close_suggestions">&times;</button>
                    </div>
                </div>
                <div class="pw_modal_body" id="pw_modal_body"></div>
            </div>
        </div>`;

        jQuery('body').append(modalHtml);
        suggestionsModal = jQuery('#pw_suggestions_modal');

        jQuery('#pw_close_suggestions').on('click', closeSuggestionsModal);
        jQuery('#pw_refresh_btn').on('click', () => {
            const category = suggestionsModal.data('category');
            if (category) generateSuggestions(category, true, null, 'single_scene', null, !!suggestionsModal.data('timeSkip'));
        });

        suggestionsModal.on('click', (e) => {
            if (e.target === suggestionsModal[0]) closeSuggestionsModal();
        });

        jQuery(document).off('keydown.pathweaver_suggestions').on('keydown.pathweaver_suggestions', (e) => {
            if (e.key !== 'Escape') return;
            // Close the top-most open Pathweaver modal
            if (jQuery('#pw_icon_panel').hasClass('open')) return;
            const open = jQuery('.pw_modal_overlay.active').last();
            if (!open.length) return;
            const id = open.attr('id');
            if (id === 'pw_suggestions_modal') closeSuggestionsModal();
            else if (id === 'pw_settings_modal') closeSettingsModal();
            else if (id === 'pw_styles_manager') closeStylesManager();
            else if (id === 'pw_surprise_modal') open.find('#pw_close_surprise').trigger('click');
            else open.removeClass('active');
        });
    }

    /** Opens a style clicked in the bar, honoring the Time Skip toggle. */
    function openStyleFromBar(category) {
        if (timeSkipMode && !hasTimeSkipVariant(category)) {
            const name = getAllCategories()[category]?.name || category;
            showToast(`Time skip isn't enabled for ${name} (edit the style to turn it on)`, 'warning');
            return;
        }
        openSuggestionsModal(category, timeSkipMode);
    }

    function openSuggestionsModal(category, timeSkip = false) {
        createSuggestionsModal();

        const allCategories = getAllCategories();
        let catInfo = allCategories[category];

        if (category === 'director') {
            catInfo = { name: 'Director Instructions', icon: 'fa-clapperboard' };
        }

        const title = catInfo?.name || 'Story Directions';
        jQuery('#pw_modal_title_text').text(timeSkip ? `${title} · Time Skip` : title);
        jQuery('#pw_suggestions_modal .pw_modal_title i')
            .removeClass()
            .addClass(`fa-solid ${timeSkip ? 'fa-hourglass-half' : (catInfo?.icon || 'fa-compass')}`);

        suggestionsModal.data('category', category);
        suggestionsModal.data('timeSkip', timeSkip);
        suggestionsModal.addClass('active');
        generateSuggestions(category, false, null, 'single_scene', null, timeSkip);
    }

    function closeSuggestionsModal() {
        // isGenerating is released by generateSuggestions once the request has
        // really finished, so a new request can't overlap one still running.
        if (abortController) abortController.abort();
        if (suggestionsModal) suggestionsModal.removeClass('active');
    }

    function showLoadingState(category, outputContainer = null, customMessage = null) {
        const body = outputContainer || jQuery('#pw_modal_body');
        const allCategories = getAllCategories();
        const catName = allCategories[category]?.name || category;
        const msg = customMessage || `Generating ${catName} suggestions...`;

        let skeletons = '';
        for (let i = 0; i < Math.min(6, settings.suggestions_count); i++) {
            skeletons += `
            <div class="pw_skeleton_card">
                <div class="pw_skeleton_emoji"></div>
                <div class="pw_skeleton_title"></div>
                <div class="pw_skeleton_line"></div>
                <div class="pw_skeleton_line"></div>
            </div>`;
        }

        body.html(`
            <div class="pw_status">
                <i class="fa-solid fa-circle-notch pw_spin"></i>
                <span>${msg}</span>
                <div class="pw_status_actions">
                    <button class="pw_status_btn cancel pw_throb" id="pw_cancel_gen">
                        <i class="fa-solid fa-xmark"></i> Cancel
                    </button>
                </div>
            </div>
            <div class="pw_suggestions_grid">${skeletons}</div>
        `);

        body.find('#pw_cancel_gen').off('click').on('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            if (abortController) abortController.abort();
        });
    }

    function showEmptyState(message = 'No suggestions available', outputContainer = null) {
        const body = outputContainer || jQuery('#pw_modal_body');
        body.html(`
            <div class="pw_empty_state">
                <i class="fa-solid fa-compass"></i>
                <p>${esc(message)}</p>
            </div>
        `);
    }

    function showErrorState(message, outputContainer = null) {
        const body = outputContainer || jQuery('#pw_modal_body');
        body.html(`
            <div class="pw_empty_state">
                <i class="fa-solid fa-circle-exclamation" style="color: var(--pw-danger);"></i>
                <p>${esc(message)}</p>
            </div>
        `);
    }

    function displaySuggestions(suggestions, category, outputContainer = null) {
        const body = outputContainer || jQuery('#pw_modal_body');

        if (!suggestions || suggestions.length === 0) {
            showEmptyState('No suggestions could be generated. Try again.', outputContainer);
            return;
        }

        const { DOMPurify } = SillyTavern.libs;
        let cardsHtml = '<div class="pw_suggestions_grid">';

        suggestions.forEach((suggestion, index) => {
            const safeTitle = DOMPurify.sanitize(suggestion.title, { ALLOWED_TAGS: [] });
            const safeDesc = DOMPurify.sanitize(suggestion.description, { ALLOWED_TAGS: [] });
            const safeEmoji = suggestion.emoji || '✨';

            cardsHtml += `
            <div class="pw_suggestion_card" data-index="${index}">
                <div class="pw_card_header">
                    <span class="pw_card_emoji">${safeEmoji}</span>
                    <span class="pw_card_title">${safeTitle}</span>
                </div>
                <div class="pw_card_description">${safeDesc}</div>
                <div class="pw_card_actions">
                    <button class="pw_card_action_btn" data-action="copy" title="Copy to clipboard">
                        <i class="fa-solid fa-copy"></i> Copy
                    </button>
                    <button class="pw_card_action_btn" data-action="insert" title="Insert into input field">
                        <i class="fa-solid fa-plus"></i> Insert
                    </button>
                    <button class="pw_card_action_btn primary" data-action="send" title="Insert and send">
                        <i class="fa-solid fa-paper-plane"></i> Send
                    </button>
                </div>
            </div>`;
        });

        cardsHtml += '</div>';
        body.html(cardsHtml);

        // Scope to this container: the Director and suggestion modals can both hold cards
        body.find('.pw_suggestion_card').on('click', function (e) {
            const index = jQuery(this).data('index');
            const suggestion = suggestions[index];
            if (!suggestion) return;
            const action = jQuery(e.target).closest('[data-action]').data('action');

            if (action === 'copy') {
                copyToClipboard(suggestion.description);
            } else if (action === 'insert') {
                insertSuggestion(suggestion);
            } else if (action === 'send') {
                sendSuggestion(suggestion);
            }
        });
    }

    function getFormattedSuggestion(text) {
        if (!settings.insert_type_enabled) return text;

        if (settings.insert_type_ooc) return `[OOC: ${text}]`;
        if (settings.insert_type_director) return `[Director: ${text}]`;

        return text;
    }

    function copyToClipboard(text) {
        const formatted = getFormattedSuggestion(text);
        navigator.clipboard.writeText(formatted).then(() => showToast('Copied to clipboard!'));
    }

    function insertSuggestion(suggestion) {
        const textarea = jQuery('#send_textarea');
        const text = getFormattedSuggestion(suggestion.description);
        const current = textarea.val();

        if (settings.insert_mode) {
            // Append Mode
            textarea.val(current + (current ? '\n' : '') + text);
        } else {
            // Overwrite Mode (Default)
            textarea.val(text);
        }

        // Trigger input event and resize the textarea
        textarea.trigger('input');

        // Force textarea to resize by triggering native events
        const textareaEl = textarea[0];
        if (textareaEl) {
            textareaEl.style.height = 'auto';
            textareaEl.style.height = textareaEl.scrollHeight + 'px';
            textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
        }

        closeSuggestionsModal();
        jQuery('#pw_director_modal').removeClass('active');
        showToast('Suggestion inserted!');
    }

    function sendSuggestion(suggestion) {
        const textarea = jQuery('#send_textarea');
        const text = getFormattedSuggestion(suggestion.description);

        textarea.val(text);
        textarea.trigger('input');

        closeSuggestionsModal();
        jQuery('#pw_director_modal').removeClass('active');

        // Click the send button after a short delay
        setTimeout(() => {
            const sendBtn = jQuery('#send_but');
            if (sendBtn.length) {
                sendBtn.trigger('click');
                showToast('Suggestion sent!');
            }
        }, 100);
    }

    function showToast(message, type = 'success') {
        if (typeof toastr !== 'undefined') {
            (toastr[type] || toastr.success)(message, 'Pathweaver');
        } else {
            console.log('[Pathweaver-Toast]', message);
        }
    }

    // ============================================================
    // UI - SETTINGS MODAL
    // ============================================================

    function createSettingsModal() {
        if (jQuery('#pw_settings_modal').length) {
            jQuery('#pw_settings_modal').remove();
        }

        const profiles = getConnectionProfiles();
        let profileOptions = '<option value="">-- Select Profile --</option>';
        profiles.forEach(p => {
            const selected = settings.preset === p.name ? ' selected' : '';
            const safeName = escapeHtmlAttr(p.name);
            profileOptions += `<option value="${safeName}"${selected}>${safeName}</option>`;
        });

        const modalHtml = `
        <div class="pw_modal_overlay" id="pw_settings_modal">
            <div class="pw_modal pw_settings_modal">
                <div class="pw_modal_header">
                    <h3 class="pw_modal_title">
                        <i class="fa-solid fa-gear"></i>
                        Pathweaver Settings
                    </h3>
                    <button class="pw_modal_close" id="pw_close_settings">&times;</button>
                </div>
                <div class="pw_modal_body">
                    <div class="pw_settings_content">
                        
                        <div class="pw_settings_section">
                            <h4 class="pw_settings_section_title">
                                <i class="fa-solid fa-sliders"></i> General
                            </h4>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-power-off"></i> Enable Pathweaver</span>
                                <div class="pw_toggle ${settings.enabled ? 'active' : ''}" data-setting="enabled"></div>
                            </div>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-eye-slash"></i> Hide Animated Bar</span>
                                <div class="pw_toggle ${settings.hide_animated_bar ? 'active' : ''}" data-setting="hide_animated_bar"></div>
                            </div>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-plus-circle"></i> Insert Mode (Append)</span>
                                <div class="pw_toggle ${settings.insert_mode ? 'active' : ''}" data-setting="insert_mode"></div>
                            </div>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-fire pw_nsfw_icon"></i> Show Explicit Category (NSFW)</span>
                                <div class="pw_toggle ${settings.show_explicit ? 'active' : ''}" data-setting="show_explicit"></div>
                            </div>
                            
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-code-branch"></i> Insert Type</span>
                                <div class="pw_toggle ${settings.insert_type_enabled ? 'active' : ''}" data-setting="insert_type_enabled"></div>
                            </div>
                            
                            <div id="pw_sm_insert_type_options" style="${settings.insert_type_enabled ? 'display:flex' : 'display:none'}; flex-direction: column; gap: 8px; padding-left: 20px; border-left: 2px solid var(--SmartThemeBorderColor); margin-bottom: 10px;">
                                <div class="pw_setting_row">
                                    <span class="pw_setting_label" style="font-size: 0.9em;">[OOC: ]</span>
                                    <div class="pw_toggle ${settings.insert_type_ooc ? 'active' : ''}" data-setting="insert_type_ooc"></div>
                                </div>
                                <div class="pw_setting_row">
                                    <span class="pw_setting_label" style="font-size: 0.9em;">[Director: ]</span>
                                    <div class="pw_toggle ${settings.insert_type_director ? 'active' : ''}" data-setting="insert_type_director"></div>
                                </div>
                                <p class="pw_setting_hint" style="margin: 0;">With a wrapper on, suggestions are written as directions to the AI. Without one, they are written as your character's next message.</p>
                            </div>

                        </div>

                        <div class="pw_settings_section">
                            <h4 class="pw_settings_section_title">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> Generation
                            </h4>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-list-ol"></i> Suggestions count</span>
                                <div class="pw_setting_control">
                                    <select id="pw_sm_suggestions" class="pw_select text_pole">
                                        <option value="2" ${settings.suggestions_count == 2 ? 'selected' : ''}>2</option>
                                        <option value="4" ${settings.suggestions_count == 4 ? 'selected' : ''}>4</option>
                                        <option value="6" ${settings.suggestions_count == 6 ? 'selected' : ''}>6</option>
                                    </select>
                                </div>
                            </div>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-layer-group"></i> Context depth</span>
                                <div class="pw_setting_control">
                                    <select id="pw_sm_context" class="pw_select text_pole">
                                        <option value="2" ${settings.context_depth == 2 ? 'selected' : ''}>2 messages</option>
                                        <option value="4" ${settings.context_depth == 4 ? 'selected' : ''}>4 messages</option>
                                        <option value="6" ${settings.context_depth == 6 ? 'selected' : ''}>6 messages</option>
                                        <option value="8" ${settings.context_depth == 8 ? 'selected' : ''}>8 messages</option>
                                        <option value="10" ${settings.context_depth == 10 ? 'selected' : ''}>10 messages</option>
                                        <option value="12" ${settings.context_depth == 12 ? 'selected' : ''}>12 messages</option>
                                        <option value="16" ${settings.context_depth == 16 ? 'selected' : ''}>16 messages</option>
                                        <option value="20" ${settings.context_depth == 20 ? 'selected' : ''}>20 messages</option>
                                    </select>
                                </div>
                            </div>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-text-width"></i> Suggestion length</span>
                                <div class="pw_setting_control">
                                    <select id="pw_sm_suggestion_length" class="pw_select text_pole">
                                        <option value="short" ${settings.suggestion_length === 'short' ? 'selected' : ''}>Short (2-3 sentences)</option>
                                        <option value="long" ${settings.suggestion_length === 'long' ? 'selected' : ''}>Long (4-6 sentences)</option>
                                    </select>
                                </div>
                            </div>
                            <div class="pw_setting_row pw_setting_row_stream">
                                <span class="pw_setting_label"><i class="fa-solid fa-stream"></i> Stream suggestions</span>
                                <div class="pw_toggle ${settings.stream_suggestions ? 'active' : ''}" data-setting="stream_suggestions"></div>
                            </div>
                            <p class="pw_setting_hint pw_setting_stream_hint">
                                Cards appear as each suggestion is generated. Works with Ollama, OpenAI-compatible APIs, and most Connection Profiles. The Default (Main API) source can't stream.
                            </p>
                            
                            <!-- Reasoning Mode Settings -->
                            <div class="pw_setting_row" style="margin-top: 12px;">
                                <span class="pw_setting_label"><i class="fa-solid fa-brain"></i> Reasoning Mode</span>
                                <div class="pw_toggle ${settings.reasoning_mode ? 'active' : ''}" data-setting="reasoning_mode"></div>
                            </div>
                            <p class="pw_setting_hint">
                                Enable for reasoning models (DeepSeek, etc.). Increases max tokens and properly handles thinking tags.
                            </p>
                            
                            <div id="pw_modal_max_tokens_row" class="pw_setting_row" style="${settings.reasoning_mode ? 'display: flex' : 'display: none'}; margin-top: 8px;">
                                <span class="pw_setting_label"><i class="fa-solid fa-terminal"></i> Max Output Tokens</span>
                                <div class="pw_setting_control">
                                    <input id="pw_modal_max_output_tokens" type="number" class="text_pole" value="${settings.max_output_tokens || 16384}" min="512" max="128000" step="512" style="width: 100px;"
                                        title="Maximum tokens for reasoning model output">
                                </div>
                            </div>
                            <p id="pw_modal_max_tokens_hint" class="pw_setting_hint" style="${settings.reasoning_mode ? 'display: block' : 'display: none'}; margin-top: 4px;">
                                Higher values allow more thinking tokens for reasoning models. 8K-32K recommended.
                            </p>
                        </div>

                        <div class="pw_settings_section">
                            <h4 class="pw_settings_section_title">
                                <i class="fa-solid fa-book-open"></i> Context Sources
                            </h4>
                            <p style="color: var(--pw-text-muted); font-size: 0.8rem; margin-bottom: 10px;">
                                Include additional context for more accurate suggestions
                            </p>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-scroll"></i> Include Scenario</span>
                                <div class="pw_toggle ${settings.include_scenario ? 'active' : ''}" data-setting="include_scenario"></div>
                            </div>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-user"></i> Include Character Description</span>
                                <div class="pw_toggle ${settings.include_description ? 'active' : ''}" data-setting="include_description"></div>
                            </div>
                            <div class="pw_setting_row" style="flex-wrap: wrap;">
                                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                                    <span class="pw_setting_label"><i class="fa-solid fa-globe"></i> Include World Info Lorebook</span>
                                    <div class="pw_toggle ${settings.include_worldinfo ? 'active' : ''}" data-setting="include_worldinfo"></div>
                                </div>
                                <div class="pw_setting_hint" style="width: 100%; margin-top: 4px;">
                                    <i class="fa-solid fa-circle-info"></i> Adds the World Info entries that the recent messages activate, the same way a normal reply would.
                                </div>
                            </div>
                        </div>

                        <div class="pw_settings_section">
                            <h4 class="pw_settings_section_title">
                                <i class="fa-solid fa-microchip"></i> Generation Source
                            </h4>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-server"></i> Source</span>
                                <div class="pw_setting_control">
                                    <select id="pw_sm_source" class="pw_select text_pole">
                                        <option value="default" ${settings.source === 'default' ? 'selected' : ''}>Default (Main API)</option>
                                        <option value="profile" ${settings.source === 'profile' ? 'selected' : ''}>Connection Profile</option>
                                        <option value="ollama" ${settings.source === 'ollama' ? 'selected' : ''}>Ollama</option>
                                        <option value="openai" ${settings.source === 'openai' ? 'selected' : ''}>OpenAI Compatible</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="pw_sm_provider_box" id="pw_sm_profile_box" style="${settings.source === 'profile' ? '' : 'display:none'}">
                                <div class="pw_sm_provider_row">
                                    <label>Profile</label>
                                    <select id="pw_sm_profile" class="pw_select text_pole">${profileOptions}</select>
                                </div>
                            </div>
                            
                            <div class="pw_sm_provider_box" id="pw_sm_ollama_box" style="${settings.source === 'ollama' ? '' : 'display:none'}">
                                <div class="pw_sm_provider_row">
                                    <label>URL</label>
                                    <input type="text" id="pw_sm_ollama_url" value="${esc(settings.ollama_url)}" placeholder="http://localhost:11434">
                                </div>
                                <div class="pw_sm_provider_row">
                                    <label>Model</label>
                                    <select id="pw_sm_ollama_model" class="pw_select text_pole"></select>
                                </div>
                            </div>
                            
                            <div class="pw_sm_provider_box" id="pw_sm_openai_box" style="${settings.source === 'openai' ? '' : 'display:none'}">
                                <div class="pw_sm_provider_row">
                                    <label>Preset</label>
                                    <select id="pw_sm_openai_preset" class="pw_select text_pole">
                                        ${Object.entries({ custom: 'Custom', lmstudio: 'LM Studio (:1234)', kobold: 'KoboldCPP (:5001)', textgen: 'TextGenWebUI (:5000)', vllm: 'vLLM (:8000)' })
        .map(([v, label]) => `<option value="${v}" ${settings.openai_preset === v ? 'selected' : ''}>${label}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="pw_sm_provider_row">
                                    <label>URL</label>
                                    <input type="text" id="pw_sm_openai_url" value="${esc(settings.openai_url)}" placeholder="http://localhost:1234/v1">
                                </div>
                                <div class="pw_sm_provider_row">
                                    <label>Model</label>
                                    <input type="text" id="pw_sm_openai_model" value="${esc(settings.openai_model)}" placeholder="Model name">
                                </div>
                                <div class="pw_sm_provider_row">
                                    <label>Key</label>
                                    <input type="password" id="pw_sm_openai_key" value="${esc(settings.openai_key)}" placeholder="API Key (Optional)">
                                </div>
                            </div>
                        </div>

                        <div class="pw_settings_section">
                            <h4 class="pw_settings_section_title">
                                <i class="fa-solid fa-palette"></i> Appearance
                            </h4>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-text-height"></i> Font Size</span>
                                <div class="pw_setting_control">
                                    <select id="pw_sm_font_size" class="pw_select text_pole">
                                        <option value="small" ${settings.bar_font_size === 'small' ? 'selected' : ''}>Small</option>
                                        <option value="default" ${settings.bar_font_size === 'default' ? 'selected' : ''}>Default</option>
                                        <option value="large" ${settings.bar_font_size === 'large' ? 'selected' : ''}>Large</option>
                                    </select>
                                </div>
                            </div>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-up-down"></i> Bar Height</span>
                                <div class="pw_setting_control">
                                    <select id="pw_sm_bar_height" class="pw_select text_pole">
                                        <option value="compact" ${settings.bar_height === 'compact' ? 'selected' : ''}>Compact</option>
                                        <option value="default" ${settings.bar_height === 'default' ? 'selected' : ''}>Default</option>
                                        <option value="max" ${settings.bar_height === 'max' ? 'selected' : ''}>Max</option>
                                    </select>
                                </div>
                            </div>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-font"></i> Title font</span>
                                <div class="pw_setting_control">
                                    <select id="pw_sm_bar_title_font" class="pw_select pw_title_font_select text_pole">
                                        <option value="none" style="font-family: inherit" ${settings.bar_title_font === 'none' ? 'selected' : ''}>None (hidden)</option>
                                        <option value="default" style="font-family: 'Crimson Text', Georgia, serif" ${settings.bar_title_font === 'default' ? 'selected' : ''}>Default</option>
                                        <optgroup label="Serif">
                                            <option value="crimson" style="font-family: 'Crimson Text', Georgia, serif" ${settings.bar_title_font === 'crimson' ? 'selected' : ''}>Crimson Text</option>
                                            <option value="georgia" style="font-family: Georgia, 'Times New Roman', serif" ${settings.bar_title_font === 'georgia' ? 'selected' : ''}>Georgia</option>
                                            <option value="merriweather" style="font-family: 'Merriweather', Georgia, serif" ${settings.bar_title_font === 'merriweather' ? 'selected' : ''}>Merriweather</option>
                                            <option value="lora" style="font-family: 'Lora', Georgia, serif" ${settings.bar_title_font === 'lora' ? 'selected' : ''}>Lora</option>
                                        </optgroup>
                                        <optgroup label="Sans-serif">
                                            <option value="inter" style="font-family: 'Inter', system-ui, sans-serif" ${settings.bar_title_font === 'inter' ? 'selected' : ''}>Inter</option>
                                            <option value="nunito" style="font-family: 'Nunito', system-ui, sans-serif" ${settings.bar_title_font === 'nunito' ? 'selected' : ''}>Nunito</option>
                                            <option value="poppins" style="font-family: 'Poppins', system-ui, sans-serif" ${settings.bar_title_font === 'poppins' ? 'selected' : ''}>Poppins</option>
                                            <option value="roboto" style="font-family: 'Roboto', system-ui, sans-serif" ${settings.bar_title_font === 'roboto' ? 'selected' : ''}>Roboto</option>
                                        </optgroup>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="pw_settings_section">
                            <h4 class="pw_settings_section_title">
                                <i class="fa-solid fa-wand-sparkles"></i> Surprise Me
                                <span class="pw_setting_tooltip_icon" title="Surprise Me secretly injects an AI-generated suggestion into the chat context a set number of messages before it fires. Pick a style, and Pathweaver will quietly arm a hidden prompt. When the countdown hits, the suggestion appears naturally — like the story took an unexpected turn on its own.">?</span>
                            </h4>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-infinity"></i> Endless Surprises
                                    <span class="pw_setting_tooltip_icon" title="Automatically generates and arms a fresh surprise the moment the previous one fires. The story never stops surprising you — until you turn this off.">?</span>
                                </span>
                                <div class="pw_toggle ${settings.surprise_endless ? 'active' : ''}" data-setting="surprise_endless"></div>
                            </div>
                            <p class="pw_setting_hint" style="margin: -4px 0 10px 0; font-size: 0.78rem; opacity: 0.8;">
                                A new surprise is silently queued the moment the previous one fires.
                            </p>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-shuffle"></i> Randomize depth</span>
                                <div class="pw_toggle ${settings.surprise_randomize ? 'active' : ''}" data-setting="surprise_randomize"></div>
                            </div>
                            <div id="pw_sm_surprise_range_rows" style="${settings.surprise_randomize ? '' : 'display:none;'}">
                                <p class="pw_setting_hint" style="margin: 2px 0 10px 0; font-size: 0.78rem; opacity: 0.8;">
                                    Picks a random depth within this range each time.
                                </p>
                                <div class="pw_setting_row pw_surprise_depth_range_row">
                                    <span class="pw_setting_label"><i class="fa-solid fa-clock-rotate-left"></i> Min messages</span>
                                    <div class="pw_setting_control">
                                        <select id="pw_sm_surprise_depth_min" class="pw_select text_pole">
                                            ${[2,3,4,5,6,7,8,9,10,11,12].map(n => `<option value="${n}" ${settings.surprise_depth_min == n ? 'selected' : ''}>${n}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                                <div class="pw_setting_row pw_surprise_depth_range_row">
                                    <span class="pw_setting_label"><i class="fa-solid fa-clock-rotate-left"></i> Max messages</span>
                                    <div class="pw_setting_control">
                                        <select id="pw_sm_surprise_depth_max" class="pw_select text_pole">
                                            ${[2,3,4,5,6,7,8,9,10,11,12].map(n => `<option value="${n}" ${settings.surprise_depth_max == n ? 'selected' : ''}>${n}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div id="pw_sm_surprise_fixed_hint" style="${settings.surprise_randomize ? 'display:none;' : ''}">
                                <p class="pw_setting_hint" style="margin: 2px 0 0; font-size: 0.78rem; opacity: 0.8;">
                                    Uses a fixed depth of <strong>${settings.surprise_depth_min}</strong> messages.
                                </p>
                            </div>

                            <!-- Active queue accordion -->
                            <details id="pw_sm_surprise_queue_accordion" class="pw_surprise_queue_accordion" style="display:none; margin-top: 12px;">
                                <summary class="pw_surprise_queue_summary">
                                    <i class="fa-solid fa-list-check"></i>
                                    <span id="pw_sm_surprise_queue_label">Armed surprises</span>
                                    <i class="fa-solid fa-chevron-down pw_surprise_queue_chevron"></i>
                                </summary>
                                <ul id="pw_sm_surprise_queue_list" class="pw_surprise_queue_list"></ul>
                            </details>

                            <!-- Clear all button -->
                            <button id="pw_sm_surprise_clear_all" class="pw_surprise_clear_all_btn" style="display:none; margin-top: 10px;">
                                <i class="fa-solid fa-xmark"></i> Clear all surprises
                            </button>
                        </div>

                        <div class="pw_settings_section">
                            <h4 class="pw_settings_section_title">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> Suggestion Styles
                            </h4>
                            <p style="color: var(--pw-text-muted); font-size: 0.85rem; margin-bottom: 12px;">
                                Manage built-in and customized suggestion styles.
                            </p>
                            <button class="pw_open_editor_btn" id="pw_open_style_editor">
                                <i class="fa-solid fa-layer-group"></i> Suggestion Styles Manager
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>`;

        jQuery('body').append(modalHtml);
        settingsModal = jQuery('#pw_settings_modal');

        // Bind close
        jQuery('#pw_close_settings').on('click', closeSettingsModal);
        settingsModal.on('click', (e) => {
            if (e.target === settingsModal[0]) closeSettingsModal();
        });

        // Toggle switches
        jQuery('.pw_toggle').on('click', function () {
            const setting = jQuery(this).data('setting');
            settings[setting] = !settings[setting];
            jQuery(this).toggleClass('active');

            if (setting === 'enabled') {
                createActionBar();
            }
            if (setting === 'show_explicit') createActionBar();
            if (setting === 'hide_animated_bar') {
                jQuery('.pw_action_bar').toggleClass('pw_hide_animated_bar', settings.hide_animated_bar);
            }

            if (setting === 'insert_type_enabled') {
                if (settings[setting]) jQuery('#pw_sm_insert_type_options').css('display', 'flex');
                else jQuery('#pw_sm_insert_type_options').hide();
            }

            // Mutually exclusive sub-options
            if (setting === 'insert_type_ooc' && settings.insert_type_ooc) {
                settings.insert_type_director = false;
                jQuery('.pw_toggle[data-setting="insert_type_director"]').removeClass('active');
            }
            if (setting === 'insert_type_director' && settings.insert_type_director) {
                settings.insert_type_ooc = false;
                jQuery('.pw_toggle[data-setting="insert_type_ooc"]').removeClass('active');
            }

            // Surprise Me: show/hide range rows based on randomize toggle
            if (setting === 'surprise_randomize') {
                if (settings.surprise_randomize) {
                    jQuery('#pw_sm_surprise_range_rows').show();
                    jQuery('#pw_sm_surprise_fixed_hint').hide();
                } else {
                    jQuery('#pw_sm_surprise_range_rows').hide();
                    jQuery('#pw_sm_surprise_fixed_hint').show();
                    jQuery('#pw_sm_surprise_fixed_hint p strong').text(settings.surprise_depth_min);
                }
            }

            // Surprise Me: clear queue when endless is turned off so no
            // lingering background generations can fire against local backends.
            if (setting === 'surprise_endless' && !settings.surprise_endless) {
                clearAllSurprises();
                renderSurpriseQueue();
                createActionBar();
            }

            // Reasoning mode: show/hide max tokens input
            if (setting === 'reasoning_mode') {
                if (settings.reasoning_mode) {
                    jQuery('#pw_modal_max_tokens_row').show();
                    jQuery('#pw_modal_max_tokens_hint').show();
                } else {
                    jQuery('#pw_modal_max_tokens_row').hide();
                    jQuery('#pw_modal_max_tokens_hint').hide();
                }
                // Also sync to extension panel
                jQuery('#pw_max_output_tokens_row, #pw_max_output_tokens_hint').toggle(!!settings.reasoning_mode);
            }

            saveSettings();
            syncSettingsToPanel(); // Sync to extension panel (NOW after logic)
        });

        // Source dropdown
        jQuery('#pw_sm_source').on('change', function () {
            settings.source = this.value;
            saveSettings();
            jQuery('#pw_sm_profile_box, #pw_sm_ollama_box, #pw_sm_openai_box').hide();
            if (this.value === 'profile') jQuery('#pw_sm_profile_box').show();
            else if (this.value === 'ollama') {
                jQuery('#pw_sm_ollama_box').show();
                refreshOllamaModels();
            }
            else if (this.value === 'openai') jQuery('#pw_sm_openai_box').show();
        });

        jQuery('#pw_sm_profile').on('change', function () { settings.preset = this.value; saveSettings(); syncSettingsToPanel(); });
        jQuery('#pw_sm_ollama_url').on('change', function () { settings.ollama_url = this.value; saveSettings(); syncSettingsToPanel(); refreshOllamaModels(); });
        jQuery('#pw_sm_ollama_model').on('change', function () { settings.ollama_model = this.value; saveSettings(); syncSettingsToPanel(); });
        jQuery('#pw_sm_openai_preset').on('change', function () {
            applyOpenAIPreset(this.value);
            jQuery('#pw_sm_openai_url').val(settings.openai_url);
            jQuery('#pw_sm_openai_model').val(settings.openai_model);
            saveSettings();
            syncSettingsToPanel();
        });
        jQuery('#pw_sm_openai_url').on('change', function () { settings.openai_url = this.value; saveSettings(); syncSettingsToPanel(); });
        jQuery('#pw_sm_openai_model').on('change', function () { settings.openai_model = this.value; saveSettings(); syncSettingsToPanel(); });
        jQuery('#pw_sm_openai_key').on('change', function () { settings.openai_key = this.value; saveSettings(); syncSettingsToPanel(); });

        jQuery('#pw_sm_suggestions').on('change', function () {
            settings.suggestions_count = Math.max(1, Math.min(20, parseInt(this.value) || 6));
            this.value = settings.suggestions_count;
            saveSettings();
            syncSettingsToPanel();
        });

        jQuery('#pw_sm_context').on('change', function () { settings.context_depth = parseInt(this.value) || 8; saveSettings(); syncSettingsToPanel(); });

        // Suggestion length
        jQuery('#pw_sm_suggestion_length').on('change', function () { settings.suggestion_length = this.value; saveSettings(); syncSettingsToPanel(); });

        // Modal: Max output tokens
        jQuery('#pw_modal_max_output_tokens').on('change', function () {
            const val = parseInt(this.value) || 16384;
            settings.max_output_tokens = Math.max(512, Math.min(128000, val));
            this.value = settings.max_output_tokens;
            saveSettings();
            syncSettingsToPanel();
        });

        // Surprise Me: depth min select
        jQuery('#pw_sm_surprise_depth_min').on('change', function () {
            const val = parseInt(this.value) || 2;
            settings.surprise_depth_min = val;
            // Ensure max >= min
            if (settings.surprise_depth_max < val) {
                settings.surprise_depth_max = val;
                jQuery('#pw_sm_surprise_depth_max').val(val);
            }
            saveSettings();
            syncSettingsToPanel();
        });

        // Surprise Me: depth max select
        jQuery('#pw_sm_surprise_depth_max').on('change', function () {
            const val = parseInt(this.value) || 6;
            settings.surprise_depth_max = val;
            // Ensure min <= max
            if (settings.surprise_depth_min > val) {
                settings.surprise_depth_min = val;
                jQuery('#pw_sm_surprise_depth_min').val(val);
            }
            saveSettings();
            syncSettingsToPanel();
        });

        // Font size
        jQuery('#pw_sm_font_size').on('change', function () {
            settings.bar_font_size = this.value;
            saveSettings();
            syncSettingsToPanel();
            createActionBar();
        });

        // Bar height
        jQuery('#pw_sm_bar_height').on('change', function () {
            settings.bar_height = this.value;
            saveSettings();
            syncSettingsToPanel();
            createActionBar();
        });

        // Bar title font
        jQuery('#pw_sm_bar_title_font').on('change', function () {
            settings.bar_title_font = this.value;
            applyTitleFontSelectDisplay(this);
            saveSettings();
            syncSettingsToPanel();
            createActionBar();
        });
        applyTitleFontSelectDisplay(document.getElementById('pw_sm_bar_title_font'));

        // Style editor opener
        jQuery('#pw_open_style_editor').on('click', () => openStylesManager());

        // Surprise Me: clear all (modal)
        jQuery('#pw_sm_surprise_clear_all').on('click', function () {
            clearAllSurprises();
            renderSurpriseQueue();
            createActionBar();
            showToast('Surprises cleared!');
        });

        // Surprise Me: remove individual item from modal list
        jQuery('#pw_sm_surprise_queue_list').on('click', '.pw_sq_remove', function () {
            const idx = parseInt(jQuery(this).data('surprise-index'));
            if (!isNaN(idx) && idx >= 0 && idx < activeSurprises.length) {
                const s = activeSurprises[idx];
                if (s.injected) clearSurprisePrompt(s.key);
                activeSurprises.splice(idx, 1);
                saveSurpriseQueue();
                renderSurpriseQueue();
                createActionBar();
                showToast('Surprise removed.');
            }
        });

        if (settings.source === 'ollama') refreshOllamaModels();

        // Populate queue display now that modal elements exist in the DOM
        renderSurpriseQueue();
    }

    async function refreshOllamaModels() {
        const select = jQuery('#pw_sm_ollama_model');
        select.html('<option value="">Loading...</option>');
        const models = await fetchOllamaModels();
        select.empty();
        if (models.length) {
            models.forEach(m => {
                const selected = settings.ollama_model === m.name ? ' selected' : '';
                select.append(`<option value="${esc(m.name)}"${selected}>${esc(m.name)}</option>`);
            });
        } else {
            select.append('<option value="">No models found</option>');
        }
    }

    function openSettingsModal() {
        createSettingsModal();
        settingsModal.addClass('active');
    }

    function closeSettingsModal() {
        if (settingsModal) settingsModal.removeClass('active');
    }

    // ============================================================
    // UI - STYLES MANAGER MODAL (Complete Redesign)
    // ============================================================

    let stylesManagerModal = null;
    let currentEditStyle = null;
    let originalBuiltinPrompts = {}; // Cache original prompts for reset

    // Default template for new custom styles
    // Default template for new custom styles. Pathweaver adds the shared rules
    // (continuity, voice, variety, output format) around it automatically.
    const defaultTemplate = `STYLE: [Your style name]
Suggest developments that [describe the kind of turn you want]. Build them from the current scene: [what to look for in the recent messages, such as a character's goal or an object in the room]. [Any tone or content preferences.]`;

    function openStylesManager() {
        if (jQuery('#pw_styles_manager').length) {
            jQuery('#pw_styles_manager').remove();
        }

        const modalHtml = `
        <div class="pw_modal_overlay" id="pw_styles_manager">
            <div class="pw_modal pw_manager_modal">
                <div class="pw_modal_header">
                    <h3 class="pw_modal_title">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        Suggestion Styles Manager
                    </h3>
                    <button class="pw_modal_close" id="pw_close_manager">&times;</button>
                </div>
                <div class="pw_modal_body">
                    <div class="pw_manager_container">
                        <div class="pw_manager_flipper" id="pw_manager_flipper">
                            <!-- FRONT: List View -->
                            <div class="pw_manager_front" id="pw_manager_list_view">
                                <div class="pw_manager_header">
                                    <h4><i class="fa-solid fa-layer-group"></i> All Styles</h4>
                                    <button class="pw_create_btn" id="pw_create_new_style">
                                        <i class="fa-solid fa-plus"></i> Create New
                                    </button>
                                </div>
                                <div class="pw_style_list" id="pw_style_list"></div>
                            </div>
                            <!-- BACK: Editor View -->
                            <div class="pw_manager_back" id="pw_manager_editor_view">
                                <div class="pw_editor_back_header">
                                    <button class="pw_back_btn" id="pw_back_to_list" title="Back to list">
                                        <i class="fa-solid fa-arrow-left"></i>
                                    </button>
                                    <span class="pw_editor_back_title" id="pw_editor_title">Edit Style</span>
                                </div>
                                <div class="pw_editor_content">
                                    <div class="pw_editor_row">
                                        <label>Name</label>
                                        <input type="text" id="pw_edit_name" placeholder="Style Name" maxlength="30">
                                    </div>
                                    <div class="pw_editor_row">
                                        <label>Icon</label>
                                        <div class="pw_icon_dropdown_wrap">
                                            <select id="pw_edit_icon" style="display:none;"></select>
                                            <button type="button" class="pw_icon_dropdown_trigger" id="pw_icon_dropdown" data-value="fa-star">
                                                <i class="fa-solid fa-star pw_icon_dd_icon"></i>
                                                <span class="pw_icon_dd_label">star</span>
                                                <i class="fa-solid fa-chevron-down pw_icon_dd_chevron"></i>
                                            </button>
                                            <div class="pw_icon_dropdown_panel" id="pw_icon_panel">
                                                <div class="pw_icon_mobile_header">
                                                    <div class="pw_icon_mobile_handle"></div>
                                                    <span class="pw_icon_mobile_title">Choose Icon</span>
                                                    <button type="button" class="pw_icon_mobile_close" id="pw_icon_mobile_close" aria-label="Close icon picker">
                                                        <i class="fa-solid fa-xmark"></i>
                                                    </button>
                                                </div>
                                                <div class="pw_icon_search_wrap">
                                                    <i class="fa-solid fa-magnifying-glass"></i>
                                                    <input type="text" class="pw_icon_search" id="pw_icon_search" placeholder="Search icons...">
                                                </div>
                                                <div class="pw_icon_grid" id="pw_icon_grid"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="pw_editor_row">
                                        <label for="pw_edit_timeskip">Time Skip</label>
                                        <label class="pw_timeskip_check">
                                            <input type="checkbox" id="pw_edit_timeskip">
                                            <span>Time-skip variant <span class="pw_setting_tooltip_icon" title="Adds a time-skip version of this style. Turn on Time Skip (the hourglass in the Pathweaver bar) and click this style to get suggestions that jump ahead in time.">?</span></span>
                                        </label>
                                    </div>
                                    <div class="pw_editor_row" style="flex-direction: column; align-items: flex-start; flex: 1;">
                                        <label style="margin-bottom: 4px;">Style Prompt</label>
                                        <p class="pw_setting_hint" style="margin: 0 0 8px 0; padding-left: 0;">Describe only what this style should focus on. Pathweaver adds the shared rules and the output format automatically.</p>
                                        <textarea class="pw_editor_textarea" id="pw_edit_prompt" placeholder="Enter system prompt..."></textarea>
                                    </div>
                                </div>
                                <div class="pw_editor_toolbar">
                                    <button class="pw_toolbar_btn primary" id="pw_save_style">
                                        <i class="fa-solid fa-check"></i> Save
                                    </button>
                                    <button class="pw_toolbar_btn" id="pw_copy_prompt">
                                        <i class="fa-solid fa-copy"></i> Copy
                                    </button>
                                    <button class="pw_toolbar_btn" id="pw_paste_prompt">
                                        <i class="fa-solid fa-paste"></i> Paste
                                    </button>
                                    <button class="pw_toolbar_btn" id="pw_reset_prompt">
                                        <i class="fa-solid fa-rotate-left"></i> Reset
                                    </button>
                                    <button class="pw_toolbar_btn" id="pw_export_prompt">
                                        <i class="fa-solid fa-download"></i> Export
                                    </button>
                                    <button class="pw_toolbar_btn danger" id="pw_delete_style">
                                        <i class="fa-solid fa-trash"></i> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        jQuery('body').append(modalHtml);
        stylesManagerModal = jQuery('#pw_styles_manager');

        // Populate hidden select (for value tracking) and custom icon grid
        const iconSelect = jQuery('#pw_edit_icon');
        const iconGrid  = jQuery('#pw_icon_grid');
        AVAILABLE_ICONS.forEach(icon => {
            const label = icon.replace('fa-', '');
            iconSelect.append(`<option value="${icon}">${label}</option>`);
            iconGrid.append(`
                <button type="button" class="pw_icon_grid_item" data-icon="${icon}" title="${label}">
                    <i class="fa-solid ${icon}"></i>
                    <span>${label}</span>
                </button>
            `);
        });

        // Render the styles list
        renderStylesList();

        // Bind events
        bindStylesManagerEvents();

        // Show modal
        stylesManagerModal.addClass('active');
    }

    function renderStylesList() {
        const listContainer = jQuery('#pw_style_list');
        listContainer.empty();

        // getAllCategories() already merges builtin_icon_customizations so icons reflect saved overrides
        const allCats = getAllCategories();

        // Built-in styles first
        for (const [key, cat] of Object.entries(MAIN_CATEGORIES)) {
            if (cat.nsfw && !settings.show_explicit) continue;
            const displayIcon = allCats[key]?.icon || cat.icon;

            listContainer.append(`
                <div class="pw_style_item builtin" data-style-id="${key}" data-builtin="true">
                    <div class="pw_style_icon">
                        <i class="fa-solid ${displayIcon}"></i>
                    </div>
                    <div class="pw_style_info">
                        <div class="pw_style_name">${cat.name}</div>
                        <div class="pw_style_type">Main Style</div>
                    </div>
                    <div class="pw_style_actions">
                        <button class="pw_style_action_btn pw_edit_style_btn" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>
                </div>
            `);
        }

        // Genre styles
        for (const [key, cat] of Object.entries(GENRE_CATEGORIES)) {
            if (cat.nsfw && !settings.show_explicit) continue;
            const displayIcon = allCats[key]?.icon || cat.icon;

            listContainer.append(`
                <div class="pw_style_item builtin" data-style-id="${key}" data-builtin="true">
                    <div class="pw_style_icon">
                        <i class="fa-solid ${displayIcon}"></i>
                    </div>
                    <div class="pw_style_info">
                        <div class="pw_style_name">${cat.name}</div>
                        <div class="pw_style_type">Genre Style</div>
                    </div>
                    <div class="pw_style_actions">
                        <button class="pw_style_action_btn pw_edit_style_btn" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>
                </div>
            `);
        }

        // Custom styles
        if (settings.custom_styles?.length) {
            settings.custom_styles.forEach(style => {
                listContainer.append(`
                    <div class="pw_style_item custom" data-style-id="${style.id}" data-builtin="false">
                        <div class="pw_style_icon">
                            <i class="fa-solid ${style.icon}"></i>
                        </div>
                        <div class="pw_style_info">
                            <div class="pw_style_name">${esc(style.name)}</div>
                            <div class="pw_style_type">Custom Style</div>
                        </div>
                        <div class="pw_style_actions">
                            <button class="pw_style_action_btn pw_edit_style_btn" title="Edit">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="pw_style_action_btn danger pw_delete_style_btn" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `);
            });
        }
    }

    function bindStylesManagerEvents() {
        // Close modal
        jQuery('#pw_close_manager').on('click', closeStylesManager);
        stylesManagerModal.on('click', (e) => {
            if (e.target === stylesManagerModal[0]) closeStylesManager();
        });

        // Create new style
        jQuery('#pw_create_new_style').on('click', () => {
            openEditorView(null, true);
        });

        // Edit style from list
        jQuery('#pw_style_list').on('click', '.pw_edit_style_btn', function (e) {
            e.stopPropagation();
            const item = jQuery(this).closest('.pw_style_item');
            const styleId = item.data('style-id');
            const isBuiltin = String(item.data('builtin')) === 'true';
            openEditorView(styleId, false, isBuiltin);
        });

        // Delete style from list
        jQuery('#pw_style_list').on('click', '.pw_delete_style_btn', function (e) {
            e.stopPropagation();
            const item = jQuery(this).closest('.pw_style_item');
            const styleId = item.data('style-id');
            deleteStyle(styleId);
        });

        // Back to list
        jQuery('#pw_back_to_list').on('click', () => {
            jQuery('#pw_manager_flipper').removeClass('flipped');
            currentEditStyle = null;
        });

        // Remove any prior document handlers before re-adding (modal is recreated each open)
        jQuery(document)
            .off('click.pw_icon_dd')
            .off('click.pw_icon_dd_outside')
            .off('input.pw_icon_search')
            .off('click.pw_icon_grid');

        // Shared close helper — removes open state and mobile backdrop class
        function closeIconPanel() {
            jQuery('#pw_icon_panel').removeClass('open pw_icon_panel_flip pw_icon_panel_up');
            jQuery('body').removeClass('pw_icon_dd_open');
        }

        // Custom icon dropdown – trigger opens/closes the panel
        jQuery(document).on('click.pw_icon_dd', '#pw_icon_dropdown', function (e) {
            e.stopPropagation();
            const panel = jQuery('#pw_icon_panel');
            const isOpen = panel.hasClass('open');
            const isMobile = window.innerWidth <= 768;

            if (!isOpen) {
                panel.removeClass('pw_icon_panel_flip pw_icon_panel_up');
                panel.css({ top: '', bottom: '', left: '', right: '', transform: '' });
                panel.addClass('open');

                if (isMobile) {
                    // Mobile bottom-sheet — CSS handles positioning, just add
                    // the body class to activate the dimming backdrop.
                    jQuery('body').addClass('pw_icon_dd_open');
                } else {
                    // Desktop: measure and apply flip/up corrections as normal
                    requestAnimationFrame(() => {
                        const rect = panel[0].getBoundingClientRect();
                        const wrap = panel.closest('.pw_icon_dropdown_wrap')[0];
                        const wrapRect = wrap ? wrap.getBoundingClientRect() : rect;

                        if (rect.right > window.innerWidth - 8) {
                            panel.addClass('pw_icon_panel_flip');
                        }
                        if (rect.bottom > window.innerHeight - 8 && wrapRect.top > rect.height + 12) {
                            panel.addClass('pw_icon_panel_up');
                        }
                    });
                }

                jQuery('#pw_icon_search').val('').trigger('input').focus();
            } else {
                closeIconPanel();
            }
        });

        // Mobile sheet close button (×) — fires before the outside-click guard
        jQuery(document).on('click.pw_icon_dd', '#pw_icon_mobile_close', function (e) {
            e.stopPropagation();
            closeIconPanel();
        });

        // Close when tapping the dimming backdrop.
        // Guard: ignore clicks that land on the panel or the trigger button.
        jQuery(document).on('click.pw_icon_dd_outside', function (e) {
            if (!jQuery(e.target).closest('.pw_icon_dropdown_panel, .pw_icon_dropdown_wrap').length) {
                closeIconPanel();
            }
        });

        // Search filter
        jQuery(document).on('input.pw_icon_search', '#pw_icon_search', function () {
            const q = this.value.toLowerCase();
            jQuery('#pw_icon_grid .pw_icon_grid_item').each(function () {
                const match = jQuery(this).data('icon').replace('fa-', '').includes(q);
                jQuery(this).toggle(match);
            });
        });

        // Select icon from grid
        jQuery(document).on('click.pw_icon_grid', '#pw_icon_grid .pw_icon_grid_item', function (e) {
            e.stopPropagation();
            const icon = jQuery(this).data('icon');
            setIconDropdown(icon);
            closeIconPanel();
        });

        // Save style
        jQuery('#pw_save_style').on('click', saveCurrentStyle);

        // Copy prompt
        jQuery('#pw_copy_prompt').on('click', () => {
            const prompt = jQuery('#pw_edit_prompt').val();
            navigator.clipboard.writeText(prompt).then(() => showToast('Prompt copied!'));
        });

        // Paste prompt
        jQuery('#pw_paste_prompt').on('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                jQuery('#pw_edit_prompt').val(text);
                showToast('Prompt pasted!');
            } catch (err) {
                showToast('Could not read clipboard');
            }
        });

        // Reset prompt + icon (built-in only)
        jQuery('#pw_reset_prompt').on('click', async () => {
            if (currentEditStyle && currentEditStyle.builtin) {
                const original = await loadBuiltinPrompt(currentEditStyle.id);
                jQuery('#pw_edit_prompt').val(original);
                // Also restore the original default icon
                const allCatsOrig = { ...MAIN_CATEGORIES, ...GENRE_CATEGORIES };
                const originalIcon = allCatsOrig[currentEditStyle.id]?.icon || 'fa-star';
                setIconDropdown(originalIcon);
                showToast('Reset to default!');
            } else {
                jQuery('#pw_edit_prompt').val(defaultTemplate);
                showToast('Reset to template!');
            }
        });

        // Export prompt
        jQuery('#pw_export_prompt').on('click', () => {
            const name = jQuery('#pw_edit_name').val().trim() || 'style';
            const prompt = jQuery('#pw_edit_prompt').val();
            const blob = new Blob([prompt], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${name.replace(/\s+/g, '_').toLowerCase()}.md`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Exported!');
        });

        // Delete style (from editor)
        jQuery('#pw_delete_style').on('click', () => {
            if (currentEditStyle && !currentEditStyle.builtin) {
                deleteStyle(currentEditStyle.id);
                jQuery('#pw_manager_flipper').removeClass('flipped');
            } else {
                showToast('Cannot delete built-in styles');
            }
        });
    }

    /** Update the custom icon dropdown trigger UI and hidden select value */
    function setIconDropdown(icon) {
        const safe = icon || 'fa-star';
        const label = safe.replace('fa-', '');
        const trigger = jQuery('#pw_icon_dropdown');
        trigger.data('value', safe);
        trigger.find('.pw_icon_dd_icon').removeClass().addClass(`fa-solid ${safe} pw_icon_dd_icon`);
        trigger.find('.pw_icon_dd_label').text(label);
        // Sync hidden select
        jQuery('#pw_edit_icon').val(safe);
        // Highlight active item in grid
        jQuery('#pw_icon_grid .pw_icon_grid_item').removeClass('active');
        jQuery(`#pw_icon_grid .pw_icon_grid_item[data-icon="${safe}"]`).addClass('active');
    }

    async function openEditorView(styleId, isNew = false, isBuiltin = false) {
        const flipper = jQuery('#pw_manager_flipper');
        const nameInput = jQuery('#pw_edit_name');
        const promptArea = jQuery('#pw_edit_prompt');
        const deleteBtn = jQuery('#pw_delete_style');
        const titleEl = jQuery('#pw_editor_title');

        if (isNew) {
            // Creating new style
            currentEditStyle = { id: null, builtin: false, isNew: true };
            titleEl.text('Create New Suggestion Style');
            nameInput.val('').prop('disabled', false);
            setIconDropdown('fa-star');
            promptArea.val(defaultTemplate);
            deleteBtn.hide();
            jQuery('#pw_edit_timeskip').prop('checked', false);
        } else if (isBuiltin) {
            // Editing built-in style
            const allCats = getAllCategories();
            const cat = allCats[styleId];
            currentEditStyle = { id: styleId, builtin: true, isNew: false };
            titleEl.text(`Edit: ${cat.name}`);
            nameInput.val(cat.name).prop('disabled', true);
            // Use the saved icon override if present, otherwise fall back to category default
            const savedIcon = settings.builtin_icon_customizations?.[styleId] || cat.icon;
            setIconDropdown(savedIcon);

            // Load the prompt (check for user customization first)
            let prompt = promptCache[styleId];
            if (!prompt) {
                prompt = await loadPrompt(styleId);
            }
            promptArea.val(prompt);
            deleteBtn.hide();
            jQuery('#pw_edit_timeskip').prop('checked', hasTimeSkipVariant(styleId));
        } else {
            // Editing custom style
            const style = settings.custom_styles.find(s => s.id === styleId);
            if (!style) return;

            currentEditStyle = { id: styleId, builtin: false, isNew: false };
            titleEl.text(`Edit: ${style.name}`);
            nameInput.val(style.name).prop('disabled', false);
            setIconDropdown(style.icon || 'fa-star');
            promptArea.val(style.prompt);
            deleteBtn.show();
            jQuery('#pw_edit_timeskip').prop('checked', hasTimeSkipVariant(styleId));
        }

        flipper.addClass('flipped');
    }

    function saveCurrentStyle() {
        const name = jQuery('#pw_edit_name').val().trim();
        // Read icon from our custom dropdown (hidden select is kept in sync)
        const icon = jQuery('#pw_edit_icon').val() || jQuery('#pw_icon_dropdown').data('value') || 'fa-star';
        const prompt = jQuery('#pw_edit_prompt').val().trim();
        const timeSkipEnabled = jQuery('#pw_edit_timeskip').prop('checked');

        if (!currentEditStyle) return;

        if (currentEditStyle.builtin) {
            // Save customization for built-in style (prompt + icon)
            promptCache[currentEditStyle.id] = prompt;
            if (!settings.builtin_customizations) settings.builtin_customizations = {};
            settings.builtin_customizations[currentEditStyle.id] = prompt;

            // Save icon customization
            const allCatsOrig = { ...MAIN_CATEGORIES, ...GENRE_CATEGORIES };
            const originalIcon = allCatsOrig[currentEditStyle.id]?.icon;
            if (!settings.builtin_icon_customizations) settings.builtin_icon_customizations = {};
            if (icon && icon !== originalIcon) {
                settings.builtin_icon_customizations[currentEditStyle.id] = icon;
            } else {
                delete settings.builtin_icon_customizations[currentEditStyle.id];
            }

            setTimeSkipVariant(currentEditStyle.id, timeSkipEnabled);
            saveSettings();
            showToast('Built-in style customized!');
        } else {
            // Custom style
            if (!name) { showToast('Please enter a name'); return; }
            if (!prompt) { showToast('Please enter a prompt'); return; }

            const id = currentEditStyle.isNew ? 'custom_' + Date.now() : currentEditStyle.id;
            const newStyle = { id, name, icon, prompt };

            if (!settings.custom_styles) settings.custom_styles = [];

            if (currentEditStyle.isNew) {
                settings.custom_styles.push(newStyle);
            } else {
                const idx = settings.custom_styles.findIndex(s => s.id === currentEditStyle.id);
                if (idx >= 0) settings.custom_styles[idx] = newStyle;
            }

            delete promptCache[id];
            setTimeSkipVariant(id, timeSkipEnabled);
            saveSettings();
            showToast('Style saved!');
        }

        createActionBar();
        renderStylesList();
        jQuery('#pw_manager_flipper').removeClass('flipped');
        currentEditStyle = null;
    }

    function setTimeSkipVariant(styleId, enabled) {
        const ids = (settings.time_skip_styles || []).filter(id => id !== styleId);
        if (enabled) ids.push(styleId);
        settings.time_skip_styles = ids;
    }

    function deleteStyle(styleId) {
        settings.custom_styles = settings.custom_styles.filter(s => s.id !== styleId);
        setTimeSkipVariant(styleId, false);
        delete promptCache[styleId];
        delete cachedSuggestions[styleId];
        delete cachedSuggestions[getSuggestionCacheKey(styleId, true)];
        saveSettings();
        createActionBar();
        renderStylesList();
        showToast('Style deleted');
    }

    async function loadBuiltinPrompt(category) {
        // Check if we have original cached
        if (originalBuiltinPrompts[category]) {
            return originalBuiltinPrompts[category];
        }
        // Load from file
        try {
            const response = await fetch(`${BASE_URL}/prompts/${category}.md`);
            if (response.ok) {
                const text = await response.text();
                originalBuiltinPrompts[category] = text;
                return text;
            }
        } catch (err) {
            warn('Failed to load built-in prompt:', err);
        }
        return defaultTemplate;
    }

    function closeStylesManager() {
        if (stylesManagerModal) {
            stylesManagerModal.removeClass('active');
            // Reset flip state
            jQuery('#pw_manager_flipper').removeClass('flipped');
            currentEditStyle = null;
        }
    }

    // ============================================================
    // PREMISE GENERATOR
    // ============================================================

    /*
     * A premise is a long-running situation for the whole roleplay, not a
     * single beat. It is built on Goal / Motivation / Conflict for {{char}},
     * plus stakes, a central dramatic question, an "engine" that keeps making
     * new trouble, and the opening catalyst. {{user}} only gets a role and a
     * hook (never a goal or feelings), or is left out entirely.
     *
     * A pinned premise is stored in the chat's metadata and injected into
     * every prompt with setExtensionPrompt, so it steers the whole chat.
     */

    const PREMISE_PROMPT_KEY = 'pathweaver_premise';
    /** After this many new messages the opening has played out and is dropped from the injection. */
    const PREMISE_OPENING_MESSAGES = 4;

    /** Styles offered in the premise modal. Context-Aware and New Character have no premise form. */
    const PREMISE_STYLES = {
        general: { name: 'General', icon: 'fa-compass' },
        twist: { name: 'Plot Twist', icon: 'fa-shuffle' },
        explicit: { name: 'Explicit', icon: 'fa-fire', nsfw: true },
    };

    const PREMISE_STYLE_GUIDES = {
        general: `STYLE: General
Use whatever genre and tone best fit the concept and the characters.`,

        twist: `STYLE: Plot Twist
Build each premise around a hidden truth that changes how the whole situation reads once it comes out: a false identity, a concealed motive, a misread event, an ally secretly working for the other side. Put it in the Secret field. The premise must work as a complete, compelling situation without the secret; the secret recasts it rather than replacing it, and it can be revealed gradually through clues.`,

        action: `STYLE: Action
Give {{char}} an external, physical goal and a capable opposing force that acts on its own (pursuers, a rival crew, an army, a hunter). Favor a deadline or a moving target. The engine should produce repeated confrontations that escalate in scale and cost.`,

        comedy: `STYLE: Comedy
Give {{char}} a sincere, strongly held goal and a flaw, lie, or circumstance that makes every attempt backfire. The humor comes from characters taking an absurd situation seriously. Good engines: a misunderstanding or cover story that has to keep being maintained, a mismatch between a character and where they are, a rule they must not break.`,

        fantasy: `STYLE: Fantasy
Root the conflict in a rule of the world (a magic, curse, bargain, prophecy, or law) that has a cost. The engine is that cost compounding, or the rule being tested again and again.`,

        horror: `STYLE: Horror
Give {{char}} a goal (escape, protect someone, uncover the truth) against a threat that follows rules the characters have to learn and that escalates over time. Safe places and options should shrink. Favor dread and the unknown over gore.`,

        mystery: `STYLE: Mystery
The central question is something hidden that must be uncovered. Include a few suspects or explanations with plausible motives. The engine: each answer raises a new question, and someone is working to keep the truth buried.`,

        noir: `STYLE: Noir
{{char}} is compromised, and a job, debt, or temptation pulls them deeper into corruption. There are no clean choices. The engine: debts, leverage, and lies that keep coming due.`,

        romance: `STYLE: Romance (SFW)
Falling in love is never the goal; romance complicates the goal. Give the characters an external reason that keeps them close and an internal reason (a wound, a belief, a loyalty, a secret) that keeps them apart. Keep it non-explicit. The engine: situations that force closeness and keep testing what stands between them.`,

        'sci-fi': `STYLE: Sci-Fi
Build each premise on one speculative idea (a technology, discovery, or social order) and explore it through its human consequences. The engine: the idea's consequences spreading or escalating.`,

        thriller: `STYLE: Thriller
A threat with a deadline. {{char}} is outmatched and missing information the opposition has. The engine: a countdown, a pursuer, or a conspiracy that tightens with every move.`,

        explicit: `STYLE: Explicit (NSFW)
Sexual content is the point of this premise, and it should be frank about the erotic dynamic. Desire is the conflict, never the goal: "they want to sleep together" is used up after one scene. Give the characters an outside reason that keeps them close (a job, an arrangement, a shared space, a bet, a debt) and a reason the desire is costly, forbidden, or bound by rules (a rivalry, a power imbalance, a secret, the terms of the arrangement). The engine is what keeps creating new erotic situations and pushing the dynamic further over many scenes. All characters are adults.`,
    };

    let premiseModal = null;
    let premiseResults = null; // last generated premises, kept until the chat changes
    let pinnedPremise = null;  // { premise, style, includeUser, baseMessageCount }

    function getPremiseStyleOptions() {
        const allCategories = getAllCategories();
        const options = [];
        const add = (id, name, icon) => options.push({ id, name, icon });
        add('general', PREMISE_STYLES.general.name, PREMISE_STYLES.general.icon);
        add('twist', PREMISE_STYLES.twist.name, allCategories.twist?.icon || PREMISE_STYLES.twist.icon);
        if (settings.show_explicit) add('explicit', PREMISE_STYLES.explicit.name, allCategories.explicit?.icon || PREMISE_STYLES.explicit.icon);
        Object.entries(GENRE_CATEGORIES)
            .sort((a, b) => a[1].name.localeCompare(b[1].name))
            .forEach(([id, cat]) => add(id, cat.name, allCategories[id]?.icon || cat.icon));
        (settings.custom_styles || []).forEach(style => add(style.id, style.name, style.icon));
        return options;
    }

    function getPremiseStyleName(styleId) {
        return getPremiseStyleOptions().find(o => o.id === styleId)?.name || 'General';
    }

    async function loadPremiseStyleGuide(styleId) {
        if (PREMISE_STYLE_GUIDES[styleId]) return PREMISE_STYLE_GUIDES[styleId];
        const customStyle = settings.custom_styles?.find(s => s.id === styleId);
        if (customStyle) {
            const prompt = await loadPrompt(styleId);
            return `STYLE: ${customStyle.name} (custom)
The style notes below were written for in-scene suggestions. Apply their genre, tone, themes, and content rules to the premise, and ignore anything about the next message or the current scene.
${String(prompt).trim()}`;
        }
        return PREMISE_STYLE_GUIDES.general;
    }

    /** Character card and persona only; chat history is deliberately left out. */
    function extractPremiseContext(includeUser) {
        const stContext = SillyTavern.getContext();
        if (!stContext || (stContext.characterId === undefined && !stContext.groupId)) return null;
        const fields = getCardFields(stContext);
        return {
            charName: getCharacterNames(stContext),
            userName: stContext.name1 || 'User',
            description: fields.description || '',
            scenario: fields.scenario || '',
            persona: includeUser ? (fields.persona || '') : '',
        };
    }

    function buildPremiseContextBlock(ctx, includeUser) {
        const parts = [];
        parts.push(includeUser
            ? `Characters: ${ctx.charName} (played by the AI); ${ctx.userName} (the user's character).`
            : `Main character: ${ctx.charName}. The user does not appear in this story.`);
        if (ctx.description) parts.push(`${ctx.charName}'s description:\n${ctx.description.substring(0, 10000)}`);
        if (includeUser && ctx.persona) parts.push(`${ctx.userName}'s persona:\n${ctx.persona.substring(0, 4000)}`);
        if (ctx.scenario) parts.push(`The card's default scenario (for reference only; premises may depart from it):\n${ctx.scenario.substring(0, 4000)}`);
        return parts.join('\n\n');
    }

    function buildPremiseSystemPrompt(styleGuide, ctx, includeUser, styleId) {
        const cast = includeUser
            ? 'an ongoing roleplay between {{user}} (the user) and {{char}}'
            : 'an ongoing story starring {{char}}, in which the user does not appear as a character';
        const userField = includeUser
            ? `- Role: who {{user}} is in this situation, and why {{user}} cannot simply walk away. Do not give {{user}} a goal, feelings, or decisions; the user decides those by playing.`
            : `- {{user}} is not part of this story. Never mention {{user}}. Invent any other characters the premise needs and give them names.`;
        const secretField = styleId === 'twist'
            ? '\n- Secret: the hidden truth, and who knows it.'
            : '';
        const secretLine = styleId === 'twist' ? '\nSecret: <the hidden truth>' : '';
        const roleLine = includeUser ? '\nRole: <{{user}}\'s role and hook>' : '';

        const prompt = `You create story premises for ${cast}. The user gives you a concept: a few sentences, a vibe, or a list of tags. Turn it into premises.

A premise is a long-running situation that can sustain many scenes, not a single scene or event. Describe the starting forces and pressures; do not script what happens later, and never reveal how it ends.

${styleGuide.trim()}

EACH PREMISE HAS:
- Premise: one or two sentences that capture the heart of the story: who, the catalyst, what they want, and what stands in the way.
- Goal: what {{char}} wants. Concrete enough that you could tell whether it was achieved.
- Motivation: why {{char}} wants it, and why it matters to them personally.
- Conflict: what stands in the way: an opposing person or force, or the gap between what {{char}} wants and what they need.
${userField}
- Stakes: what is lost if things go wrong.
- Question: one central dramatic question the story keeps returning to. Do not answer it.
- Engine: what keeps producing new conflict over many scenes: what the opposition does if nobody acts, a recurring event, a countdown, or rules that keep being tested.
- Opening: the concrete situation the first scene starts in, and why the story starts now.${secretField}

RULES:
- Keep everything the concept asks for (setting, tropes, dynamics, tags) and fill the gaps with specific choices. Do not just restate the tags.
- Keep {{char}} true to their description: personality, abilities, and world. If the concept moves them to a different setting, follow the concept but keep who they are.
- Set Type to "plot-driven" when the main conflict is an outside antagonist or force, or "character-driven" when it is the gap between what {{char}} wants and what they need (often a false belief they hold). Mix both types across the set.
- Make the premises clearly different from each other: vary the source of conflict, the stakes, and the setting. Never write the same premise in different clothes.
- Use plain, specific language. Name important places, groups, and secondary characters.

OUTPUT FORMAT (follow exactly):
<one emoji> <title in plain text, under 8 words>
Type: <plot-driven or character-driven>
Premise: <1-2 sentences>
Goal: <...>
Motivation: <...>
Conflict: <...>${roleLine}
Stakes: <...>
Question: <...>
Engine: <...>
Opening: <...>${secretLine}
---
Put a line containing only --- between premises. No numbering, markdown, preamble, or closing remarks.`;
        return substituteMacros(prompt, { charName: ctx.charName, userName: ctx.userName });
    }

    const PREMISE_FIELDS = {
        type: 'type', premise: 'premise', logline: 'premise',
        goal: 'goal', motivation: 'motivation', conflict: 'conflict',
        role: 'role', 'user role': 'role',
        stakes: 'stakes', question: 'question', 'dramatic question': 'question', 'central question': 'question',
        engine: 'engine', opening: 'opening', secret: 'secret',
    };

    /** Parse one premise block into { emoji, title, type, premise, goal, ... } or null. */
    function parsePremiseBlock(blockText) {
        const text = stripReasoning(blockText).replace(/<[^>]*>/g, '').trim();
        if (text.length < 20) return null;

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const result = { emoji: '✨', title: '' };
        let current = null;
        const labelRegex = /^[-*\s]*\**\s*([A-Za-z][A-Za-z ']{1,24}?)\s*\**\s*:\s*\**\s*(.*)$/;

        for (const line of lines) {
            const match = line.match(labelRegex);
            // "Goal", but also "Mara's goal" or "Lena's role"
            const label = match ? match[1].toLowerCase().replace(/'s\b/g, '').trim() : '';
            const key = match && (PREMISE_FIELDS[label] || PREMISE_FIELDS[label.split(/\s+/).pop()]);
            if (key) {
                current = key;
                result[key] = stripMarkdown(match[2]);
                continue;
            }
            if (!result.title && !current) {
                const emojiMatch = line.match(EMOJI_SEQUENCE_REGEX);
                if (emojiMatch) {
                    result.emoji = emojiMatch[0];
                    result.title = stripMarkdown(line.substring(emojiMatch[0].length));
                } else {
                    result.title = stripMarkdown(line.replace(/^\s*\d+[.)]\s*/, ''));
                }
                continue;
            }
            if (current) result[current] = `${result[current]} ${stripMarkdown(line)}`.trim();
        }

        if (!result.premise || !result.title) return null;
        result.title = result.title.substring(0, 100);
        const type = (result.type || '').toLowerCase();
        result.type = type.includes('character') ? 'character-driven' : type.includes('plot') ? 'plot-driven' : '';
        return result;
    }

    async function parsePremises(text, maxCount) {
        await new Promise(resolve => setTimeout(resolve, 0));
        const cleaned = stripReasoning(text);
        if (!cleaned) return [];
        let blocks = cleaned.split(BLOCK_SEPARATOR);
        // Fallback: a new block starts at each line that begins with an emoji
        if (blocks.length <= 1) blocks = cleaned.split(new RegExp(`\\n(?=\\s*${EMOJI_PATTERN})`, 'u'));
        return blocks.map(parsePremiseBlock).filter(Boolean).slice(0, maxCount);
    }

    function premiseFieldRows(premise, userName, { forInjection = false, includeOpening = true, charName = '' } = {}) {
        // In the injected prompt, say whose goal it is
        const owner = forInjection && charName ? `${charName}'s ` : '';
        const label = text => owner ? `${owner}${text.toLowerCase()}` : text;
        const rows = [
            [label('Goal'), premise.goal],
            [label('Motivation'), premise.motivation],
            [label('Conflict'), premise.conflict],
            [`${userName}'s role`, premise.role],
            ['Stakes', premise.stakes],
            [forInjection ? 'Central question (keep returning to it; do not resolve it early)' : 'Question', premise.question],
            [forInjection ? 'Engine (draw new complications from this)' : 'Engine', premise.engine],
        ];
        if (includeOpening) rows.push([forInjection ? 'Opening situation' : 'Opening', premise.opening]);
        if (premise.secret) rows.push([forInjection ? 'Secret (hidden from the other characters; reveal gradually through clues)' : 'Secret', premise.secret]);
        return rows.filter(([, value]) => value);
    }

    function formatPremiseText(premise, userName) {
        const lines = [`${premise.title}`, '', premise.premise, ''];
        for (const [label, value] of premiseFieldRows(premise, userName)) lines.push(`${label}: ${value}`);
        return lines.join('\n').trim();
    }

    function buildPremiseInjection(pin) {
        const stContext = SillyTavern.getContext();
        const userName = stContext?.name1 || 'User';
        // In a group, name2 is just the last speaker, so leave the owner out
        const charName = stContext?.groupId ? '' : (stContext?.name2 || '');
        const newMessages = (stContext?.chat?.length ?? 0) - (pin.baseMessageCount || 0);
        const includeOpening = newMessages < PREMISE_OPENING_MESSAGES;
        const header = pin.includeUser
            ? '[Story premise: the long-running situation this story is built on. Keep events anchored to it and let new developments grow from it. It is a situation, not a script: never decide what the user\'s character wants, feels, or chooses.]'
            : `[Story premise: the long-running situation this story is built on. Keep events anchored to it and let new developments grow from it. It is a situation, not a script. ${userName} is not a character in this story; do not write ${userName} into it.]`;
        const lines = [header, `Title: ${pin.premise.title}`, `Premise: ${pin.premise.premise}`];
        for (const [label, value] of premiseFieldRows(pin.premise, userName, { forInjection: true, includeOpening, charName })) {
            lines.push(`${label}: ${value}`);
        }
        return lines.join('\n');
    }

    function applyPremiseInjection() {
        try {
            const stContext = SillyTavern.getContext();
            if (typeof stContext?.setExtensionPrompt !== 'function') {
                warn('setExtensionPrompt not available; premise cannot be pinned');
                return false;
            }
            if (!pinnedPremise) {
                stContext.setExtensionPrompt(PREMISE_PROMPT_KEY, '', EXTENSION_PROMPT_TYPES.NONE, 0);
                return true;
            }
            stContext.setExtensionPrompt(PREMISE_PROMPT_KEY, buildPremiseInjection(pinnedPremise), EXTENSION_PROMPT_TYPES.IN_PROMPT, 0, false, EXTENSION_PROMPT_ROLES.SYSTEM);
            return true;
        } catch (err) {
            warn('Failed to apply premise injection:', err);
            return false;
        }
    }

    function savePinnedPremise() {
        try {
            const stContext = SillyTavern.getContext();
            if (!stContext?.chatMetadata) return;
            if (pinnedPremise) stContext.chatMetadata.pathweaver_premise = pinnedPremise;
            else delete stContext.chatMetadata.pathweaver_premise;
            if (typeof stContext.saveMetadataDebounced === 'function') stContext.saveMetadataDebounced();
        } catch (err) { warn('Failed to save pinned premise:', err); }
    }

    function loadPinnedPremise() {
        try {
            const saved = SillyTavern.getContext()?.chatMetadata?.pathweaver_premise;
            pinnedPremise = saved?.premise?.premise ? saved : null;
        } catch (err) {
            warn('Failed to load pinned premise:', err);
            pinnedPremise = null;
        }
        applyPremiseInjection();
    }

    function pinPremise(premise, style, includeUser) {
        const stContext = SillyTavern.getContext();
        if (!stContext?.chatMetadata || (stContext.characterId === undefined && !stContext.groupId)) {
            showToast('Open a chat before pinning a premise.', 'warning');
            return;
        }
        pinnedPremise = {
            premise,
            style,
            includeUser,
            baseMessageCount: stContext.chat?.length ?? 0,
        };
        if (!applyPremiseInjection()) {
            pinnedPremise = null;
            showToast('This version of SillyTavern can\'t pin prompts.', 'error');
            return;
        }
        savePinnedPremise();
        createActionBar();
        renderPinnedPremise();
        showToast(`Premise pinned: ${premise.title}`);
    }

    function unpinPremise() {
        pinnedPremise = null;
        applyPremiseInjection();
        savePinnedPremise();
        createActionBar();
        renderPinnedPremise();
        showToast('Premise unpinned');
    }

    function renderPinnedPremise() {
        const box = jQuery('#pw_premise_pinned');
        if (!box.length) return;
        if (!pinnedPremise) {
            box.hide().empty();
        } else {
            const p = pinnedPremise.premise;
            box.html(`
                <div class="pw_premise_pinned_head">
                    <span class="pw_premise_pinned_label"><i class="fa-solid fa-thumbtack"></i> Pinned to this chat</span>
                    <button class="pw_header_btn" id="pw_premise_unpin" title="Stop injecting this premise"><i class="fa-solid fa-xmark"></i> Unpin</button>
                </div>
                <div class="pw_premise_pinned_title">${esc(p.emoji || '✨')} ${esc(p.title)}</div>
                <div class="pw_premise_pinned_text">${esc(p.premise)}</div>`).show();
            box.find('#pw_premise_unpin').on('click', unpinPremise);
        }
        // Keep the "Pinned" state of result cards in sync
        jQuery('#pw_premise_results_content .pw_premise_card').each(function () {
            const index = jQuery(this).data('index');
            const isPinned = !!(pinnedPremise && premiseResults?.items[index] === pinnedPremise.premise);
            jQuery(this).toggleClass('pw_premise_is_pinned', isPinned)
                .find('[data-action="pin"]').html(isPinned
                    ? '<i class="fa-solid fa-check"></i> Pinned'
                    : '<i class="fa-solid fa-thumbtack"></i> Pin');
        });
    }

    function displayPremises(container) {
        const { DOMPurify } = SillyTavern.libs;
        const clean = s => DOMPurify.sanitize(String(s ?? ''), { ALLOWED_TAGS: [] });
        const { items } = premiseResults;
        const userName = SillyTavern.getContext()?.name1 || 'User';

        if (!items.length) {
            showEmptyState('No premises could be generated. Try again or reword the concept.', container);
            return;
        }

        const cards = items.map((p, index) => {
            const rows = premiseFieldRows(p, userName)
                .map(([label, value]) => `<dt>${clean(label)}</dt><dd>${clean(value)}</dd>`).join('');
            const typeBadge = p.type
                ? `<span class="pw_premise_type pw_premise_type_${p.type === 'plot-driven' ? 'plot' : 'character'}">${p.type === 'plot-driven' ? 'Plot-driven' : 'Character-driven'}</span>`
                : '';
            return `
            <div class="pw_suggestion_card pw_premise_card" data-index="${index}">
                <div class="pw_card_header">
                    <span class="pw_card_emoji">${clean(p.emoji || '✨')}</span>
                    <span class="pw_card_title">${clean(p.title)}</span>
                </div>
                ${typeBadge}
                <div class="pw_premise_logline">${clean(p.premise)}</div>
                <details class="pw_premise_details">
                    <summary>Goal, motivation, conflict &amp; more</summary>
                    <dl>${rows}</dl>
                </details>
                <div class="pw_card_actions">
                    <button class="pw_card_action_btn" data-action="copy" title="Copy the full premise">
                        <i class="fa-solid fa-copy"></i> Copy
                    </button>
                    <button class="pw_card_action_btn primary" data-action="pin" title="Inject this premise into every prompt in this chat">
                        <i class="fa-solid fa-thumbtack"></i> Pin
                    </button>
                </div>
            </div>`;
        }).join('');

        container.html(`<div class="pw_suggestions_grid pw_premise_grid">${cards}</div>`);
        container.find('.pw_premise_card').on('click', '[data-action]', function (e) {
            e.stopPropagation();
            const index = jQuery(this).closest('.pw_premise_card').data('index');
            const premise = premiseResults?.items[index];
            if (!premise) return;
            const action = jQuery(this).data('action');
            if (action === 'copy') {
                navigator.clipboard.writeText(formatPremiseText(premise, userName))
                    .then(() => showToast('Premise copied!'));
            } else if (action === 'pin') {
                if (pinnedPremise?.premise === premise) unpinPremise();
                else pinPremise(premise, premiseResults.style, premiseResults.includeUser);
            }
        });
        renderPinnedPremise();
    }

    async function generatePremises({ concept, style, includeUser, count, container }) {
        if (isGenerating) {
            showToast('Pathweaver is still finishing the previous request.', 'warning');
            return;
        }

        isGenerating = true;
        showLoadingState(style, container, 'Generating premises...');
        abortController = new AbortController();
        const signal = abortController.signal;

        try {
            const ctx = extractPremiseContext(includeUser);
            if (!ctx) {
                showEmptyState('Select a character to generate premises for.', container);
                return;
            }

            const styleGuide = await loadPremiseStyleGuide(style);
            const systemPrompt = buildPremiseSystemPrompt(styleGuide, ctx, includeUser, style);
            const userPrompt = `[CHARACTERS]\n${buildPremiseContextBlock(ctx, includeUser)}\n\n[CONCEPT]\n${concept}\n\n[TASK]\nWrite exactly ${count} premises based on the concept.`;
            const needed = count * 450 + 800;
            const maxTokens = settings.reasoning_mode
                ? Math.max(settings.max_output_tokens || 8192, needed)
                : Math.min(8192, Math.max(2048, needed));

            if (settings.source === 'profile') getSelectedProfile(SillyTavern.getContext());

            const result = await requestCompletion({ systemPrompt, userPrompt, maxTokens, signal, temperature: 0.9 });
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

            const items = await parsePremises(result, count);
            // The user's character has no role in a premise written without them
            if (!includeUser) items.forEach(p => delete p.role);
            premiseResults = { items, style, includeUser };
            displayPremises(container);
        } catch (err) {
            if (err.name === 'AbortError' || signal.aborted) {
                showEmptyState('Generation cancelled by user', container);
            } else {
                error('Premise generation failed:', err);
                showErrorState(err.message || 'API request failed', container);
            }
        } finally {
            abortController = null;
            await waitForMainApiRequest();
            isGenerating = false;
        }
    }

    function showPremiseModal() {
        if (jQuery('#pw_premise_modal').length) {
            premiseModal = jQuery('#pw_premise_modal');
            refreshPremiseModalOptions();
            renderPinnedPremise();
            jQuery('#pw_premise_show_results').toggle(!!premiseResults?.items?.length);
            premiseModal.addClass('active');
            return;
        }

        const countOptions = [2, 4, 6].map(n =>
            `<option value="${n}"${settings.premise_count === n ? ' selected' : ''}>${n}</option>`).join('');

        const modalHtml = `
        <div class="pw_modal_overlay" id="pw_premise_modal">
            <div class="pw_modal" style="max-width: 760px;">
                <div class="pw_modal_header">
                    <h3 class="pw_modal_title">
                        <i class="fa-solid fa-lightbulb" style="color: var(--pw-premise-color);"></i>
                        Premise
                    </h3>
                    <button class="pw_modal_close" id="pw_close_premise">&times;</button>
                </div>
                <div class="pw_modal_body" style="overflow: hidden; display: flex; flex-direction: column;">
                    <div class="pw_director_container">
                        <div class="pw_director_view visible" id="pw_premise_inputs_view">
                            <div class="pw_premise_pinned" id="pw_premise_pinned" style="display:none;"></div>

                            <label class="pw_premise_label" for="pw_premise_concept">Your concept</label>
                            <textarea id="pw_premise_concept" class="pw_premise_concept" rows="4" maxlength="2000"
                                placeholder="A few sentences or tags, e.g. &quot;rivals forced to work together, heist, 1920s Chicago, slow burn&quot;"></textarea>

                            <div class="pw_premise_options">
                                <label class="pw_premise_option">
                                    <span>Style</span>
                                    <select id="pw_premise_style" class="pw_select"></select>
                                </label>
                                <label class="pw_premise_option">
                                    <span>Premises</span>
                                    <select id="pw_premise_count" class="pw_select">${countOptions}</select>
                                </label>
                                <label class="pw_premise_option pw_premise_check" title="When off, premises are written about the character and an invented cast, without your character.">
                                    <input type="checkbox" id="pw_premise_include_user"${settings.premise_include_user ? ' checked' : ''}>
                                    <span id="pw_premise_include_user_label">Include my character</span>
                                </label>
                            </div>

                            <div style="display: flex; gap: 10px; margin-top: 16px;">
                                <button class="pw_header_btn primary pw_premise_generate_btn" id="pw_premise_generate" style="margin-top:0;">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Premises
                                </button>
                                <button class="pw_header_btn" id="pw_premise_show_results" style="display:none; flex: 1; justify-content: center; align-items: center; gap: 8px;">
                                    Show Premises <i class="fa-solid fa-arrow-right"></i>
                                </button>
                            </div>
                        </div>

                        <div class="pw_director_view hidden" id="pw_premise_results_view">
                            <div class="pw_results_header">
                                <button class="pw_back_btn" id="pw_premise_back">
                                    <i class="fa-solid fa-arrow-left"></i> Back to concept
                                </button>
                                <button class="pw_header_btn" id="pw_premise_regenerate" title="Generate new premises from the same concept" style="margin-left: auto;">
                                    <i class="fa-solid fa-rotate"></i> Refresh
                                </button>
                            </div>
                            <div id="pw_premise_results_content"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        jQuery('body').append(modalHtml);
        premiseModal = jQuery('#pw_premise_modal');
        const inputsView = jQuery('#pw_premise_inputs_view');
        const resultsView = jQuery('#pw_premise_results_view');
        const results = jQuery('#pw_premise_results_content');
        const conceptInput = jQuery('#pw_premise_concept');

        conceptInput.val(settings.premise_concept || '');
        refreshPremiseModalOptions();
        renderPinnedPremise();

        const showResults = () => {
            inputsView.removeClass('visible').addClass('hidden');
            resultsView.removeClass('hidden').addClass('visible');
        };
        const showInputs = () => {
            resultsView.removeClass('visible').addClass('hidden');
            inputsView.removeClass('hidden').addClass('visible');
            jQuery('#pw_premise_show_results').toggle(!!premiseResults?.items?.length);
        };
        const close = () => premiseModal.removeClass('active');

        jQuery('#pw_close_premise').on('click', close);
        premiseModal.on('click', (e) => { if (e.target === premiseModal[0]) close(); });
        jQuery('#pw_premise_back').on('click', showInputs);
        jQuery('#pw_premise_show_results').on('click', () => {
            if (premiseResults) displayPremises(results);
            showResults();
        });

        conceptInput.on('input', function () {
            settings.premise_concept = this.value;
            SillyTavern.getContext().saveSettingsDebounced();
        });
        jQuery('#pw_premise_style').on('change', function () {
            settings.premise_style = this.value;
            SillyTavern.getContext().saveSettingsDebounced();
        });
        jQuery('#pw_premise_count').on('change', function () {
            settings.premise_count = parseInt(this.value) || 6;
            SillyTavern.getContext().saveSettingsDebounced();
        });
        jQuery('#pw_premise_include_user').on('change', function () {
            settings.premise_include_user = this.checked;
            SillyTavern.getContext().saveSettingsDebounced();
        });

        const run = () => {
            const concept = conceptInput.val().trim();
            if (!concept) {
                showToast('Describe a concept first: a few sentences or tags.', 'warning');
                conceptInput.trigger('focus');
                return;
            }
            showResults();
            generatePremises({
                concept,
                style: jQuery('#pw_premise_style').val() || 'general',
                includeUser: jQuery('#pw_premise_include_user').is(':checked'),
                count: parseInt(jQuery('#pw_premise_count').val()) || 6,
                container: results,
            });
        };
        jQuery('#pw_premise_generate').on('click', run);
        jQuery('#pw_premise_regenerate').on('click', run);

        setTimeout(() => premiseModal.addClass('active'), 10);
    }

    /** Rebuild the style list (Explicit and custom styles can change) and the user label. */
    function refreshPremiseModalOptions() {
        const select = jQuery('#pw_premise_style');
        if (!select.length) return;
        const options = getPremiseStyleOptions();
        const selected = options.some(o => o.id === settings.premise_style) ? settings.premise_style : 'general';
        select.html(options.map(o =>
            `<option value="${esc(o.id)}"${o.id === selected ? ' selected' : ''}>${esc(o.name)}</option>`).join(''));
        const userName = SillyTavern.getContext()?.name1;
        jQuery('#pw_premise_include_user_label').text(userName ? `Include ${userName}` : 'Include my character');
    }

    // ============================================================
    // SURPRISE FEATURE
    // ============================================================

    // Mirrors extension_prompt_types / extension_prompt_roles in SillyTavern's
    // script.js. They are not exposed through getContext(), but the values are
    // the same in upstream SillyTavern and SillyBunny.
    const EXTENSION_PROMPT_TYPES = Object.freeze({ NONE: -1, IN_PROMPT: 0, IN_CHAT: 1, BEFORE_PROMPT: 2 });
    const EXTENSION_PROMPT_ROLES = Object.freeze({ SYSTEM: 0, USER: 1, ASSISTANT: 2 });

    /**
     * Inject a hidden prompt into the chat context at a given depth.
     * Uses setExtensionPrompt so it is invisible to the user in the chat log.
     */
    function injectSurprisePrompt(text, depth, key) {
        try {
            const stContext = SillyTavern.getContext();
            if (!stContext || typeof stContext.setExtensionPrompt !== 'function') {
                warn('setExtensionPrompt not available');
                return false;
            }
            stContext.setExtensionPrompt(key, text, EXTENSION_PROMPT_TYPES.IN_CHAT, depth, true, EXTENSION_PROMPT_ROLES.SYSTEM);
            log('Surprise injected at depth', depth, 'key:', key, ':', text.substring(0, 80) + '...');
            return true;
        } catch (err) {
            warn('Failed to inject surprise prompt:', err);
            return false;
        }
    }

    /** Remove a single surprise injection by its unique key. */
    function clearSurprisePrompt(key) {
        try {
            const stContext = SillyTavern.getContext();
            if (!stContext || typeof stContext.setExtensionPrompt !== 'function') return;
            stContext.setExtensionPrompt(key, '', EXTENSION_PROMPT_TYPES.NONE, 0);
            log('Surprise prompt cleared:', key);
        } catch (err) {
            warn('Failed to clear surprise prompt:', err);
        }
    }

    /** Clear every active surprise injection and reset the in-memory queue. */
    function clearAllSurprises() {
        for (const s of activeSurprises) {
            if (s.injected) clearSurprisePrompt(s.key);
        }
        activeSurprises = [];
        saveSurpriseQueue();
    }

    /** Persist the queue to chatMetadata. The `injected` flag is omitted intentionally. */
    function saveSurpriseQueue() {
        try {
            const stContext = SillyTavern.getContext();
            if (!stContext?.chatMetadata) return;
            stContext.chatMetadata.pathweaver_surprises = activeSurprises.map(s => ({
                key: s.key, category: s.category,
                triggerAfter: s.triggerAfter, baseMessageCount: s.baseMessageCount, text: s.text
            }));
            if (typeof stContext.saveMetadataDebounced === 'function') stContext.saveMetadataDebounced();
            log('Surprise queue saved:', activeSurprises.length, 'items');
        } catch (err) { warn('Failed to save surprise queue:', err); }
    }

    /** Restore the queue from chatMetadata. All entries start as not-yet-injected. */
    function loadSurpriseQueue() {
        try {
            const stContext = SillyTavern.getContext();
            const saved = stContext?.chatMetadata?.pathweaver_surprises;
            if (!saved?.length) { activeSurprises = []; return; }
            activeSurprises = saved.map(s => ({ ...s, injected: false }));
            for (const s of activeSurprises) {
                const n = parseInt(s.key.replace('pathweaver_surprise_', ''));
                if (!isNaN(n) && n >= surpriseKeyCounter) surpriseKeyCounter = n + 1;
            }
            log('Surprise queue restored:', activeSurprises.length, 'items');
        } catch (err) { warn('Failed to load surprise queue:', err); activeSurprises = []; }
    }

    /** Render the queue into both the settings panel and modal accordions. */
    function renderSurpriseQueue() {
        const allCategories = getAllCategories();
        const stContext = SillyTavern.getContext();
        const currentCount = stContext?.chat?.length ?? 0;
        const hasAny = activeSurprises.length > 0;

        const listHtml = activeSurprises.map((s, i) => {
            const cat = allCategories[s.category] || { name: s.category, icon: 'fa-wand-sparkles' };
            const remaining = Math.max(0, s.triggerAfter - (currentCount - s.baseMessageCount));
            const statusHtml = s.injected
                ? `<span class="pw_sq_status pw_sq_firing"><i class="fa-solid fa-bolt"></i> Firing now</span>`
                : `<span class="pw_sq_status"><i class="fa-solid fa-hourglass-half"></i> ~${remaining} msg${remaining !== 1 ? 's' : ''}</span>`;
            return `<li class="pw_sq_item">
                <span class="pw_sq_cat"><i class="fa-solid ${cat.icon}"></i> ${esc(cat.name)}</span>
                ${statusHtml}
                <button class="pw_sq_remove" data-surprise-index="${i}" title="Cancel this surprise">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </li>`;
        }).join('');

        const labelText = `Armed surprises (${activeSurprises.length})`;

        // Settings panel (settings.html — always in DOM)
        jQuery('#pw_surprise_queue_list').html(listHtml);
        jQuery('#pw_surprise_queue_label').text(labelText);
        jQuery('#pw_surprise_queue_accordion').css('display', hasAny ? '' : 'none');
        jQuery('#pw_surprise_clear_all').css('display', hasAny ? '' : 'none');

        // Settings modal (only present when open)
        jQuery('#pw_sm_surprise_queue_list').html(listHtml);
        jQuery('#pw_sm_surprise_queue_label').text(labelText);
        jQuery('#pw_sm_surprise_queue_accordion').css('display', hasAny ? '' : 'none');
        jQuery('#pw_sm_surprise_clear_all').css('display', hasAny ? '' : 'none');
    }

    /** Normalize the model's reply into a single "[System Note: ...]" line. */
    function extractSystemNote(text) {
        const cleaned = stripReasoning(text).replace(/<[^>]*>/g, '').trim();
        const match = cleaned.match(/\[\s*System Note\s*:\s*([\s\S]*)\]/i);
        let note = match ? match[1] : cleaned
            // Drop a leading "emoji title" line if the model used the suggestion format
            .replace(new RegExp(`^\\s*${EMOJI_PATTERN}[^\\n]*\\n`, 'u'), '')
            .split(/\n\s*---/)[0];
        note = stripMarkdown(note.replace(/^\s*System Note\s*:\s*/i, ''));
        if (!note) return '';
        return `[System Note: ${note.substring(0, 800)}]`;
    }

    /**
     * Generate a single hidden narrative event using the given category as the style.
     * Returns a "[System Note: ...]" string ready to inject.
     */
    async function generateSurpriseText(category, signal) {
        // Pathweaver's own suggestion request shares the backend; don't overlap it
        if (isGenerating || pendingMainApiRequest) {
            throw new Error('Pathweaver is still generating suggestions. Try again when it finishes.');
        }

        const storyContext = await extractContext();
        if (!storyContext) throw new Error('No active conversation found. Start a chat first.');

        const stylePrompt = await loadPrompt(category);
        const systemPrompt = buildSurpriseSystemPrompt(stylePrompt, storyContext);
        const userPrompt = `[STORY CONTEXT]\n${buildContextBlock(storyContext)}\n\n[TASK]\nWrite the single hidden [System Note: ...] now.`;
        const maxTokens = settings.reasoning_mode ? Math.max(settings.max_output_tokens || 8192, 1024) : 400;

        const result = await requestCompletion({ systemPrompt, userPrompt, maxTokens, signal, temperature: 0.9 });
        const note = extractSystemNote(result);
        if (!note) throw new Error('No content generated');
        return note;
    }

    /**
     * Show the Surprise modal: style picker → processing → confirmation.
     */
    function showSurpriseModal(category) {
        if (surpriseAbortController) {
            showToast('A surprise is already being prepared.', 'warning');
            return;
        }

        // Remove any existing surprise modal
        jQuery('#pw_surprise_modal').remove();

        const allCategories = getAllCategories();
        const catInfo = allCategories[category] || { name: category, icon: 'fa-wand-sparkles' };

        const modalHtml = `
        <div class="pw_modal_overlay pw_surprise_modal_overlay" id="pw_surprise_modal">
            <div class="pw_modal pw_surprise_modal_inner">
                <div class="pw_modal_header">
                    <h3 class="pw_modal_title">
                        <i class="fa-solid fa-wand-sparkles pw_surprise_icon_spin"></i>
                        Surprise Me
                    </h3>
                    <button class="pw_modal_close" id="pw_close_surprise">&times;</button>
                </div>
                <div class="pw_modal_body" id="pw_surprise_modal_body">
                    <!-- Processing state -->
                    <div id="pw_surprise_processing" class="pw_surprise_processing">
                        <div class="pw_surprise_spinner">
                            <i class="fa-solid fa-circle-notch pw_spin pw_surprise_spin_icon"></i>
                        </div>
                        <div class="pw_surprise_processing_text">
                            <strong>Crafting your surprise...</strong>
                            <span class="pw_surprise_style_label">
                                <i class="fa-solid ${catInfo.icon}"></i> ${catInfo.name}
                            </span>
                            <p class="pw_surprise_hint">The AI is secretly planning something. You won't know what it is until it happens.</p>
                        </div>
                        <button class="pw_header_btn" id="pw_surprise_cancel_gen" style="margin-top: 16px;">
                            <i class="fa-solid fa-xmark"></i> Cancel
                        </button>
                    </div>
                    <!-- Done state (hidden initially) -->
                    <div id="pw_surprise_done" class="pw_surprise_done" style="display:none;">
                        <div class="pw_surprise_done_icon">
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                        <div class="pw_surprise_done_text">
                            <strong>Your surprise is set!</strong>
                            <p>Something unexpected has been secretly woven into the story. It will emerge within the next few messages — keep writing and see what happens.</p>
                            <span class="pw_surprise_style_label">
                                <i class="fa-solid ${catInfo.icon}"></i> ${catInfo.name} style
                            </span>
                        </div>
                        <button class="pw_header_btn primary" id="pw_surprise_ok" style="margin-top: 20px; width: 100%; justify-content: center;">
                            <i class="fa-solid fa-check"></i> OK, let's go!
                        </button>
                    </div>
                    <!-- Error state (hidden initially) -->
                    <div id="pw_surprise_error" class="pw_surprise_error" style="display:none;">
                        <div class="pw_surprise_error_icon">
                            <i class="fa-solid fa-circle-exclamation"></i>
                        </div>
                        <p id="pw_surprise_error_msg">Something went wrong.</p>
                        <button class="pw_header_btn" id="pw_surprise_retry" style="margin-top: 12px;">
                            <i class="fa-solid fa-rotate"></i> Retry
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

        jQuery('body').append(modalHtml);
        const modal = jQuery('#pw_surprise_modal');

        // Close handlers
        jQuery('#pw_close_surprise').on('click', () => {
            if (surpriseAbortController) surpriseAbortController.abort();
            modal.removeClass('active');
            setTimeout(() => modal.remove(), 300);
        });
        modal.on('click', (e) => {
            if (e.target === modal[0]) {
                if (surpriseAbortController) surpriseAbortController.abort();
                modal.removeClass('active');
                setTimeout(() => modal.remove(), 300);
            }
        });

        // Cancel generation
        jQuery('#pw_surprise_cancel_gen').on('click', () => {
            if (surpriseAbortController) surpriseAbortController.abort();
        });

        // OK button
        jQuery('#pw_surprise_ok').on('click', () => {
            modal.removeClass('active');
            setTimeout(() => modal.remove(), 300);
        });

        // Show modal
        setTimeout(() => modal.addClass('active'), 10);

        // Start generation
        runSurpriseGeneration(category, modal);
    }

    async function runSurpriseGeneration(category, modal) {
        surpriseAbortController = new AbortController();
        const signal = surpriseAbortController.signal;

        try {
            const text = await generateSurpriseText(category, signal);

            if (signal.aborted) return;

            armSurprise(category, text);

            // Show done state
            jQuery('#pw_surprise_processing').hide();
            jQuery('#pw_surprise_done').show();

        } catch (err) {
            if (err.name === 'AbortError' || signal.aborted) {
                // User cancelled — just close
                if (modal && modal.length) {
                    modal.removeClass('active');
                    setTimeout(() => modal.remove(), 300);
                }
                return;
            }
            error('Surprise generation failed:', err);
            jQuery('#pw_surprise_processing').hide();
            jQuery('#pw_surprise_error_msg').text(err.message || 'Generation failed. Please try again.');
            jQuery('#pw_surprise_error').show();

            // Retry button
            jQuery('#pw_surprise_retry').off('click').on('click', () => {
                jQuery('#pw_surprise_error').hide();
                jQuery('#pw_surprise_processing').show();
                runSurpriseGeneration(category, modal);
            });
        } finally {
            await waitForMainApiRequest();
            surpriseAbortController = null;
        }
    }

    // ============================================================
    // SETTINGS PANEL (for ST extension panel)
    // ============================================================

    async function initSettingsPanel() {
        try {
            const response = await fetch(`${BASE_URL}/settings.html`);
            if (response.ok) {
                const html = await response.text();
                jQuery('#pathweaver_settings').remove();
                jQuery('#extensions_settings').append(html);
                log('Settings panel loaded');

                // Bind event handlers for settings.html
                bindSettingsPanelEvents();
                // Apply current settings to UI
                applySettingsToUI();
            }
        } catch (err) {
            warn('Failed to load settings panel:', err);
        }
    }

    function applySettingsToUI() {
        // Delegate all field-restoration to syncSettingsToPanel, which is the
        // single authoritative place that maps every settings key to its panel
        // element.  Previously applySettingsToUI was a hand-maintained partial
        // copy of that function and had drifted out of sync — causing several
        // settings (#pw_openai_key, #pw_stream_suggestions, #pw_bar_title_font,
        // #pw_surprise_randomize, #pw_surprise_depth_min/_max, and the
        // randomize show/hide block) to always revert to their HTML defaults
        // after every page reload even though the values were saved correctly.
        syncSettingsToPanel();

        // These extras are init-only (dynamic data that syncSettingsToPanel
        // intentionally omits because they require async work or DOM queries
        // that are only meaningful on first load):
        populateProfileDropdown('#pw_profile_select');
        if (settings.source === 'ollama') {
            fetchAndPopulateOllamaModels('#pw_ollama_model');
        }
    }

    function updateProviderVisibility(source) {
        jQuery('#pw_profile_settings, #pw_ollama_settings, #pw_openai_settings').hide();
        if (source === 'profile') jQuery('#pw_profile_settings').show();
        else if (source === 'ollama') jQuery('#pw_ollama_settings').show();
        else if (source === 'openai') jQuery('#pw_openai_settings').show();
    }

    function populateProfileDropdown(selector) {
        const select = jQuery(selector);
        if (!select.length) return;

        select.empty();
        select.append('<option value="">-- Select Profile --</option>');

        const profiles = getConnectionProfiles();
        profiles.forEach(p => {
            const selected = settings.preset === p.name ? ' selected' : '';
            const safeName = escapeHtmlAttr(p.name);
            select.append(`<option value="${safeName}"${selected}>${safeName}</option>`);
        });
    }

    async function fetchAndPopulateOllamaModels(selector) {
        const select = jQuery(selector);
        if (!select.length) return;

        select.html('<option value="">Loading...</option>');
        const models = await fetchOllamaModels();
        select.empty();

        if (models.length) {
            models.forEach(m => {
                const selected = settings.ollama_model === m.name ? ' selected' : '';
                select.append(`<option value="${esc(m.name)}"${selected}>${esc(m.name)}</option>`);
            });
            // Auto-select first if none selected
            if (!settings.ollama_model && models.length) {
                settings.ollama_model = models[0].name;
                select.val(settings.ollama_model);
                saveSettings();
            }
        } else {
            select.append('<option value="">No models found</option>');
        }
    }

    const OPENAI_PRESETS = Object.freeze({
        lmstudio: { url: 'http://localhost:1234/v1', model: 'local-model' },
        kobold: { url: 'http://localhost:5001/v1', model: 'koboldcpp' },
        textgen: { url: 'http://localhost:5000/v1', model: 'local-model' },
        vllm: { url: 'http://localhost:8000/v1', model: 'local-model' },
    });

    function applyOpenAIPreset(preset) {
        settings.openai_preset = preset;
        if (OPENAI_PRESETS[preset]) {
            settings.openai_url = OPENAI_PRESETS[preset].url;
            settings.openai_model = OPENAI_PRESETS[preset].model;
        }
    }

    // Sync settings from modal to extension panel
    function syncSettingsToPanel() {
        jQuery('#pw_enabled').prop('checked', settings.enabled);
        jQuery('#pw_source').val(settings.source);
        jQuery('#pw_profile_select').val(settings.preset);
        jQuery('#pw_ollama_url').val(settings.ollama_url);
        jQuery('#pw_ollama_model').val(settings.ollama_model);
        jQuery('#pw_openai_preset').val(settings.openai_preset);
        jQuery('#pw_openai_url').val(settings.openai_url);
        jQuery('#pw_openai_model').val(settings.openai_model);
        jQuery('#pw_openai_key').val(settings.openai_key);
        jQuery('#pw_suggestions_count').val(settings.suggestions_count);
        jQuery('#pw_context_depth').val(settings.context_depth);
        jQuery('#pw_suggestion_length').val(settings.suggestion_length);
        jQuery('#pw_insert_mode').prop('checked', settings.insert_mode);
        jQuery('#pw_show_explicit').prop('checked', settings.show_explicit);
        jQuery('#pw_hide_animated_bar').prop('checked', settings.hide_animated_bar);

        jQuery('#pw_insert_type_enabled').prop('checked', settings.insert_type_enabled);
        jQuery('#pw_insert_type_ooc').prop('checked', settings.insert_type_ooc);
        jQuery('#pw_insert_type_director').prop('checked', settings.insert_type_director);

        if (settings.insert_type_enabled) jQuery('#pw_insert_type_options').css('display', 'flex');
        else jQuery('#pw_insert_type_options').hide();

        jQuery('#pw_font_size').val(settings.bar_font_size);
        jQuery('#pw_bar_height').val(settings.bar_height);
        jQuery('#pw_bar_title_font').val(settings.bar_title_font || 'default');
        applyTitleFontSelectDisplay(document.getElementById('pw_bar_title_font'));
        // Context sources
        jQuery('#pw_include_scenario').prop('checked', settings.include_scenario);
        jQuery('#pw_include_description').prop('checked', settings.include_description);
        jQuery('#pw_include_worldinfo').prop('checked', settings.include_worldinfo);
        jQuery('#pw_stream_suggestions').prop('checked', settings.stream_suggestions);
        // Reasoning mode settings
        jQuery('#pw_reasoning_mode').prop('checked', settings.reasoning_mode);
        jQuery('#pw_max_output_tokens').val(settings.max_output_tokens || 16384);
        jQuery('#pw_max_output_tokens_row, #pw_max_output_tokens_hint').toggle(!!settings.reasoning_mode);
        // Surprise Me
        jQuery('#pw_surprise_randomize').prop('checked', settings.surprise_randomize);
        jQuery('#pw_surprise_endless').prop('checked', settings.surprise_endless);
        jQuery('#pw_surprise_depth_min').val(settings.surprise_depth_min);
        jQuery('#pw_surprise_depth_max').val(settings.surprise_depth_max);
        if (settings.surprise_randomize) {
            jQuery('#pw_surprise_range_rows').show();
            jQuery('#pw_surprise_fixed_hint').hide();
        } else {
            jQuery('#pw_surprise_range_rows').hide();
            jQuery('#pw_surprise_fixed_hint').show();
            jQuery('#pw_surprise_fixed_depth_label').text(settings.surprise_depth_min);
        }
        updateProviderVisibility(settings.source);
    }

    // Sync settings from extension panel to modal (if open)
    function syncSettingsToModal() {
        jQuery('#pw_sm_source').val(settings.source);
        jQuery('#pw_sm_profile').val(settings.preset);
        jQuery('#pw_sm_ollama_url').val(settings.ollama_url);
        jQuery('#pw_sm_ollama_model').val(settings.ollama_model);
        jQuery('#pw_sm_openai_preset').val(settings.openai_preset);
        jQuery('#pw_sm_openai_url').val(settings.openai_url);
        jQuery('#pw_sm_openai_model').val(settings.openai_model);
        jQuery('#pw_sm_openai_key').val(settings.openai_key);
        jQuery('#pw_sm_suggestions').val(settings.suggestions_count);
        jQuery('#pw_sm_context').val(settings.context_depth);
        jQuery('#pw_sm_suggestion_length').val(settings.suggestion_length);
        jQuery('.pw_toggle[data-setting="stream_suggestions"]').toggleClass('active', settings.stream_suggestions);
        jQuery('#pw_sm_font_size').val(settings.bar_font_size);
        jQuery('#pw_sm_bar_height').val(settings.bar_height);
        jQuery('#pw_sm_bar_title_font').val(settings.bar_title_font || 'default');
        applyTitleFontSelectDisplay(document.getElementById('pw_sm_bar_title_font'));
        // Update toggles in modal
        jQuery('.pw_toggle[data-setting="enabled"]').toggleClass('active', settings.enabled);
        jQuery('.pw_toggle[data-setting="show_explicit"]').toggleClass('active', settings.show_explicit);
        jQuery('.pw_toggle[data-setting="insert_mode"]').toggleClass('active', settings.insert_mode);
        jQuery('.pw_toggle[data-setting="hide_animated_bar"]').toggleClass('active', settings.hide_animated_bar);

        jQuery('.pw_toggle[data-setting="insert_type_enabled"]').toggleClass('active', settings.insert_type_enabled);
        if (settings.insert_type_enabled) jQuery('#pw_sm_insert_type_options').css('display', 'flex');
        else jQuery('#pw_sm_insert_type_options').hide();

        jQuery('.pw_toggle[data-setting="insert_type_ooc"]').toggleClass('active', settings.insert_type_ooc);
        jQuery('.pw_toggle[data-setting="insert_type_director"]').toggleClass('active', settings.insert_type_director);

        // Surprise Me
        jQuery('.pw_toggle[data-setting="surprise_randomize"]').toggleClass('active', settings.surprise_randomize);
        jQuery('.pw_toggle[data-setting="surprise_endless"]').toggleClass('active', settings.surprise_endless);
        jQuery('#pw_sm_surprise_depth_min').val(settings.surprise_depth_min);
        jQuery('#pw_sm_surprise_depth_max').val(settings.surprise_depth_max);
        if (settings.surprise_randomize) {
            jQuery('#pw_sm_surprise_range_rows').show();
            jQuery('#pw_sm_surprise_fixed_hint').hide();
        } else {
            jQuery('#pw_sm_surprise_range_rows').hide();
            jQuery('#pw_sm_surprise_fixed_hint').show();
            jQuery('#pw_sm_surprise_fixed_hint p strong').text(settings.surprise_depth_min);
        }

        // Context sources toggles
        jQuery('.pw_toggle[data-setting="include_scenario"]').toggleClass('active', settings.include_scenario);
        jQuery('.pw_toggle[data-setting="include_description"]').toggleClass('active', settings.include_description);
        jQuery('.pw_toggle[data-setting="include_worldinfo"]').toggleClass('active', settings.include_worldinfo);

        // Reasoning mode settings
        jQuery('.pw_toggle[data-setting="reasoning_mode"]').toggleClass('active', settings.reasoning_mode);
        jQuery('#pw_modal_max_output_tokens').val(settings.max_output_tokens || 16384);
        jQuery('#pw_modal_max_tokens_row, #pw_modal_max_tokens_hint').toggle(!!settings.reasoning_mode);

        // Update provider visibility
        jQuery('#pw_sm_profile_box, #pw_sm_ollama_box, #pw_sm_openai_box').hide();
        if (settings.source === 'profile') jQuery('#pw_sm_profile_box').show();
        else if (settings.source === 'ollama') jQuery('#pw_sm_ollama_box').show();
        else if (settings.source === 'openai') jQuery('#pw_sm_openai_box').show();
        renderSurpriseQueue();
    }

    function bindSettingsPanelEvents() {
        // Enable toggle
        jQuery('#pw_enabled').on('change', function () {
            settings.enabled = this.checked;
            saveSettings();
            syncSettingsToModal();
            createActionBar();
        });

        // Source dropdown - in settings panel
        jQuery('#pw_source').on('change', function () {
            settings.source = this.value;
            saveSettings();
            updateProviderVisibility(this.value);
            syncSettingsToModal();
            if (this.value === 'ollama') {
                fetchAndPopulateOllamaModels('#pw_ollama_model');
            }
        });

        // Profile select
        jQuery('#pw_profile_select').on('change', function () {
            settings.preset = this.value;
            saveSettings();
            syncSettingsToModal();
        });

        // Ollama URL
        jQuery('#pw_ollama_url').on('change', function () {
            settings.ollama_url = this.value;
            saveSettings();
            syncSettingsToModal();
            fetchAndPopulateOllamaModels('#pw_ollama_model');
        });

        // Ollama model
        jQuery('#pw_ollama_model').on('change', function () {
            settings.ollama_model = this.value;
            saveSettings();
            syncSettingsToModal();
        });

        // OpenAI preset
        jQuery('#pw_openai_preset').on('change', function () {
            applyOpenAIPreset(this.value);
            jQuery('#pw_openai_url').val(settings.openai_url);
            jQuery('#pw_openai_model').val(settings.openai_model);
            saveSettings();
            syncSettingsToModal();
        });

        // OpenAI URL
        jQuery('#pw_openai_url').on('change', function () {
            settings.openai_url = this.value;
            saveSettings();
            syncSettingsToModal();
        });

        // OpenAI model
        jQuery('#pw_openai_model').on('change', function () {
            settings.openai_model = this.value;
            saveSettings();
            syncSettingsToModal();
        });

        // OpenAI Key
        jQuery('#pw_openai_key').on('change', function () {
            settings.openai_key = this.value;
            saveSettings();
            syncSettingsToModal();
        });

        // Suggestions count
        jQuery('#pw_suggestions_count').on('change', function () {
            settings.suggestions_count = Math.max(1, Math.min(20, parseInt(this.value) || 6));
            this.value = settings.suggestions_count;
            saveSettings();
            syncSettingsToModal();
        });

        // Context depth
        jQuery('#pw_context_depth').on('change', function () {
            settings.context_depth = parseInt(this.value) || 8;
            saveSettings();
            syncSettingsToModal();
        });

        // Font size
        jQuery('#pw_font_size').on('change', function () {
            settings.bar_font_size = this.value;
            saveSettings();
            syncSettingsToModal();
            createActionBar();
        });

        // Bar height
        jQuery('#pw_bar_height').on('change', function () {
            settings.bar_height = this.value;
            saveSettings();
            syncSettingsToModal();
            createActionBar();
        });

        // Bar title font
        jQuery('#pw_bar_title_font').on('change', function () {
            settings.bar_title_font = this.value;
            applyTitleFontSelectDisplay(this);
            saveSettings();
            syncSettingsToModal();
            createActionBar();
        });

        // Insert mode
        jQuery('#pw_insert_mode').on('change', function () {
            settings.insert_mode = this.checked;
            saveSettings();
            syncSettingsToModal();
        });

        // Show explicit
        jQuery('#pw_show_explicit').on('change', function () {
            settings.show_explicit = this.checked;
            saveSettings();
            syncSettingsToModal();
            createActionBar();
        });



        // Hide Animated Bar
        jQuery('#pw_hide_animated_bar').on('change', function () {
            settings.hide_animated_bar = this.checked;
            saveSettings();
            syncSettingsToModal();
            jQuery('.pw_action_bar').toggleClass('pw_hide_animated_bar', settings.hide_animated_bar);
        });

        // Insert Type Enabled
        jQuery('#pw_insert_type_enabled').on('change', function () {
            settings.insert_type_enabled = this.checked;
            saveSettings();
            syncSettingsToModal();

            if (this.checked) jQuery('#pw_insert_type_options').css('display', 'flex');
            else jQuery('#pw_insert_type_options').hide();
        });

        // Insert Type OOC
        jQuery('#pw_insert_type_ooc').on('change', function () {
            settings.insert_type_ooc = this.checked;
            if (this.checked) {
                settings.insert_type_director = false;
                jQuery('#pw_insert_type_director').prop('checked', false);
            }
            saveSettings();
            syncSettingsToModal();
        });

        // Insert Type Director
        jQuery('#pw_insert_type_director').on('change', function () {
            settings.insert_type_director = this.checked;
            if (this.checked) {
                settings.insert_type_ooc = false;
                jQuery('#pw_insert_type_ooc').prop('checked', false);
            }
            saveSettings();
            syncSettingsToModal();
        });

        // Suggestion length
        jQuery('#pw_suggestion_length').on('change', function () {
            settings.suggestion_length = this.value;
            saveSettings();
            syncSettingsToModal();
        });

        // Stream suggestions
        jQuery('#pw_stream_suggestions').on('change', function () {
            settings.stream_suggestions = this.checked;
            saveSettings();
            syncSettingsToModal();
        });

        // Reasoning mode toggle
        jQuery('#pw_reasoning_mode').on('change', function () {
            settings.reasoning_mode = this.checked;
            saveSettings();
            syncSettingsToModal();
            // Show/hide max_output_tokens setting based on reasoning mode
            jQuery('#pw_max_output_tokens_row, #pw_max_output_tokens_hint').toggle(this.checked);
        });

        // Max output tokens
        jQuery('#pw_max_output_tokens').on('change', function () {
            const val = parseInt(this.value) || 16384;
            settings.max_output_tokens = Math.max(512, Math.min(128000, val));
            this.value = settings.max_output_tokens;
            saveSettings();
            syncSettingsToModal();
        });

        // Include Scenario
        jQuery('#pw_include_scenario').on('change', function () {
            settings.include_scenario = this.checked;
            saveSettings();
            syncSettingsToModal();
        });

        // Include Description
        jQuery('#pw_include_description').on('change', function () {
            settings.include_description = this.checked;
            saveSettings();
            syncSettingsToModal();
        });

        // Include World Info
        jQuery('#pw_include_worldinfo').on('change', function () {
            settings.include_worldinfo = this.checked;
            saveSettings();
            syncSettingsToModal();
        });

        // Open Style Editor from settings
        jQuery('#pw_open_editor_settings').on('click', function () {
            openStylesManager();
        });

        // Surprise Me: endless toggle
        jQuery('#pw_surprise_endless').on('change', function () {
            settings.surprise_endless = this.checked;
            saveSettings();
            syncSettingsToModal();
            if (this.checked) {
                showToast('Endless Surprises enabled — surprises will keep arming themselves!');
            } else {
                // Clear any pending surprises so no background generation fires
                // after the user turns off the feature.
                clearAllSurprises();
                renderSurpriseQueue();
                createActionBar();
                showToast('Endless Surprises disabled — surprise queue cleared.');
            }
        });

        // Surprise Me: randomize toggle
        jQuery('#pw_surprise_randomize').on('change', function () {            settings.surprise_randomize = this.checked;
            if (settings.surprise_randomize) {
                jQuery('#pw_surprise_range_rows').show();
                jQuery('#pw_surprise_fixed_hint').hide();
            } else {
                jQuery('#pw_surprise_range_rows').hide();
                jQuery('#pw_surprise_fixed_hint').show();
                jQuery('#pw_surprise_fixed_depth_label').text(settings.surprise_depth_min);
            }
            saveSettings();
            syncSettingsToModal();
        });

        // Surprise Me: depth min select
        jQuery('#pw_surprise_depth_min').on('change', function () {
            const val = parseInt(this.value) || 2;
            settings.surprise_depth_min = val;
            if (settings.surprise_depth_max < val) {
                settings.surprise_depth_max = val;
                jQuery('#pw_surprise_depth_max').val(val);
            }
            saveSettings();
            syncSettingsToModal();
        });

        // Surprise Me: depth max select
        jQuery('#pw_surprise_depth_max').on('change', function () {
            const val = parseInt(this.value) || 6;
            settings.surprise_depth_max = val;
            if (settings.surprise_depth_min > val) {
                settings.surprise_depth_min = val;
                jQuery('#pw_surprise_depth_min').val(val);
            }
            saveSettings();
            syncSettingsToModal();
        });

        // Surprise Me: clear all (settings panel)
        jQuery('#pw_surprise_clear_all').on('click', function () {
            clearAllSurprises();
            renderSurpriseQueue();
            createActionBar();
            showToast('Surprises cleared!');
        });

        // Surprise Me: remove individual item from panel list
        jQuery('#pw_surprise_queue_list').on('click', '.pw_sq_remove', function () {
            const idx = parseInt(jQuery(this).data('surprise-index'));
            if (!isNaN(idx) && idx >= 0 && idx < activeSurprises.length) {
                const s = activeSurprises[idx];
                if (s.injected) clearSurprisePrompt(s.key);
                activeSurprises.splice(idx, 1);
                saveSurpriseQueue();
                renderSurpriseQueue();
                createActionBar();
                showToast('Surprise removed.');
            }
        });
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    // Named handlers for cleanup
    const handleChatChanged = () => {
        timeSkipMode = false;
        cachedSuggestions = {};
        cachedChatId = null;
        for (const s of activeSurprises) {
            if (s.injected) clearSurprisePrompt(s.key);
        }
        activeSurprises = [];
        loadSurpriseQueue();
        renderSurpriseQueue();
        // Premises are written for one character; old results don't carry over
        premiseResults = null;
        jQuery('#pw_premise_results_content').empty();
        jQuery('#pw_premise_show_results').hide();
        jQuery('#pw_premise_back').trigger('click');
        loadPinnedPremise();
        refreshPremiseModalOptions();
        renderPinnedPremise();
        createActionBar();
    };

    const handleSettingsUpdated = () => {
        populateConnectionProfiles();
    };

    const handleMessageSent = () => {
        jQuery('.pw_action_bar').addClass('pw_processing');
        // Drops the premise's opening from the injection once play has moved past it
        if (pinnedPremise) applyPremiseInjection();
        // The user's message counts toward armed surprises; one that becomes due
        // now is injected in time for the reply being generated.
        checkSurpriseTrigger({ replyReceived: false });
    };

    const handleMessageReceived = (_messageId, type) => {
        if (pinnedPremise) applyPremiseInjection();
        if (type === 'first_message') return;
        checkSurpriseTrigger({ replyReceived: true });
    };

    const handleGenerationEnded = () => {
        jQuery('.pw_action_bar').removeClass('pw_processing');
        // The chat changed, so cached suggestions are stale
        cachedSuggestions = {};
    };

    /**
     * Advance armed surprises. Driven by chat messages rather than generation
     * events, so quiet/background generations (summaries, other extensions)
     * don't count and can't use up an injected surprise.
     */
    function checkSurpriseTrigger({ replyReceived }) {
        if (!activeSurprises.length) return;

        const stContext = SillyTavern.getContext();
        const currentCount = stContext?.chat?.length ?? 0;
        let changed = false;

        // A surprise injected before this reply has now been used by it
        if (replyReceived) {
            for (let i = activeSurprises.length - 1; i >= 0; i--) {
                const s = activeSurprises[i];
                if (!s.injected) continue;
                clearSurprisePrompt(s.key);
                activeSurprises.splice(i, 1);
                changed = true;
                log('Surprise', s.key, 'cleared after firing');
                if (settings.surprise_endless) scheduleEndlessSurprise(s.category);
            }
        }

        // Inject any surprise that is now due; it applies to the next reply
        for (const s of activeSurprises) {
            if (s.injected) continue;
            const newMessages = currentCount - s.baseMessageCount;
            if (newMessages >= s.triggerAfter && injectSurprisePrompt(s.text, 1, s.key)) {
                s.injected = true;
                changed = true;
                log('Surprise', s.key, 'triggered after', newMessages, 'new messages');
            }
        }

        if (changed) {
            saveSurpriseQueue();
            renderSurpriseQueue();
            createActionBar();
        }
    }

    function pickSurpriseDelay() {
        const dMin = Math.max(1, Math.min(12, settings.surprise_depth_min || 2));
        const dMax = Math.max(dMin, Math.min(12, settings.surprise_depth_max || 6));
        return settings.surprise_randomize
            ? Math.floor(Math.random() * (dMax - dMin + 1)) + dMin
            : dMin;
    }

    function armSurprise(category, text) {
        const stContext = SillyTavern.getContext();
        const triggerAfter = pickSurpriseDelay();
        activeSurprises.push({
            key: `pathweaver_surprise_${surpriseKeyCounter++}`,
            category,
            triggerAfter,
            baseMessageCount: stContext?.chat?.length ?? 0,
            text,
            injected: false,
        });
        saveSurpriseQueue();
        renderSurpriseQueue();
        createActionBar();
        return triggerAfter;
    }

    /**
     * Silently generate and arm a new surprise for the given category.
     * Used by Endless Surprises to keep the queue loaded without interrupting
     * the user. It waits until neither SillyTavern nor Pathweaver is generating,
     * plus a few seconds so local backends (KoboldCPP, Ollama, ...) can release
     * GPU resources, because concurrent requests can crash them.
     */
    async function scheduleEndlessSurprise(category) {
        const chatIdAtStart = SillyTavern.getContext()?.chatId;
        const stillWanted = () => settings.surprise_endless && SillyTavern.getContext()?.chatId === chatIdAtStart;
        const isBusy = () => isGenerating || isHostGenerating() || surpriseAbortController !== null || pendingMainApiRequest !== null;

        try {
            do {
                await new Promise(resolve => setTimeout(resolve, 4000));
                if (!stillWanted()) return;
            } while (isBusy());

            const text = await generateSurpriseText(category, new AbortController().signal);
            if (!stillWanted()) return;
            const triggerAfter = armSurprise(category, text);
            log('Endless Surprises: new surprise armed for category', category, '— fires in', triggerAfter, 'messages');
        } catch (err) {
            if (err.name === 'AbortError') return;
            warn('Endless Surprises: background generation failed:', err.message);
        }
    }

    const handleProfileMousedown = () => {
        populateConnectionProfiles();
    };

    function registerEvents() {
        const { eventSource, event_types } = SillyTavern.getContext();

        // Document events - Namespace them!
        jQuery(document).on('mousedown.pathweaver', '#pw_profile_select, #pw_sm_profile', handleProfileMousedown);

        // EventSource events
        eventSource.on(event_types.CHAT_CHANGED, handleChatChanged);
        eventSource.on(event_types.SETTINGS_UPDATED, handleSettingsUpdated);
        eventSource.on(event_types.MESSAGE_SENT, handleMessageSent);
        eventSource.on(event_types.MESSAGE_RECEIVED, handleMessageReceived);
        eventSource.on(event_types.GENERATION_ENDED, handleGenerationEnded);
        eventSource.on(event_types.GENERATION_STOPPED, handleGenerationEnded);
    }

    // Expose cleanup function for hot reload
    window.pathweaver_cleanup = function () {
        if (DEBUG) console.log(`[${EXTENSION_NAME}] Cleaning up...`);
        const { eventSource, event_types } = SillyTavern.getContext();

        // Remove EventSource listeners
        eventSource.removeListener(event_types.CHAT_CHANGED, handleChatChanged);
        eventSource.removeListener(event_types.SETTINGS_UPDATED, handleSettingsUpdated);
        eventSource.removeListener(event_types.MESSAGE_SENT, handleMessageSent);
        eventSource.removeListener(event_types.MESSAGE_RECEIVED, handleMessageReceived);
        eventSource.removeListener(event_types.GENERATION_ENDED, handleGenerationEnded);
        eventSource.removeListener(event_types.GENERATION_STOPPED, handleGenerationEnded);

        // Remove Document listeners
        jQuery(document).off('mousedown.pathweaver');
        jQuery(document).off('keydown.pathweaver_suggestions');
        jQuery(document).off('.pw_action_bar_events');
        jQuery(document).off('click.pw_icon_dd');
        jQuery(document).off('click.pw_icon_dd_outside');
        jQuery(document).off('input.pw_icon_search');
        jQuery(document).off('click.pw_icon_grid');
        jQuery('body').removeClass('pw_icon_dd_open');
        if (barResizeObserver) barResizeObserver.disconnect();
        window.removeEventListener('resize', checkBarWidth);

        // Remove UI elements
        jQuery('.pw_action_bar').remove();
        jQuery('#pw_suggestions_modal').remove();
        jQuery('#pw_settings_modal').remove();
        jQuery('#pw_styles_manager').remove();
        jQuery('#pw_director_modal').remove();
        jQuery('#pw_surprise_modal').remove();
        jQuery('#pw_premise_modal').remove();
        jQuery('#pathweaver_settings').remove();

        // Clear the premise injection (chatMetadata keeps it for restore on next init)
        try {
            SillyTavern.getContext().setExtensionPrompt?.(PREMISE_PROMPT_KEY, '', EXTENSION_PROMPT_TYPES.NONE, 0);
        } catch (_) { }
        pinnedPremise = null;
        premiseResults = null;
        premiseModal = null;

        // Clear any active surprise injections (leave chatMetadata intact for restore on next init)
        try {
            for (const s of activeSurprises) {
                if (s.injected) clearSurprisePrompt(s.key);
            }
        } catch (_) { }
        if (surpriseAbortController) { try { surpriseAbortController.abort(); } catch (_) { } }

        // Reset state
        actionBar = null;
        suggestionsModal = null;
        settingsModal = null;
        activeSurprises = [];
        surpriseKeyCounter = 0;
        surpriseAbortController = null;
    };

    // ============================================================
    // INITIALIZATION (Pattern from EchoChamber)
    // ============================================================

    async function init() {
        log('Initializing...');

        // Wait for SillyTavern to be ready
        if (typeof SillyTavern === 'undefined' || !SillyTavern.getContext) {
            warn('SillyTavern not ready, retrying in 500ms...');
            setTimeout(init, 500);
            return;
        }

        const stContext = SillyTavern.getContext();
        log('Context available:', !!stContext);

        try {
            loadSettings();
            await initSettingsPanel();
            loadSurpriseQueue();
            renderSurpriseQueue();
            loadPinnedPremise();
            createActionBar();
            registerEvents();
            log('Initialized successfully');
        } catch (err) {
            error('Initialization failed:', err);
        }
    }

    // Start when DOM is ready (like EchoChamber)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
