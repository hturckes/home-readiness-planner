import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppState,
  AssetBucket,
  GlidePathSettings,
  InvestmentAssumptions,
  MonthlyCashFlow,
  MortgageInputs,
  PurchaseTarget,
  SavedScenario,
  DEFAULT_ASSET_BUCKETS,
  DEFAULT_STATE,
} from '@/lib/types';

// ─── Store Shape ──────────────────────────────────────────────────────────────
// The store is the single source of truth for all application state.
// It extends AppState with saved scenarios and all setter actions.
// Components must never manage their own copy of app-level state —
// they call these actions to update the store and read via useStore().

interface StoreState extends AppState {
  scenarios: SavedScenario[];

  // ── Setters ────────────────────────────────────────────────────────────────
  setPurchaseTarget: (updates: Partial<PurchaseTarget>) => void;
  updateAssetBucket: (id: string, updates: Partial<AssetBucket>) => void;
  setCashFlow: (updates: Partial<MonthlyCashFlow>) => void;
  setAssumptions: (updates: Partial<InvestmentAssumptions>) => void;
  setGlidePathSettings: (updates: Partial<GlidePathSettings>) => void;
  setMortgageInputs: (updates: Partial<MortgageInputs>) => void;
  resetToDefaults: () => void;

  // ── Scenario management ────────────────────────────────────────────────────
  saveScenario: (name: string) => void;
  deleteScenario: (id: string) => void;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

const useAppStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // ── Initial state from defaults ───────────────────────────────────────
      ...DEFAULT_STATE,
      scenarios: [],

      // ── Purchase target ───────────────────────────────────────────────────
      setPurchaseTarget: (updates) =>
        set((state) => ({
          purchaseTarget: { ...state.purchaseTarget, ...updates },
        })),

      // ── Asset buckets ─────────────────────────────────────────────────────
      updateAssetBucket: (id, updates) =>
        set((state) => ({
          assetBuckets: state.assetBuckets.map((bucket) =>
            bucket.id === id ? { ...bucket, ...updates } : bucket
          ),
        })),

      // ── Cash flow ─────────────────────────────────────────────────────────
      setCashFlow: (updates) =>
        set((state) => ({
          cashFlow: { ...state.cashFlow, ...updates },
        })),

      // ── Investment assumptions ────────────────────────────────────────────
      setAssumptions: (updates) =>
        set((state) => ({
          assumptions: { ...state.assumptions, ...updates },
        })),

      // ── Glide path settings ───────────────────────────────────────────────
      setGlidePathSettings: (updates) =>
        set((state) => ({
          glidePathSettings: { ...state.glidePathSettings, ...updates },
        })),

      // ── Mortgage inputs ───────────────────────────────────────────────────
      setMortgageInputs: (updates) =>
        set((state) => ({
          mortgageInputs: { ...state.mortgageInputs, ...updates },
        })),

      // ── Reset ─────────────────────────────────────────────────────────────
      // Restores all AppState fields to DEFAULT_STATE values.
      // Shallow-copies nested objects and arrays to avoid shared references.
      // Saved scenarios are intentionally preserved across a reset.
      resetToDefaults: () =>
        set({
          ...DEFAULT_STATE,
          assetBuckets: DEFAULT_ASSET_BUCKETS.map((b) => ({ ...b })),
        }),

      // ── Scenarios ─────────────────────────────────────────────────────────
      // Saves a snapshot of the current AppState under the given name.
      // Maximum of 3 scenarios are kept; if already at 3, the oldest is
      // dropped to make room for the new one.
      saveScenario: (name) =>
        set((state) => {
          const snapshot: AppState = {
            purchaseTarget: { ...state.purchaseTarget },
            assetBuckets: state.assetBuckets.map((b) => ({ ...b })),
            cashFlow: { ...state.cashFlow },
            assumptions: { ...state.assumptions },
            glidePathSettings: { ...state.glidePathSettings },
            mortgageInputs: { ...state.mortgageInputs },
            scenarioName: name,
          };

          const newScenario: SavedScenario = {
            id: String(Date.now()),
            name,
            state: snapshot,
            createdAt: Date.now(),
          };

          const existing = state.scenarios;
          const updated =
            existing.length >= 3
              ? [...existing.slice(1), newScenario]
              : [...existing, newScenario];

          return { scenarios: updated };
        }),

      deleteScenario: (id) =>
        set((state) => ({
          scenarios: state.scenarios.filter((s) => s.id !== id),
        })),
    }),
    {
      name: 'home-readiness-planner-v1',
    }
  )
);

// ─── Exported Hook ────────────────────────────────────────────────────────────
// Single import point for all components. Returns the full store slice so
// components can destructure exactly what they need.
// For performance-critical subtrees, prefer importing useAppStore directly
// and supplying a narrower selector to limit re-renders.

export const useStore = () => useAppStore((state) => state);

export default useAppStore;
