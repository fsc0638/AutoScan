/**
 * Text Similarity Utilities
 * 
 * Provides functions to calculate similarity between two strings
 * using Levenshtein Distance algorithm.
 */

/**
 * Calculate Levenshtein Distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into the other.
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create 2D array for dynamic programming
    const dp = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= len1; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
        dp[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                // Characters match, no edit needed
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                // Take minimum of three operations
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,      // Deletion
                    dp[i][j - 1] + 1,      // Insertion
                    dp[i - 1][j - 1] + 1   // Substitution
                );
            }
        }
    }

    return dp[len1][len2];
}

/**
 * Calculate similarity percentage between two strings
 * Returns a value between 0-100, where 100 means identical strings
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity percentage (0-100)
 */
function calculateSimilarity(str1, str2) {
    // Handle edge cases
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 100;

    // Normalize strings (trim whitespace, lowercase for comparison)
    const normalized1 = str1.trim();
    const normalized2 = str2.trim();

    if (normalized1 === normalized2) return 100;

    // Calculate Levenshtein distance
    const distance = levenshteinDistance(normalized1, normalized2);

    // Convert to similarity percentage
    const maxLen = Math.max(normalized1.length, normalized2.length);
    const similarity = ((maxLen - distance) / maxLen) * 100;

    return Math.round(similarity * 100) / 100; // Round to 2 decimal places
}

/**
 * Find the best match from a list of candidates
 * Returns the candidate with highest similarity and its similarity score
 * 
 * @param {string} target - Target string to match
 * @param {Array<{id: string, text: string}>} candidates - Array of candidate objects
 * @param {number} threshold - Minimum similarity threshold (0-100), default 60
 * @returns {{match: object|null, similarity: number}} - Best match and its similarity
 */
function findBestMatch(target, candidates, threshold = 60) {
    if (!target || !candidates || candidates.length === 0) {
        return { match: null, similarity: 0 };
    }

    let bestMatch = null;
    let highestSimilarity = 0;

    for (const candidate of candidates) {
        const similarity = calculateSimilarity(target, candidate.text);

        if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = candidate;
        }
    }

    // Return match only if it meets threshold
    if (highestSimilarity >= threshold) {
        return { match: bestMatch, similarity: highestSimilarity };
    }

    return { match: null, similarity: highestSimilarity };
}

// Module exports for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        levenshteinDistance,
        calculateSimilarity,
        findBestMatch
    };
}

// Browser global
if (typeof window !== 'undefined') {
    window.SimilarityUtils = {
        levenshteinDistance,
        calculateSimilarity,
        findBestMatch
    };
}
