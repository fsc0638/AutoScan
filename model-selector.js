// ==========================================
// Language Model Selection Handler
// ==========================================

/**
 * Initialize model selector
 */
function initializeModelSelector() {
    const modelProvider = document.getElementById('modelProvider');
    const modelAgent = document.getElementById('modelAgent');

    if (!modelProvider || !modelAgent) {
        console.warn('Model selector elements not found');
        return;
    }

    // Set initial agents for Gemini (default) - This will be called by configLoaded or manually if config is already there
    // updateAgents('gemini'); // Removed as per instruction

    // Listen for provider changes
    modelProvider.addEventListener('change', (e) => {
        const provider = e.target.value;
        updateAgents(provider);
        console.log(`Model provider changed to: ${provider}`);
    });

    // Listen for agent changes
    modelAgent.addEventListener('change', (e) => {
        const agent = e.target.value;
        const provider = modelProvider.value;
        console.log(`Model agent changed to: ${agent} (${provider})`);
    });

    // Listen for config loaded events to refresh lists
    window.addEventListener('configLoaded', () => {
        const provider = modelProvider.value;
        updateAgents(provider);
        console.log('🔄 Agent lists refreshed due to config update');
    });
}

/**
 * Get Agent Display Name
 * @param {string} name - Agent name from config
 * @param {string} defaultLabel - Fallback if everything is missing
 * @returns {string} Display name
 */
function formatAgentName(name, defaultLabel) {
    if (name && name.trim() !== "") {
        return name;
    }
    return "[未命名的Agent]";
}

/**
 * Update agent dropdown based on selected provider and dynamic config
 * @param {string} provider - The model provider (gemini or openai)
 */
function updateAgents(provider) {
    const modelAgent = document.getElementById('modelAgent');
    if (!modelAgent) return;

    // Clear existing options
    modelAgent.innerHTML = '';

    const config = window.AUTOSCAN_CONFIG?.[provider];
    const agents = [];

    // 2. Add custom agents from config
    if (config) {
        // Support for multiple agents array
        if (Array.isArray(config.agents) && config.agents.length > 0) {
            config.agents.forEach(a => {
                let id;
                if (provider === 'gemini') {
                    id = a.agentKey || a.key || a.id;
                } else {
                    id = a.assistantId || a.id || a.key;
                }

                if (id) {
                    agents.push({
                        value: id,
                        label: formatAgentName(a.name || a.agentName)
                    });
                }
            });
        }
        // Support for single agent format
        else {
            const id = provider === 'gemini'
                ? (config.agentKey || config.agentId)
                : (config.assistantId || config.agentId || config.id);
            const name = config.agentName || config.name;

            if (id) {
                agents.push({
                    value: id,
                    label: formatAgentName(name)
                });
            }
        }
    }

    // 3. Fallback if no agents found (keep basic model support)
    if (agents.length === 0) {
        const fallbackId = provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o';
        agents.push({
            value: fallbackId,
            label: `預設 ${provider.toUpperCase()}`
        });
    }

    // Populate options
    agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.value;
        option.textContent = agent.label;
        modelAgent.appendChild(option);
    });

    // Manually trigger change to ensure logic is updated
    modelAgent.dispatchEvent(new Event('change'));

    console.log(`Updated dynamic agents for ${provider}:`, agents.map(a => a.label));
}

/**
 * Get currently selected model configuration
 * @returns {Object} Selected model provider and agent
 */
function getSelectedModel() {
    const modelProvider = document.getElementById('modelProvider');
    const modelAgent = document.getElementById('modelAgent');

    return {
        provider: modelProvider?.value || 'gemini',
        agent: modelAgent?.value || 'default',
        agentLabel: modelAgent?.options[modelAgent.selectedIndex]?.text || '預設 Agent'
    };
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initializeModelSelector();
    console.log('✅ Model selector initialized');
});
