import React, { useMemo, useState } from "react";
import { ArticleCacheCtx, defaultState, type CacheState, type CacheCtx } from "./articleCacheContext";

export const ArticleCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CacheState>(defaultState);

  const api = useMemo<CacheCtx>(() => ({
    ...state,
    setColumns: v => setState(s => ({ ...s, columns: v })),
    setFullRows: v => setState(s => ({ ...s, fullRows: v })),
    setQB: v => setState(s => ({ ...s, qb: v })),
    setYearFrom: n => setState(s => ({ ...s, yearFrom: n })),
    setYearTo: n => setState(s => ({ ...s, yearTo: n })),
    setSort: v => setState(s => ({ ...s, sort: v })),
    setOrder: v => setState(s => ({ ...s, order: v })),
    setPage: v => setState(s => ({ ...s, page: v })),
    setPageSize: v => setState(s => ({ ...s, pageSize: v })),
    setStatus: v => setState(s => ({ ...s, status: v })),
    setError: v => setState(s => ({ ...s, error: v })),
    setHydrated: b => setState(s => ({ ...s, hydrated: b })),
    reset: () => setState(defaultState),
  }), [state]);

  return <ArticleCacheCtx.Provider value={api}>{children}</ArticleCacheCtx.Provider>;
};

export default ArticleCacheProvider;
