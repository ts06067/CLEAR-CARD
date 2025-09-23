import { createContext } from "react";
export const defaultState = {
    columns: [],
    fullRows: [],
    qb: { combinator: "and", rules: [], id: "article-qb" },
    yearFrom: 2008,
    yearTo: 2018,
    sort: "cited_pub_year",
    order: "desc",
    page: 1,
    pageSize: 50,
    status: "OK",
    error: "",
    hydrated: false,
};
export const ArticleCacheCtx = createContext(null);
