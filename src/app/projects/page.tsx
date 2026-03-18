import { PrismaClient } from '@prisma/client'
import { AddProjectModal } from '@/components/projects/AddProjectModal'
import { InteractiveProjectList } from '@/components/projects/InteractiveProjectList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const prisma = new PrismaClient()

export default async function ProjectsPage() {
    // 1. Pobieramy surowe dane z bazy
    const rawProjects = await prisma.project.findMany({
        include: {
            contractor: true,
            object: true,
            transactions: true,
            invoices: true,
            stages: true,
        },
        orderBy: { createdAt: 'desc' }
    })

    // 2. KLUCZOWY FIX: Przepuszczamy przez sito i zmieniamy Decimal na Number (GŁĘBOKA SERIALIZACJA)
    const allProjects = rawProjects.map(p => ({
        ...p,
        budgetEstimated: p.budgetEstimated ? Number(p.budgetEstimated) : 0,
        budgetUsed: p.budgetUsed ? Number(p.budgetUsed) : 0,
        invoices: (p.invoices || []).map(inv => ({
            ...inv,
            amountNet: Number(inv.amountNet),
            amountGross: Number(inv.amountGross),
            taxRate: Number(inv.taxRate),
        })),
        transactions: (p.transactions || []).map(t => ({
            ...t,
            amount: Number(t.amount),
        })),
        stages: (p.stages || []).map(s => ({
            ...s,
            budgetEstimated: Number(s.budgetEstimated),
        }))
    }))

    const contractors = await prisma.contractor.findMany({
        select: { id: true, name: true },
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' }
    })

    // Ujawniamy uśpione na zakładce aktywnych, by po wybraniu z Checkboxa dało się je odbudzić lub usunąć. Archiwum dostaje swoje okno.
    const activeProjects = allProjects.filter((p) => p.lifecycleStatus === 'ACTIVE' || p.lifecycleStatus === 'ON_HOLD')
    const archivedProjects = allProjects.filter((p) => p.lifecycleStatus === 'ARCHIVED')

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Projekty Inżynieryjne</h1>
                    <p className="text-slate-500 mt-1">Cykl życia inwestycji: od planowania po archiwizację.</p>
                </div>
                <AddProjectModal contractors={contractors} />
            </div>

            <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-[400px] grid-cols-2 mb-6">
                    <TabsTrigger value="active">Aktywne i Wstrzymane ({activeProjects.length})</TabsTrigger>
                    <TabsTrigger value="archive">Archiwum ({archivedProjects.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="active">
                    <InteractiveProjectList projects={activeProjects} />
                </TabsContent>

                <TabsContent value="archive">
                    <InteractiveProjectList projects={archivedProjects} isArchivedView={true} />
                </TabsContent>
            </Tabs>
        </div>
    )
}