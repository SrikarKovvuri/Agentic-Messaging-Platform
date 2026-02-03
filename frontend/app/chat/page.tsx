import { Suspense } from "react";
import ChatClient from "./ChatClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading chat…</div>}>
      <ChatClient />
    </Suspense>
  );
}
