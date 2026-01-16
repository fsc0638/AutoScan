// ==========================================
// LLM UI Component - Reusable Model Selector
// ==========================================
// A reusable UI component for selecting language models
// Designed to work with llm-core.js

/**
 * LLM UI Component
 * Provides a clean interface for model selection and status display
 */
class LLMUIComponent {
    /**
     * Initialize UI Component
     * @param {Object} options
     * @param {string} options.containerId - DOM element ID to render into
     * @param {Object} options.configManager - Config manager instance
     * @param {Object} options.llmCore - LLM Core instance
     * @param {Function} options.onAnalyze - Callback when analyze button is clicked
     */
    constructor(options = {}) {
        this.containerId = options.containerId || 'llm-component-container';
        this.configManager = options.configManager || window.configManager;
        this.llmCore = options.llmCore || window.llmCore;
        this.onAnalyzeCallback = options.onAnalyze;

        this.elements = {};
        this.state = {
            provider: localStorage.getItem('llm_provider') || 'gemini',
            agent: localStorage.getItem('llm_agent') || null,
            useAgent: localStorage.getItem('llm_use_agent') === 'true' || false
        };
    }

    /**
     * Render the UI component
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`[LLM UI] Container #${this.containerId} not found`);
            return;
        }

        container.innerHTML = `
            <div class="llm-selector-wrapper llm-compact-layout">
                <div class="llm-compact-row">
                    <div class="llm-compact-item">
                        <label class="llm-label-inline">選擇語言模型:</label>
                        <select id="llm-provider-select" class="llm-select-compact">
                            <option value="gemini">Gemini</option>
                            <option value="openai">OpenAI</option>
                        </select>
                    </div>
                    
                    <div class="llm-compact-item">
                        <label class="llm-label-inline">調用 Agent:</label>
                        <label class="llm-toggle-switch">
                            <input type="checkbox" id="llm-use-agent-toggle">
                            <span class="llm-toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <div class="llm-compact-row">
                    <div class="llm-compact-item">
                        <label class="llm-label-inline" id="llm-agent-label">語言版本:</label>
                        <select id="llm-agent-select" class="llm-select-compact">
                            <!-- Options populated dynamically -->
                        </select>
                    </div>
                    
                    <button id="llm-analyze-btn" class="llm-analyze-btn-compact">
                        <span class="llm-btn-icon">🔍</span>
                        <span class="llm-btn-text">分析文字</span>
                    </button>
                </div>
            </div>
        `;

        // Cache elements
        this.elements = {
            providerSelect: document.getElementById('llm-provider-select'),
            agentSelect: document.getElementById('llm-agent-select'),
            agentLabel: document.getElementById('llm-agent-label'),
            useAgentToggle: document.getElementById('llm-use-agent-toggle'),
            analyzeBtn: document.getElementById('llm-analyze-btn')
        };

        this.setupEventListeners();
        this.restoreState();
        this.updateAgentList();

        console.log('✅ LLM UI Component rendered');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Provider change
        this.elements.providerSelect.addEventListener('change', () => {
            this.state.provider = this.elements.providerSelect.value;
            localStorage.setItem('llm_provider', this.state.provider);
            this.updateAgentList();
        });

        // Agent change
        this.elements.agentSelect.addEventListener('change', () => {
            this.state.agent = this.elements.agentSelect.value;
            localStorage.setItem('llm_agent', this.state.agent);
        });

        // Agent toggle change
        this.elements.useAgentToggle.addEventListener('change', () => {
            this.state.useAgent = this.elements.useAgentToggle.checked;
            localStorage.setItem('llm_use_agent', this.state.useAgent);
            console.log('[LLM UI] Agent mode:', this.state.useAgent ? 'ON' : 'OFF');
            this.updateAgentList(); // Refresh list based on toggle
        });

        // Analyze button
        if (this.onAnalyzeCallback) {
            this.elements.analyzeBtn.addEventListener('click', () => {
                this.onAnalyzeCallback();
            });
        }
    }

    /**
     * Restore previous state
     */
    restoreState() {
        if (this.state.provider) {
            this.elements.providerSelect.value = this.state.provider;
        }
        if (this.state.useAgent !== null) {
            this.elements.useAgentToggle.checked = this.state.useAgent;
        }
    }

