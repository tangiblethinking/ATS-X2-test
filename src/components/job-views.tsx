import { ExternalLink, Send } from "lucide-react";
import { WORK_MODE_LABEL, sourceLabel, type Job, type Source } from "@/lib/jobs";
import { formatUpdated } from "./search-shared";

export type SendJob = (job: Job) => void;

export function TitleLink({ job }: { job: Job }) {
  if (!job.url.startsWith("https://")) {
    return <span className="text-foreground">{job.title}</span>;
  }
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-start gap-1 text-foreground underline decoration-border underline-offset-2"
    >
      <span>{job.title}</span>
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </a>
  );
}

function SendBtn({ job, onSend, disabled }: { job: Job; onSend?: SendJob; disabled?: boolean }) {
  if (!onSend) return null;
  return (
    <button
      type="button"
      disabled={disabled || !job.url.startsWith("https://")}
      onClick={() => onSend(job)}
      className="inline-flex min-h-9 items-center gap-1 rounded-sm bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40"
    >
      <Send className="size-3.5" aria-hidden="true" />
      Send to pipeline
    </button>
  );
}

export function JobCard({ job, onSend, sendDisabled }: { job: Job; onSend?: SendJob; sendDisabled?: boolean }) {
  const when = formatUpdated(job.updated);
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {sourceLabel(job.source)} · {job.company}
      </p>
      <TitleLink job={job} />
      <p className="text-sm text-muted-foreground">
        {WORK_MODE_LABEL[job.workMode]}
        {job.country ? ` · ${job.country}` : ""}
        {job.location ? ` · ${job.location}` : " · Location not listed"}
        {when ? ` · ${when}` : ""}
      </p>
      <SendBtn job={job} onSend={onSend} disabled={sendDisabled} />
    </article>
  );
}

export function JobRow({ job, onSend, sendDisabled }: { job: Job; onSend?: SendJob; sendDisabled?: boolean }) {
  const when = formatUpdated(job.updated);
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-3 text-muted-foreground">{sourceLabel(job.source)}</td>
      <td className="px-3 py-3 text-foreground">{job.company}</td>
      <td className="px-3 py-3">
        <TitleLink job={job} />
      </td>
      <td className="px-3 py-3 text-muted-foreground">{WORK_MODE_LABEL[job.workMode]}</td>
      <td className="px-3 py-3 text-muted-foreground">{job.location || "—"}</td>
      <td className="px-3 py-3 text-muted-foreground">{job.country || "—"}</td>
      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground tabular-nums">{when || "—"}</td>
      {onSend ? (
        <td className="px-3 py-3">
          <SendBtn job={job} onSend={onSend} disabled={sendDisabled} />
        </td>
      ) : null}
    </tr>
  );
}

export function GroupRows({ source, jobs, onSend, sendDisabled }: { source: Source; jobs: Job[]; onSend?: SendJob; sendDisabled?: boolean }) {
  return (
    <>
      <tr>
        <td colSpan={onSend ? 8 : 7} className="bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
          {sourceLabel(source)}
          <span className="tabular-nums"> · {jobs.length}</span>
        </td>
      </tr>
      {jobs.map((job, index) => (
        <JobRow key={`${job.url}-${job.title}-${index}`} job={job} onSend={onSend} sendDisabled={sendDisabled} />
      ))}
    </>
  );
}
