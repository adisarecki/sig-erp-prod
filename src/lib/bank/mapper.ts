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

export function mapToERP(normalized: NormalizedTx): ERPTransaction {
    const { title, description, counterparty, type } = normalized;
    const isIncome = type === 'INCOME';
    
    // 1. Logic flags & Auto-Routing (The Rule Engine)
    let category = isIncome ? "SPRZEDAŻ_TOWARU" : "KOSZT_FIRMOWY";
    let classification: 'PROJECT_COST' | 'GENERAL_COST' = "PROJECT_COST";
    const tags: string[] = [];

    const isManagementCostVendor = /(ZABKA|ORLEN|CIRCLE K|ARKADIA|BULECKA|BIEDRONKA|STOKROTKA|LIDL|SHELL|BP|MOYA|SHELLE|AUCHAN|BIEDRONK)/i.test(counterparty);
    const isTaxOrZusVendor = /(ZUS|URZĄD SKARBOWY|US\s)/i.test(counterparty);

    if (!isIncome) {
        if (isManagementCostVendor) {
            category = "KOSZTY_ZARZADU";
            classification = "GENERAL_COST";
            if (/(ORLEN|SHELL|BP|CIRCLE K|MOYA)/i.test(counterparty)) {
                tags.push("PALIWO");
            } else {
                tags.push("BIURO/ZAKUPY");
            }
        } else if (isTaxOrZusVendor) {
            category = "ZUS_PODATKI";
            classification = "GENERAL_COST";
        }
    }

    // 2. Additional Tagging
    if (!isIncome && !!title.match(/USŁUGI|PODWYKONAWCA|MONTAŻ|PRACE/i)) {
        tags.push("WYMAGA PRZYPISANIA DO PROJEKTU");
    }

    return {
        ...normalized,
        category,
        classification,
        projectId: null, 
        tags,
        source: "BANK_IMPORT",
        isTaxOrZus: isTaxOrZusVendor,
        isManagementCost: isManagementCostVendor
    };
}
