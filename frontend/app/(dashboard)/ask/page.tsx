import { PageHeader } from "@/components/shared/Header";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { MobileConversationDrawer } from "@/components/chat/MobileConversationDrawer";

interface AskPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

/**
 * Route: /ask
 * Professional AI chat interface with a ChatGPT-style conversation rail.
 * Supports prefill via ?q= (used by the dashboard question box and quick
 * questions). Sending the first message creates a conversation and the URL is
 * replaced with /chat/{id} so a refresh reloads it.
 */
export default async function AskPage({ searchParams }: AskPageProps) {
  const params = await searchParams;
  const raw = params.q;
  const query = Array.isArray(raw) ? raw[0] : raw;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ask a Question"
        description="Get accurate answers based on your organization's HR policies."
        actions={<MobileConversationDrawer />}
      />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <ConversationSidebar />
        </div>
        <ChatWindow initialQuery={query} conversationId={null} />
      </div>
    </div>
  );
}
