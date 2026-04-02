import { PrismaClient } from "@prisma/client";
import { calculateSimilarity, normalizeText } from "../reconciliation";
import { Decimal } from "decimal.js";

export type ResolutionResult = {
    contractorId: string | null;
    confidence: number; // 0-100
    source: "IBAN" | "NIP" | "FUZZY_AMOUNT" | "FUZZY_NAME" | "NONE";
    iban?: string;
};

export class ContractorResolutionService {
    static async resolveFromBankTransaction(
        tenantId: string,
        tx: { 
            iban?: string; 
            counterpartyName: string; 
            description: string; 
            title?: string;
            amount: number | Decimal;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: any
    ): Promise<ResolutionResult> {
        // 1. TIER 1: IBAN Match (Confidence: 100)
        if (tx.iban) {
            const linkedAccount = await prisma.contractorBankAccount.findUnique({
                where: { 
                    tenantId_iban: { tenantId, iban: tx.iban } 
                },
                include: { contractor: true }
            });

            if (linkedAccount) {
                return {
                    contractorId: linkedAccount.contractorId,
                    confidence: 100,
                    source: "IBAN",
                    iban: tx.iban
                };
            }
        }

        // 2. TIER 2: NIP Match in Description (Confidence: 100 - HARDENED)
        const extractedNip = this.extractNip(tx.description + " " + (tx.title || ""));
        if (extractedNip && this.isValidNip(extractedNip)) {
            const contractor = await prisma.contractor.findFirst({
                where: { tenantId, nip: extractedNip }
            });

            if (contractor) {
                // Auto-link IBAN if present and NOT conflicting
                if (tx.iban) {
                    await this.linkIbanToContractor(tenantId, contractor.id, tx.iban, "BANK_MATCH", prisma);
                }

                return {
                    contractorId: contractor.id,
                    confidence: 100,
                    source: "NIP"
                };
            }
        }

        // 3. TIER 3: Deterministic Fuzzy Match + Exact Amount (Confidence: 70 - SUGGESTION ONLY)
        const normalizedInputName = this.hardenNormalizeName(tx.counterpartyName);
        const contractors = await prisma.contractor.findMany({ where: { tenantId } });
        
        for (const contractor of contractors) {
            const simScore = calculateSimilarity(normalizedInputName, this.hardenNormalizeName(contractor.name));
            
            if (simScore >= 0.8) {
                // Check for exact amount match in open invoices
                const amount = new Decimal(tx.amount).abs();
                const matchingInvoice = await prisma.invoice.findFirst({
                    where: {
                        contractorId: contractor.id,
                        amountGross: amount,
                        paymentStatus: "UNPAID",
                        status: "ACTIVE"
                    }
                });

                if (matchingInvoice) {
                    // VECTOR 116: NO AUTO-LINK for Score 70. Just return result.
                    return {
                        contractorId: contractor.id,
                        confidence: 70,
                        source: "FUZZY_AMOUNT"
                    };
                }
            }
        }

        // 4. TIER 4: Fuzzy Name Only (Confidence: 30)
        let bestMatch = { id: null as string | null, similarity: 0 };
        for (const contractor of contractors) {
            const similarity = calculateSimilarity(normalizedInputName, this.hardenNormalizeName(contractor.name));
            if (similarity >= 0.8 && similarity > bestMatch.similarity) {
                bestMatch = { id: contractor.id, similarity };
            }
        }

        if (bestMatch.id) {
            return {
                contractorId: bestMatch.id,
                confidence: 30,
                source: "FUZZY_NAME"
            };
        }

        return {
            contractorId: null,
            confidence: 0,
            source: "NONE"
        };
    }

    /**
     * Rejestruje IBAN dla kontrahenta (Vector 110: Atomic Write).
     */
    static async linkIbanToContractor(
        tenantId: string,
        contractorId: string,
        iban: string,
        source: "KSEF" | "BANK_MATCH" | "MANUAL",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: any
    ) {
        try {
            // CONFLICT PROTOCOL (FAIL HARD - Vector 116.1)
            const existing = await prisma.contractorBankAccount.findUnique({
                where: { tenantId_iban: { tenantId, iban } }
            });

            if (existing && existing.contractorId !== contractorId) {
                console.error(`[IDENTITY_CONFLICT] IBAN ${iban} already linked to contractor ${existing.contractorId}. Re-assignment to ${contractorId} BLOCKED.`);
                
                // Record Conflict securely
                await prisma.identityConflictRecord.create({
                    data: {
                        tenantId,
                        iban,
                        detectedContractorId: contractorId,
                        existingContractorId: existing.contractorId,
                        details: `Conflict from source: ${source}. New contractor attempt: ${contractorId}.`
                    }
                });
                return; // FAIL HARD (Skip re-assignment)
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).contractorBankAccount.upsert({
                where: { tenantId_iban: { tenantId, iban } },
                update: { source },
                create: { tenantId, contractorId, iban, source }
            });
        } catch (e) {
            console.error("[ContractorResolutionService] Error linking IBAN:", e);
        }
    }

    /**
     * NIP Checksum Validation (Weights: [6, 5, 7, 2, 3, 4, 5, 6, 7])
     */
    static isValidNip(nip: string): boolean {
        const digits = nip.replace(/\D/g, "");
        if (digits.length !== 10) return false;
        
        const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(digits[i]) * weights[i];
        }
        return (sum % 11) === parseInt(digits[9]);
    }

    /**
     * Hardened Normalization (Polish Suffixes, Diacritics, Punctuation)
     */
    static hardenNormalizeName(name: string): string {
        if (!name) return "";
        
        // 1. Lowercase + Diacritic normalization
        let n = name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/ł/g, "l").replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e")
            .replace(/ń/g, "n").replace(/ó/g, "o").replace(/ś/g, "s").replace(/ź/g, "z").replace(/ż/g, "z");

        // 2. Remove all punctuation and dots FIRST to normalize suffixes (e.g. S.A. -> SA)
        n = n.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");

        // 3. Strip Polish Legal Suffixes (Now dot-free)
        const suffixes = [
            "sp z o o", "sp z oo", "z o o", "z oo", "sa", "sp k", "sp j", "sc", "sp p",
            "spolka akcyjna", "spolka z ograniczona odpowiedzialnoscia",
            "spolka komandytowa", "spolka jawna", "spolka cywilna"
        ];
        
        for (const s of suffixes) {
            n = n.replace(new RegExp(`\\b${s}\\b`, "g"), "");
        }

        // 4. Whitespace collapse and final cleanup
        return n.replace(/\s{2,}/g, " ").trim().toUpperCase();
    }

    /**
     * Helper: Ekstrakcja NIP (10 cyfr) z tekstu.
     */
    private static extractNip(text: string): string | null {
        const nipRegex = /(?:\b|NIP:?|NIP\s)(\d{10})\b/g;
        const matches = text.match(nipRegex);
        if (matches && matches.length > 0) {
            // Return only the digits
            return matches[0].replace(/\D/g, "");
        }
        return null;
    }
}
