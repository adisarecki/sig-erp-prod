import { config } from "dotenv";
config({ path: ".env.local" });
import { getAdminDb } from "./src/lib/firebaseAdmin";

async function run() {
    const adminDb = getAdminDb();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const invoicesSnap = await adminDb.collection("invoices").where("createdAt", ">=", startOfToday.toISOString()).get();
    let deletedInvoices = 0;
    for (const doc of invoicesSnap.docs) {
        await doc.ref.delete();
        deletedInvoices++;
    }

    const txSnap = await adminDb.collection("transactions").where("createdAt", ">=", startOfToday.toISOString()).get();
    let deletedTx = 0;
    for (const doc of txSnap.docs) {
        await doc.ref.delete();
        deletedTx++;
    }

    console.log(`Deleted ${deletedInvoices} invoices and ${deletedTx} transactions from today.`);
}

run().catch(console.error);
