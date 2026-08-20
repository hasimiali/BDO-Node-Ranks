import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { DataBundle, ValidationSummary } from "../../shared/validation";
import { validateDataBundle } from "../../shared/validation";
import { fetchDataBundle, importDataBundleRemote, validateDataBundleRemote } from "../api";
import { formatNumber } from "../format";
import { Badge, FeedbackState, Field, fieldClass, MetricCard, Panel, Skeleton } from "../components/ui";
import { Button } from "../components/ui/button";

type Tab = "overview" | "nodes" | "products" | "items" | "market" | "json";
type Action = "validate" | "save" | null;
type Status = { tone: "error" | "success"; title: string; message: string };

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "nodes", label: "Nodes" },
  { id: "products", label: "Products" },
  { id: "items", label: "Items" },
  { id: "market", label: "Market" },
  { id: "json", label: "JSON" },
];

export function DataPage() {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [remoteValidation, setRemoteValidation] = useState<ValidationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pendingAction, setPendingAction] = useState<Action>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);

    fetchDataBundle()
      .then((data) => {
        if (!active) return;
        setBundle(data);
        setJsonText(JSON.stringify(data, null, 2));
        setJsonError(null);
        setRemoteValidation(null);
        setDirty(false);
        setStatus(null);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error, "Unable to load the community data bundle."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const validation = useMemo(() => bundle ? validateDataBundle(bundle) : null, [bundle]);
  const controlsDisabled = pendingAction !== null;

  function updateBundle(next: DataBundle) {
    setBundle(next);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError(null);
    setRemoteValidation(null);
    setDirty(true);
    setStatus(null);
  }

  async function saveToServer() {
    if (!bundle || !window.confirm("Save this data bundle to src/data on the server?")) return;
    setPendingAction("save");
    setStatus(null);
    try {
      const result = await importDataBundleRemote(bundle);
      setRemoteValidation(result);
      setDirty(false);
      setStatus({
        tone: "success",
        title: "Data saved",
        message: `Saved data JSON to src/data. ${validationMessage(result)}`,
      });
    } catch (error: unknown) {
      setStatus({ tone: "error", title: "Save failed", message: errorMessage(error, "Unable to save the data bundle.") });
    } finally {
      setPendingAction(null);
    }
  }

  async function validateRemote() {
    if (!bundle) return;
    setPendingAction("validate");
    setStatus(null);
    try {
      const result = await validateDataBundleRemote(bundle);
      setRemoteValidation(result);
      setStatus({ tone: "success", title: "Server validation complete", message: validationMessage(result) });
    } catch (error: unknown) {
      setStatus({ tone: "error", title: "Validation failed", message: errorMessage(error, "Unable to validate the data bundle.") });
    } finally {
      setPendingAction(null);
    }
  }

  function downloadJson() {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bdo-profit-lab-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText) as DataBundle;
      validateDataBundle(parsed);
      updateBundle(parsed);
      setStatus({ tone: "success", title: "JSON applied", message: "The editor now reflects the JSON draft." });
    } catch (error: unknown) {
      setJsonError(errorMessage(error, "The JSON could not be parsed as a data bundle."));
      setStatus({ tone: "error", title: "JSON not applied", message: "Correct the invalid JSON and try again." });
    }
  }

  function editJson(value: string) {
    setJsonText(value);
    setJsonError(null);
    setRemoteValidation(null);
    setDirty(true);
    setStatus(null);
  }

  function selectTab(nextTab: Tab) {
    setTab(nextTab);
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, currentTab: Tab) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const currentIndex = tabs.findIndex((entry) => entry.id === currentTab);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex].id;
    selectTab(nextTab);
    document.getElementById(`data-tab-${nextTab}`)?.focus();
  }

  if (loading) {
    return (
      <Panel className="p-5" aria-busy="true">
        <span className="sr-only">Loading data editor</span>
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-[34rem] max-w-full" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}
        </div>
      </Panel>
    );
  }

  if (loadError || !bundle || !validation) {
    return (
      <Panel className="p-5">
        <FeedbackState
          title="Data editor unavailable"
          message={loadError ?? "The data bundle did not contain the expected editor data."}
          tone="error"
          action={() => setLoadAttempt((attempt) => attempt + 1)}
          actionLabel="Retry loading"
        />
      </Panel>
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
      <Panel className="overflow-hidden">
        <div className="border-b p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Admin workspace</p>
                <Badge tone={dirty ? "warning" : "positive"}>{dirty ? "Unsaved changes" : "Saved state"}</Badge>
                {remoteValidation && <Badge tone="teal">Server validation current</Badge>}
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Community data</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Maintain workload, distance, item IDs, yields, and manual Asia market records.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn" type="button" onClick={validateRemote} disabled={controlsDisabled}>
                {pendingAction === "validate" ? "Validating..." : "Validate Server"}
              </button>
              <button className="btn" type="button" onClick={downloadJson} disabled={controlsDisabled}>Download JSON</button>
              <button className="btn-primary" type="button" onClick={saveToServer} disabled={controlsDisabled}>
                {pendingAction === "save" ? "Saving..." : "Save To Server"}
              </button>
            </div>
          </div>
          {status && (
            <div className="mt-4">
              <FeedbackState {...status} compact />
            </div>
          )}
        </div>
        <div className="overflow-x-auto bg-muted/30 p-2" aria-label="Data editor sections">
          <div className="flex min-w-max gap-1" role="tablist">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                id={`data-tab-${entry.id}`}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                aria-controls={`data-panel-${entry.id}`}
                tabIndex={tab === entry.id ? 0 : -1}
                className={tab === entry.id ? "btn-primary" : "btn"}
                onClick={() => selectTab(entry.id)}
                onKeyDown={(event) => handleTabKeyDown(event, entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <div id={`data-panel-${tab}`} role="tabpanel" aria-labelledby={`data-tab-${tab}`} tabIndex={0}>
        {tab === "overview" && <Overview validation={remoteValidation ?? validation} isRemote={remoteValidation !== null} />}
        {tab === "nodes" && <NodesEditor bundle={bundle} updateBundle={updateBundle} disabled={controlsDisabled} />}
        {tab === "products" && <ProductsEditor bundle={bundle} updateBundle={updateBundle} disabled={controlsDisabled} />}
        {tab === "items" && <ItemsEditor bundle={bundle} updateBundle={updateBundle} disabled={controlsDisabled} />}
        {tab === "market" && <MarketEditor bundle={bundle} updateBundle={updateBundle} disabled={controlsDisabled} />}
        {tab === "json" && (
          <Panel className="p-4 sm:p-5">
            <Field label="Data bundle JSON" hint="Apply the draft to update the structured editors before validating or saving.">
              <textarea
                className={`${fieldClass} h-[60vh] min-h-80 resize-y font-mono text-xs ${jsonError ? "border-[var(--negative)] focus:border-[var(--negative)]" : ""}`}
                value={jsonText}
                onChange={(event) => editJson(event.target.value)}
                aria-invalid={jsonError ? "true" : undefined}
                aria-describedby={jsonError ? "json-parse-error" : undefined}
                spellCheck={false}
                disabled={controlsDisabled}
              />
            </Field>
            {jsonError && <p id="json-parse-error" className="mt-2 text-sm text-[var(--negative)]" role="alert">{jsonError}</p>}
            <button className="btn-primary mt-3" type="button" onClick={applyJson} disabled={controlsDisabled}>Apply JSON</button>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Overview({ validation, isRemote }: { validation: ValidationSummary; isRemote: boolean }) {
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Data health</h2>
        <Badge tone={isRemote ? "teal" : "neutral"}>{isRemote ? "Server results" : "Local results"}</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Nodes" value={formatNumber(validation.nodes, 0)} detail="Total node records" featured />
        <MetricCard label="Rankable" value={formatNumber(validation.rankableNodes, 0)} detail="Ready for ranking" />
        <MetricCard label="Missing item IDs" value={formatNumber(validation.missingItemIds, 0)} detail="Products without joins" />
        <MetricCard label="Missing workload" value={formatNumber(validation.missingWorkload, 0)} detail="Cycle time incomplete" />
        <MetricCard label="Missing distance" value={formatNumber(validation.missingDistance, 0)} detail="Travel time incomplete" />
      </div>
      <h3 className="mt-6 border-b pb-2 text-lg font-semibold">Validation issues</h3>
      {validation.issues.length === 0 ? (
        <div className="mt-3">
          <FeedbackState title="No validation issues" message="This data bundle passed all available validation checks." tone="success" compact />
        </div>
      ) : (
        <IssuesTable validation={validation} />
      )}
    </Panel>
  );
}

function IssuesTable({ validation }: { validation: ValidationSummary }) {
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(validation.issues.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const issues = validation.issues.slice(start, start + pageSize);

  return (
    <div className="mt-3">
      <PaginationControls page={safePage} pageCount={pageCount} start={start} visible={issues.length} total={validation.issues.length} label="validation issues" setPage={setPage} />
      <div className="mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[var(--canvas-raised)] text-[var(--text-subtle)]">
            <tr><th className="p-3">Severity</th><th className="p-3">Entity</th><th className="p-3">ID</th><th className="p-3">Field</th><th className="p-3">Message</th></tr>
          </thead>
          <tbody>
            {issues.map((issue, index) => (
              <tr key={`${start + index}-${issue.entity}-${issue.field}`} className="border-t border-[var(--border)]">
                <td className="p-3"><Badge tone={issue.severity === "error" ? "negative" : "warning"}>{issue.severity}</Badge></td>
                <td className="p-3">{issue.entity}</td><td className="p-3">{issue.id ?? "-"}</td><td className="p-3">{humanizeField(issue.field)}</td><td className="p-3">{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NodesEditor({ bundle, updateBundle, disabled }: EditorProps) {
  return <Panel className="p-4 sm:p-5"><EditorHeading title="Nodes" count={bundle.nodes.length} /><EditableTable rows={bundle.nodes} columns={["id", "region", "name", "type", "productionCategory", "cpCost", "workload", "distance", "nearestTown", "confidence", "notes"]} disabled={disabled} rowLabel={(row) => `node ${String(row.name || row.id)}`} onChange={(rowIndex, field, value) => { const nodes = [...bundle.nodes]; nodes[rowIndex] = { ...nodes[rowIndex], [field]: numericField(field) ? toNumberOrNull(value) : value }; updateBundle({ ...bundle, nodes }); }} /></Panel>;
}

function ProductsEditor({ bundle, updateBundle, disabled }: EditorProps) {
  const rows = bundle.nodes.flatMap((node, nodeIndex) => node.products.map((product, productIndex) => ({ nodeIndex, productIndex, nodeId: node.id, nodeName: node.name, ...product })));
  return <Panel className="p-4 sm:p-5"><EditorHeading title="Products" count={rows.length} /><EditableTable rows={rows} columns={["nodeId", "nodeName", "itemId", "itemName", "isPrimary", "yieldPer100CyclesMin", "yieldPer100CyclesMax", "averageYield", "confidence"]} disabled={disabled} rowLabel={(row) => `product ${String(row.itemName)} at ${String(row.nodeName)}`} onChange={(rowIndex, field, value) => { const target = rows[rowIndex]; const nodes = [...bundle.nodes]; const products = [...nodes[target.nodeIndex].products]; products[target.productIndex] = { ...products[target.productIndex], [field]: numericField(field) ? toNumberOrNull(value) : field === "isPrimary" ? value === "true" || value === "TRUE" : value }; nodes[target.nodeIndex] = { ...nodes[target.nodeIndex], products }; updateBundle({ ...bundle, nodes }); }} /></Panel>;
}

function ItemsEditor({ bundle, updateBundle, disabled }: EditorProps) {
  return <Panel className="p-4 sm:p-5"><EditorHeading title="Items" count={bundle.items.length} /><EditableTable rows={bundle.items} columns={["id", "name", "category", "marketCategory", "marketSubCategory", "icon", "source", "confidence"]} disabled={disabled} rowLabel={(row) => `item ${String(row.name || row.id)}`} onChange={(rowIndex, field, value) => { const items = [...bundle.items]; items[rowIndex] = { ...items[rowIndex], [field]: numericField(field) ? Number(value || 0) : value }; updateBundle({ ...bundle, items }); }} /></Panel>;
}

function MarketEditor({ bundle, updateBundle, disabled }: EditorProps) {
  function addRow() { updateBundle({ ...bundle, manualMarket: [...bundle.manualMarket, { itemId: 0, currentPrice: 0, buyOrders: 0, sellOrders: 0, updatedAt: new Date().toISOString(), source: "manual" }] }); }
  return <Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><EditorHeading title="Manual market" count={bundle.manualMarket.length} /><button className="btn-primary" type="button" onClick={addRow} disabled={disabled}>Add Market Row</button></div><EditableTable rows={bundle.manualMarket} columns={["itemId", "currentPrice", "minPrice", "maxPrice", "buyOrders", "sellOrders", "transactionVolume", "updatedAt", "source"]} disabled={disabled} rowLabel={(row) => `market item ${String(row.itemId)}`} onChange={(rowIndex, field, value) => { const manualMarket = [...bundle.manualMarket]; manualMarket[rowIndex] = { ...manualMarket[rowIndex], [field]: numericField(field) ? Number(value || 0) : value }; updateBundle({ ...bundle, manualMarket }); }} /></Panel>;
}

interface EditorProps { bundle: DataBundle; updateBundle: (bundle: DataBundle) => void; disabled: boolean; }

function EditorHeading({ title, count }: { title: string; count: number }) {
  return <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{formatNumber(count, 0)} editable records</p></div>;
}

function EditableTable<Row extends object>({ rows, columns, onChange, disabled, rowLabel }: { rows: Row[]; columns: Array<keyof Row & string>; onChange: (rowIndex: number, field: keyof Row & string, value: string) => void; disabled: boolean; rowLabel: (row: Row) => string }) {
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const visibleRows = rows.slice(start, start + pageSize);

  return (
    <div className="mt-4">
      <PaginationControls page={safePage} pageCount={pageCount} start={start} visible={visibleRows.length} total={rows.length} label="rows" setPage={setPage} disabled={disabled} />
      <div className="mt-3 overflow-x-auto rounded-lg border" tabIndex={0} aria-label="Editable data table. Scroll horizontally to view all columns.">
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead className="bg-[var(--canvas-raised)] text-[var(--text-subtle)]"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap p-2.5" scope="col">{humanizeField(column)}</th>)}</tr></thead>
          <tbody>{visibleRows.map((row, visibleIndex) => { const rowIndex = start + visibleIndex; return <tr key={rowIndex} className="border-t border-[var(--border)]">{columns.map((column) => <td key={column} className="min-w-32 p-1.5"><input className={`${fieldClass} min-h-9 px-2 py-1 text-xs`} value={String(row[column] ?? "")} onChange={(event) => onChange(rowIndex, column, event.target.value)} aria-label={`${humanizeField(column)} for ${rowLabel(row)}, row ${rowIndex + 1}`} disabled={disabled} /></td>)}</tr>; })}</tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--text-subtle)] sm:hidden">Scroll horizontally to edit additional columns.</p>
    </div>
  );
}

function PaginationControls({ page, pageCount, start, visible, total, label, setPage, disabled = false }: { page: number; pageCount: number; start: number; visible: number; total: number; label: string; setPage: React.Dispatch<React.SetStateAction<number>>; disabled?: boolean }) {
  const first = total === 0 ? 0 : start + 1;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--text-muted)]">
      <span>Showing {formatNumber(first, 0)}-{formatNumber(start + visible, 0)} of {formatNumber(total, 0)} {label}</span>
      {pageCount > 1 && <div className="flex items-center gap-2"><button className="btn" type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={disabled || page === 0} aria-label={`Previous page of ${label}`}>Previous</button><span aria-live="polite">Page {page + 1} of {pageCount}</span><button className="btn" type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={disabled || page >= pageCount - 1} aria-label={`Next page of ${label}`}>Next</button></div>}
    </div>
  );
}

const fieldLabels: Record<string, string> = {
  id: "ID", nodeId: "Node ID", nodeName: "Node name", itemId: "Item ID", itemName: "Item name", isPrimary: "Primary product", productionCategory: "Production category", cpCost: "CP cost", nearestTown: "Nearest town", marketCategory: "Market category", marketSubCategory: "Market subcategory", yieldPer100CyclesMin: "Minimum yield per 100 cycles", yieldPer100CyclesMax: "Maximum yield per 100 cycles", averageYield: "Average yield", currentPrice: "Current price", minPrice: "Minimum price", maxPrice: "Maximum price", buyOrders: "Buy orders", sellOrders: "Sell orders", transactionVolume: "Transaction volume", updatedAt: "Updated at",
};

function humanizeField(field: string): string {
  return fieldLabels[field] ?? field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}

function numericField(field: string): boolean {
  return ["id", "nodeId", "itemId", "cpCost", "workload", "distance", "yieldPer100CyclesMin", "yieldPer100CyclesMax", "averageYield", "currentPrice", "minPrice", "maxPrice", "buyOrders", "sellOrders", "transactionVolume"].includes(field);
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function validationMessage(validation: ValidationSummary): string {
  if (validation.issues.length === 0) return "No validation issues found.";
  const errors = validation.issues.filter((issue) => issue.severity === "error").length;
  const warnings = validation.issues.length - errors;
  return `${formatNumber(errors, 0)} errors and ${formatNumber(warnings, 0)} warnings found.`;
}
