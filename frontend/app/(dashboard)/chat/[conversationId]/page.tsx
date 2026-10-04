import { PageHeader } from "@/components/shared/Header";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";

/**
 * Route: /chat/{conversationId}
 *
 * Opens a saved conversation so it can be viewed and continued. The id lives in
 * the URL, so a browser refresh (or opening the link directly) reloads the same
 * conversation. The backend verifies the authenticated user owns it and returns
 * 404 otherwise, so another user's conversation can never be exposed by editing
 * the id.
 */
interface ChatPageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { conversationId } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversation"
        description="Continue your previous HR policy conversation."
      />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <ConversationSidebar />
        </div>
        <ChatWindow conversationId={conversationId} />
      </div>
    </div>
  );
}
