import { useCallback, useEffect, useRef, useState } from "react";
import { LEAGUE_ID, TEAM_ACCENTS } from "../lib/config";

const STORAGE_KEY = "sdn-test-lab-v1";

export const testInitialState = {
  league_id: LEAGUE_ID,
  scene: "split",
  camera_enabled: true,
  camera_layout: "rails",
  top_ticker_enabled: true,
  bottom_ticker_enabled: true,
  ticker_speed: 26,
  mock_mode: false,
  mock_picks: [],
  announcement: null,
};

const testTickers = [
  { id: "test-top", lane: "top", kind: "test", text: "TEST LAB · NOTHING HERE CHANGES THE LIVE BROADCAST", accent: "#fbbf24" },
  { id: "test-bottom", lane: "bottom", kind: "mock", text: "SIMULATED CAMERAS · LOCAL MOCK PICKS · SAFE TEAM STYLES", accent: "#38bdf8" },
];

function loadTestState() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null");
    return saved ? { ...testInitialState, ...saved } : testInitialState;
  } catch {
    return testInitialState;
  }
}

function seedProfiles(bootstrap) {
  return (bootstrap?.members || []).map((member, index) => ({
    league_id: LEAGUE_ID,
    roster_id: member.rosterId,
    team_name: member.teamName,
    accent: TEAM_ACCENTS[index]?.[0] || "#1f9bfe",
    accent_2: TEAM_ACCENTS[index]?.[1] || "#b7ff3c",
    panel_style: "broadcast",
    motto: `${member.displayName}'s test container`,
    badge: `T${member.rosterId}`,
  }));
}

export function useTestControl(bootstrap) {
  const [state, setState] = useState(loadTestState);
  const stateRef = useRef(state);
  const [profiles, setProfiles] = useState(() => seedProfiles(bootstrap));
  stateRef.current = state;

  useEffect(() => {
    if (!profiles.length && bootstrap?.members?.length) setProfiles(seedProfiles(bootstrap));
  }, [bootstrap, profiles.length]);

  useEffect(() => {
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { /* Test mode still works when browser storage is unavailable. */ }
  }, [state]);

  const updateState = useCallback(async (patch) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const updateProfile = useCallback((rosterId, patch) => {
    setProfiles((current) => current.map((profile) => Number(profile.roster_id) === Number(rosterId) ? { ...profile, ...patch } : profile));
  }, []);

  const reset = useCallback(() => {
    stateRef.current = testInitialState;
    setState(testInitialState);
    setProfiles(seedProfiles(bootstrap));
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
  }, [bootstrap]);

  return {
    state,
    tickers: testTickers,
    profiles,
    connected: true,
    error: "",
    updateState,
    updateProfile,
    reset,
    reload: async () => undefined,
  };
}
