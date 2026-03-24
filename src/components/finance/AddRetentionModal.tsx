"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle, Plus, X, Search } from "lucide-react"
import { addRetention } from "@/app/actions/retentions"
import { createContractor } from "@/app/actions/crm"
import { createProject } from "@/app/actions/projects"

interface AddRetentionModalProps {
    projects: { id: string, name: string, contractorId?: string }[]
    contractors: { id: string, name: string }[]
}

export function AddRetentionModal({ projects, contractors }: AddRetentionModalProps) {
    const [open, setOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)

    const [localProjects, setLocalProjects] = useState(projects)
    const [localContractors, setLocalContractors] = useState(contractors)

    const [isAddingContractor, setIsAddingContractor] = useState(false)
    const [newContractorName, setNewContractorName] = useState("")
    const [isAddingProject, setIsAddingProject] = useState(false)
    const [newProjectName, setNewProjectName] = useState("")

    const [selectedContractorId, setSelectedContractorId] = useState("")
    const [selectedProjectId, setSelectedProjectId] = useState("")

    async function handleSubmit(formData: FormData) {
        setIsPending(true)
        try {
            const res = await addRetention(formData)
            if (res.success) {
                setOpen(false)
                // Reset states
                setIsAddingContractor(false)
                setIsAddingProject(false)
                setNewContractorName("")
                setNewProjectName("")
                setSelectedContractorId("")
                setSelectedProjectId("")
            } else {
                alert("Błąd: " + res.error)
            }
        } catch (error) {
            console.error(error)
            alert("Wystąpił nieoczekiwany błąd.")
        } finally {
            setIsPending(false)
        }
    }

    async function handleQuickAddContractor() {
        if (!newContractorName.trim()) return
        setIsPending(true)
        try {
            const res = await createContractor({ name: newContractorName, type: "INWESTOR" })
            if (res.success && res.id) {
                const newContractor = { id: res.id, name: newContractorName }
                setLocalContractors(prev => [...prev, newContractor])
                setSelectedContractorId(res.id)
                setIsAddingContractor(false)
                setNewContractorName("")
            }
        } catch (error) {
            alert("Błąd podczas dodawania firmy.")
        } finally {
            setIsPending(false)
        }
    }

    async function handleQuickAddProject() {
        if (!newProjectName.trim() || !selectedContractorId) {
            if (!selectedContractorId) alert("Najpierw wybierz lub dodaj firmę/inwestora.")
            return
        }
        setIsPending(true)
        try {
            const res = await createProject({ name: newProjectName, contractorId: selectedContractorId })
            if (res.success && res.id) {
                const newProject = { id: res.id, name: newProjectName, contractorId: selectedContractorId }
                setLocalProjects(prev => [...prev, newProject])
                setSelectedProjectId(res.id)
                setIsAddingProject(false)
                setNewProjectName("")
            }
        } catch (error) {
            alert("Błąd podczas dodawania projektu.")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-dashed">
                    <PlusCircle className="w-4 h-4" />
                    Dodaj Ręcznie
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Dodaj Kaucję Gwarancyjną</DialogTitle>
                    <DialogDescription>
                        Wprowadź środki zamrożone u inwestora, które nie wynikają z automatycznej kaucji projektowej.
                    </DialogDescription>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Kwota (PLN)</Label>
                            <Input id="amount" name="amount" type="number" step="0.01" required placeholder="0.00" autoFocus />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="type">Typ Kaucji</Label>
                            <select
                                id="type"
                                name="type"
                                className="w-full flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                                required
                            >
                                <option value="SHORT_TERM">Krótkoterminowa</option>
                                <option value="LONG_TERM">Długoterminowa</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="expiryDate">Data Wygaśnięcia (Zwrotu)</Label>
                        <Input id="expiryDate" name="expiryDate" type="date" required />
                    </div>

                    <div className="space-y-2">
                        <Label>Firma / Inwestor *</Label>
                        {!isAddingContractor ? (
                            <div className="flex gap-2">
                                <select
                                    name="contractorId"
                                    value={selectedContractorId}
                                    onChange={(e) => setSelectedContractorId(e.target.value)}
                                    className="flex-1 h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                                    required
                                >
                                    <option value="">-- Wybierz firmę --</option>
                                    {localContractors.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setIsAddingContractor(true)}
                                    title="Dodaj nową firmę"
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nazwa nowej firmy..."
                                    value={newContractorName}
                                    onChange={(e) => setNewContractorName(e.target.value)}
                                    className="flex-1"
                                    autoFocus
                                />
                                <Button
                                    type="button"
                                    onClick={handleQuickAddContractor}
                                    disabled={isPending}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3"
                                >
                                    Dodaj
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setIsAddingContractor(false)
                                        setNewContractorName("")
                                    }}
                                >
                                    <X className="w-4 h-4 text-slate-400" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Projekt (Opcjonalnie)</Label>
                        {!isAddingProject ? (
                            <div className="flex gap-2">
                                <select
                                    name="projectId"
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                    className="flex-1 h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                                >
                                    <option value="">-- Brak powiązania --</option>
                                    {localProjects
                                        .filter(p => !selectedContractorId || p.contractorId === selectedContractorId)
                                        .map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))
                                    }
                                </select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setIsAddingProject(true)}
                                    title="Dodaj nowy projekt"
                                    disabled={!selectedContractorId}
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nazwa nowego projektu..."
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    className="flex-1"
                                    autoFocus
                                />
                                <Button
                                    type="button"
                                    onClick={handleQuickAddProject}
                                    disabled={isPending}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3"
                                >
                                    Dodaj
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setIsAddingProject(false)
                                        setNewProjectName("")
                                    }}
                                >
                                    <X className="w-4 h-4 text-slate-400" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Opis / Uwagi</Label>
                        <Input id="description" name="description" placeholder="np. Kaucja przejęta z firmy XYZ" />
                    </div>

                    <input type="hidden" name="source" value="MANUAL" />

                    <DialogFooter className="pt-4">
                        <Button type="submit" disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                            {isPending ? "Zapisywanie..." : "Zarejestruj Kaucję"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
