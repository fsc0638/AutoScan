const ModelSelector = {
    init() {
        this.modelProviderSelect = document.getElementById('modelProvider');
        this.modelAgentSelect = document.getElementById('modelAgent');
        this.useAgentToggle = document.getElementById('useAgentToggle');
        this.modelLabel = document.getElementById('modelLabel');

        if (!this.modelProviderSelect || !this.modelAgentSelect) return;

        // Restore saved state
        const savedProvider = localStorage.getItem('selectedModelProvider') || 'gemini';
        this.modelProviderSelect.value = savedProvider;

        const savedUseAgent = localStorage.getItem('useAgent') === 'true';
        if (this.useAgentToggle) {
            this.useAgentToggle.checked = savedUseAgent;
        }

        this.setupEventListeners();
        this.updateModelList();
    },

    setupEventListeners() {
        // Provider Change
        this.modelProviderSelect.addEventListener('change', () => {
            localStorage.setItem('selectedModelProvider', this.modelProviderSelect.value);
            this.updateModelList();
        });

        // Toggle Change
        if (this.useAgentToggle) {
            this.useAgentToggle.addEventListener('change', () => {
                localStorage.setItem('useAgent', this.useAgentToggle.checked);
                console.log('Agent Mode Toggled:', this.useAgentToggle.checked);
                this.updateModelList(); // Refresh list on toggle
            });
        }
    },

    updateModelList() {
        const provider = this.modelProviderSelect.value;
        const useAgent = this.useAgentToggle ? this.useAgentToggle.checked : false;

        this.modelAgentSelect.innerHTML = '';
        const models = [];

        // Update Label
        if (this.modelLabel) {
            this.modelLabel.textContent = useAgent ? 'Agent' : '語言版本';
        }

        const config = window.AUTOSCAN_CONFIG?.[provider];

        if (useAgent) {
            // ===========================================
            // AGENT MODE (Toggle ON)
            // ===========================================
            // Show Agents found in config
            // Note: Currently we filter OUT standard models here if possible, or show "Default Agent"
            if (config && Array.isArray(config.agents)) {
                config.agents.forEach(a => {
                    const name = a.name || a.agentName || '';
                    let id = (provider === 'gemini') ? (a.agentKey || a.key || a.id) : (a.assistantId || a.id || a.key);

                    if (id) {
                        models.push({
                            value: id,
                            label: this.formatAgentName(name)
                        });
                    }
                });
            }
            // Should we add a placeholder if empty?
            if (models.length === 0) {
                models.push({ value: 'default', label: 'Default Agent' });
            }

        } else {
            // ===========================================
            // STANDARD MODE (Toggle OFF)
            // ===========================================
            // Show available Language Versions (Models)

            // 1. Configured Model (Default)
            if (config && config.model) {
                models.push({
                    value: config.model, // e.g. gemini-1.5-flash
                    label: this.formatModelName(config.model)
                });
            }

            // 2. Add other models (hardcoded common ones if not in config explicitly as separate list)
            // Ideally config.agents usually contained these. We filter for things that look like models or are explicitly set.
            // For now, let's look at what was in config.agents but filter OUT "AutoScan Agent" legacy stuff.
            if (config && Array.isArray(config.agents)) {
                config.agents.forEach(a => {
                    const name = a.name || a.agentName || '';
                    if (!name.includes('AutoScan Agent')) {
                        let id = (provider === 'gemini') ? (a.agentKey || a.key || a.id) : (a.assistantId || a.id || a.key);
                        if (id) {
                            models.push({
                                value: id,
                                label: this.formatModelName(id) || name
                            });
                        }
                    }
                });
            }

            // If Gemini, only keep 2.0 Flash
            if (provider === 'gemini') {
                // De-duplicate based on values
                const existingValues = new Set(models.map(m => m.value));

                // Add 2.0 Flash (Experimental) - Only supported version
                if (!existingValues.has('gemini-2.0-flash-exp')) {
                    models.push({ value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Exp)' });
                }
            } else if (provider === 'openai') {
                const existingValues = new Set(models.map(m => m.value));
                if (!existingValues.has('gpt-4o')) {
                    models.push({ value: 'gpt-4o', label: 'GPT-4o' });
                }
                if (!existingValues.has('gpt-4-turbo')) {
                    models.push({ value: 'gpt-4-turbo', label: 'GPT-4 Turbo' });
                }
            }
        }

        // Populate Dropdown
        models.forEach(m => {
            const option = document.createElement('option');
            option.value = m.value;
            option.text = m.label;
            this.modelAgentSelect.add(option);
        });

        // Restore selected model if possible
        const savedKey = useAgent ? `selectedAgent_${provider}` : `selectedModel_${provider}`;
        const savedVal = localStorage.getItem(savedKey);
        if (savedVal) {
            // Check if value exists in current options
            const exists = Array.from(this.modelAgentSelect.options).some(o => o.value === savedVal);
            if (exists) this.modelAgentSelect.value = savedVal;
        }

        // Save selection on change
        this.modelAgentSelect.onchange = () => {
            localStorage.setItem(savedKey, this.modelAgentSelect.value);
        };
    },

    formatModelName(modelId) {
        if (!modelId) return 'Unknown';
        if (modelId.includes('gemini-1.5-pro')) return 'Gemini 1.5 Pro';
        if (modelId.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash';
        if (modelId.includes('gemini-pro')) return 'Gemini Pro';
        if (modelId.includes('gpt-4o')) return 'GPT-4o';
        if (modelId.includes('gpt-4')) return 'GPT-4';
        if (modelId.includes('gpt-3.5')) return 'GPT-3.5';
        return modelId;
    },

    formatAgentName(name) {
        return name.replace('AutoScan', '').trim() || name;
    }
};

// Global accessor
function getSelectedModel() {
    const selector = ModelSelector;
    const provider = selector.modelProviderSelect?.value || 'gemini';
    const agentSelect = selector.modelAgentSelect;
    const useAgent = selector.useAgentToggle?.checked || false;

    return {
        provider: provider,
        agent: agentSelect?.value || 'default',
        agentLabel: agentSelect?.options[agentSelect.selectedIndex]?.text || 'Default',
        useAgent: useAgent
    };
}

// Initialize when config is ready
function checkConfigAndInit() {
    if (window.configManager && window.configManager.loaded) {
        ModelSelector.init();
    } else {
        setTimeout(checkConfigAndInit, 500);
    }
}

document.addEventListener('DOMContentLoaded', checkConfigAndInit);
