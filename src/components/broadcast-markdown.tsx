import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders broadcast/notice body as rich markdown.
 * Supports: **bold**, *italic*, # headings, - bullet lists, 1. numbered lists,
 * [links](url), `code`, > blockquotes, --- dividers, and emojis.
 */
export function BroadcastMarkdown({ children, muted = false }: { children: string; muted?: boolean }) {
  const textCls = muted ? "text-[#7D6452]" : "text-[#4A3728]";
  const strongCls = muted ? "text-[#5A4434]" : "text-[#2D1B0D]";
  return (
    <div className={`text-sm sm:text-[15px] leading-relaxed ${textCls} broadcast-md space-y-2`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className={`text-base sm:text-lg font-extrabold ${strongCls} mt-3 mb-1`}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className={`text-[15px] sm:text-base font-extrabold ${strongCls} mt-3 mb-1`}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className={`text-sm sm:text-[15px] font-bold ${strongCls} mt-2 mb-1`}>{children}</h3>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className={`font-bold ${strongCls}`}>{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 marker:text-[#FF7E5F]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 marker:text-[#FF7E5F] marker:font-bold">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF7E5F] underline underline-offset-2 font-medium hover:text-[#FEB47B]"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded bg-[#FFF1E5] text-[#2D1B0D] text-[0.9em] font-mono">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#FF7E5F] pl-3 italic text-[#7D6452] bg-[#FFF9F5] py-1 rounded-r">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-t border-[#FFEDD5] my-3" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
