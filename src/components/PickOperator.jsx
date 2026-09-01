import { Check, Clipboard, ExternalLink, LoaderCircle, Radio, RotateCcw, ShieldAlert, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { memberForPick, playerImage } from "../lib/draft";
import { reconcilePickRequest } from "../lib/pickWorkflow";
import { usePickRequests } from "../hooks/usePickRequests";

const ACTIVE_STATUSES = new Set(["pending", "processing", "submitted"]);

export default function PickOperator({ bootstrap, live, enabled }) {
  const { requests, connected, error, update } = usePickRequests(enabled);
  const [message, setMessage] = useState("");
  const draft = live?.draft || bootstrap.draft;
  const picks = live?.picks || [];
  const pickNo = picks.length + 1;
  const onClock = memberForPick(pickNo, draft, bootstrap.members);
  const sleeperUrl = `https://sleeper.app/draft/nfl/${draft.draftId}`;
  const active = useMemo(() => requests.filter((request) => ACTIVE_STATUSES.has(request.status)), [requests]);
  const recent = useMemo(() => requests.filter((request) => !ACTIVE_STATUSES.has(request.status)).slice(0, 6), [requests]);

  useEffect(() => {
    if (!enabled || !picks.length || !active.length) return;
    for (const request of active) {
      const resolution = reconcilePickRequest(request,picks);
      if (resolution) void update(request.id,resolution);
    }
  }, [active, enabled, picks, update]);

  const act = async (request, status, note) => {
    try {
      await update(request.id, { status, operator_note: note });
      setMessage(`${request.player_name}: ${status}`);
      window.setTimeout(() => setMessage(""), 2200);
    } catch (requestError) {
      setMessage(requestError.message || "Queue update failed");
    }
  };

  const copy = async (request) => {
    await navigator.clipboard.writeText(request.player_name);
    setMessage(`${request.player_name} copied`);
    window.setTimeout(() => setMessage(""), 1800);
  };
  const openForEntry = async (request) => {
    window.open(sleeperUrl,"sleeper-draft-room");
    try {await navigator.clipboard.writeText(request.player_name);} catch { /* The player remains visible for manual entry. */ }
    if (request.status === "pending") await act(request,"processing","Sleeper opened and player copied; ready for automated or manual entry.");
    else {setMessage(`${request.player_name}: Sleeper opened and player copied`);window.setTimeout(() => setMessage(""),2200);}
  };

  return (
    <article className="control-card pick-operator-card" data-testid="pick-operator">
      <header className="pick-operator-head"><div><h2><Radio /> Official Pick Operator</h2><p>Team requests land here. “Open + copy” supports ChatGPT browser automation and the same screen is the commissioner’s immediate manual fallback. Sleeper’s official feed confirms the result.</p></div><div className={`operator-connection ${connected ? "connected" : ""}`}><i />{connected ? "QUEUE LIVE" : "RECONNECTING"}</div></header>
      <div className="operator-truth-strip"><span>SLEEPER STATUS <b>{String(draft.status).replace("_", " ")}</b></span><span>CURRENT PICK <b>{pickNo}</b></span><span>ON CLOCK <b>{onClock?.teamName || "Complete"}</b></span><span>PENDING <b>{active.length}</b></span><a href={sleeperUrl} target="sleeper-draft-room" rel="noreferrer"><ExternalLink />Open Sleeper draft room</a></div>
      {(error || message) && <div className={error ? "form-error" : "form-success"}>{error || message}</div>}
      <div className="operator-queue">
        {active.length ? active.map((request) => {
          const owner = bootstrap.members.find((member) => Number(member.rosterId) === Number(request.roster_id));
          const wrongTurn = Number(request.pick_no) !== Number(pickNo) || Number(request.roster_id) !== Number(onClock?.rosterId);
          return <section className={`operator-request status-${request.status} ${wrongTurn ? "operator-warning" : ""}`} key={request.id} data-request-id={request.id}>
            <img src={playerImage(request.player_id, request.position)} alt="" />
            <div className="operator-player"><span>PICK {request.pick_no} · {owner?.teamName || `Team ${request.roster_id}`}</span><h3>{request.player_name}</h3><p>{request.position} · {request.nfl_team} · Request #{request.id}</p>{wrongTurn && <em><ShieldAlert />Does not match the current Sleeper turn—verify before acting.</em>}</div>
            <div className="operator-status"><small>STATUS</small><b>{request.status}</b><span>{new Date(request.requested_at).toLocaleTimeString([], { hour:"numeric", minute:"2-digit", second:"2-digit" })}</span></div>
            <div className="operator-actions">
              <button className="active" onClick={() => openForEntry(request)}><ExternalLink />Open + copy</button>
              <button onClick={() => copy(request)}><Clipboard />Copy only</button>
              {request.status === "pending" && <button className="active" onClick={() => act(request,"processing","Commissioner operator opened the request.")}><LoaderCircle />Start</button>}
              {request.status !== "submitted" && <button onClick={() => act(request,"submitted","Entered in Sleeper; awaiting official-feed verification.")}><Check />I entered it</button>}
              <button className="danger-lite" onClick={() => act(request,"rejected","Commissioner rejected or replaced this request.")}><X />Reject</button>
            </div>
          </section>;
        }) : <div className="operator-empty"><Radio /><b>No pending pick requests</b><span>The next authenticated team selection will appear here automatically.</span></div>}
      </div>
      {recent.length > 0 && <details className="operator-history"><summary><RotateCcw />Recent completed requests</summary>{recent.map((request) => <div key={request.id}><b>Pick {request.pick_no} · {request.player_name}</b><span>{request.status}</span><small>{request.operator_note}</small></div>)}</details>}
    </article>
  );
}
