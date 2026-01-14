// ============================================
// Configuration Manager
// ============================================

class ConfigManager {
    constructor() {
        this.config = null;
        this.loaded = false;
    }

    /**
     * Load configuration
     * Priorities: 
     * 1. window.AUTOSCAN_CONFIG (from config.js)
     * 2. fetch config.json (if server is present)
     * 3. localStorage (fallback)
     */
    async loadConfig() {
        // 1. Try from window object (Loaded via <script src="config.js">)
        if (window.AUTOSCAN_CONFIG) {
            this.config = window.AUTOSCAN_CONFIG;
            this.loaded = true;
            console.log('✅ Configuration loaded from window.AUTOSCAN_CONFIG');
            return this.config;
        }

        // 2. Try fetch (for local server environments)
        try {
            const response = await fetch('config.json');
            if (response.ok) {
                this.config = await response.json();
                this.loaded = true;
                console.log('✅ Configuration loaded from config.json fetch');
                return this.config;
            }
        } catch (e) {
            console.warn('ℹ️ JSON fetch failed (normal if opening from file://)');
        }

        // 3. Try LocalStorage fallback
        const stored = this.loadFromLocalStorage();
        if (stored) {
            this.config = stored;
            this.loaded = true;
            console.log('✅ Configuration restored from localStorage');
            return this.config;
        }

        throw new Error('找不到配置。請確保已引入 config.js 或 config.json 存在。');
    }

    getGeminiConfig() {
        return this.config?.gemini || {};
    }

    getOpenAIConfig() {
        return this.config?.openai || {};
    }

    getNotionConfig() {
        return this.config?.notion || {};
    }

    saveToLocalStorage() {
        if (this.config) {
            localStorage.setItem('autoscan_config', JSON.stringify(this.config));
        }
    }

    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('autoscan_config');
            return stored ? JSON.parse(stored) : null;
        } catch (e) { return null; }
    }

    isConfigured(service) {
        if (!this.loaded || !this.config) return false;
        const s = this.config[service];
        if (!s) return false;

        if (service === 'gemini') return s.apiKey && !s.apiKey.includes('YOUR_');
        if (service === 'openai') return s.apiKey && !s.apiKey.includes('YOUR_');
        if (service === 'notion') return s.token && s.databaseId && !s.token.includes('YOUR_');

        return false;
    }
}

// Create global instance
const configManager = new ConfigManager();
window.configManager = configManager;

// Load immediately
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await configManager.loadConfig();
        configManager.saveToLocalStorage();

        // Update UI status if elements exist
        const gStatus = document.getElementById('geminiStatus');
        if (gStatus && configManager.isConfigured('gemini')) {
            gStatus.className = 'api-status connected';
            gStatus.textContent = '已設定';
        }

        // Notify other components that config is ready
        window.dispatchEvent(new CustomEvent('configLoaded', { detail: configManager.config }));
        console.log('📢 Sent configLoaded event');
    } catch (error) {
        console.warn('⚠️ Config error:', error.message);
    }
});
