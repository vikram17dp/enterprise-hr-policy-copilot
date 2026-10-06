"use client";

import { useState } from "react";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";

/**
 * Mobile/tablet access to the conversation rail.
 *
 * On >= lg the chat pages show the ConversationSidebar inline beside the chat
 * surface. Below lg that rail is hidden, so this control gives phone/tablet
 * users the same New Chat / open / rename / delete capabilities in a slide-in
 * drawer. Purely presentational — it only toggles a Sheet and reuses the
 * existing ConversationSidebar; no data or navigation logic is duplicated.
 */
export function MobileConversationDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 rounded-lg border-slate-300 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
      >
        <History className="size-4" aria-hidden />
        Conversations
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-80 max-w-[85vw] gap-0 p-0 sm:max-w-80"
        >
          <SheetTitle className="sr-only">Your conversations</SheetTitle>
          <ConversationSidebar
            onNavigate={() => setOpen(false)}
            className="h-full min-h-0 rounded-none border-0 shadow-none"
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

export default MobileConversationDrawer;
