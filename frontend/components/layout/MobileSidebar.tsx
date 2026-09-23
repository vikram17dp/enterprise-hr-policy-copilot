"use client";

import { X } from "lucide-react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarPanel } from "@/components/layout/Sidebar";

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Slide-in navigation for tablet/mobile. Reuses the same SidebarPanel as the
 * desktop sidebar so navigation stays consistent.
 */
export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-72 gap-0 bg-[#0b1220] p-0 text-slate-200 sm:max-w-72"
      >
        <SheetTitle className="sr-only">Employee navigation</SheetTitle>

        <SidebarPanel onNavigate={() => onOpenChange(false)} />

        <SheetClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-3 top-3.5 text-slate-400 hover:bg-white/10 hover:text-white"
            />
          }
        >
          <X className="size-4" aria-hidden />
          <span className="sr-only">Close menu</span>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}

export default MobileSidebar;
