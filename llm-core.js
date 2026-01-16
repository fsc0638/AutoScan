// ==========================================
// LLM Core - Standalone Language Model Module
// ==========================================
// A reusable, standalone module for calling language models
// Can be used in any project without dependencies on AutoScan

/**
 * Core Language Model API handler
 * Supports: Gemini, OpenAI, Vertex AI Agent
 */
class LLMCore {
    /**
     * Initialize LLM Core
     * @param {Object} options - Configuration options
     * @param {Object} options.configManager - Reference to config manager (optional)
     * @param {boolean} options.debug - Enable debug logging
     */
    constructor(options = {}) {
        this.configManager = options.configManager || window.configManager;
        this.debug = options.debug !== false; // Default: true
        this.retryAttempts = options.retryAttempts || 2;
        this.timeout = options.timeout || 60000; // 60 seconds

        if (this.debug) {
            console.log('[LLM Core] Initialized with options:', options);
        }
    }

    /**
     * Main unified call method
     * @param {string} text - Input text to analyze
     * @param {Object} options - Call options
     * @param {string} options.provider - 'gemini' or 'openai'
     * @param {string} options.model - Model ID or agent ID
     * @param {string} options.apiKey - API key (optional, uses config if not provided)
     * @param {string} options.systemInstruction - System instruction (optional)
     * @param {string} options.targetLanguage - Target language for output
     * @param {number} options.temperature - Temperature (0-1)
     * @param {number} options.maxTokens - Max output tokens
     * @param {boolean} options.useAgent - Use Vertex AI Agent mode
     * @returns {Promise<Object>} Result object with text, usage, etc.
     */
    async call(text, options = {}) {
        const {
            provider = 'gemini',
            model,
            apiKey,
            systemInstruction,
            targetLanguage = 'Traditional Chinese',
            temperature = 0.7,
            maxTokens = 8192,
            useAgent = false
        } = options;

        if (this.debug) {
            console.log(`[LLM Core] Calling ${provider}${useAgent ? ' (Agent Mode)' : ''}`);
            console.log('[LLM Core] Options:', { model, targetLanguage, temperature, maxTokens });
        }

        // Get API key from config if not provided
        let finalApiKey = apiKey;
        if (!finalApiKey && this.configManager) {
            const config = await this.getProviderConfig(provider);
            finalApiKey = config?.apiKey;
        }

        if (!finalApiKey) {
            throw new Error(`未設定 ${provider} API 金鑰`);
        }

        // Route to appropriate handler
        try {
            if (useAgent && provider === 'gemini') {
                // Use Vertex AI Agent
                if (typeof window.callVertexAgent === 'function') {
                    return await this.callWithRetry(() =>
                        window.callVertexAgent(text)
                    );
                } else {
                    throw new Error('Vertex AI Agent 模組未載入');
                }
            } else if (provider === 'gemini') {
                return await this.callWithRetry(() =>
                    this.callGemini(text, {
                        model,
                        apiKey: finalApiKey,
                        systemInstruction,
                        targetLanguage,
                        temperature,
                        maxTokens
                    })
                );
            } else if (provider === 'openai') {
                return await this.callWithRetry(() =>
                    this.callOpenAI(text, {
                        model,
                        apiKey: finalApiKey,
                        systemInstruction,
                        targetLanguage,
                        temperature,
                        maxTokens
                    })
                );
            } else {
                throw new Error(`不支援的提供者: ${provider}`);
            }
        } catch (error) {
            console.error('[LLM Core] Call failed:', error);
            throw this.enhanceError(error, provider);
        }
    }

    /**
     * Call Gemini API
     */
    async callGemini(text, options) {
        const {
            model = 'gemini-2.0-flash-exp',
            apiKey,
            systemInstruction,
            targetLanguage,
            temperature,
            maxTokens
        } = options;

        const isLocalhost = this.isLocalhost();
        const apiVersion = 'v1beta';
        const modelPath = (model.startsWith('models/') || model.startsWith('tunedModels/'))
            ? model
            : `models/${model}`;

        const baseUrl = isLocalhost
            ? `/api/gemini/${apiVersion}/${modelPath}:generateContent`
            : `https://generativelanguage.googleapis.com/${apiVersion}/${modelPath}:generateContent`;

        const url = `${baseUrl}?key=${apiKey}`;

        const requestBody = {
            contents: [{ parts: [{ text }] }],
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature: temperature
            }
        };

        if (systemInstruction) {
            requestBody.system_instruction = {
                parts: [{ text: systemInstruction }]
            };
        }

        const response = await this.fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Gemini API Error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return {
            text: generatedText,
            usage: {
                promptTokens: data.usageMetadata?.promptTokenCount,
                completionTokens: data.usageMetadata?.candidatesTokenCount,
                totalTokens: data.usageMetadata?.totalTokenCount
            },
            raw: data
        };
    }

    /**
     * Call OpenAI API
     */
    async callOpenAI(text, options) {
        const {
            model = 'gpt-4o',
            apiKey,
            systemInstruction,
            targetLanguage,
            temperature,
            maxTokens
        } = options;

        const isLocalhost = this.isLocalhost();
        const url = isLocalhost
            ? '/api/openai/v1/chat/completions'
            : 'https://api.openai.com/v1/chat/completions';

        const messages = [];
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }
        messages.push({ role: 'user', content: text });

        const response = await this.fetchWithTimeout(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const generatedText = data.choices[0].message.content;

        return {
            text: generatedText,
            usage: {
                promptTokens: data.usage?.prompt_tokens,
                completionTokens: data.usage?.completion_tokens,
                totalTokens: data.usage?.total_tokens
            },
            raw: data
        };
    }

    /**
     * Call with retry mechanism
     */
    async callWithRetry(fn, attempt = 1) {
        try {
            return await fn();
        } catch (error) {
            if (attempt < this.retryAttempts && this.isRetryableError(error)) {
                if (this.debug) {
                    console.warn(`[LLM Core] Retry attempt ${attempt}/${this.retryAttempts}`);
                }
                await this.sleep(1000 * attempt); // Exponential backoff
                return this.callWithRetry(fn, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Fetch with timeout
     */
    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeout);
            return response;
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                throw new Error('請求超時，請稍後再試');
            }
            throw error;
        }
    }

    /**
     * Get provider configuration
     */
    async getProviderConfig(provider) {
        if (!this.configManager) {
            throw new Error('Config manager not available');
        }

        if (!this.configManager.loaded) {
            if (this.debug) console.log('[LLM Core] Waiting for config to load...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!this.configManager.loaded) {
            throw new Error('配置未載入，請刷新頁面');
        }

        if (provider === 'gemini') {
            return this.configManager.getGeminiConfig();
        } else if (provider === 'openai') {
            return this.configManager.getOpenAIConfig();
        }
        return null;
    }

    /**
     * Utility functions
     */
    isLocalhost() {
        return window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
    }

    isRetryableError(error) {
        const retryableMessages = ['timeout', '503', '429', 'network'];
        return retryableMessages.some(msg =>
            error.message.toLowerCase().includes(msg)
        );
    }

    enhanceError(error, provider) {
        if (error.message.includes('Failed to fetch')) {
            return new Error(`網路錯誤：無法連接到 ${provider} API`);
        }
        return error;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export to global window
window.LLMCore = LLMCore;

// Create default instance
window.llmCore = new LLMCore({
    configManager: window.configManager,
    debug: true
});

console.log('✅ LLM Core module loaded');