    /**
     * Update agent/model list based on selected provider and toggle state
     */
    updateAgentList() {
        const provider = this.state.provider;
        const useAgent = this.state.useAgent;
        this.elements.agentSelect.innerHTML = '';

        // Update label based on toggle (compact layout uses shorter labels)
        if (this.elements.agentLabel) {
            this.elements.agentLabel.textContent = useAgent ? 'Agent 名稱:' : '語言版本:';
        }

        const config = this.getProviderConfigSync();
        const models = [];

        if (useAgent) {
            // ==========================================
            // AGENT MODE - 顯示已配置的 Agent
            // ==========================================
            if (config && Array.isArray(config.agents)) {
                config.agents.forEach(agent => {
                    const name = agent.name || agent.agentName || '';
                    let id = (provider === 'gemini')
                        ? (agent.agentKey || agent.key || agent.id)
                        : (agent.assistantId || agent.id || agent.key);

                    if (id) {
                        models.push({
                            value: id,
                            label: this.formatAgentName(name)
                        });
                    }
                });
            }

            // Fallback if no agents configured
            if (models.length === 0) {
                models.push({ value: 'default', label: '未配置 Agent' });
            }
        } else {
            // ==========================================
            // STANDARD MODE - 顯示語言版本（但仍使用 AutoScan 指令）
            // ==========================================
            if (provider === 'gemini') {
                models.push(
                    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Exp)' },
                    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
                    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }
                );
            } else if (provider === 'openai') {
                models.push(
                    { value: 'gpt-4o', label: 'GPT-4 Turbo' },
                    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
                    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
                );
            }
        }

        // Populate dropdown
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            this.elements.agentSelect.appendChild(option);
        });

        // Restore previous selection
        if (this.state.agent) {
            const exists = Array.from(this.elements.agentSelect.options)
                .some(opt => opt.value === this.state.agent);
            if (exists) {
                this.elements.agentSelect.value = this.state.agent;
            }
        }
    }

    /**
     * Get current selection
     */
    getSelection() {
        return {
            provider: this.elements.providerSelect.value,
            model: this.elements.agentSelect.value,
            modelName: this.elements.agentSelect.options[this.elements.agentSelect.selectedIndex]?.text,
            useAgent: this.elements.useAgentToggle.checked
        };
    }

    /**
     * Check if current selection is an agent
     */
    isAgentMode() {
        const selection = this.elements.agentSelect.value;
        // Vertex AI agents start with 'tunedModels/' or contain 'AutoScan'
        return selection.startsWith('tunedModels/') ||
            this.elements.agentSelect.options[this.elements.agentSelect.selectedIndex]?.text.includes('AutoScan');
    }

    /**
     * Update button state
     */
    updateButtonState(state, message) {
        const btn = this.elements.analyzeBtn;
        const icon = btn.querySelector('.llm-btn-icon');
        const text = btn.querySelector('.llm-btn-text');

        switch (state) {
            case 'loading':
                btn.disabled = true;
                btn.classList.add('loading');
                icon.textContent = '⏳';
                if (message) text.textContent = message;
                break;
            case 'success':
                btn.disabled = false;
                btn.classList.remove('loading');
                icon.textContent = '✅';
                if (message) text.textContent = message;
                setTimeout(() => {
                    icon.textContent = '🔍';
                    text.textContent = '分析文字';
                }, 2000);
                break;
            case 'error':
                btn.disabled = false;
                btn.classList.remove('loading');
                icon.textContent = '❌';
                if (message) text.textContent = message;
                setTimeout(() => {
                    icon.textContent = '🔍';
                    text.textContent = '分析文字';
                }, 3000);
                break;
            default:
                btn.disabled = false;
                btn.classList.remove('loading');
                icon.textContent = '🔍';
                text.textContent = '分析文字';
        }
    }

    /**
     * Utility functions
     */
    getProviderConfigSync() {
        if (!this.configManager || !this.configManager.loaded) {
            return null;
        }

        if (this.state.provider === 'gemini') {
            return this.configManager.getGeminiConfig();
        } else if (this.state.provider === 'openai') {
            return this.configManager.getOpenAIConfig();
        }
        return null;
    }

    formatAgentName(name) {
        // Remove 'AutoScan' prefix for cleaner display
        return name.replace('AutoScan', '').trim() || name;
    }

    formatModelName(modelId) {
        if (!modelId) return 'Unknown';
        if (modelId.includes('gemini-2.0')) return 'Gemini 2.0 Flash';
        if (modelId.includes('gemini-1.5-pro')) return 'Gemini 1.5 Pro';
        if (modelId.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash';
        if (modelId.includes('gpt-4o')) return 'GPT-4 Turbo';
        if (modelId.includes('gpt-4')) return 'GPT-4';
        return modelId;
    }
}

// Export to global window
window.LLMUIComponent = LLMUIComponent;

console.log('✅ LLM UI Component module loaded');
