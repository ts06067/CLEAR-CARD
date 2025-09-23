import { jsx as _jsx } from "react/jsx-runtime";
import React, { useMemo, useState } from "react";
import { ArticleCacheCtx, defaultState } from "./articleCacheContext";
export const ArticleCacheProvider = ({ children }) => {
    const [state, setState] = useState(defaultState);
    const api = useMemo(() => ({
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
    return _jsx(ArticleCacheCtx.Provider, { value: api, children: children });
};
export default ArticleCacheProvider;
