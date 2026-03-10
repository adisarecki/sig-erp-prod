import { PrismaClient } from '@prisma/client'
import { TooltipHelp } from '@/components/ui/TooltipHelp'
import { AddProjectModal } from '@/components/projects/AddProjectModal'
import { ProjectAnalysisDialog } from '@/components/projects/ProjectAnalysisDialog'
import { ArchiveProjectButton } from '@/components/projects/ArchiveProjectButton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const prisma = new PrismaClient()

// Formatowanie waluty (PLN)
const formatPln = (value: number) => {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
}

export default async function ProjectsPage() {
    const allProjects = await prisma.project.findMany({
        include: {
            contractor: true,
            object: true,
            transactions: true,
            invoices: true,
        },
        orderBy: { createdAt: 'desc' }
    })

    const contractors = await prisma.contractor.findMany({
        select: { id: true, name: true },
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' }
    })

    const activeProjects = allProjects.filter((p: any) => p.lifecycleStatus === 'ACTIVE')
    const archivedProjects = allProjects.filter((p: any) => p.lifecycleStatus === 'ARCHIVED')

    const ProjectList = ({ projects, showArchiveButton = true }: { projects: any[], showArchiveButton?: boolean }) => (
        <div className="grid gap-6">
            {projects.map((project: any) => {
                // Obliczanie realnych przychodów
                const totalInvoiced = project.invoices.reduce((sum: number, inv: any) => sum + Number(inv.amountNet), 0)

                // Obliczanie realnych kosztów z transakcji (tylko te typu KOSZT)
                const totalCosts = project.transactions
                    .filter((t: any) => t.type === 'KOSZT')
                    .reduce((sum: number, t: any) => sum + Number(t.amount), 0)

                // Marża = Przychody netto - Koszty
                const currentMargin = totalInvoiced - totalCosts
                const isLoss = currentMargin < 0

                return (
                    <div key={project.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition ${project.lifecycleStatus === 'ARCHIVED' ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                        <div className="p-6 border-b flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200">
                                        {project.type}
                                    </span>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-md border ${project.lifecycleStatus === 'ARCHIVED' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                        {project.lifecycleStatus === 'ARCHIVED' ? 'ZARCHIWIZOWANY' : project.status}
                                    </span>
                                </div>
                                <h2 className="text-xl font-bold mt-2 text-slate-900">{project.name}</h2>
                                <p className="text-slate-500 mt-1 text-sm">
                                    Inwestor: <strong className="text-slate-700">{project.contractor.name}</strong> •
                                    Obiekt: <strong className="text-slate-700">{project.object.name}</strong>
                                    ({project.object.address})
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end mr-4">
                                    <div className="flex items-center">
                                        <p className="text-sm font-medium text-slate-500">Szacowany Budżet</p>
                                        <TooltipHelp content="Wartość całkowita kontraktu określona przed rozpoczęciem prac." />
                                    </div>
                                    <p className="text-lg font-bold text-slate-800">{formatPln(Number(project.budgetEstimated))}</p>
                                </div>
                                <div className="flex items-center gap-2 border-l border-slate-100 pl-4 h-full">
                                    <ProjectAnalysisDialog
                                        projectName={project.name}
                                        transactions={project.transactions.map((t: any) => ({
                                            ...t,
                                            amount: Number(t.amount)
                                        }))}
                                        budgetEstimated={Number(project.budgetEstimated)}
                                    />
                                    {showArchiveButton && project.lifecycleStatus === 'ACTIVE' && (
                                        <ArchiveProjectButton projectId={project.id} />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <div className="flex items-center mb-1">
                                    <p className="text-sm font-medium text-slate-500">Zaksięgowane Przychody</p>
                                </div>
                                <p className="text-xl font-bold text-slate-800">{formatPln(totalInvoiced)}</p>
                                <p className="text-xs text-slate-400 mt-1">Z {project.invoices.length} faktur</p>
                            </div>

                            <div>
                                <div className="flex items-center mb-1">
                                    <p className="text-sm font-medium text-slate-500">Poniesione Koszty</p>
                                </div>
                                <p className="text-xl font-bold text-red-600">{formatPln(totalCosts)}</p>
                                <p className="text-xs text-slate-400 mt-1">Z {project.transactions.filter((t: any) => t.type === 'KOSZT').length} transakcji</p>
                            </div>

                            <div className="pl-6 border-l border-slate-200">
                                <div className="flex items-center mb-1">
                                    <p className="text-sm font-medium text-slate-500">Obecna Marża Zysku</p>
                                </div>
                                <p className={`text-2xl font-bold ${isLoss ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatPln(currentMargin)}
                                </p>
                            </div>
                        </div>
                    </div>
                )
            })}

            {projects.length === 0 && (
                <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-4">
                        <span className="text-xl">📁</span>
                    </div>
                    <p className="text-slate-500 italic">Brak projektów w tej kategorii.</p>
                </div>
            )}
        </div>
    )

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
                    <TabsTrigger value="active">Aktywne ({activeProjects.length})</TabsTrigger>
                    <TabsTrigger value="archive">Archiwum ({archivedProjects.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="active">
                    <ProjectList projects={activeProjects} />
                </TabsContent>

                <TabsContent value="archive">
                    <ProjectList projects={archivedProjects} showArchiveButton={false} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
