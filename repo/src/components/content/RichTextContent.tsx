import { PortableText } from "@portabletext/react";
import type { PortableBlock } from "@/types";

export function RichTextContent({ value }: { value: PortableBlock[] }) {
  return (
    <PortableText
      value={value}
      components={{
        block: {
          normal: ({ children }) => (
            <p className="font-body text-base leading-relaxed text-ivory/70 md:text-lg">
              {children}
            </p>
          ),
          h2: ({ children }) => (
            <h2 className="font-display text-2xl font-medium text-ivory md:text-3xl">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-display text-xl font-medium text-ivory md:text-2xl">
              {children}
            </h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l border-gold/40 pl-6 font-display text-2xl leading-relaxed text-ivory">
              {children}
            </blockquote>
          ),
        },
        list: {
          bullet: ({ children }) => (
            <ul className="space-y-3 pl-5 font-body text-base text-ivory/70 md:text-lg">
              {children}
            </ul>
          ),
          number: ({ children }) => (
            <ol className="space-y-3 pl-5 font-body text-base text-ivory/70 md:text-lg">
              {children}
            </ol>
          ),
        },
        listItem: {
          bullet: ({ children }) => <li className="list-disc">{children}</li>,
          number: ({ children }) => <li className="list-decimal">{children}</li>,
        },
        marks: {
          link: ({ children, value }) => (
            <a
              href={typeof value?.href === "string" ? value.href : "#"}
              className="text-gold transition-colors hover:text-gold-light"
            >
              {children}
            </a>
          ),
        },
      }}
    />
  );
}
