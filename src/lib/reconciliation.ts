import Decimal from "decimal.js";

/**
 * Normalization Layer: Cleans strings for better comparison.
 * Removes special characters, extra spaces, and converts to lowercase.
 */
export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove polish diacritics
        .replace(/[^a-z0-9\s]/g, "") // Remove special chars
        .replace(/\s+/g, " ") // Collapse spaces
        .trim();
}

/**
 * Levenshtein distance: Measures similarity between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Similarity Score (0 to 1): Based on Levenshtein distance relative to length.
 */
export function calculateSimilarity(a: string, b: string): number {
    const normA = normalizeText(a);
    const normB = normalizeText(b);
    if (normA === normB) return 1;
    if (normA.length === 0 || normB.length === 0) return 0;

    const distance = levenshteinDistance(normA, normB);
    const maxLength = Math.max(normA.length, normB.length);
    return 1 - distance / maxLength;
}

export interface MatchSuggestion {
    invoiceId: string;
    invoiceNumber?: string;
    contractorName: string;
    amount: Decimal;
    confidence: number; // 0 to 1
    reason: string;
}

/**
 * Reconciliation Engine: Business logic for matching bank transactions to invoices.
 */
export class ReconciliationEngine {
    /**
     * Finds potential matches for a bank transaction.
     */
    static suggestMatches(
        transaction: { description: string; amount: Decimal },
        unpaidInvoices: { id: string; externalId?: string | null; contractor: { name: string }; amountGross: Decimal }[]
    ): MatchSuggestion[] {
        const suggestions: MatchSuggestion[] = [];
        const transNorm = normalizeText(transaction.description);

        for (const inv of unpaidInvoices) {
            let confidence = 0;
            let reason = "";

            // 1. Exact amount match (High priority)
            const amountMatch = transaction.amount.equals(inv.amountGross);
            if (amountMatch) {
                confidence += 0.4;
                reason += "Kwota zgodna. ";
            }

            // 2. Invoice number in description (Very high priority)
            if (inv.externalId) {
                const invNumNorm = normalizeText(inv.externalId);
                if (transNorm.includes(invNumNorm)) {
                    confidence += 0.5;
                    reason += `Znaleziono nr faktury ${inv.externalId}. `;
                }
            }

            // 3. Contractor name fuzzy matching
            const similarity = calculateSimilarity(inv.contractor.name, transaction.description);
            if (similarity > 0.6) {
                confidence += similarity * 0.3;
                reason += `Podobna nazwa kontrahenta (${Math.round(similarity * 100)}%). `;
            }

            if (confidence > 0.2) {
                suggestions.push({
                    invoiceId: inv.id,
                    invoiceNumber: inv.externalId || undefined,
                    contractorName: inv.contractor.name,
                    amount: inv.amountGross,
                    confidence: Math.min(confidence, 1),
                    reason: reason.trim()
                });
            }
        }

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }
}
