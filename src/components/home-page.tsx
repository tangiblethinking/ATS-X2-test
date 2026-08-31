import { useEffect, useMemo, useRef, useState } from "react";
import { FileCode2, Play, RotateCcw, Moon, Sun, X } from "lucide-react";
import { PdfConvertButton } from "@/components/pdf-convert-button";
import { toast } from "sonner";
import { ApiKeyDialog } from "@/components/api-key-dialog";
import { JobSearchPanel } from "@/components/job-search-panel";
import { OutputPanel, type DocKind } from "@/components/output-panel";
import { PipelineRail } from "@/components/pipeline-rail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  isPlausibleApiKey,
  readStoredApiKey,
  readStoredSearchApiKey,
} from "@/lib/api-key-store";
import { looksLikeHtml } from "@/lib/html-clean";
import {
  auditKeywords,
  cleanHtml,
  customizeResume,
  extractKeywords,
  fetchJobDescription,
  generateCoverLetter,
  grammarCheck,
  lockLayout,
  rewriteResume,
} from "@/lib/optimize";
import type { JobResult } from "@/lib/job-search";
import {
  DRAFT_STORAGE,
  MAX_JOB_CHARS,
  MAX_RESUME_CHARS,
  type AuditResult,
  type KeywordSet,
  type StepId,
  type StepStatus,
} from "@/lib/pipeline-types";

const idleStatuses = (): Record<StepId, StepStatus> => ({
  1: "idle",
  2: "idle",
  3: "idle",
  4: "idle",
  5: "idle",
  6: "idle",
});

type Draft = { jobUrl: string; jobText: string; resumeHtml: string };
type Theme = "dark" | "light";

function readDraft(): Draft {
  if (typeof window === "undefined") return { jobUrl: "", jobText: "", resumeHtml: "" };
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE);
    if (!raw) return { jobUrl: "", jobText: "", resumeHtml: "" };
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      jobUrl: typeof parsed.jobUrl === "string" ? parsed.jobUrl : "",
      jobText: typeof parsed.jobText === "string" ? parsed.jobText : "",
      resumeHtml: typeof parsed.resumeHtml === "string" ? parsed.resumeHtml : "",
    };
  } catch {
    return { jobUrl: "", jobText: "", resumeHtml: "" };
  }
}

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const t = window.localStorage.getItem("ats-align.theme");
    return t === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
  try {
    window.localStorage.setItem("ats-align.theme", theme);
  } catch {
    /* ignore */
  }
}

export function HomePage() {
  const [apiKey, setApiKey] = useState("");
  const [searchApiKey, setSearchApiKey] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [resumeHtml, setResumeHtml] = useState("");
  const [statuses, setStatuses] = useState<Record<StepId, StepStatus>>(idleStatuses);
  const [details, setDetails] = useState<Partial<Record<StepId, string>>>({});
  const [keywords, setKeywords] = useState<KeywordSet | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [finalHtml, setFinalHtml] = useState<string | null>(null);
  const [coverHtml, setCoverHtml] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"pipeline" | "search">("pipeline");
  const [theme, setTheme] = useState<Theme>("dark");
  const fileRef = useRef<HTMLInputElement>(null);
  const [convertingPdf, setConvertingPdf] = useState(false);

  const busy = running || rewriting || customizing || generatingCover || convertingPdf;

  useEffect(() => {
    setApiKey(readStoredApiKey());
    setSearchApiKey(readStoredSearchApiKey());
    const draft = readDraft();
    setJobUrl(draft.jobUrl);
    setJobText(draft.jobText);
    setResumeHtml(draft.resumeHtml);
    const t = readTheme();
    setTheme(t);
    applyTheme(t);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        DRAFT_STORAGE,
        JSON.stringify({ jobUrl, jobText, resumeHtml } satisfies Draft),
      );
    } catch {
      // quota
    }
  }, [hydrated, jobUrl, jobText, resumeHtml]);

  const canRun = useMemo(() => {
    return (
      isPlausibleApiKey(apiKey) &&
      jobUrl.trim().length > 7 &&
      resumeHtml.trim().length > 40 &&
      !busy
    );
  }, [apiKey, jobUrl, resumeHtml, busy]);

  function mark(id: StepId, status: StepStatus, detail?: string) {
    setStatuses((prev) => ({ ...prev, [id]: status }));
    if (detail) setDetails((prev) => ({ ...prev, [id]: detail }));
  }

  function fail(id: StepId, message: string) {
    mark(id, "error", message);
    toast.error(message);
  }

  function toastBusy() {
    const task = running
      ? "the pipeline"
      : rewriting
        ? "a rewrite"
        : customizing
          ? "a customize pass"
          : convertingPdf
            ? "PDF conversion"
            : "cover letter generation";
    toast.message("Please wait", {
      description: `${task.charAt(0).toUpperCase()}${task.slice(1)} is still running. Finish it before starting a new task.`,
    });
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    if (text.length > MAX_RESUME_CHARS) {
      toast.error("That HTML file is too large.");
      return;
    }
    setResumeHtml(text);
  }

  function resetPipeline() {
    setStatuses(idleStatuses());
    setDetails({});
    setKeywords(null);
    setAudit(null);
    setFinalHtml(null);
    setCoverHtml(null);
  }

  // NOTE: remainder of HomePage (runPipeline through JSX) must match original;
  // truncated push risk — see follow-up commit if incomplete.
  return null;
}
