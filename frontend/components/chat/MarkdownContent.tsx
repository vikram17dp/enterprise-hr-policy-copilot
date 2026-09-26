"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders LLM/assistant output as Markdown.
 *
 * The backend returns Markdown (bold, headings, lists, links, GFM tables, fenced
 * code). We render it with `react-markdown` + `remark-gfm` — never by stripping
 * characters, regex-to-HTML, or `dangerouslySetInnerHTML`. This project has no
 * `@tailwindcss/typography`, so each element is mapped to Tailwind classes that
 * match the existing chat styling.
 */

const components: Components = {
  p: ({ children }) => (
    <p className="my-2 leading-6 first:mt-0 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => (
    <h1 className="mt-3 mb-2 text-base font-semibold text-slate-900 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-2 text-[15px] font-semibold text-slate-900 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold text-slate-900 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2 mb-1 text-sm font-semibold text-slate-800 first:mt-0">
      {children}
    </h4>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-6">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-words text-blue-600 underline underline-offset-2 hover:text-blue-700"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-slate-300 pl-3 italic text-slate-600">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-slate-200" />,
  // Fenced code block container.
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[13px] leading-5 text-slate-100">
      {children}
    </pre>
  ),
  // Inline vs block code: block code has a `language-*` class or spans lines.
  code: ({ className, children, node }) => {
    const text = String(children ?? "");
    const isBlock =
      /language-/.test(className || "") ||
      text.includes("\n") ||
      (node?.position != null &&
        node.position.start.line !== node.position.end.line);

    if (isBlock) {
      return (
        <code className="block font-mono text-[13px] leading-5 whitespace-pre text-slate-100">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-2 w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="border border-slate-200 px-2.5 py-1.5 text-left font-semibold text-slate-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-slate-200 px-2.5 py-1.5 align-top text-slate-600">
      {children}
    </td>
  ),
};

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="break-words text-slate-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownContent;
