import { PageHeader } from "@/components/shared/Header";
import { ChatWindow } from "@/components/chat/ChatWindow";

interface AskPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

/**
 * Route: /ask
 * Professional AI chat interface. Supports prefill via ?q= (used by the
 * dashboard question box and quick questions).
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
      />
      <ChatWindow initialQuery={query} />
    </div>
  );
}
