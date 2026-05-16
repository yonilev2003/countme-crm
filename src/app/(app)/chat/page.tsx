import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ChannelList } from "@/components/chat/channel-list";
import { loadChannelSidebar } from "./_data";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { channels, unreadCounts } = await loadChannelSidebar(supabase, user.id);

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] min-h-0 flex-1 overflow-hidden">
      <aside className="hidden w-72 shrink-0 border-e border-slate-200 bg-white md:flex md:flex-col">
        <ChannelList
          channels={channels}
          unreadCounts={unreadCounts}
          activeChannelId={null}
        />
      </aside>

      <main className="flex min-w-0 flex-1 items-center justify-center bg-slate-50">
        <div className="flex max-w-md flex-col items-center px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <MessageSquare className="h-8 w-8" aria-hidden />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-slate-900">
            ברוכים הבאים לצ׳אט
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            בחר ערוץ או שיחה כדי להתחיל
          </p>
        </div>
      </main>
    </div>
  );
}
