import { PageMeta } from "./pageApi";
import { smartCompare } from "./smartCompare";

export interface PageMetaObject extends PageMeta {
    children: PageMetaObject[];
}

export function findItemHierarchyInTree(tree: PageMetaObject[], url: string): PageMetaObject[] {
    for (const item of tree) {
        if (item.url === url) return [item];
        const found = findItemHierarchyInTree(item.children, url);
        if (found.length) return [item, ...found];
    }
    return [];
}

export function findItemInTree(tree: PageMetaObject[], url: string): PageMetaObject | null {
    for (const item of tree) {
        if (item.url === url) return item;
        const found = findItemInTree(item.children, url);
        if (found) return found;
    }
    return null;
}

export function buildTree(pages: PageMeta[]): PageMetaObject[] {
    pages.sort(function (a, b) {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return smartCompare(a.title, b.title);
    });
    const allPages: PageMetaObject[] = pages.map((page) => ({
        ...page,
        children: [],
    }));

    return buildTreeInternal(allPages, undefined);
}

function buildTreeInternal(
    allPages: PageMetaObject[],
    parent?: PageMetaObject
): PageMetaObject[] {
    let pages = allPages.filter(
        (page) => page.parentId === (parent ? parent.id : null)
    );
    pages.sort(function (a, b) {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return smartCompare(a.title, b.title);
    });
    if (parent?.sortChildrenDesc) pages = pages.filter(p => p.isPinned).concat(pages.filter(p => !p.isPinned).reverse());
    for (const page of pages) {
        page.children = buildTreeInternal(allPages, page);
        parent?.children.push(page);
    }
    return pages;
}