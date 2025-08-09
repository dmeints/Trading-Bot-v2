import { Link } from "wouter";
import { Activity } from "lucide-react";

export function Navigation() {
  return (
    <nav className="flex gap-4 p-4 bg-gray-100 dark:bg-gray-800">
      <Link href="/health" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
        <Activity className="h-4 w-4" />
        Health
      </Link>
    </nav>
  );
}