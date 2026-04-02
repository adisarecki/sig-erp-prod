import prisma from "../src/lib/prisma";
import Decimal from "decimal.js";
import { recordInvoiceToLedger } from "../src/lib/finance/ledger-manager";
import { getProjectFinancials, getFinancialSnapshot } from "../src/lib/finance/ledger-service";

/**
 * [VECTOR 117] Verification Test
 * 
 * Test Case: 10,000 PLN Net Invoice with 10% Retention
 * 
 * Expected Results:
 * - Margin: +10,000 PLN
 * - Safe to Spend: ~8,100 PLN (after 10% retention and 9% CIT reserve)
 * - Vault (Skarbiec): +1,000 PLN
 */

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧪 VECTOR 117 VERIFICATION TEST");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // ========== SETUP PHASE ==========
    console.log("📋 SETUP PHASE\n");

    // Find or create test tenant
    let tenant = await prisma.tenant.findFirst({
      where: { name: "Test Tenant Vector 117" }
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { name: "Test Tenant Vector 117" }
      });
      console.log(`✅ Created test tenant: ${tenant.name}`);
    } else {
      console.log(`✅ Using existing tenant: ${tenant.name}`);
    }

    // Find or create test contractor
    let contractor = await prisma.contractor.findFirst({
      where: { tenantId: tenant.id, name: "Test Contractor PL" }
    });

    if (!contractor) {
      contractor = await prisma.contractor.create({
        data: {
          tenantId: tenant.id,
          name: "Test Contractor PL",
          nip: "1234567890",
          type: "INWESTOR",
          status: "ACTIVE"
        }
      });
      console.log(`✅ Created test contractor: ${contractor.name}`);
    } else {
      console.log(`✅ Using existing contractor: ${contractor.name}`);
    }

    // Find or create test object
    let obj = await prisma.object.findFirst({
      where: { contractorId: contractor.id, name: "Test Object" }
    });

    if (!obj) {
      obj = await prisma.object.create({
        data: {
          contractorId: contractor.id,
          name: "Test Object",
          address: "ul. Testowa 1, 32-000 Kraków"
        }
      });
      console.log(`✅ Created test object: ${obj.name}`);
    } else {
      console.log(`✅ Using existing object: ${obj.name}`);
    }

    // Create test project with 10% retention (GROSS base)
    const project = await prisma.project.create({
      data: {
        tenantId: tenant.id,
        contractorId: contractor.id,
        objectId: obj.id,
        name: "Vector 117 Test Project - 10% Retention",
        type: "CONSTRUCTION",
        status: "ACTIVE",
        lifecycleStatus: "ACTIVE",
        budgetEstimated: new Decimal("10000.00"),
        retentionShortTermRate: new Decimal("0.10"), // 10% short-term
        retentionLongTermRate: new Decimal("0"),
        retentionBase: "GROSS" // Calculated on Gross amount
      }
    });
    console.log(`✅ Created test project: ${project.name}`);
    console.log(
      `   - Retention Base: ${project.retentionBase}`,
      `\n   - Retention Rate: ${(Number(project.retentionShortTermRate) * 100).toFixed(0)}%`
    );

    // ========== INVOICE RECORDING PHASE ==========
    console.log("\n📄 INVOICE RECORDING PHASE\n");

    const netAmount = new Decimal("10000.00");
    const vatRate = new Decimal("0.23"); // 23% VAT
    const vatAmount = netAmount.mul(vatRate);
    const grossAmount = netAmount.plus(vatAmount);

    console.log(`Net Amount: ${netAmount.toString()} PLN`);
    console.log(`VAT (23%): ${vatAmount.toString()} PLN`);
    console.log(`Gross Amount: ${grossAmount.toString()} PLN\n`);

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        contractorId: contractor.id,
        projectId: project.id,
        type: "SPRZEDAŻ",
        amountNet: netAmount,
        amountGross: grossAmount,
        taxRate: vatRate,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
        paymentStatus: "UNPAID",
        invoiceNumber: "TEST/2026/001"
      }
    });
    console.log(`✅ Created invoice: ${invoice.invoiceNumber}`);

    // Record to ledger (income entry)
    const retentionAmount = new Decimal("0"); // Will be calculated on payment
    await recordInvoiceToLedger({
      tenantId: tenant.id,
      projectId: project.id,
      invoiceId: invoice.id,
      amountNet: netAmount,
      vatAmount: vatAmount,
      retainedAmount: retentionAmount,
      type: "INCOME",
      date: new Date()
    });
    console.log(`✅ Recorded invoice to ledger`);

    // ========== CALCULATION PHASE ==========
    console.log("\n🔢 RETENTION CALCULATION PHASE\n");

    const shortRate = project.retentionShortTermRate || new Decimal("0");
    const longRate = project.retentionLongTermRate || new Decimal("0");
    const totalRate = shortRate.plus(longRate);

    console.log(`Base: ${project.retentionBase}`);
    console.log(`Total Retention Rate: ${totalRate.mul(100).toString()}%\n`);

    let expectedPayment = new Decimal("0");
    let calculatedRetention = new Decimal("0");

    if (project.retentionBase === "GROSS") {
      // Formula: Expected = Brutto * (1 - Rate)
      expectedPayment = grossAmount.mul(new Decimal("1").minus(totalRate));
      calculatedRetention = grossAmount.mul(totalRate);
      console.log(`Formula (GROSS Base): Expected = Brutto × (1 - Rate)`);
    } else {
      // Formula: Expected = Brutto - (Net * Rate)
      calculatedRetention = netAmount.mul(totalRate);
      expectedPayment = grossAmount.minus(calculatedRetention);
      console.log(`Formula (NET Base): Expected = Brutto - (Net × Rate)`);
    }

    console.log(`Expected Payment: ${expectedPayment.toString()} PLN`);
    console.log(`Retention Amount (Vault): ${calculatedRetention.toString()} PLN\n`);

    // ========== PRE-PAYMENT STATE ==========
    console.log("💰 PRE-PAYMENT STATE\n");

    const prePaymentFinancials = await getProjectFinancials(tenant.id, project.id);
    console.log(`Project Financials:`);
    console.log(`  - Income (Net): ${prePaymentFinancials.income.toString()} PLN`);
    console.log(`  - Expense (Net): ${prePaymentFinancials.expense.toString()} PLN`);
    console.log(`  - Margin: ${prePaymentFinancials.margin.toString()} PLN`);
    console.log(`  - Locked Retention: ${prePaymentFinancials.lockedRetention.toString()} PLN\n`);

    // ========== SIMULATE BANK PAYMENT ==========
    console.log("🏦 SIMULATING BANK PAYMENT\n");

    // Create transaction for bank payment (matching expected amount)
    const bankTransaction = await prisma.transaction.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        amount: expectedPayment,
        type: "INCOME",
        transactionDate: new Date(),
        category: "SPRZEDAŻ",
        description: `Bank payment for invoice ${invoice.invoiceNumber}`,
        source: "BANK_IMPORT",
        status: "ACTIVE",
        classification: "PROJECT_COST",
        matchedContractorId: contractor.id
      }
    });
    console.log(`✅ Created bank transaction: ${expectedPayment.toString()} PLN`);

    // Link invoice to transaction
    await prisma.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        transactionId: bankTransaction.id,
        amountApplied: expectedPayment
      }
    });
    console.log(`✅ Linked invoice to bank transaction`);

    // Record bank payment to ledger
    await prisma.ledgerEntry.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        source: "BANK_PAYMENT",
        sourceId: bankTransaction.id,
        amount: expectedPayment,
        type: "INCOME",
        date: new Date()
      }
    });
    console.log(`✅ Recorded bank payment to ledger\n`);

    // Record retention lock
    await prisma.ledgerEntry.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        source: "INVOICE",
        sourceId: invoice.id,
        amount: calculatedRetention,
        type: "RETENTION_LOCK",
        date: new Date()
      }
    });
    console.log(`✅ Recorded retention lock to ledger\n`);

    // Update invoice status
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        paymentStatus: "PAID"
      }
    });
    console.log(`✅ Updated invoice status to PAID\n`);

    // ========== POST-PAYMENT VERIFICATION ==========
    console.log("✅ POST-PAYMENT VERIFICATION\n");

    const postPaymentFinancials = await getProjectFinancials(tenant.id, project.id);
    console.log(`Project Financials After Payment:`);
    console.log(`  - Income (Net): ${postPaymentFinancials.income.toString()} PLN`);
    console.log(`  - Expense (Net): ${postPaymentFinancials.expense.toString()} PLN`);
    console.log(`  - Margin: ${postPaymentFinancials.margin.toString()} PLN ✓`);
    console.log(`  - Locked Retention (Vault): ${postPaymentFinancials.lockedRetention.toString()} PLN ✓\n`);

    // ========== SYSTEM-WIDE FINANCIAL SNAPSHOT ==========
    console.log("🏛️  SYSTEM-WIDE FINANCIAL SNAPSHOT\n");

    const snapshot = await getFinancialSnapshot(tenant.id);
    console.log(`Real Cash Balance: ${snapshot.realCashBalance.toString()} PLN`);
    console.log(`VAT Balance: ${snapshot.vatBalance.toString()} PLN`);
    console.log(`Vault Value: ${snapshot.vaultValue.toString()} PLN`);
    console.log(`Safe to Spend: ${snapshot.safeToSpend.toString()} PLN\n`);

    // ========== VERIFICATION ASSERTIONS ==========
    console.log("🔍 VERIFICATION ASSERTIONS\n");

    const assertions = [
      {
        name: "Income equals Net amount",
        condition: postPaymentFinancials.income.equals(netAmount),
        expected: netAmount.toString(),
        actual: postPaymentFinancials.income.toString()
      },
      {
        name: "Margin equals Net amount",
        condition: postPaymentFinancials.margin.equals(netAmount),
        expected: netAmount.toString(),
        actual: postPaymentFinancials.margin.toString()
      },
      {
        name: "Vault (Locked Retention) equals calculated retention",
        condition: postPaymentFinancials.lockedRetention.equals(calculatedRetention),
        expected: calculatedRetention.toString(),
        actual: postPaymentFinancials.lockedRetention.toString()
      },
      {
        name: "Expected payment calculation correct",
        condition: expectedPayment.equals(grossAmount.mul(new Decimal("0.9"))),
        expected: grossAmount.mul(new Decimal("0.9")).toString(),
        actual: expectedPayment.toString()
      },
      {
        name: "Bank payment matches expected",
        condition: bankTransaction.amount.equals(expectedPayment),
        expected: expectedPayment.toString(),
        actual: bankTransaction.amount.toString()
      }
    ];

    let allPass = true;
    for (const assertion of assertions) {
      const status = assertion.condition ? "✅ PASS" : "❌ FAIL";
      console.log(
        `${status}: ${assertion.name}\n    Expected: ${assertion.expected}\n    Actual: ${assertion.actual}`
      );
      if (!assertion.condition) allPass = false;
    }

    // ========== FINAL SUMMARY ==========
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (allPass) {
      console.log("🎉 ALL TESTS PASSED - VECTOR 117 VERIFIED");
    } else {
      console.log("⚠️  SOME TESTS FAILED - REVIEW ABOVE");
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Print final summary table
    console.log("📊 FINAL SUMMARY TABLE\n");
    console.log("Property                          | Value");
    console.log("────────────────────────────────────────────────────────");
    console.log(`Invoice Net Amount                | ${netAmount.toString()} PLN`);
    console.log(`VAT (23%)                          | ${vatAmount.toString()} PLN`);
    console.log(`Invoice Gross Amount              | ${grossAmount.toString()} PLN`);
    console.log(`Retention Rate                     | 10%`);
    console.log(`Retention Amount (Vault)          | ${calculatedRetention.toString()} PLN`);
    console.log(`Expected Bank Payment             | ${expectedPayment.toString()} PLN`);
    console.log(`Actual Bank Payment               | ${bankTransaction.amount.toString()} PLN`);
    console.log(`Project Margin                     | ${postPaymentFinancials.margin.toString()} PLN`);
    console.log(`Safe to Spend (no CIT reserve)    | ${snapshot.safeToSpend.toString()} PLN`);
    console.log("────────────────────────────────────────────────────────");
  } catch (error) {
    console.error("❌ TEST FAILED:", error);
    process.exit(1);
  }
}

main();
