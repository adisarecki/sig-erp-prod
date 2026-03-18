"use client"

import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

interface ActionItem {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: 'danger' | 'default' | 'primary';
}

interface FloatingActionBarProps {
    selectedCount: number;
    actions: ActionItem[];
    onClearSelection: () => void;
}

export function FloatingActionBar({ selectedCount, actions, onClearSelection }: FloatingActionBarProps) {
    if (selectedCount === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl border border-slate-700/50"
            >
                <div className="flex items-center gap-3 pr-4 border-r border-slate-700">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 font-bold text-sm">
                        {selectedCount}
                    </span>
                    <span className="font-semibold text-sm hidden sm:inline">Wybrane rekordy</span>
                </div>

                <div className="flex items-center gap-2">
                    {actions.map((action, idx) => (
                        <button
                            key={idx}
                            onClick={action.onClick}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all 
                                ${action.variant === 'danger' ? 'hover:bg-rose-500/20 text-rose-300 hover:text-rose-200' :
                                action.variant === 'primary' ? 'bg-blue-600 hover:bg-blue-500 text-white' :
                                'hover:bg-slate-800 text-slate-300 hover:text-white'}`}
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClearSelection}
                    className="ml-2 p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </motion.div>
        </AnimatePresence>
    )
}
