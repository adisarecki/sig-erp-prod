// Debug script to check Prisma Client property names
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('--- 🔍 PRISMA CLIENT PROPERTIES ---');
const props = Object.keys(prisma).filter(k => !k.startsWith('_') && typeof prisma[k] === 'object');
console.log(props.sort().join(', '));
process.exit(0);
