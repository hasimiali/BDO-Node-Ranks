import { useEffect, useId, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import type { NodeRanking } from "../../shared/models";
import { formatNumber, formatSilver } from "../format";
import { Badge, FeedbackState, HelpLabel } from "./ui";

export interface RankingResultsProps {
  rankings: NodeRanking[];
  openDetail: (id: number) => void;
  caption?: string;
  pageSize?: number;
  emptyAction?: () => void;
  emptyActionLabel?: string;
}

const DEFAULT_PAGE_SIZE = 25;

export function RankingResults({
  rankings,
  openDetail,
  caption = "Node rankings",
  pageSize = DEFAULT_PAGE_SIZE,
  emptyAction,
  emptyActionLabel,
}: RankingResultsProps) {
  const [page, setPage] = useState(1);
  const mobileHeadingId = useId();
  const safePageSize = Number.isFinite(pageSize)
    ? Math.max(1, Math.floor(pageSize))
    : DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(rankings.length / safePageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * safePageSize;
  const visibleRankings = rankings.slice(startIndex, startIndex + safePageSize);
  const rangeStart = rankings.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + safePageSize, rankings.length);

  useEffect(() => {
    setPage(1);
  }, [rankings, safePageSize]);

  if (rankings.length === 0) {
    return (
      <FeedbackState
        title="No rankings to show"
        message="No nodes match the current ranking criteria."
        action={emptyAction}
        actionLabel={emptyActionLabel}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
          <caption className="pb-3 text-left text-sm text-muted-foreground">
            {caption}
          </caption>
          <thead className="sticky top-0 z-10 bg-muted/95 text-xs text-muted-foreground backdrop-blur">
            <tr>
              <th scope="col" className="px-3 py-3">Rank / node</th>
              <th scope="col" className="px-3 py-3 text-right tabular-nums">CP</th>
              <th scope="col" className="px-3 py-3 text-right tabular-nums">
                <HelpLabel label="Realizable silver/day" help="Estimated daily silver limited by available market demand." />
              </th>
              <th scope="col" className="px-3 py-3 text-right tabular-nums">Silver/CP</th>
              <th scope="col" className="px-3 py-3 text-right tabular-nums">Demand</th>
              <th scope="col" className="px-3 py-3 text-right tabular-nums">
                <HelpLabel label="Score" help="The supplied overall ranking score." />
              </th>
              <th scope="col" className="px-3 py-3">
                <HelpLabel label="Data" help="Confidence and the number of incomplete-data issues." />
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRankings.map((ranking) => (
              <RankingRow
                key={ranking.node.id}
                ranking={ranking}
                openDetail={openDetail}
              />
            ))}
          </tbody>
        </table>
      </div>

      <section className="grid gap-2 md:hidden" aria-labelledby={mobileHeadingId}>
        <h2 id={mobileHeadingId} className="text-sm font-medium text-muted-foreground">
          {caption}
        </h2>
        {visibleRankings.map((ranking) => (
          <RankingCard
            key={ranking.node.id}
            ranking={ranking}
            openDetail={openDetail}
          />
        ))}
      </section>

      <Pagination
        currentPage={currentPage}
        pageCount={pageCount}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        total={rankings.length}
        setPage={setPage}
      />
    </div>
  );
}

function RankingRow({
  ranking,
  openDetail,
}: {
  ranking: NodeRanking;
  openDetail: (id: number) => void;
}) {
  const topThree = ranking.rank != null && ranking.rank <= 3;

  return (
    <tr
      className={`align-middle transition hover:bg-muted/50 ${
        ranking.rank === 1
          ? "bg-muted/60"
          : topThree
            ? "bg-muted/25"
            : ""
      }`}
    >
      <th scope="row" className="border-b border-[var(--border)] px-3 py-3 font-normal">
        <div className="flex items-start gap-3">
          <RankBadge ranking={ranking} />
          <div className="min-w-0">
            <button
              type="button"
              className="text-left font-medium text-foreground transition hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => openDetail(ranking.node.id)}
            >
              {ranking.node.name}
            </button>
            <div className="mt-0.5 text-xs text-[var(--text-subtle)]">
              {ranking.node.region}
            </div>
          </div>
        </div>
      </th>
      <NumericCell>{formatNumber(ranking.node.cpCost, 0)}</NumericCell>
      <NumericCell featured>{formatSilver(ranking.realizableSilverPerDay)}</NumericCell>
      <NumericCell>{formatSilver(ranking.silverPerCp)}</NumericCell>
      <NumericCell>
        {formatNumber(ranking.demandScore, 0)} <span className="text-xs text-[var(--text-muted)]">{ranking.demandLabel}</span>
      </NumericCell>
      <NumericCell>{formatNumber(ranking.score, 1)}</NumericCell>
      <td className="border-b border-[var(--border)] px-3 py-3">
        <DataQuality ranking={ranking} />
      </td>
    </tr>
  );
}

function NumericCell({
  children,
  featured = false,
}: {
  children: ReactNode;
  featured?: boolean;
}) {
  return (
    <td className={`border-b border-[var(--border)] px-3 py-3 text-right tabular-nums ${featured ? "font-bold text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
      {children}
    </td>
  );
}

function RankingCard({
  ranking,
  openDetail,
}: {
  ranking: NodeRanking;
  openDetail: (id: number) => void;
}) {
  const topThree = ranking.rank != null && ranking.rank <= 3;

  return (
    <article
      className={`rounded-xl border p-4 shadow-sm ${
        ranking.rank === 1
          ? "border-foreground/30 bg-muted/50"
          : topThree
            ? "bg-muted/25"
            : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <RankBadge ranking={ranking} />
          <div className="min-w-0">
            <button
              type="button"
              className="text-left text-base font-semibold text-foreground hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => openDetail(ranking.node.id)}
            >
              {ranking.node.name}
            </button>
            <div className="mt-1 text-xs text-[var(--text-subtle)]">{ranking.node.region}</div>
          </div>
        </div>
        <DataQuality ranking={ranking} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <MobileMetric label="CP" value={formatNumber(ranking.node.cpCost, 0)} />
        <MobileMetric label="Score" value={formatNumber(ranking.score, 1)} />
        <MobileMetric label="Realizable silver/day" value={formatSilver(ranking.realizableSilverPerDay)} featured />
        <MobileMetric label="Silver/CP" value={formatSilver(ranking.silverPerCp)} />
        <MobileMetric
          label="Demand"
          value={`${formatNumber(ranking.demandScore, 0)} ${ranking.demandLabel}`}
        />
      </dl>
    </article>
  );
}

function MobileMetric({
  label,
  value,
  featured = false,
}: {
  label: string;
  value: string;
  featured?: boolean;
}) {
  return (
    <div className={label === "Realizable silver/day" ? "col-span-2" : ""}>
      <dt className="text-xs text-[var(--text-subtle)]">{label}</dt>
      <dd className={`mt-0.5 tabular-nums ${featured ? "text-lg font-extrabold text-[var(--text)]" : "font-semibold text-[var(--text-muted)]"}`}>
        {value}
      </dd>
    </div>
  );
}

function RankBadge({ ranking }: { ranking: NodeRanking }) {
  if (ranking.rank === 1) {
    return <Badge tone="gold" className="shrink-0">#1 Recommended</Badge>;
  }
  if (ranking.rank != null && ranking.rank <= 3) {
    return <Badge tone="gold" className="shrink-0">#{ranking.rank} Top 3</Badge>;
  }
  return <Badge className="shrink-0">#{ranking.rank ?? "-"}</Badge>;
}

function DataQuality({ ranking }: { ranking: NodeRanking }) {
  const confidenceTone =
    ranking.confidence === "high"
      ? "positive"
      : ranking.confidence === "estimated"
        ? "warning"
        : "negative";
  const issueCount = ranking.issues.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={confidenceTone}>{ranking.confidence}</Badge>
      <Badge tone={issueCount > 0 ? "warning" : "neutral"}>
        {issueCount} incomplete {issueCount === 1 ? "issue" : "issues"}
      </Badge>
    </div>
  );
}

function Pagination({
  currentPage,
  pageCount,
  rangeStart,
  rangeEnd,
  total,
  setPage,
}: {
  currentPage: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  setPage: Dispatch<SetStateAction<number>>;
}) {
  return (
    <nav className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Rankings pagination">
      <p className="text-sm text-[var(--text-muted)]" aria-live="polite">
        Showing <span className="tabular-nums">{rangeStart}-{rangeEnd}</span> of <span className="tabular-nums">{total}</span> rankings
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage === 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          Previous
        </button>
        <span className="px-2 text-sm tabular-nums text-[var(--text-muted)]">
          Page {currentPage} of {pageCount}
        </span>
        <button
          type="button"
          className="btn min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage === pageCount}
          onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
