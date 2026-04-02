import prisma from "../src/lib/prisma";

/**
 * VECTOR 117: Data Purge for Test Projects
 * Deletes all existing LedgerEntry and KsefInvoice records for:
 * - "Kopalnia MARCEL"
 * - "Nowowiejskiego 2"
 * 
 * Maintains referential integrity by deleting in proper order.
 */
async function main() {
  const PROJECT_NAMES = ["Kopalnia MARCEL", "Nowowiejskiego 2"];

  console.log("🗑️  VECTOR 117: DATA PURGE INITIATED");
  console.log(`Target projects: ${PROJECT_NAMES.join(", ")}\n`);

  try {
    // 1. Find projects by name
    const projects = await prisma.project.findMany({
      where: {
        name: { in: PROJECT_NAMES }
      },
      select: { id: true, name: true, tenantId: true }
    });

    if (projects.length === 0) {
      console.log(`❌ ERROR: No projects found with names: ${PROJECT_NAMES.join(", ")}`);
      console.log("\nAvailable projects:");
      const allProjects = await prisma.project.findMany({
        select: { id: true, name: true }
      });
      allProjects.forEach((p) => console.log(`  - ${p.name} (${p.id})`));
      process.exit(1);
    }

    const projectIds = projects.map((p) => p.id);
    console.log(`✅ Found ${projects.length} target project(s):`);
    projects.forEach((p) => console.log(`   - ${p.name} (${p.id})`));
    console.log();

    // Perform deletions in a transaction to maintain consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete LedgerEntries for these projects
      const ledgerDel = await tx.ledgerEntry.deleteMany({
        where: { projectId: { in: projectIds } }
      });
      console.log(`🗑️  Deleted ${ledgerDel.count} LedgerEntries`);

      // 2. Delete InvoicePayments (references both Invoices and Transactions)
      const invoices = await tx.invoice.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true, ksefId: true }
      });
      const invoiceIds = invoices.map((i) => i.id);

      if (invoiceIds.length > 0) {
        const invoicePaymentsDel = await tx.invoicePayment.deleteMany({
          where: { invoiceId: { in: invoiceIds } }
        });
        console.log(`🗑️  Deleted ${invoicePaymentsDel.count} InvoicePayments`);

        // 3. Delete KsefInvoices linked to these invoices
        const ksefIds = invoices
          .filter((i: any) => i.ksefId)
          .map((i: any) => i.ksefId);

        if (ksefIds.length > 0) {
          const ksefDel = await tx.ksefInvoice.deleteMany({
            where: { ksefNumber: { in: ksefIds } }
          });
          console.log(`🗑️  Deleted ${ksefDel.count} KsefInvoices`);
        }
      }

      // 4. Delete Invoices
      const invoiceDel = await tx.invoice.deleteMany({
        where: { projectId: { in: projectIds } }
      });
      console.log(`🗑️  Deleted ${invoiceDel.count} Invoices`);

      // 5. Delete Transactions linked to these projects
      const transactionDel = await tx.transaction.deleteMany({
        where: { projectId: { in: projectIds } }
      });
      console.log(`🗑️  Deleted ${transactionDel.count} Transactions`);

      // 6. Delete Retentions linked to these projects
      const retentionDel = await tx.retention.deleteMany({
        where: { projectId: { in: projectIds } }
      });
      console.log(`🗑️  Deleted ${retentionDel.count} Retentions`);

      // 7. Delete Assets linked to these projects
      const assetDel = await tx.asset.deleteMany({
        where: { project: { id: { in: projectIds } } }
      });
      console.log(`🗑️  Deleted ${assetDel.count} Assets`);

      // 8. Delete ProjectStages
      const stageDel = await tx.projectStage.deleteMany({
        where: { projectId: { in: projectIds } }
      });
      console.log(`🗑️  Deleted ${stageDel.count} ProjectStages`);

      // 9. Delete Projects themselves
      const projectDel = await tx.project.deleteMany({
        where: { id: { in: projectIds } }
      });
      console.log(`🗑️  Deleted ${projectDel.count} Projects`);

      return {
        ledgerEntries: ledgerDel.count,
        invoicePayments: invoicePaymentsDel?.count || 0,
        ksefInvoices: ksefIds?.length || 0,
        invoices: invoiceDel.count,
        transactions: transactionDel.count,
        retentions: retentionDel.count,
        assets: assetDel.count,
        stages: stageDel.count,
        projects: projectDel.count
      };
    });

    console.log("\n✅ PURGE COMPLETED SUCCESSFULLY");
    console.log("\nDeletion Summary:");
    console.log(`  LedgerEntries: ${result.ledgerEntries}`);
    console.log(`  InvoicePayments: ${result.invoicePayments}`);
    console.log(`  KsefInvoices: ${result.ksefInvoices}`);
    console.log(`  Invoices: ${result.invoices}`);
    console.log(`  Transactions: ${result.transactions}`);
    console.log(`  Retentions: ${result.retentions}`);
    console.log(`  Assets: ${result.assets}`);
    console.log(`  ProjectStages: ${result.stages}`);
    console.log(`  Projects: ${result.projects}`);
  } catch (error) {
    console.error("❌ PURGE FAILED:", error);
    process.exit(1);
  }
}

main();
