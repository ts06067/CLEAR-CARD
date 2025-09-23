import { useState } from "react";
import { motion } from "motion/react";
import { Copy } from "lucide-react";

export default function SqlPreview({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // noop
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">Preview only. Executed on submit.</div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="btn btn-ghost"
          onClick={onCopy}
          title="Copy SQL"
        >
          <Copy className="h-4 w-4 mr-2" />
          {copied ? "Copied" : "Copy"}
        </motion.button>
      </div>
      <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-3 overflow-auto max-h-[60vh]">
{sql}
      </pre>
    </div>
  );
}
