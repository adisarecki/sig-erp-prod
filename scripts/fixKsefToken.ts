import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  // Read .env manually to be safe
  const envPath = path.join(process.cwd(), '.env');
  let ksefToken = process.env.KSEF_TOKEN;
  let targetNip = process.env.KSEF_NIP || '9542751368';

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const tokenMatch = envContent.match(/KSEF_TOKEN="?([^"\n]+)"?/);
    const nipMatch = envContent.match(/KSEF_NIP="?([^"\n]+)"?/);

    if (tokenMatch) ksefToken = tokenMatch[1];
    if (nipMatch) targetNip = nipMatch[1];
  }

  if (!ksefToken) {
    console.error("❌ KSEF_TOKEN not found in .env or environment");
    process.exit(1);
  }

  console.log(`🚀 Updating KSeF Token in Database for ALL tenants...`);

  const tenants = await prisma.tenant.findMany();

  if (tenants.length === 0) {
    console.warn("⚠️ No tenants found in database. Check your setup.");
    return;
  }

  for (const tenant of tenants) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: "Sig ERP",             // Surgical correction to real name
        nip: targetNip,             // Surgical correction to real NIP
        ksefToken: ksefToken,
        ksefAccessToken: null,      // Force fresh handshake
        ksefRefreshToken: null,     // Force fresh handshake
        ksefTokenExpiresAt: null    // Force fresh handshake
      } as any
    });
    console.log(`✅ Updated tenant: Sig ERP (${targetNip})`);
  }

  console.log(`✨ All ${tenants.length} tenant(s) synchronized with .env token.`);
}

main()
  .catch((e) => {
    console.error("❌ Error updating database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
