import { useCallback, useEffect, useRef, useState } from "react";
import { LEAGUE_ID } from "../lib/config";

async function getJson(url, signal) {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Draft data request failed (${response.status})`);
  return response.json();
}

const CACHE_KEY = `draft-night-bootstrap-${LEAGUE_ID}`;

function cachedBootstrap() {
  try { return JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null"); }
  catch { return null; }
}

export function useDraftData() {
  const [bootstrap, setBootstrap] = useState(cachedBootstrap);
  const [live, setLive] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const active = useRef(true);

  const refreshLive = useCallback(async () => {
    try {
      const result = await getJson(`/api/live?leagueId=${LEAGUE_ID}`);
      if (!active.current) return;
      setLive(result);
      setStatus("live");
      setError("");
    } catch (requestError) {
      if (!active.current) return;
      setStatus("offline");
      setError(requestError instanceof Error ? requestError.message : "Live draft unavailable");
    }
  }, []);

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    Promise.all([
      getJson(`/api/bootstrap?leagueId=${LEAGUE_ID}`, controller.signal),
      getJson(`/api/live?leagueId=${LEAGUE_ID}`, controller.signal),
    ])
      .then(([base, current]) => {
        if (!active.current) return;
        setBootstrap(base);
        try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(base)); } catch { /* Private browsing can deny storage. */ }
        setLive(current);
        setStatus("live");
      })
      .catch((requestError) => {
        if (!active.current) return;
        setStatus("offline");
        if (!cachedBootstrap()) setError(requestError instanceof Error ? requestError.message : "Could not open the draft room");
      });

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshLive();
    }, 1200);
    const immediate = () => refreshLive();
    window.addEventListener("focus", immediate);
    window.addEventListener("online", immediate);
    document.addEventListener("visibilitychange", immediate);
    return () => {
      active.current = false;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", immediate);
      window.removeEventListener("online", immediate);
      document.removeEventListener("visibilitychange", immediate);
    };
  }, [refreshLive]);

  return { bootstrap, live, status, error, refreshLive };
}
