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
    const AVAILABLE_ICONS = [
        'fa-star', 'fa-bolt', 'fa-moon', 'fa-sun', 'fa-cloud', 'fa-leaf',
        'fa-feather', 'fa-gem', 'fa-crown', 'fa-mask', 'fa-skull', 'fa-dragon',
        'fa-hat-wizard', 'fa-wand-sparkles', 'fa-glasses', 'fa-dice', 'fa-puzzle-piece',
        'fa-key', 'fa-lock', 'fa-book', 'fa-scroll', 'fa-map', 'fa-compass-drafting',
        'fa-palette', 'fa-music', 'fa-film', 'fa-gamepad', 'fa-rocket', 'fa-anchor'
    ];

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
        suggestions_count: 6,
        context_depth: 4,
        bar_minimized: false,
        insert_mode: false,
        show_explicit: false,
        bar_font_size: 'default',  // 'small', 'default', 'large'
        bar_height: 'default',      // 'compact', 'default', 'max'
        suggestion_length: 'short', // 'short' (2-3 sentences) or 'long' (4-6 sentences)
        include_scenario: true,     // Include character scenario in context
        include_description: true,  // Include character description in context
        include_worldinfo: false,   // Include World Info lorebook in context
        custom_styles: []
    });


    // Runtime state
    let settings = JSON.parse(JSON.stringify(defaultSettings));
    let actionBar = null;
    let suggestionsModal = null;
    let settingsModal = null;
    let editorModal = null;
    let abortController = null;
    let isGenerating = false;
    let promptCache = {};
    let currentCategory = 'context';
    let directorMode = 'single_scene'; // 'single_scene' or 'story_beats'

    // Suggestion cache
    let cachedSuggestions = {};
    let cachedChatId = null;

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
        const categories = { ...MAIN_CATEGORIES, ...GENRE_CATEGORIES };

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

    // Helper to get just the main bar buttons (Main + Custom)
    function getBarButtons() {
        const buttons = { ...MAIN_CATEGORIES };

        // Inject customs after character, before explicit? Or just append.
        // Let's just append custom styles to the main list logic.
        // But we return them as a separate list for the UI builder loop
        return buttons;
    }

    function getVisibleCategories() {
        const all = getAllCategories();
        const visible = {};

        for (const [key, cat] of Object.entries(all)) {
            if (cat.nsfw && !settings.show_explicit) continue;
            visible[key] = cat;
        }

        return visible;
    }

    // ============================================================
    // CONNECTION PROFILE UTILITIES (from EchoChamber pattern)
    // ============================================================

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
                        select.append(`<option value="${profile.name}"${isSelected}>${profile.name}</option>`);
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

    async function loadPrompt(category) {
        if (promptCache[category]) {
            return promptCache[category];
        }

        // Check for user customization of built-in style
        if (settings.builtin_customizations?.[category]) {
            promptCache[category] = settings.builtin_customizations[category];
            return settings.builtin_customizations[category];
        }

        const customStyle = settings.custom_styles?.find(s => s.id === category);
        if (customStyle) {
            promptCache[category] = customStyle.prompt;
            return customStyle.prompt;
        }

        try {
            const response = await fetch(`${BASE_URL}/prompts/${category}.md?v=${Date.now()}`);
            if (!response.ok) throw new Error('Failed to load prompt');
            const prompt = await response.text();
            promptCache[category] = prompt;
            return prompt;
        } catch (err) {
            warn(`Failed to load prompt for ${category}:`, err);
            const templateResp = await fetch(`${BASE_URL}/prompts/template.md?v=${Date.now()}`);
            return templateResp.ok ? await templateResp.text() : 'Generate story suggestions.';
        }
    }

    async function loadTemplatePrompt() {
        try {
            const response = await fetch(`${BASE_URL}/prompts/template.md?v=${Date.now()}`);
            if (!response.ok) throw new Error('Failed');
            return await response.text();
        } catch {
            return `You are a creative writing assistant generating story direction suggestions.

TASK: Generate distinct suggestions for what could happen next in the narrative.

OUTPUT FORMAT:
[EMOJI] TITLE
DESCRIPTION

---

GUIDELINES:
- Each suggestion should be distinct and creative
- Keep titles punchy and evocative (under 8 words)
- Match the tone and genre of the ongoing story
- Do NOT include numbering or preamble`;
        }
    }

    // ============================================================
    // CONTEXT EXTRACTION
    // ============================================================

    function extractContext() {
        const stContext = SillyTavern.getContext();
        const context = stContext;
        const chat = stContext?.chat;

        if (!chat || chat.length === 0) return null;

        // Helper to strip reasoning/thinking tags from text
        const stripReasoningTags = (text) => {
            if (!text) return '';
            return text
                .replace(/<(thought|think|thinking|reasoning|reason)>[\s\S]*?<\/\1>/gi, '')
                .replace(/<(thought|think|thinking|reasoning|reason)\/>/gi, '')
                .replace(/<(thought|think|thinking|reasoning|reason)\s*\/>/gi, '')
                .trim();
        };

        const cleanMessage = (text) => {
            if (!text) return '';
            let cleaned = stripReasoningTags(text);
            cleaned = cleaned.replace(/<[^>]*>/g, '');
            const txt = document.createElement('textarea');
            txt.innerHTML = cleaned;
            return txt.value.substring(0, 2000);
        };

        const depth = Math.max(2, Math.min(10, settings.context_depth || 4));
        const recentMessages = chat.slice(-depth);

        const history = recentMessages.map(msg =>
            `${msg.name}: ${cleanMessage(msg.mes)}`
        ).join('\n\n');

        let characterInfo = '';
        let scenario = '';
        let description = '';
        let worldInfo = '';

        if (stContext.characterId !== undefined && stContext.characters && stContext.characters[stContext.characterId]) {
            const char = stContext.characters[stContext.characterId];
            characterInfo = `Character: ${char.name || 'Unknown'}`;

            if (char.data?.scenario) scenario = char.data.scenario;
            else if (char.scenario) scenario = char.scenario;

            if (char.data?.description) description = char.data.description;
            else if (char.description) description = char.description;
        }

        // Extract World Info / Lorebook entries with Order >= 250 filter
        try {
            const entries = [];
            const MIN_ORDER = 250;

            // Helper to process WI entries from various formats
            const processEntries = (entryData) => {
                if (!entryData) return;
                const entryList = Array.isArray(entryData) ? entryData : Object.values(entryData);
                for (const entry of entryList) {
                    if (!entry) continue;
                    const content = entry.content || entry.text || '';
                    const isDisabled = entry.disable === true || entry.disabled === true;
                    const order = entry.order ?? entry.insertion_order ?? 0;
                    if (content && !isDisabled && order >= MIN_ORDER) {
                        entries.push(content);
                    }
                }
            };

            // Method 1: Character's embedded lorebook (primary source)
            if (stContext.characterId !== undefined && stContext.characters && stContext.characters[stContext.characterId]) {
                const char = stContext.characters[stContext.characterId];
                if (char.data?.character_book?.entries) processEntries(char.data.character_book.entries);
                if (entries.length === 0 && char.character_book?.entries) processEntries(char.character_book.entries);
            }

            // Method 2: Global window.world_info
            if (entries.length === 0 && typeof window.world_info !== 'undefined' && window.world_info) {
                processEntries(window.world_info);
                if (window.world_info.entries) processEntries(window.world_info.entries);
            }

            // Method 3: window.world_info_data
            if (entries.length === 0 && window.world_info_data?.entries) processEntries(window.world_info_data.entries);

            // Method 4: chatMetadata.worldInfo
            if (entries.length === 0 && stContext.chatMetadata?.worldInfo) processEntries(stContext.chatMetadata.worldInfo);

            if (entries.length > 0) worldInfo = entries.slice(0, 10).join('\n\n');
        } catch (err) {
            warn('Failed to extract World Info:', err);
        }

        return {
            history,
            characterInfo,
            scenario,
            description,
            worldInfo,
            messageCount: recentMessages.length,
            chatId: stContext.chatId || Date.now()
        };
    }


    // ============================================================
    // GENERATION LOGIC (Pattern from EchoChamber)
    // ============================================================

    async function generateSuggestions(category, forceRefresh = false, customDirections = null, mode = 'single_scene', outputContainer = null) {
        log('Generating suggestions for:', category);
        const stContext = SillyTavern.getContext();
        const context = stContext;

        if (!stContext) {
            error('SillyTavern context not available');
            return;
        }

        const storyContext = extractContext();
        if (!storyContext) {
            showEmptyState('Start a conversation to get suggestions', outputContainer);
            return;
        }

        // Only cache if NOT director mode (director is always dynamic)
        if (category !== 'director') {
            if (cachedChatId !== storyContext.chatId) {
                cachedSuggestions = {};
                cachedChatId = storyContext.chatId;
            }

            if (!forceRefresh && cachedSuggestions[category]) {
                displaySuggestions(cachedSuggestions[category], category, outputContainer);
                return;
            }
        }

        if (isGenerating) return;
        isGenerating = true;
        currentCategory = category;

        // Determine loading message
        let loadingMsg = 'Generating Suggestions...';

        showLoadingState(category, outputContainer, loadingMsg);
        abortController = new AbortController();

        try {
            const categoryPrompt = await loadPrompt(category);
            let contextBlock = '';

            if (storyContext.characterInfo) contextBlock += `${storyContext.characterInfo}\n\n`;
            if (settings.include_scenario && storyContext.scenario) contextBlock += `Scenario: ${storyContext.scenario}\n\n`;
            if (settings.include_description && storyContext.description) {
                contextBlock += `Character Description: ${storyContext.description.substring(0, 800)}\n\n`;
            }
            if (settings.include_worldinfo && storyContext.worldInfo) {
                contextBlock += `World Lore:\n${storyContext.worldInfo.substring(0, 1500)}\n\n`;
            }
            contextBlock += `Recent conversation:\n${storyContext.history}`;

            let userPrompt = '';
            let calculatedMaxTokens = 0;

            if (category === 'director' && customDirections?.length) {
                if (mode === 'story_beats') {
                    // Story Beats: 1 input = 1 suggestion (Classic behavior)
                    const dirList = customDirections.map((d, i) => `${i + 1}. ${d}`).join('\n');
                    userPrompt = `[STORY CONTEXT]\n${contextBlock}\n\n[TASK]\nGenerate exactly ${customDirections.length} suggestions, one for each of the following directions.\n\nUSER DIRECTIONS:\n${dirList}\n\nFORMAT:\n[EMOJI] TITLE\nDESCRIPTION\n\nGUIDELINES:\n- PREVENT BLEED: Each suggestion must be strictly isolated to its corresponding input beat. Do NOT combine events from different beats unless explicitly requested.\n- Follow the specific direction for each suggestion EXACTLY.\n- Keep titles punchy and plain text (no asterisks).\n- ${settings.suggestion_length === 'long' ? 'Write 4-6 sentences per suggestion.' : 'Write 2-3 sentences per suggestion.'}\n- Do NOT include any preamble.`;
                    const tokensPerSuggestion = settings.suggestion_length === 'long' ? 300 : 150;
                    calculatedMaxTokens = Math.min(8192, Math.max(2048, customDirections.length * tokensPerSuggestion + 500));
                } else {
                    // Single Scene: Combined inputs = N suggestions (New behavior)
                    const combinedDirections = customDirections.join(' ');
                    const lengthInstruction = settings.suggestion_length === 'long'
                        ? 'Each description should be 4-6 sentences, providing rich detail and context.'
                        : 'Each description should be 2-3 sentences, concise but evocative.';

                    userPrompt = `[STORY CONTEXT]\n${contextBlock}\n\n[TASK]\nThe user has provided the following direction/scenario for the next scene:\n"${combinedDirections}"\n\nBased on this direction, generate exactly ${settings.suggestions_count} DISTINCT options or variations for how this scene could play out.\n${lengthInstruction}\n\nFORMAT:\n[EMOJI] TITLE\nDESCRIPTION\n\nGUIDELINES:\n- All suggestions must follow the user's direction but offer different execution/flavor.\n- Keep titles punchy and plain text.\n- Do NOT include any preamble.`;
                    const tokensPerSuggestion = settings.suggestion_length === 'long' ? 250 : 120;
                    calculatedMaxTokens = Math.min(8192, Math.max(2048, settings.suggestions_count * tokensPerSuggestion + 500));
                }
            } else {
                const lengthInstruction = settings.suggestion_length === 'long'
                    ? 'Each description should be 4-6 sentences, providing rich detail and context.'
                    : 'Each description should be 2-3 sentences, concise but evocative.';

                userPrompt = `[STORY CONTEXT]\n${contextBlock}\n\n[TASK]\nGenerate exactly ${settings.suggestions_count} distinct suggestions.\n${lengthInstruction}\nFollow the format specified in the system instructions exactly.\nIMPORTANT: Use PLAIN TEXT for titles - do NOT wrap titles in **asterisks**.\nDo NOT include any preamble.`;
                const tokensPerSuggestion = settings.suggestion_length === 'long' ? 250 : 120;
                calculatedMaxTokens = Math.min(8192, Math.max(2048, settings.suggestions_count * tokensPerSuggestion + 500));
            }

            let result = '';
            log(`Calculated Max Tokens: ${calculatedMaxTokens}`);

            if (settings.source === 'profile' && settings.preset) {
                const cm = stContext.extensionSettings?.connectionManager;
                const profile = cm?.profiles?.find(p => p.name === settings.preset);
                if (!profile) throw new Error(`Profile '${settings.preset}' not found`);

                if (!stContext.ConnectionManagerRequestService) throw new Error('ConnectionManagerRequestService not available');

                const messages = [
                    { role: 'system', content: categoryPrompt },
                    { role: 'user', content: userPrompt }
                ];

                log(`Generating with profile: ${profile.name}`);
                const response = await stContext.ConnectionManagerRequestService.sendRequest(
                    profile.id,
                    messages,
                    calculatedMaxTokens,
                    {
                        stream: false,
                        signal: abortController.signal,
                        extractData: true,
                        includePreset: true,
                        includeInstruct: true
                    }
                );

                if (response?.content) result = response.content;
                else if (typeof response === 'string') result = response;
                else if (response?.choices?.[0]?.message?.content) result = response.choices[0].message.content;
                else result = JSON.stringify(response);

            } else if (settings.source === 'ollama') {
                const baseUrl = (settings.ollama_url || 'http://localhost:11434').replace(/\/$/, '');
                if (!settings.ollama_model) throw new Error('No Ollama model selected');

                log(`Generating with Ollama: ${settings.ollama_model}`);
                const response = await fetch(`${baseUrl}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: settings.ollama_model,
                        system: categoryPrompt,
                        prompt: userPrompt,
                        stream: false,
                        options: { num_ctx: 8192, num_predict: calculatedMaxTokens }
                    }),
                    signal: abortController.signal
                });

                if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
                const data = await response.json();
                result = data.response || '';

            } else if (settings.source === 'openai') {
                const baseUrl = (settings.openai_url || 'http://localhost:1234/v1').replace(/\/$/, '');
                log(`Generating with OpenAI-compatible: ${baseUrl}`);
                const response = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: settings.openai_model || 'local-model',
                        messages: [
                            { role: 'system', content: categoryPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.8,
                        max_tokens: calculatedMaxTokens,
                        stream: false
                    }),
                    signal: abortController.signal
                });

                if (!response.ok) throw new Error(`API error: ${response.status}`);
                const data = await response.json();
                result = data.choices?.[0]?.message?.content || '';

            } else {
                const { generateRaw } = stContext;
                if (!generateRaw) throw new Error('generateRaw not available in context');

                log('Generating with default ST API');

                // Create a promise that rejects when aborted
                const abortPromise = new Promise((_, reject) => {
                    abortController.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
                });

                // Race the generation against the abort signal
                result = await Promise.race([
                    generateRaw({ systemPrompt: categoryPrompt, prompt: userPrompt, streaming: false }),
                    abortPromise
                ]);
            }

            if (abortController.signal.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            const suggestions = await parseSuggestions(result);
            if (category !== 'director') cachedSuggestions[category] = suggestions;
            displaySuggestions(suggestions, category, outputContainer);

        } catch (err) {
            if (err.name === 'AbortError' || (abortController && abortController.signal.aborted)) {
                showEmptyState('Generation cancelled by user', outputContainer);
            } else {
                error('Generation failed:', err);
                showErrorState(err.message || 'API request failed', outputContainer);
            }
        } finally {
            isGenerating = false;
            abortController = null;
        }
    }

    // ============================================================
    // RESPONSE PARSING - Robust multi-strategy parser
    // ============================================================

    async function parseSuggestions(text) {
        // Yield to UI thread to prevent blocking during parsing
        await new Promise(resolve => setTimeout(resolve, 0));

        if (!text) return [];

        // First, strip any reasoning/thinking tags from the entire response
        let cleanedText = text
            .replace(/<(thought|think|thinking|reasoning|reason)>[\s\S]*?<\/\1>/gi, '')
            .replace(/<(thought|think|thinking|reasoning|reason)\/>/gi, '')
            .replace(/<(thought|think|thinking|reasoning|reason)\s*\/>/gi, '')
            .trim();



        const suggestions = [];
        let blocks = [];

        // Broad emoji pattern that catches most emojis
        const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2300}-\u{23FF}\u{2B50}\u{1FA00}-\u{1FAFF}]/gu;

        // Strategy 1: Split by --- separator (various formats)
        blocks = cleanedText.split(/\n---\n|\n---|---\n|\n\n---\n\n/);

        // Strategy 2: Split by double newlines (common format)
        if (blocks.length <= 1) {
            blocks = cleanedText.split(/\n\n+/);
        }

        // Strategy 3: If still few blocks, try to find emoji patterns anywhere
        if (blocks.length <= 2) {
            // Find all emojis in the text and use them as split points
            const emojiMatches = [...cleanedText.matchAll(emojiRegex)];
            if (emojiMatches.length >= 2) {
                blocks = [];
                for (let i = 0; i < emojiMatches.length; i++) {
                    const start = emojiMatches[i].index;
                    const end = i < emojiMatches.length - 1 ? emojiMatches[i + 1].index : cleanedText.length;
                    const block = cleanedText.substring(start, end).trim();
                    if (block.length > 10) {
                        blocks.push(block);
                    }
                }
            }
        }

        // Strategy 4: Split by numbered patterns like "1." or "1)" at line start
        if (blocks.length <= 2) {
            const numberedBlocks = cleanedText.split(/\n(?=\d+[\.\)]\s)/);
            if (numberedBlocks.length > blocks.length) {
                blocks = numberedBlocks;
                log('Strategy 4 (numbered) found', blocks.length, 'blocks');
            }
        }

        for (const block of blocks) {
            let trimmed = block.trim();
            if (!trimmed || trimmed.length < 10) continue;

            // Strip any remaining reasoning tags from this block
            trimmed = trimmed
                .replace(/<(thought|think|thinking|reasoning|reason)>[\s\S]*?<\/\1>/gi, '')
                .replace(/<[^>]*>/g, '')
                .trim();

            if (!trimmed || trimmed.length < 10) continue;

            // Find the first emoji in this block
            const emojiMatch = trimmed.match(emojiRegex);
            let emoji = '✨';
            let title = '';
            let description = '';

            if (emojiMatch) {
                emoji = emojiMatch[0];
                const emojiIndex = trimmed.indexOf(emoji);
                // Get text after emoji as title (first line or until next newline)
                const afterEmoji = trimmed.substring(emojiIndex + emoji.length).trim();
                const newlineIndex = afterEmoji.indexOf('\n');

                if (newlineIndex > 0) {
                    title = afterEmoji.substring(0, newlineIndex).trim();
                    description = afterEmoji.substring(newlineIndex + 1).trim();
                } else {
                    title = afterEmoji;
                    description = '';
                }
            } else {
                // No emoji, just use first line as title
                const lines = trimmed.split('\n');
                title = lines[0].trim();
                description = lines.slice(1).join(' ').trim();
            }

            // Remove leading numbers like "1." or "1)"
            title = title.replace(/^\d+[\.\)]\s*/, '');

            // Strip markdown formatting from title
            title = title.replace(/\*\*([^*]+)\*\*/g, '$1');
            title = title.replace(/\*([^*]+)\*/g, '$1');
            title = title.replace(/^\*+\s*|\s*\*+$/g, '').trim();
            title = title.replace(/\s+/g, ' ');

            // Strip markdown from description
            description = description
                .replace(/\*\*([^*]+)\*\*/g, '$1')
                .replace(/\*([^*]+)\*/g, '$1')
                .replace(/\s+/g, ' ')
                .trim();

            if (title && title.length > 2 && title.length < 150) {
                suggestions.push({
                    emoji,
                    title: title.substring(0, 100),
                    description: description || 'Click to use this suggestion'
                });
            }
        }

        log('Parsed', suggestions.length, 'suggestions');
        return suggestions.slice(0, settings.suggestions_count);
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

        // 1. Built-in Buttons
        let builtinButtonsHtml = '';

        // Director Button (Special)
        builtinButtonsHtml += `
            <button class="pw_cat_btn pw_director_btn" 
                    data-category="director"
                    data-name="Director"
                    title="Director: Take control of the story">
                <i class="fa-solid fa-clapperboard"></i>
            </button>`;

        // Main Categories (Context, Twist, Character, Explicit)
        let categoryOptionsHtml = '<option value="director">Director Mode</option>';

        for (const [key, cat] of Object.entries(MAIN_CATEGORIES)) {
            if (cat.nsfw && !settings.show_explicit) continue;

            const btnHtml = `
                <button class="pw_cat_btn"
                        data-category="${key}"
                        data-name="${cat.name}"
                        title="${cat.name}: ${cat.tooltip}">
                    <i class="fa-solid ${cat.icon}"></i>
                </button>`;

            builtinButtonsHtml += btnHtml;
            categoryOptionsHtml += `<option value="${key}">${cat.name}</option>`;
        }

        // 2. Custom Styles (Combined Dropdown)
        let customDropdownHtml = '';
        if (settings.custom_styles?.length) {
            let customItems = '';
            for (const style of settings.custom_styles) {
                customItems += `
                    <button class="pw_dropdown_item" data-category="${style.id}">
                        <i class="fa-solid ${style.icon}"></i>
                        <span>${style.name}</span>
                    </button>`;
                // Also add to the mobile/fallback select
                categoryOptionsHtml += `<option value="${style.id}">${style.name}</option>`;
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
            genreItems += `
                <button class="pw_dropdown_item" data-category="${key}">
                    <i class="fa-solid ${cat.icon}"></i>
                    <span>${cat.name}</span>
                </button>`;

            categoryOptionsHtml += `<option value="${key}">${cat.name}</option>`;
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

        const barHtml = `
        <div class="pw_action_bar${minimized}${fontClass}${heightClass}">
            <span class="pw_bar_title">Pathweaver</span>
            <div class="pw_category_buttons">
                ${builtinButtonsHtml}
                ${customDropdownHtml}
                ${genreDropdownHtml}
            </div>
            <select class="pw_category_dropdown" title="Select a suggestion style">
                <option value="" disabled selected>Style...</option>
                ${categoryOptionsHtml}
            </select>
            <div class="pw_bar_right">
                <span class="pw_hover_label" id="pw_hover_label"></span>
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
            openSuggestionsModal(category);
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
                openSuggestionsModal(category);
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
                if (category === 'director') {
                    showDirectorModal();
                } else {
                    openSuggestionsModal(category);
                }
                this.selectedIndex = 0; // Reset
            }
        });

        // 7. Hover Labels (Delegated)
        jQuery(document).on(`mouseenter${eventNs}`, '.pw_cat_btn, .pw_dropdown_btn', function () {
            const name = jQuery(this).data('name');
            if (name) {
                jQuery('#pw_hover_label').text(name).addClass('visible');
            }
        }).on(`mouseleave${eventNs}`, '.pw_cat_btn, .pw_dropdown_btn', function () {
            jQuery('#pw_hover_label').removeClass('visible');
        });

        // 6. Settings & Minimize
        jQuery(document).on(`click${eventNs}`, '#pw_bar_settings', openSettingsModal);

        jQuery(document).on(`click${eventNs}`, '#pw_minimize_bar', function () {
            settings.bar_minimized = !settings.bar_minimized;
            saveSettings();
            createActionBar();
        });
    }

    function setupResponsiveBar() {
        const bar = document.querySelector('.pw_action_bar');
        if (!bar) return;

        const checkWidth = () => {
            const buttons = bar.querySelector('.pw_category_buttons');
            const dropdown = bar.querySelector('.pw_category_dropdown');
            if (!buttons || !dropdown) return;

            // If bar is narrower than 300px, show fallback dropdown instead of buttons
            if (bar.offsetWidth < 300) {
                buttons.style.display = 'none';
                dropdown.style.display = 'block';
            } else {
                buttons.style.display = 'flex';
                dropdown.style.display = 'none';
            }
        };

        // Check immediately and on resize
        checkWidth();
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(checkWidth);
            observer.observe(bar);
        } else {
            // Fallback for older browsers
            window.addEventListener('resize', checkWidth);
        }
    }

    function updateActionBarVisibility() {
        if (actionBar && actionBar.length) {
            settings.enabled ? actionBar.show() : actionBar.hide();
        }
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
                                    <div class="pw_mode_desc">Combine inputs into one rich scene</div>
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
                alert('Please enter at least one direction.');
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
        jQuery('#pw_refresh_btn').on('click', () => generateSuggestions(currentCategory, true));

        suggestionsModal.on('click', (e) => {
            if (e.target === suggestionsModal[0]) closeSuggestionsModal();
        });

        jQuery(document).on('keydown.pathweaver_suggestions', (e) => {
            if (e.key === 'Escape' && suggestionsModal.hasClass('active')) closeSuggestionsModal();
        });
    }

    function openSuggestionsModal(category) {
        createSuggestionsModal();
        currentCategory = category;

        const allCategories = getAllCategories();
        let catInfo = allCategories[category];

        if (category === 'director') {
            catInfo = { name: 'Director Instructions', icon: 'fa-clapperboard' };
        }

        jQuery('#pw_modal_title_text').text(catInfo?.name || 'Story Directions');
        jQuery('#pw_suggestions_modal .pw_modal_title i')
            .removeClass()
            .addClass(`fa-solid ${catInfo?.icon || 'fa-compass'}`);

        suggestionsModal.addClass('active');
        generateSuggestions(category);
    }

    function closeSuggestionsModal() {
        if (abortController) abortController.abort();
        if (suggestionsModal) suggestionsModal.removeClass('active');
        isGenerating = false;
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

        jQuery('#pw_cancel_gen').off('click').on('click', function (e) {
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
                <p>${message}</p>
            </div>
        `);
    }

    function showErrorState(message, outputContainer = null) {
        const body = outputContainer || jQuery('#pw_modal_body');
        body.html(`
            <div class="pw_empty_state">
                <i class="fa-solid fa-circle-exclamation" style="color: var(--pw-danger);"></i>
                <p>${message}</p>
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

        jQuery('.pw_suggestion_card').on('click', function (e) {
            const index = jQuery(this).data('index');
            const suggestion = suggestions[index];
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

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
    }

    function insertSuggestion(suggestion) {
        const textarea = jQuery('#send_textarea');
        const text = suggestion.description;
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
        const text = suggestion.description;

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

    function showToast(message) {
        if (typeof toastr !== 'undefined') {
            toastr.success(message, 'Pathweaver');
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
            profileOptions += `<option value="${p.name}"${selected}>${p.name}</option>`;
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
                                <span class="pw_setting_label"><i class="fa-solid fa-plus-circle"></i> Insert Mode (Append)</span>
                                <div class="pw_toggle ${settings.insert_mode ? 'active' : ''}" data-setting="insert_mode"></div>
                            </div>
                            <div class="pw_setting_row">
                                <span class="pw_setting_label"><i class="fa-solid fa-fire pw_nsfw_icon"></i> Show Explicit Category (NSFW)</span>
                                <div class="pw_toggle ${settings.show_explicit ? 'active' : ''}" data-setting="show_explicit"></div>
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
                                <div class="pw_warning_text" style="width: 100%; margin-top: 4px;">
                                    <i class="fa-solid fa-triangle-exclamation"></i> Experimental: May decrease suggestion quality. Works only on entries with Order 250 or higher.
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
                                    <input type="text" id="pw_sm_ollama_url" value="${settings.ollama_url}" placeholder="http://localhost:11434">
                                </div>
                                <div class="pw_sm_provider_row">
                                    <label>Model</label>
                                    <select id="pw_sm_ollama_model" class="pw_select text_pole"></select>
                                </div>
                            </div>
                            
                            <div class="pw_sm_provider_box" id="pw_sm_openai_box" style="${settings.source === 'openai' ? '' : 'display:none'}">
                                <div class="pw_sm_provider_row">
                                    <label>URL</label>
                                    <input type="text" id="pw_sm_openai_url" value="${settings.openai_url}" placeholder="http://localhost:1234/v1">
                                </div>
                                <div class="pw_sm_provider_row">
                                    <label>Model</label>
                                    <input type="text" id="pw_sm_openai_model" value="${settings.openai_model}" placeholder="Model name">
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
            saveSettings();
            syncSettingsToPanel(); // Sync to extension panel

            if (setting === 'enabled') {
                createActionBar();
            }
            if (setting === 'show_explicit') createActionBar();
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
        jQuery('#pw_sm_openai_url').on('change', function () { settings.openai_url = this.value; saveSettings(); syncSettingsToPanel(); });
        jQuery('#pw_sm_openai_model').on('change', function () { settings.openai_model = this.value; saveSettings(); syncSettingsToPanel(); });

        jQuery('#pw_sm_suggestions').on('change', function () {
            settings.suggestions_count = Math.max(1, Math.min(20, parseInt(this.value) || 10));
            this.value = settings.suggestions_count;
            saveSettings();
            syncSettingsToPanel();
        });

        jQuery('#pw_sm_context').on('change', function () { settings.context_depth = parseInt(this.value) || 4; saveSettings(); syncSettingsToPanel(); });

        // Suggestion length
        jQuery('#pw_sm_suggestion_length').on('change', function () { settings.suggestion_length = this.value; saveSettings(); syncSettingsToPanel(); });

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

        // Style editor opener
        jQuery('#pw_open_style_editor').on('click', () => openStyleEditor());

        if (settings.source === 'ollama') refreshOllamaModels();
    }

    async function refreshOllamaModels() {
        const select = jQuery('#pw_sm_ollama_model');
        select.html('<option value="">Loading...</option>');
        const models = await fetchOllamaModels();
        select.empty();
        if (models.length) {
            models.forEach(m => {
                const selected = settings.ollama_model === m.name ? ' selected' : '';
                select.append(`<option value="${m.name}"${selected}>${m.name}</option>`);
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
    const defaultTemplate = `You are a creative writing assistant generating story suggestions.

TASK: Generate suggestions for [YOUR THEME/CATEGORY HERE].

TYPES TO INCLUDE:
- [Type 1]: (description)
- [Type 2]: (description)
- [Type 3]: (description)

OUTPUT FORMAT:
[EMOJI] TITLE
DESCRIPTION

---

(Repeat for each suggestion)

GUIDELINES:
- Each suggestion should be distinct and creative
- Keep titles punchy (under 8 words) - use plain text only, NO markdown
- Match the tone and genre of the ongoing story
- Do NOT include numbering or preamble`;

    function openStyleEditor() {
        openStylesManager();
    }

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
                                        <select id="pw_edit_icon"></select>
                                        <span id="pw_edit_icon_preview" style="font-size: 1.5rem; margin-left: 10px;">
                                            <i class="fa-solid fa-star"></i>
                                        </span>
                                    </div>
                                    <div class="pw_editor_row" style="flex-direction: column; align-items: flex-start; flex: 1;">
                                        <label style="margin-bottom: 8px;">System Prompt</label>
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

        // Populate icon dropdown
        const iconSelect = jQuery('#pw_edit_icon');
        AVAILABLE_ICONS.forEach(icon => {
            iconSelect.append(`<option value="${icon}">${icon.replace('fa-', '')}</option>`);
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

        // Built-in styles first
        for (const [key, cat] of Object.entries(MAIN_CATEGORIES)) {
            if (cat.nsfw && !settings.show_explicit) continue;

            listContainer.append(`
                <div class="pw_style_item builtin" data-style-id="${key}" data-builtin="true">
                    <div class="pw_style_icon">
                        <i class="fa-solid ${cat.icon}"></i>
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

            listContainer.append(`
                <div class="pw_style_item builtin" data-style-id="${key}" data-builtin="true">
                    <div class="pw_style_icon">
                        <i class="fa-solid ${cat.icon}"></i>
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
                            <div class="pw_style_name">${style.name}</div>
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

        // Icon preview
        jQuery('#pw_edit_icon').on('change', function () {
            jQuery('#pw_edit_icon_preview i').removeClass().addClass(`fa-solid ${this.value}`);
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

        // Reset prompt (built-in only)
        jQuery('#pw_reset_prompt').on('click', async () => {
            if (currentEditStyle && currentEditStyle.builtin) {
                const original = await loadBuiltinPrompt(currentEditStyle.id);
                jQuery('#pw_edit_prompt').val(original);
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

    async function openEditorView(styleId, isNew = false, isBuiltin = false) {
        const flipper = jQuery('#pw_manager_flipper');
        const nameInput = jQuery('#pw_edit_name');
        const iconSelect = jQuery('#pw_edit_icon');
        const promptArea = jQuery('#pw_edit_prompt');
        const deleteBtn = jQuery('#pw_delete_style');
        const titleEl = jQuery('#pw_editor_title');

        if (isNew) {
            // Creating new style
            currentEditStyle = { id: null, builtin: false, isNew: true };
            titleEl.text('Create New Suggestion Style');
            nameInput.val('').prop('disabled', false);
            iconSelect.val('fa-star').trigger('change');
            promptArea.val(defaultTemplate);
            deleteBtn.hide();
        } else if (isBuiltin) {
            // Editing built-in style
            const allCats = getAllCategories();
            const cat = allCats[styleId];
            currentEditStyle = { id: styleId, builtin: true, isNew: false };
            titleEl.text(`Edit: ${cat.name}`);
            nameInput.val(cat.name).prop('disabled', true);
            iconSelect.val(cat.icon).trigger('change');

            // Load the prompt (check for user customization first)
            let prompt = promptCache[styleId];
            if (!prompt) {
                prompt = await loadPrompt(styleId);
            }
            promptArea.val(prompt);
            deleteBtn.hide();
        } else {
            // Editing custom style
            const style = settings.custom_styles.find(s => s.id === styleId);
            if (!style) return;

            currentEditStyle = { id: styleId, builtin: false, isNew: false };
            titleEl.text(`Edit: ${style.name}`);
            nameInput.val(style.name).prop('disabled', false);
            iconSelect.val(style.icon).trigger('change');
            promptArea.val(style.prompt);
            deleteBtn.show();
        }

        flipper.addClass('flipped');
    }

    function saveCurrentStyle() {
        const name = jQuery('#pw_edit_name').val().trim();
        const icon = jQuery('#pw_edit_icon').val();
        const prompt = jQuery('#pw_edit_prompt').val().trim();

        if (!currentEditStyle) return;

        if (currentEditStyle.builtin) {
            // Save customization for built-in style
            promptCache[currentEditStyle.id] = prompt;
            // Store in settings for persistence
            if (!settings.builtin_customizations) settings.builtin_customizations = {};
            settings.builtin_customizations[currentEditStyle.id] = prompt;
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
            saveSettings();
            showToast('Style saved!');
        }

        createActionBar();
        renderStylesList();
        jQuery('#pw_manager_flipper').removeClass('flipped');
        currentEditStyle = null;
    }

    function deleteStyle(styleId) {
        settings.custom_styles = settings.custom_styles.filter(s => s.id !== styleId);
        delete promptCache[styleId];
        delete cachedSuggestions[styleId];
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

    function closeStyleEditor() {
        closeStylesManager();
    }

    // ============================================================
    // SETTINGS PANEL (for ST extension panel)
    // ============================================================

    async function initSettingsPanel() {
        try {
            const response = await fetch(`${BASE_URL}/settings.html`);
            if (response.ok) {
                const html = await response.text();
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
        // Settings Panel (settings.html) - IDs without _sm_ prefix
        jQuery('#pw_enabled').prop('checked', settings.enabled);
        jQuery('#pw_source').val(settings.source);
        jQuery('#pw_profile_select').val(settings.preset);
        jQuery('#pw_ollama_url').val(settings.ollama_url);
        jQuery('#pw_ollama_model').val(settings.ollama_model);
        jQuery('#pw_openai_preset').val(settings.openai_preset);
        jQuery('#pw_openai_url').val(settings.openai_url);
        jQuery('#pw_openai_model').val(settings.openai_model);
        jQuery('#pw_suggestions_count').val(settings.suggestions_count);
        jQuery('#pw_context_depth').val(settings.context_depth);
        jQuery('#pw_suggestion_length').val(settings.suggestion_length);
        jQuery('#pw_font_size').val(settings.bar_font_size);
        jQuery('#pw_bar_height').val(settings.bar_height);
        jQuery('#pw_insert_mode').prop('checked', settings.insert_mode);
        jQuery('#pw_show_explicit').prop('checked', settings.show_explicit);
        // Context sources
        jQuery('#pw_include_scenario').prop('checked', settings.include_scenario);
        jQuery('#pw_include_description').prop('checked', settings.include_description);
        jQuery('#pw_include_worldinfo').prop('checked', settings.include_worldinfo);

        // Show/hide provider boxes based on source
        updateProviderVisibility(settings.source);

        // Populate profile dropdown
        populateProfileDropdown('#pw_profile_select');

        // Fetch Ollama models if needed
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
            select.append(`<option value="${p.name}"${selected}>${p.name}</option>`);
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
                select.append(`<option value="${m.name}"${selected}>${m.name}</option>`);
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
        jQuery('#pw_suggestions_count').val(settings.suggestions_count);
        jQuery('#pw_context_depth').val(settings.context_depth);
        jQuery('#pw_suggestion_length').val(settings.suggestion_length);
        jQuery('#pw_insert_mode').prop('checked', settings.insert_mode);
        jQuery('#pw_show_explicit').prop('checked', settings.show_explicit);
        jQuery('#pw_font_size').val(settings.bar_font_size);
        jQuery('#pw_bar_height').val(settings.bar_height);
        // Context sources
        jQuery('#pw_include_scenario').prop('checked', settings.include_scenario);
        jQuery('#pw_include_description').prop('checked', settings.include_description);
        jQuery('#pw_include_worldinfo').prop('checked', settings.include_worldinfo);
        updateProviderVisibility(settings.source);
    }

    // Sync settings from extension panel to modal (if open)
    function syncSettingsToModal() {
        jQuery('#pw_sm_source').val(settings.source);
        jQuery('#pw_sm_profile').val(settings.preset);
        jQuery('#pw_sm_ollama_url').val(settings.ollama_url);
        jQuery('#pw_sm_ollama_model').val(settings.ollama_model);
        jQuery('#pw_sm_openai_url').val(settings.openai_url);
        jQuery('#pw_sm_openai_model').val(settings.openai_model);
        jQuery('#pw_sm_suggestions').val(settings.suggestions_count);
        jQuery('#pw_sm_context').val(settings.context_depth);
        jQuery('#pw_sm_suggestion_length').val(settings.suggestion_length);
        jQuery('#pw_sm_font_size').val(settings.bar_font_size);
        jQuery('#pw_sm_bar_height').val(settings.bar_height);
        // Update toggles in modal
        jQuery('.pw_toggle[data-setting="enabled"]').toggleClass('active', settings.enabled);
        jQuery('.pw_toggle[data-setting="show_explicit"]').toggleClass('active', settings.show_explicit);
        jQuery('.pw_toggle[data-setting="insert_mode"]').toggleClass('active', settings.insert_mode);
        // Context sources toggles
        jQuery('.pw_toggle[data-setting="include_scenario"]').toggleClass('active', settings.include_scenario);
        jQuery('.pw_toggle[data-setting="include_description"]').toggleClass('active', settings.include_description);
        jQuery('.pw_toggle[data-setting="include_worldinfo"]').toggleClass('active', settings.include_worldinfo);
        // Update provider visibility
        jQuery('#pw_sm_profile_box, #pw_sm_ollama_box, #pw_sm_openai_box').hide();
        if (settings.source === 'profile') jQuery('#pw_sm_profile_box').show();
        else if (settings.source === 'ollama') jQuery('#pw_sm_ollama_box').show();
        else if (settings.source === 'openai') jQuery('#pw_sm_openai_box').show();
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
            settings.openai_preset = this.value;
            const presets = {
                lmstudio: { url: 'http://localhost:1234/v1', model: 'local-model' },
                kobold: { url: 'http://localhost:5001/v1', model: 'koboldcpp' },
                textgen: { url: 'http://localhost:5000/v1', model: 'local-model' },
                vllm: { url: 'http://localhost:8000/v1', model: 'local-model' }
            };
            if (presets[this.value]) {
                settings.openai_url = presets[this.value].url;
                settings.openai_model = presets[this.value].model;
                jQuery('#pw_openai_url').val(settings.openai_url);
                jQuery('#pw_openai_model').val(settings.openai_model);
            }
            saveSettings();
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

        // Suggestions count
        jQuery('#pw_suggestions_count').on('change', function () {
            settings.suggestions_count = Math.max(1, Math.min(20, parseInt(this.value) || 10));
            this.value = settings.suggestions_count;
            saveSettings();
            syncSettingsToModal();
        });

        // Context depth
        jQuery('#pw_context_depth').on('change', function () {
            settings.context_depth = parseInt(this.value) || 4;
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

        // Suggestion length
        jQuery('#pw_suggestion_length').on('change', function () {
            settings.suggestion_length = this.value;
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
            openStyleEditor();
        });
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    // Named handlers for cleanup
    const handleChatChanged = () => {
        cachedSuggestions = {};
        cachedChatId = null;
    };

    const handleSettingsUpdated = () => {
        populateConnectionProfiles();
    };

    const handleMessageSent = () => {
        jQuery('.pw_action_bar').addClass('pw_processing');
    };

    const handleGenerationEnded = () => {
        jQuery('.pw_action_bar').removeClass('pw_processing');
        cachedSuggestions = {};
    };

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
        eventSource.on(event_types.GENERATION_ENDED, handleGenerationEnded);
    }

    // Expose cleanup function for hot reload
    window.pathweaver_cleanup = function () {
        if (DEBUG) console.log(`[${EXTENSION_NAME}] Cleaning up...`);
        const { eventSource, event_types } = SillyTavern.getContext();

        // Remove EventSource listeners
        eventSource.removeListener(event_types.CHAT_CHANGED, handleChatChanged);
        eventSource.removeListener(event_types.SETTINGS_UPDATED, handleSettingsUpdated);
        eventSource.removeListener(event_types.MESSAGE_SENT, handleMessageSent);
        eventSource.removeListener(event_types.GENERATION_ENDED, handleGenerationEnded);

        // Remove Document listeners
        jQuery(document).off('mousedown.pathweaver');
        jQuery(document).off('keydown.pathweaver_suggestions');
        jQuery(document).off('click.pw_dropdown_close');

        // Remove UI elements
        jQuery('.pw_action_bar').remove();
        jQuery('#pw_suggestions_modal').remove();
        jQuery('#pw_settings_modal').remove();
        jQuery('#pw_styles_manager').remove();
        jQuery('#pw_director_modal').remove();

        // Reset state
        actionBar = null;
        suggestionsModal = null;
        settingsModal = null;
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
// TEST APPEND
