"use client";

import { X } from "lucide-react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AdminSidebarPanel } from "@/components/admin/AdminSidebar";

interface AdminMobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Slide-in admin navigation for tablet/mobile. Reuses AdminSidebarPanel so the
 * destinations and account menu match the desktop sidebar exactly.
 */
export function AdminMobileSidebar({ open, onOpenChange }: AdminMobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-72 gap-0 bg-[#0b1220] p-0 text-slate-200 sm:max-w-72"
      >
        <SheetTitle className="sr-only">Admin navigation</SheetTitle>

        <AdminSidebarPanel onNavigate={() => onOpenChange(false)} />

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

export default AdminMobileSidebar;
