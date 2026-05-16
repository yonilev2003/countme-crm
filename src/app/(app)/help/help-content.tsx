"use client";

import { useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { HELP_SECTIONS, type HelpBlock } from "@/lib/help-content";

type IconComponent = React.ComponentType<{ className?: string }>;

function getIcon(name: string): IconComponent {
  const candidate = (Icons as unknown as Record<string, IconComponent>)[name];
  return candidate ?? (Icons.HelpCircle as IconComponent);
}

export function HelpContent() {
  const [activeId, setActiveId] = useState<string>(HELP_SECTIONS[0]?.id ?? "");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top) setActiveId(top.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    for (const id of Object.keys(sectionRefs.current)) {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  function scrollToId(id: string) {
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <aside className="top-20 shrink-0 lg:sticky lg:w-56">
        <nav className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 px-2 text-xs font-semibold text-slate-500">
            תוכן עניינים
          </p>
          <ul className="space-y-0.5">
            {HELP_SECTIONS.map((s) => {
              const Icon = getIcon(s.iconName);
              const active = activeId === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => scrollToId(s.id)}
                    className={
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition " +
                      (active
                        ? "bg-brand-50 text-brand-800 font-semibold"
                        : "text-slate-700 hover:bg-slate-50")
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <main className="min-w-0 flex-1 space-y-10">
        {HELP_SECTIONS.map((s) => {
          const Icon = getIcon(s.iconName);
          return (
            <section
              key={s.id}
              id={s.id}
              ref={(el) => {
                sectionRefs.current[s.id] = el;
              }}
              className="scroll-mt-20"
            >
              <header className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  {s.title}
                </h2>
              </header>
              <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
                {s.body.map((b, idx) => (
                  <Block key={idx} block={b} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

function Block({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p>{block.text}</p>;
    case "heading":
      return (
        <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">
          {block.text}
        </h3>
      );
    case "list":
      return (
        <ul className="list-disc space-y-1.5 ps-6">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "tip":
      return (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <span className="me-1.5 font-semibold">💡 טיפ:</span>
          {block.text}
        </div>
      );
    case "code":
      return (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-800">
          {block.text}
        </code>
      );
  }
}
