import { useCallback, useEffect, useState } from "react";
import { LEAGUE_ID } from "../lib/config";
import { supabase } from "../lib/supabase";

const initialState = {
  league_id: LEAGUE_ID,
  scene: "split",
  camera_enabled: true,
  camera_layout: "rails",
  top_ticker_enabled: true,
  bottom_ticker_enabled: true,
  ticker_speed: 34,
  announcement: null,
  lower_third: null,
  mock_mode: false,
  mock_picks: [],
};

export function useBroadcastControl() {
  const [state, setState] = useState(initialState);
  const [tickers, setTickers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [stateResult, tickerResult, profileResult] = await Promise.all([
      supabase.from("broadcast_state").select("*").eq("league_id", LEAGUE_ID).single(),
      supabase
        .from("ticker_items")
        .select("*")
        .eq("league_id", LEAGUE_ID)
        .eq("active", true)
        .order("priority", { ascending: false }),
      supabase.rpc("get_team_profiles_public", { p_league_id: LEAGUE_ID }),
    ]);
    if (stateResult.error) throw stateResult.error;
    setState({ ...initialState, ...stateResult.data });
    setTickers(tickerResult.data || []);
    if (!profileResult.error) setProfiles(profileResult.data || []);
    setConnected(true);
    setError("");
  }, []);

  useEffect(() => {
    reload().catch((requestError) => {
      setConnected(false);
      setError(requestError.message || "Broadcast control unavailable");
    });
    const channel = supabase
      .channel(`draft-night-${LEAGUE_ID}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "broadcast_state", filter: `league_id=eq.${LEAGUE_ID}` },
        reload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticker_items", filter: `league_id=eq.${LEAGUE_ID}` },
        reload,
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [reload]);

  const updateState = useCallback(async (patch) => {
    const result = await supabase
      .from("broadcast_state")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("league_id", LEAGUE_ID)
      .select()
      .single();
    if (result.error) throw result.error;
    setState(result.data);
    return result.data;
  }, []);

  return { state, tickers, profiles, connected, error, reload, updateState };
}
