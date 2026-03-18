"use client"

import { useState } from "react"
import { Plus, Trash2, Edit2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { addProjectStage, updateProjectStage, deleteProjectStage } from "@/app/actions/stages"

interface Stage {
    id: string;
    name: string;
    budgetEstimated: number;
    status: string;
}

interface ProjectStageListProps {
    projectId: string;
    stages: Stage[];
}

export function ProjectStageList({ projectId, stages }: ProjectStageListProps) {
    const [isAdding, setIsAdding] = useState(false)
    const [newName, setNewName] = useState("")
    const [newBudget, setNewBudget] = useState("")
    
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [editBudget, setEditBudget] = useState("")

    const handleAdd = async () => {
        if (!newName) return
        const result = await addProjectStage(projectId, newName, parseFloat(newBudget) || 0)
        if (result.success) {
            setIsAdding(false)
            setNewName("")
            setNewBudget("")
        }
    }

    const handleUpdate = async (id: string) => {
        const result = await updateProjectStage(id, editName, parseFloat(editBudget) || 0)
        if (result.success) {
            setEditingId(null)
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("Czy na pewno chcesz usunąć ten etap?")) {
            await deleteProjectStage(id, projectId)
        }
    }

    const formatPln = (value: number) => {
        return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value)
    }

    return (
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-lg font-bold">Struktura Projektu (Etapy)</CardTitle>
                {!isAdding && (
                    <Button size="sm" onClick={() => setIsAdding(true)} className="bg-slate-900 text-white hover:bg-slate-800">
                        <Plus className="w-4 h-4 mr-1" /> Dodaj Etap
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-3">
                {isAdding && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
                        <Input 
                            placeholder="Nazwa etapu" 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)}
                            className="flex-1 bg-white"
                        />
                        <Input 
                            type="number" 
                            placeholder="Budżet" 
                            value={newBudget} 
                            onChange={e => setNewBudget(e.target.value)}
                            className="w-32 bg-white"
                        />
                        <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={handleAdd} className="text-green-600 hover:bg-green-50">
                                <Check className="w-5 h-5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)} className="text-red-600 hover:bg-red-50">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                )}

                {stages.length === 0 && !isAdding && (
                    <p className="text-center py-8 text-slate-500 italic">Brak zdefiniowanych etapów.</p>
                )}

                {stages.map(stage => (
                    <div key={stage.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition group bg-white">
                        {editingId === stage.id ? (
                            <div className="flex flex-1 items-center gap-3">
                                <Input 
                                    value={editName} 
                                    onChange={e => setEditName(e.target.value)}
                                    className="flex-1 bg-white"
                                />
                                <Input 
                                    type="number" 
                                    value={editBudget} 
                                    onChange={e => setEditBudget(e.target.value)}
                                    className="w-32 bg-white"
                                />
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" onClick={() => handleUpdate(stage.id)} className="text-green-600 hover:bg-green-50">
                                        <Check className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="text-red-600 hover:bg-red-50">
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-slate-900">{stage.name}</h4>
                                    <p className="text-xs text-slate-500 uppercase font-black tracking-tight">Budżet: {formatPln(stage.budgetEstimated)}</p>
                                </div>
                                <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition">
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        onClick={() => {
                                            setEditingId(stage.id)
                                            setEditName(stage.name)
                                            setEditBudget(stage.budgetEstimated.toString())
                                        }}
                                        className="h-8 w-8"
                                    >
                                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDelete(stage.id)} className="h-8 w-8 hover:bg-red-50">
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
