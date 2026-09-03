"""
TRACE card-fraud engine: train once in Python, score at runtime in TypeScript.

Mirrors the source repository's approach (Tek-nr/AI-Based-Fraud-Detection):
  - class balancing with imbalanced-learn (BalanceDataset.py: RandomUnderSampler / SMOTE)
  - a gradient-boosted classifier from MachineLearningModels.py (XGBClassifier)
  - precision / recall / F1 / AUC on a held-out split

Dataset: PaySim synthetic mobile-money transactions (Lopez-Rojas et al.), Kaggle "paysim1",
downloaded here from a public Hugging Face mirror so no Kaggle login is needed.

Output: src/data/card-model.json  (trees + metadata + parity samples), read by src/lib/cardModel.ts
Run:    npm run train:card        (or: python ml/train_paysim.py)
Env:    TRACE_SAMPLE_ROWS (default 600000), TRACE_BALANCE (under|smote, default under)
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "ml" / "data" / "paysim.csv"
OUT = ROOT / "src" / "data" / "card-model.json"
URL = "https://huggingface.co/datasets/vitaliy-sharandin/synthetic-fraud-detection/resolve/main/PS_20174392719_1491204439457_log.csv"

SEED = 42
SAMPLE_ROWS = int(os.environ.get("TRACE_SAMPLE_ROWS", "600000"))
BALANCE = os.environ.get("TRACE_BALANCE", "under")
TYPES = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]
USECOLS = ["type", "amount", "oldbalanceOrg", "newbalanceOrig", "nameDest", "oldbalanceDest", "newbalanceDest", "isFraud"]


def log(msg: str) -> None:
    print(f"[train] {msg}", flush=True)


def download() -> None:
    if DATA.exists() and DATA.stat().st_size > 100_000_000:
        log(f"dataset present: {DATA} ({DATA.stat().st_size / 1e6:.0f} MB)")
        return
    import requests

    DATA.parent.mkdir(parents=True, exist_ok=True)
    log(f"downloading PaySim from {URL}")
    try:
        with requests.get(URL, stream=True, timeout=60) as r:
            r.raise_for_status()
            total = int(r.headers.get("content-length", 0))
            done = 0
            t0 = time.time()
            with open(DATA, "wb") as f:
                for chunk in r.iter_content(chunk_size=1 << 20):
                    f.write(chunk)
                    done += len(chunk)
                    if total and done % (50 << 20) < (1 << 20):
                        log(f"  {done / 1e6:.0f} / {total / 1e6:.0f} MB ({time.time() - t0:.0f}s)")
    except Exception as e:  # noqa: BLE001
        log(f"download failed: {e}")
        log("Download the Kaggle file PS_20174392719_1491204439457_log.csv manually and save it as ml/data/paysim.csv")
        sys.exit(2)


def featurise(df: pd.DataFrame) -> pd.DataFrame:
    """Must stay in lock-step with featurise() in src/lib/cardModel.ts."""
    x = pd.DataFrame(index=df.index)
    for t in TYPES:
        x[f"type_{t}"] = (df["type"] == t).astype(np.float32)
    for c in ["amount", "oldbalanceOrg", "newbalanceOrig", "oldbalanceDest", "newbalanceDest"]:
        x[c] = df[c].astype(np.float32)
    x["errOrig"] = (df["newbalanceOrig"] + df["amount"] - df["oldbalanceOrg"]).astype(np.float32)
    x["errDest"] = (df["oldbalanceDest"] + df["amount"] - df["newbalanceDest"]).astype(np.float32)
    x["destIsMerchant"] = df["nameDest"].astype(str).str.startswith("M").astype(np.float32)
    x["drainsAccount"] = ((df["newbalanceOrig"] == 0) & (df["oldbalanceOrg"] > 0)).astype(np.float32)
    return x


def main() -> None:
    from imblearn.over_sampling import SMOTE
    from imblearn.under_sampling import RandomUnderSampler
    from sklearn.metrics import (
        average_precision_score,
        confusion_matrix,
        f1_score,
        precision_recall_curve,
        precision_score,
        recall_score,
        roc_auc_score,
    )
    from sklearn.model_selection import train_test_split
    from xgboost import XGBClassifier

    download()
    t0 = time.time()
    log("loading csv")
    df = pd.read_csv(DATA, usecols=USECOLS)
    rows_total = int(len(df))
    log(f"rows {rows_total:,} · fraud {int(df.isFraud.sum()):,} ({df.isFraud.mean() * 100:.3f}%)")

    fraud = df[df.isFraud == 1]
    legit = df[df.isFraud == 0]
    if len(df) > SAMPLE_ROWS:
        legit = legit.sample(n=max(SAMPLE_ROWS - len(fraud), 10 * len(fraud)), random_state=SEED)
    df = pd.concat([fraud, legit]).sample(frac=1, random_state=SEED).reset_index(drop=True)
    log(f"working set {len(df):,} rows (all {len(fraud):,} fraud kept)")

    X = featurise(df)
    y = df["isFraud"].astype(int).values
    X_tr, X_te, y_tr, y_te, df_tr, df_te = train_test_split(X, y, df, test_size=0.2, stratify=y, random_state=SEED)

    if BALANCE == "smote":
        sampler = SMOTE(sampling_strategy=0.25, random_state=SEED)
    else:
        sampler = RandomUnderSampler(sampling_strategy=0.25, random_state=SEED)
    X_bal, y_bal = sampler.fit_resample(X_tr, y_tr)
    log(f"balanced train: {len(X_bal):,} rows · fraud share {y_bal.mean() * 100:.1f}% ({BALANCE})")

    model = XGBClassifier(
        n_estimators=120,
        max_depth=5,
        learning_rate=0.15,
        subsample=0.9,
        colsample_bytree=0.9,
        eval_metric="aucpr",
        tree_method="hist",
        base_score=0.5,  # margin starts at logit(0.5)=0, so the TS scorer is just sigmoid(sum of leaves)
        random_state=SEED,
        n_jobs=0,
    )
    model.fit(X_bal, y_bal)
    log(f"trained in {time.time() - t0:.0f}s")

    prob = model.predict_proba(X_te)[:, 1]
    p, r, th = precision_recall_curve(y_te, prob)
    f1s = 2 * p[:-1] * r[:-1] / np.clip(p[:-1] + r[:-1], 1e-9, None)
    best = int(np.argmax(f1s))
    threshold = float(th[best])
    pred = (prob >= threshold).astype(int)
    cm = confusion_matrix(y_te, pred).tolist()
    metrics = {
        "threshold": threshold,
        "precision": float(precision_score(y_te, pred)),
        "recall": float(recall_score(y_te, pred)),
        "f1": float(f1_score(y_te, pred)),
        "roc_auc": float(roc_auc_score(y_te, prob)),
        "pr_auc": float(average_precision_score(y_te, prob)),
        "confusion": {"tn": cm[0][0], "fp": cm[0][1], "fn": cm[1][0], "tp": cm[1][1]},
        "at_0_5": {
            "precision": float(precision_score(y_te, (prob >= 0.5).astype(int))),
            "recall": float(recall_score(y_te, (prob >= 0.5).astype(int))),
        },
    }
    log(f"held-out: precision {metrics['precision']:.3f} recall {metrics['recall']:.3f} f1 {metrics['f1']:.3f} roc_auc {metrics['roc_auc']:.4f} pr_auc {metrics['pr_auc']:.4f} @thr {threshold:.3f}")

    # parity samples for the TypeScript scorer: raw readable fields + python probability
    rng = np.random.default_rng(SEED)
    te_idx = np.arange(len(y_te))
    fr = rng.choice(te_idx[y_te == 1], 20, replace=False)
    lg = rng.choice(te_idx[y_te == 0], 40, replace=False)
    samples = []
    for i in np.concatenate([fr, lg]):
        row = df_te.iloc[int(i)]
        samples.append(
            {
                "tx": {
                    "type": str(row["type"]),
                    "amount": float(row["amount"]),
                    "oldbalanceOrg": float(row["oldbalanceOrg"]),
                    "newbalanceOrig": float(row["newbalanceOrig"]),
                    "oldbalanceDest": float(row["oldbalanceDest"]),
                    "newbalanceDest": float(row["newbalanceDest"]),
                    "nameDest": str(row["nameDest"]),
                },
                "label": int(y_te[int(i)]),
                "prob": float(prob[int(i)]),
            }
        )
    rng.shuffle(samples)

    booster = model.get_booster()
    trees = [json.loads(t) for t in booster.get_dump(dump_format="json")]
    out = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset": "PaySim synthetic mobile-money transactions (Kaggle paysim1, HF mirror)",
        "algorithm": "XGBClassifier, 120 trees, depth 5, lr 0.15; RandomUnderSampler 1:4 on train only",
        "rows_total": rows_total,
        "rows_train": int(len(X_tr)),
        "rows_balanced": int(len(X_bal)),
        "rows_test": int(len(X_te)),
        "feature_names": list(X.columns),
        "base_score": 0.5,
        "threshold": threshold,
        "metrics": metrics,
        "trees": trees,
        "samples": samples,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    log(f"wrote {OUT} ({OUT.stat().st_size / 1e3:.0f} KB, {len(trees)} trees)")


if __name__ == "__main__":
    main()
