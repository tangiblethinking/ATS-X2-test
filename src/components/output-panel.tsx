import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  LoaderCircle,
  Pencil,
  Printer,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AuditResult, KeywordSet } from "@/lib/pipeline-types";

type Props = {
  html: string | null;
  keywords: KeywordSet | null;
  audit: AuditResult | null;
  pipelineComplete?: boolean;
  rewriting?: boolean;
  customizing?: boolean;
  busy?: boolean;
  onRewrite?: () => void;
  onCustomize?: (instructions: string) => void;
};

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch {
    toast.error("Could not copy. Select the text instead.");
  }
}

function downloadHtml(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "resume-ats.html";
  a.click();
  URL.revokeObjectURL(url);
}

function withPrintHints(html: string): string {
  const printCss = `
@media print {
  html, body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @page {
    size: letter;
    margin: 0.4in;
  }
}
`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `<style data-ats-print>${printCss}</style></head>`);
  }
  if (/<html\b/i.test(html)) {
    return html.replace(
      /<html\b[^>]*>/i,
      (m) => `${m}<head><meta charset="utf-8"><style data-ats-print>${printCss}</style></head>`,
    );
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style data-ats-print>${printCss}</style></head><body>${html}</body></html>`;
}

function openResumeForPrint(html: string) {
  const docHtml = withPrintHints(html);
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Pop-up blocked. Allow pop-ups for this site, then try again.");
    return;
  }
  win.document.open();
  win.document.write(docHtml);
  win.document.close();
  win.document.title = "resume-ats";
  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      toast.message("Resume opened in a new tab — use Print → Save as PDF.");
    }
  };
  if (win.document.readyState === "complete") {
    window.setTimeout(runPrint, 400);
  } else {
    win.addEventListener("load", () => window.setTimeout(runPrint, 400));
    window.setTimeout(runPrint, 1500);
  }
  toast.success('Print dialog opened — choose "Save as PDF".');
}

function openResumeInTab(html: string) {
  const docHtml = withPrintHints(html);
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Pop-up blocked. Allow pop-ups for this site, then try again.");
    return;
  }
  win.document.open();
  win.document.write(docHtml);
  win.document.close();
  win.document.title = "resume-ats";
  win.focus();
  toast.success("Resume opened in a new tab.");
}

export function OutputPanel({
  html,
  keywords,
  audit,
  pipelineComplete = false,
  rewriting = false,
  customizing = false,
  busy = false,
  onRewrite,
  onCustomize,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [instructions, setInstructions] = useState("");

  if (!html && !keywords) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl bg-secondary/60 px-6 py-10 text-center">
        <p className="font-display text-lg text-foreground">No output yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Save an API key, add a job URL and your resume HTML, then run the
          six-step pipeline.
        </p>
      </div>
    );
  }

  const showPostActions = pipelineComplete && Boolean(html);

  function submitCustomize() {
    const trimmed = instructions.trim();
    if (trimmed.length < 3) {
      toast.error("Enter edit instructions.");
      return;
    }
    setCustomizeOpen(false);
    onCustomize?.(trimmed);
    setInstructions("");
  }

  return (
    <>
      <Tabs defaultValue={html ? "preview" : "keywords"} className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
          {html ? (
            <div className="flex flex-wrap gap-2">
              {showPostActions ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onRewrite?.()}
                  >
                    {rewriting ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    {rewriting ? "Rewriting…" : "Rewrite"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      if (busy) return;
                      setCustomizeOpen(true);
                    }}
                  >
                    {customizing ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <Pencil className="size-3.5" />
                    )}
                    {customizing ? "Customizing…" : "Customize"}
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  await copyText("HTML", html);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Copy HTML
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => downloadHtml(html)}>
                <Download className="size-3.5" />
                HTML
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openResumeInTab(html)}
              >
                Open
              </Button>
              <Button
                type="button"
                variant="paper"
                size="sm"
                onClick={() => openResumeForPrint(html)}
              >
                <Printer className="size-3.5" />
                PDF / Print
              </Button>
            </div>
          ) : null}
        </div>

        {(rewriting || customizing) && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm">
            <LoaderCircle className="size-4 animate-spin shrink-0" />
            <span className="shimmer-text font-medium">
              {rewriting ? "Rewriting output…" : "Customizing…"}
            </span>
            <span className="text-xs text-muted-foreground">Please wait. Do not start another task.</span>
          </div>
        )}

        <TabsContent value="preview">
          {html ? (
            <div className="overflow-hidden rounded-xl bg-paper shadow-[var(--shadow-border)]">
              <iframe
                title="Resume preview"
                sandbox=""
                srcDoc={html}
                className="h-[min(72vh,880px)] w-full bg-paper"
              />
            </div>
          ) : (
            <EmptyNote text="Preview appears after the pipeline finishes." />
          )}
        </TabsContent>

        <TabsContent value="html">
          {html ? (
            <ScrollArea className="h-[min(72vh,880px)] rounded-xl bg-secondary">
              <pre className="whitespace-pre-wrap break-all p-4 font-mono text-xs leading-relaxed text-foreground">
                {html}
              </pre>
            </ScrollArea>
          ) : (
            <EmptyNote text="Clean HTML appears in step 6." />
          )}
        </TabsContent>

        <TabsContent value="keywords">
          {keywords ? (
            <div className="flex flex-col gap-5">
              <KeywordGroup title="Must have" items={keywords.must_have} />
              <KeywordGroup title="Phrases" items={keywords.phrases} />
              <KeywordGroup title="Keywords" items={keywords.keywords} />
              <KeywordGroup title="Nice to have" items={keywords.nice_to_have} />
            </div>
          ) : (
            <EmptyNote text="Keywords appear after step 1." />
          )}
        </TabsContent>

        <TabsContent value="audit">
          {audit ? (
            <div className="flex flex-col gap-5">
              {audit.flags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No stuffing or redundant keyword use was flagged.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {audit.flags.map((flag, i) => (
                    <li
                      key={`${flag.issue}-${i}`}
                      className="rounded-xl bg-secondary p-4"
                    >
                      <p className="text-sm font-medium">{flag.issue}</p>
                      {flag.fix ? (
                        <p className="mt-1 text-sm text-muted-foreground">{flag.fix}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {Object.keys(audit.keyword_counts).length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-medium">Keyword counts</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(audit.keyword_counts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([term, n]) => (
                        <Badge key={term} variant="outline" className="font-mono">
                          {term} · {n}
                        </Badge>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyNote text="Audit notes appear after step 4." />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Customize output</DialogTitle>
            <DialogDescription>
              Describe text and/or layout changes for the current resume HTML.
              Structure, styles, and section order can be edited when you ask.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="customize-instructions">Edit instructions</Label>
            <Textarea
              id="customize-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value.slice(0, 4000))}
              className="min-h-32"
              placeholder="e.g. Shorten the summary to two sentences. Move skills above experience. Use a two-column layout. Soften leadership language in the second role."
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              {instructions.length.toLocaleString()} / 4,000 characters
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomizeOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitCustomize}
              disabled={busy || instructions.trim().length < 3}
            >
              Apply edits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KeywordGroup({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="stone">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
