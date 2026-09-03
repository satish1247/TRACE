import model from "@/data/card-model.json";

/**
 * Card-fraud scorer. Walks the XGBoost trees exported by ml/train_paysim.py.
 * Pure and synchronous: no network, no Python at runtime. featurise() must stay
 * in lock-step with featurise() in the trainer.
 */
export interface CardTx {
  type: "CASH_IN" | "CASH_OUT" | "DEBIT" | "PAYMENT" | "TRANSFER" | string;
  amount: number;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  oldbalanceDest: number;
  newbalanceDest: number;
  nameDest: string;
}

interface TreeNode {
  nodeid: number;
  split?: string;
  split_condition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  children?: TreeNode[];
  leaf?: number;
}

export interface CardModel {
  trained_at: string;
  dataset: string;
  algorithm: string;
  rows_total: number;
  rows_train: number;
  rows_balanced: number;
  rows_test: number;
  feature_names: string[];
  base_score: number;
  threshold: number;
  metrics: {
    threshold: number;
    precision: number;
    recall: number;
    f1: number;
    roc_auc: number;
    pr_auc: number;
    confusion: { tn: number; fp: number; fn: number; tp: number };
  };
  trees: TreeNode[];
  samples: { tx: CardTx; label: 0 | 1; prob: number }[];
}

export const CARD_MODEL = model as unknown as CardModel;
const TYPES = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"] as const;

export function featurise(tx: CardTx): Record<string, number> {
  const f: Record<string, number> = {};
  for (const t of TYPES) f[`type_${t}`] = tx.type === t ? 1 : 0;
  f.amount = tx.amount;
  f.oldbalanceOrg = tx.oldbalanceOrg;
  f.newbalanceOrig = tx.newbalanceOrig;
  f.oldbalanceDest = tx.oldbalanceDest;
  f.newbalanceDest = tx.newbalanceDest;
  f.errOrig = tx.newbalanceOrig + tx.amount - tx.oldbalanceOrg;
  f.errDest = tx.oldbalanceDest + tx.amount - tx.newbalanceDest;
  f.destIsMerchant = tx.nameDest.startsWith("M") ? 1 : 0;
  f.drainsAccount = tx.newbalanceOrig === 0 && tx.oldbalanceOrg > 0 ? 1 : 0;
  // xgboost trained on float32; round-trip so thresholds compare the same way
  for (const k of Object.keys(f)) f[k] = Math.fround(f[k]);
  return f;
}

function walk(node: TreeNode, x: Record<string, number>): number {
  let n: TreeNode = node;
  for (;;) {
    if (n.leaf !== undefined) return n.leaf;
    const v = n.split ? x[n.split] : undefined;
    const next = v === undefined || Number.isNaN(v) ? n.missing : v < (n.split_condition as number) ? n.yes : n.no;
    const child = n.children?.find((c) => c.nodeid === next);
    if (!child) return 0;
    n = child;
  }
}

export function margin(tx: CardTx): number {
  const x = featurise(tx);
  const base = Math.log(CARD_MODEL.base_score / (1 - CARD_MODEL.base_score));
  return CARD_MODEL.trees.reduce((acc, t) => acc + walk(t, x), base);
}

export function scoreCard(tx: CardTx): { prob: number; flagged: boolean; reasons: string[] } {
  const m = margin(tx);
  const prob = 1 / (1 + Math.exp(-m));
  const flagged = prob >= CARD_MODEL.threshold;
  return { prob, flagged, reasons: reasonsFor(tx) };
}

/** Plain-language explanations from the engineered features that the model weights most. */
export function reasonsFor(tx: CardTx): string[] {
  const r: string[] = [];
  const f = featurise(tx);
  if (f.drainsAccount) r.push("empties the sender's account completely");
  if (tx.type === "TRANSFER" || tx.type === "CASH_OUT") r.push(`${tx.type.toLowerCase().replace("_", "-")} is the channel fraud uses`);
  if (Math.abs(f.errOrig) > 0.5) r.push("sender balance does not add up after the transfer");
  if (Math.abs(f.errDest) > 0.5 && !f.destIsMerchant) r.push("receiver balance does not add up");
  if (!f.destIsMerchant && tx.oldbalanceDest === 0 && tx.amount > 0) r.push("receiver account was empty before this");
  if (tx.amount >= 200_000) r.push("unusually large amount");
  return r.slice(0, 3);
}
