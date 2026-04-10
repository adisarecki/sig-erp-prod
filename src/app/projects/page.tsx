export const dynamic = "force-dynamic"
import { getProjects } from '@/app/actions/projects'
import { getContractors } from '@/app/actions/crm'
import { AddProjectModal } from '@/components/projects/AddProjectModal'
import { InteractiveProjectList } from '@/components/projects/InteractiveProjectList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAdminDb } from "@/lib/firebaseAdmin"
import { getCurrentTenantId } from "@/lib/tenant"

export default async function ProjectsPage() {
    const tenantId = await getCurrentTenantId()
    const rawProjects = (await getProjects()) as any[]

    // Fetch all related data in bulk to avoid N+1
    const adminDb = getAdminDb()
    const [contractorsSnap, objectsSnap, invoicesSnap, transactionsSnap] = await Promise.all([
        adminDb.collection("contractors").where("tenantId", "==", tenantId).get(),
        adminDb.collection("objects").where("contractorId", "!=", "").get(), // Objects are currently linked to contractors, not tenants directly in schema
        adminDb.collection("invoices").where("tenantId", "==", tenantId).get(),
        adminDb.collection("transactions").where("tenantId", "==", tenantId).get()
    ])

    const allContractors = contractorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))
    const allObjects = objectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))
    const allInvoices = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))
    const allTransactions = transactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))

    // Merge everything into "fat" project objects
    const allProjects = rawProjects.map(p => ({
        ...p,
        contractor: allContractors.find(c => c.id === p.contractorId) || { name: "Brak danych" },
        object: allObjects.find(o => o.id === p.objectId) || { name: "Brak danych", address: "Brak adresu" },
        invoices: allInvoices.filter(inv => inv.projectId === p.id),
        transactions: allTransactions.filter(t => t.projectId === p.id)
    }))

    const contractors = allContractors

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
                    <InteractiveProjectList projects={activeProjects} contractors={contractors} />
                </TabsContent>

                <TabsContent value="archive">
                    <InteractiveProjectList projects={archivedProjects} contractors={contractors} isArchivedView={true} />
                </TabsContent>
            </Tabs>
        </div>
    )
}