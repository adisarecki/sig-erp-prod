import prisma from "../src/lib/prisma";

async function main() {
  const projects = await prisma.project.findMany({
    where: {
      name: {
        in: ['Kopalnia MARCEL', 'Nowowiejskiego 2']
      }
    },
    select: {
      id: true,
      name: true
    }
  });
  console.log(JSON.stringify(projects, null, 2));
}

main().catch(console.error);
