import { getAdminDb } from "../src/lib/firebaseAdmin";

async function main() {
    const db = getAdminDb();
    const snapshot = await db.collection("invoices").where("amountGross", "==", 1119).get();
    
    console.log(`Found ${snapshot.size} invoices in Firestore with amount 1119.`);
    snapshot.forEach(doc => {
        console.log(`Doc ID: ${doc.id}`, JSON.stringify(doc.data(), null, 2));
    });
}

main().catch(console.error);
