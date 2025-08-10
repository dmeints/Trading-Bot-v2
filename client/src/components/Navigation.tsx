import { Link } from "wouter";
import { Activity, Database, Bot, MessageSquare } from "lucide-react";

export function Navigation() {
  return (
    <nav className="flex gap-4 p-4 bg-gray-100 dark:bg-gray-800">
      <Link href="/health" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
        <Activity className="h-4 w-4" />
        Health
      </Link>
      <Link href="/connectors-demo" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
        <Database className="h-4 w-4" />
        Phase A - Connectors
      </Link>
      <Link href="/ai-chat" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
        <Bot className="h-4 w-4" />
        Phase B - AI Chat
      </Link>
      <Link href="/execution" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
        <MessageSquare className="h-4 w-4" />
        Phase J - Execution
      </Link>
    </nav>
  );
}