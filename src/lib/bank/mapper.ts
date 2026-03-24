import { NormalizedTx } from "./types";

/**
 * LAYER 3: MAP (Business Logic)
 * Applies ERP-specific rules, tagging, and categorization.
 */

export interface ERPTransaction extends NormalizedTx {
    category: string;
    classification: 'PROJECT_COST' | 'GENERAL_COST';
    projectId: string | null;
    tags: string[];
    source: string;
    isTaxOrZus: boolean;
    isManagementCost: boolean;
}

const MANAGEMENT_KEYWORDS = [/Żabka/i, /Stokrotka/i, /Biedronka/i, /Prowizja/i, /ZUS/i, /Paliwo/i, /Orlen/i, /Shell/i, /Circle K/i, /Stacja/i, /Moya/i, /BP/i, /ARKADIA/i, /BULECKA/i];
const MANAGEMENT_BRANDS = ["ZABKA", "ORLEN", "CIRCLE K", "STOKROTKA", "BIEDRONKA", "SHELL", "LIDL", "BP", "MOYA", "ARKADIA", "BULECKA"];

export function mapToERP(normalized: NormalizedTx): ERPTransaction {
    const { title, description, counterparty, type } = normalized;
    const isIncome = type === 'INCOME';
    
    // 1. Tagging
    const tags: string[] = [];
    if (!isIncome && (!!title.match(/PALIWO|ORLEN|BP|SHELL|STACJA/i) || !!description.match(/PALIWO|ORLEN|BP|SHELL|STACJA/i))) {
        tags.push("KOSZTY OGÓLNE FIRMY", "PALIWO");
    }
    if (!!title.match(/USŁUGI|PODWYKONAWCA|MONTAŻ|PRACE/i)) {
        tags.push("WYMAGA PRZYPISANIA DO PROJEKTU");
    }

    // 2. Logic flags
    const isManagementCost = !isIncome && (
        tags.includes("KOSZTY OGÓLNE FIRMY") || 
        MANAGEMENT_KEYWORDS.some(kw => kw.test(description) || kw.test(title) || kw.test(counterparty)) ||
        MANAGEMENT_BRANDS.includes(counterparty.toUpperCase())
    );

    const isTaxOrZus = !isIncome && (
        !!counterparty.match(/ZUS|PODATKI|URZAD SKARBOWY/i) || 
        !!title.match(/ZUS|PODATKI|VAT|PIT|CIT/i)
    );

    // 3. Routing
    let category = isIncome ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY";
    let classification: 'PROJECT_COST' | 'GENERAL_COST' = "PROJECT_COST";

    if (isTaxOrZus) {
        category = "ZUS_PODATKI";
        classification = "GENERAL_COST";
    } else if (isManagementCost) {
        category = "KOSZTY_ZARZADU";
        classification = "GENERAL_COST";
    }

    return {
        ...normalized,
        category,
        classification,
        projectId: null, // Will be enriched by matcher if invoice linked
        tags,
        source: "BANK_IMPORT",
        isTaxOrZus,
        isManagementCost
    };
}
