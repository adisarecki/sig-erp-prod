export const dynamic = "force-dynamic"
import { getProjects } from '@/app/actions/projects'
import { getContractors } from '@/app/actions/crm'
import { AddProjectModal } from '@/components/projects/AddProjectModal'
import { InteractiveProjectList } from '@/components/projects/InteractiveProjectList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function ProjectsPage() {
    // Firestore – dane jako plain objects (bez Decimal)
    const allProjects = (await getProjects()) as any[]

    const rawContractors = (await getContractors()) as any[]
    const contractors = rawContractors.map(c => ({ id: c.id, name: c.name }))

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