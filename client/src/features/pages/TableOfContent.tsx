import { useEffect, useState } from 'react';

interface Heading {
    id: string;
    text: string;
    level: number;
}

interface TableOfContentProps {
    title: string;
    content: string;
}

export default function TableOfContent({ title, content }: TableOfContentProps) {
    const [headings, setHeadings] = useState<Heading[]>([]);

    useEffect(() => {
        // Parse the HTML content to extract headings
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const headingElements = doc.querySelectorAll('h1, h2, h3, h4');

        const extractedHeadings: Heading[] = Array.from(headingElements).map((heading, index) => {
            const text = heading.textContent || '';
            const level = parseInt(heading.tagName.charAt(1));
            // Generate an ID if it doesn't exist
            let id = heading.id;
            if (!id) {
                id = `heading-${index}-${text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
                heading.id = id;
            }

            return { id, text, level };
        });

        // Adjust levels if no h1 exists - treat h2 as level 1, h3 as level 2
        const hasH1 = extractedHeadings.some(heading => heading.level === 1);
        const hasH2 = extractedHeadings.some(heading => heading.level === 2);
        const adjust = (hasH1 ? 0 : 1) + (hasH2 ? 0 : 1);
        const adjustedHeadings = extractedHeadings.map(heading => ({
            ...heading,
            level: hasH1 ? heading.level : heading.level - adjust
        }));

        setHeadings(adjustedHeadings);

        // Update the actual DOM elements with IDs for navigation
        const ckContent = document.querySelector('.ck-content');
        if (ckContent) {
            const realHeadings = ckContent.querySelectorAll('h1, h2, h3, h4');
            realHeadings.forEach((heading, index) => {
                if (!heading.id && extractedHeadings[index]) {
                    heading.id = extractedHeadings[index].id;
                }
            });
        }
    }, [content]);

    const scrollToHeading = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    if (headings.length === 0) {
        return null;
    }

    return (
        <aside className="hidden xl:block">
            <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                    <h4 className="text-sm font-medium text-[#1e5770] dark:text-[#92A7B4]">On this page</h4>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{title || 'Table of Contents'}</p>
                </div>
                <nav className="pt-1">
                    <ul className="space-y-1">
                        {headings.map(({ id, text, level }) => (
                            <li key={id}>
                                <button
                                    onClick={() => scrollToHeading(id)}
                                    className={`block w-full rounded-md py-1.5 text-left text-sm leading-5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#2d6880] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-[#92A7B4] ${level === 1
                                            ? 'ps-1'
                                            : level === 2
                                                ? 'ps-4'
                                                : level === 3
                                                    ? 'ps-7'
                                                    : level === 4
                                                        ? 'ps-10'
                                                        : 'ps-1'
                                        }`}
                                >
                                    {text}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </aside>
    );
}
