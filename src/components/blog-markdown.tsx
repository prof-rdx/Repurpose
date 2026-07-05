import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

/**
 * Isolated entry so the markdown stack (react-markdown, remark, rehype)
 * lives in its own chunk, loaded only when a job's blog tab is rendered.
 */
export default function BlogMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
      {content}
    </ReactMarkdown>
  );
}
