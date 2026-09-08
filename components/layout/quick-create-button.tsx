"use client";

import { Briefcase, FileText, ListChecks, Plus, User, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@doscientos/ui";
import { CREATE_SHORTCUTS } from "@/lib/navigation/shortcuts";
import { cn } from "@/lib/utils";

const ICON_BY_HREF: Record<string, React.ComponentType<{ className?: string }>> = {
  "/leads/new": User,
  "/clients/new": Users,
  "/projects/new": Briefcase,
  "/tasks/new": ListChecks,
  "/proposals/new": FileText,
};

export function QuickCreateButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-end px-4 md:px-6">
      <div className="pointer-events-auto">
        <DropdownMenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
          <Button
            size="lg"
            className="h-12 gap-2 rounded-full px-4 shadow-lg sm:w-12 sm:px-0"
            aria-label="Acciones rápidas (C + tecla)"
          >
            <Plus className={cn("h-5 w-5 transition-transform", isOpen && "rotate-45")} />
            <span className="sm:hidden">Crear</span>
          </Button>
          <DropdownMenuContent placement="top end" offset={8} className="min-w-56">
            <DropdownMenuLabel className="flex items-center justify-between">
              Crear nuevo
              <span className="text-muted-foreground text-[10px] font-normal uppercase">
                Atajos: C + …
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CREATE_SHORTCUTS.map((action) => {
              const Icon = ICON_BY_HREF[action.href] ?? Plus;
              return (
                <DropdownMenuItem
                  key={action.href}
                  href={action.href}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </div>
                  <span className="text-muted-foreground font-mono text-[10px] uppercase">
                    C {action.key}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenuTrigger>
      </div>
    </div>
  );
}
