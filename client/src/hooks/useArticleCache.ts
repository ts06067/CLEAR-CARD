import { useContext } from "react";
import { ArticleCacheCtx } from "../context/articleCacheContext";

export const useArticleCache = () => {
  const c = useContext(ArticleCacheCtx);
  if (!c) throw new Error("useArticleCache must be used inside <ArticleCacheProvider>");
  return c;
};

export default useArticleCache;
