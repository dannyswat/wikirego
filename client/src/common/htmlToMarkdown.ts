import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const turndownService = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
  headingStyle: "atx",
});

turndownService.use(gfm);

turndownService.remove(["script", "style"]);

export function convertHtmlToMarkdown(html: string) {
  if (!html.trim()) {
    return "";
  }

  return turndownService.turndown(html).trim();
}