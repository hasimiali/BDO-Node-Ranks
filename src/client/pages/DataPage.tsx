import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type { DataBundle, ValidationSummary } from "../../shared/validation";
import { validateDataBundle } from "../../shared/validation";
import { fetchDataBundle, importDataBundleRemote, validateDataBundleRemote } from "../api";
import { formatNumber } from "../format";

type Tab = "overview" | "nodes" | "products" | "items" | "market" | "json";

export function DataPage() {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [jsonText, setJsonText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [remoteValidation, setRemoteValidation] = useState<ValidationSummary | null>(null);

  useEffect(() => {
    fetchDataBundle().then((data) => {
      setBundle(data);
      setJsonText(JSON.stringify(data, null, 2));
    });
  }, []);

  const validation = useMemo(() => bundle ? validateDataBundle(bundle) : null, [bundle]);

  if (!bundle || !validation) return <Panel>Loading data editor...</Panel>;

  function updateBundle(next: DataBundle) {
    setBundle(next);
    setJsonText(JSON.stringify(next, null, 2));
    setMessage(null);
  }

  async function saveToServer() {
    if (!bundle) return;
    const result = await importDataBundleRemote(bundle);
    setRemoteValidation(result);
    setMessage("Saved data JSON to src/data.");
  }

  async function validateRemote() {
    if (!bundle) return;
    setRemoteValidation(await validateDataBundleRemote(bundle));
    setMessage("Server validation complete.");
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bdo-node-optimizer-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function applyJson() {
    const parsed = JSON.parse(jsonText) as DataBundle;
    updateBundle(parsed);
  }

  return (
    <div className="grid gap-5">
      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-2xl font-black">Community Data Editor</h2><p className="mt-1 text-sm text-slate-400">Edit missing workload, distance, item IDs, yields, and manual Asia market data.</p></div>
          <div className="flex flex-wrap gap-2"><button className="btn" onClick={validateRemote}>Validate Server</button><button className="btn" onClick={downloadJson}>Download JSON</button><button className="btn-primary" onClick={saveToServer}>Save To Server</button></div>
        </div>
        {message && <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}
      </Panel>
      <div className="flex flex-wrap gap-2">{(["overview", "nodes", "products", "items", "market", "json"] as Tab[]).map((entry) => <button key={entry} className={tab === entry ? "btn-primary" : "btn"} onClick={() => setTab(entry)}>{entry}</button>)}</div>
      {tab === "overview" && <Overview validation={remoteValidation ?? validation} />}
      {tab === "nodes" && <NodesEditor bundle={bundle} updateBundle={updateBundle} />}
      {tab === "products" && <ProductsEditor bundle={bundle} updateBundle={updateBundle} />}
      {tab === "items" && <ItemsEditor bundle={bundle} updateBundle={updateBundle} />}
      {tab === "market" && <MarketEditor bundle={bundle} updateBundle={updateBundle} />}
      {tab === "json" && <Panel><textarea className="h-[560px] w-full rounded-xl border border-white/10 bg-slate-950 p-3 font-mono text-xs text-slate-100" value={jsonText} onChange={(event) => setJsonText(event.target.value)} /><button className="btn-primary mt-3" onClick={applyJson}>Apply JSON</button></Panel>}
    </div>
  );
}

function Overview({ validation }: { validation: ValidationSummary }) {
  return <Panel><div className="grid gap-3 md:grid-cols-5"><Stat label="Nodes" value={validation.nodes} /><Stat label="Rankable" value={validation.rankableNodes} /><Stat label="Missing Item IDs" value={validation.missingItemIds} /><Stat label="Missing Workload" value={validation.missingWorkload} /><Stat label="Missing Distance" value={validation.missingDistance} /></div><h3 className="mt-6 text-xl font-bold">Validation Issues</h3><div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-white/10"><table className="w-full text-left text-sm"><thead className="bg-white/5 text-slate-400"><tr><th className="p-2">Severity</th><th>Entity</th><th>ID</th><th>Field</th><th>Message</th></tr></thead><tbody>{validation.issues.slice(0, 500).map((issue, index) => <tr key={index} className="border-t border-white/5"><td className={issue.severity === "error" ? "p-2 text-red-300" : "p-2 text-amber-300"}>{issue.severity}</td><td>{issue.entity}</td><td>{issue.id}</td><td>{issue.field}</td><td>{issue.message}</td></tr>)}</tbody></table></div></Panel>;
}

function NodesEditor({ bundle, updateBundle }: EditorProps) {
  return <Panel><EditableTable rows={bundle.nodes.slice(0, 500)} columns={["id", "region", "name", "type", "productionCategory", "cpCost", "workload", "distance", "nearestTown", "confidence", "notes"]} onChange={(rowIndex, field, value) => { const nodes = [...bundle.nodes]; nodes[rowIndex] = { ...nodes[rowIndex], [field]: numericField(field) ? toNumberOrNull(value) : value }; updateBundle({ ...bundle, nodes }); }} /></Panel>;
}

function ProductsEditor({ bundle, updateBundle }: EditorProps) {
  const rows = bundle.nodes.flatMap((node, nodeIndex) => node.products.map((product, productIndex) => ({ nodeIndex, productIndex, nodeId: node.id, nodeName: node.name, ...product })));
  return <Panel><EditableTable rows={rows.slice(0, 800)} columns={["nodeId", "nodeName", "itemId", "itemName", "isPrimary", "yieldPer100CyclesMin", "yieldPer100CyclesMax", "averageYield", "confidence"]} onChange={(rowIndex, field, value) => { const target = rows[rowIndex]; const nodes = [...bundle.nodes]; const products = [...nodes[target.nodeIndex].products]; products[target.productIndex] = { ...products[target.productIndex], [field]: numericField(field) ? toNumberOrNull(value) : field === "isPrimary" ? value === "true" || value === "TRUE" : value }; nodes[target.nodeIndex] = { ...nodes[target.nodeIndex], products }; updateBundle({ ...bundle, nodes }); }} /></Panel>;
}

function ItemsEditor({ bundle, updateBundle }: EditorProps) {
  return <Panel><EditableTable rows={bundle.items.slice(0, 800)} columns={["id", "name", "category", "marketCategory", "marketSubCategory", "icon", "source", "confidence"]} onChange={(rowIndex, field, value) => { const items = [...bundle.items]; items[rowIndex] = { ...items[rowIndex], [field]: numericField(field) ? Number(value || 0) : value }; updateBundle({ ...bundle, items }); }} /></Panel>;
}

function MarketEditor({ bundle, updateBundle }: EditorProps) {
  function addRow() { updateBundle({ ...bundle, manualMarket: [...bundle.manualMarket, { itemId: 0, currentPrice: 0, buyOrders: 0, sellOrders: 0, updatedAt: new Date().toISOString(), source: "manual" }] }); }
  return <Panel><button className="btn-primary mb-3" onClick={addRow}>Add Market Row</button><EditableTable rows={bundle.manualMarket.slice(0, 800)} columns={["itemId", "currentPrice", "minPrice", "maxPrice", "buyOrders", "sellOrders", "transactionVolume", "updatedAt", "source"]} onChange={(rowIndex, field, value) => { const manualMarket = [...bundle.manualMarket]; manualMarket[rowIndex] = { ...manualMarket[rowIndex], [field]: numericField(field) ? Number(value || 0) : value }; updateBundle({ ...bundle, manualMarket }); }} /></Panel>;
}

interface EditorProps { bundle: DataBundle; updateBundle: (bundle: DataBundle) => void; }

function EditableTable({ rows, columns, onChange }: { rows: Array<Record<string, unknown>>; columns: string[]; onChange: (rowIndex: number, field: string, value: string) => void }) {
  return <div className="overflow-auto"><table className="w-full min-w-[1100px] text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr>{columns.map((column) => <th key={column} className="p-2">{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-white/5">{columns.map((column) => <td key={column} className="p-1"><input className="w-full rounded border border-white/10 bg-slate-950 px-2 py-1 text-slate-100" value={String(row[column] ?? "")} onChange={(event) => onChange(rowIndex, column, event.target.value)} /></td>)}</tr>)}</tbody></table></div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-wider text-slate-500">{label}</div><div className="mt-2 text-2xl font-black">{formatNumber(value, 0)}</div></div>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-xl backdrop-blur">{children}</section>;
}

function numericField(field: string): boolean {
  return ["id", "nodeId", "itemId", "cpCost", "workload", "distance", "yieldPer100CyclesMin", "yieldPer100CyclesMax", "averageYield", "currentPrice", "minPrice", "maxPrice", "buyOrders", "sellOrders", "transactionVolume"].includes(field);
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
