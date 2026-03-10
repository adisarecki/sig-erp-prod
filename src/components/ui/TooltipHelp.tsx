import { HelpCircle } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface TooltipHelpProps {
    content: string | React.ReactNode;
}

export function TooltipHelp({ content }: TooltipHelpProps) {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button type="button" className="inline-flex cursor-help ml-2 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1">
                        <HelpCircle className="w-4 h-4 text-slate-400 hover:text-blue-500 transition-colors duration-200" />
                        <span className="sr-only">Więcej informacji</span>
                    </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px] bg-slate-900 text-white font-medium border-none shadow-lg">
                    <p className="text-xs leading-relaxed">{content}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
