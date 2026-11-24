import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { client, connect, explorer, fees, read, rpc, signer, succeeded, switchNetwork, validAddress, wallet, type Hex, type Receipt } from './network'
import { clock, eligible, emptyEvent, inputError, minute, newId, splitSkills, type Attempt, type EventInput, type EventMeta, type Person, type Schedule, type Task } from './model'
import deployment from './deployment.json'
import './style.css'

type View = 'My events' | 'Schedule' | 'People' | 'Tasks' | 'History'
type Target = {workspace: string; event: string}
type TxHash = Parameters<typeof client.getTransaction>[0]['hash']
type Activity = {hash: TxHash; label: string; target?: Target}
const views: [View, string][] = [['My events', '◫'], ['Schedule', '▤'], ['People', '♧'], ['Tasks', '≡'], ['History', '↶']]
const idPattern = /^[a-z0-9_-]{1,40}$/
const stored = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback } }
const address = validAddress(deployment.contract) ? deployment.contract : validAddress(import.meta.env.VITE_SHIFTQUORUM_CONTRACT || '') ? import.meta.env.VITE_SHIFTQUORUM_CONTRACT as Hex : null
const query = new URLSearchParams(location.search)
const demo = {workspace: deployment.demoWorkspace, event: deployment.demoEvent}
const mayDeploy = import.meta.env.DEV && query.has('deploy')
const querySafeEvent = () => new URLSearchParams(location.search).get('event')
const initialTarget = () => {
  const workspace = query.get('workspace') ?? demo.workspace
  const event = query.get('event') ?? demo.event
  return idPattern.test(workspace) && idPattern.test(event) ? {workspace, event} : null
}

function Board({event, schedule, onTask}: {event: EventInput; schedule: Schedule | null; onTask: (task: Task) => void}) {
  const first = event.tasks.length ? Math.floor(Math.min(...event.tasks.map(task => task.start)) / 60) * 60 : 540
  const end = Math.min(1440, Math.max(first + 180, ...event.tasks.map(task => Math.ceil(task.end / 60) * 60)))
  const hours = Array.from({length: Math.ceil((end - first) / 60)}, (_, index) => first + index * 60)
  const offset = (time: number) => (time - first) / (end - first) * 100
  if (!event.people.length) return <div className="empty"><h3>Make room for your team</h3><p>Add people and their availability to start planning.</p></div>
  return <><div className="board-scroll"><div className="board">
    <div className="lane"><div className="lane-name column-name">Participant</div><div className="timebar">{hours.map(hour => <span key={hour} style={{left: offset(hour) + '%'}}>{clock(hour)}</span>)}</div></div>
    {event.people.map((person, index) => <div className="lane" key={person.id}>
      <div className="lane-name"><span className={'avatar tone-' + index % 4}>{person.alias.slice(0, 2).toUpperCase()}</span><div><strong>{person.alias}</strong><small>{schedule ? `${schedule.workload[person.id] ?? 0} / ${person.limit} min` : `Up to ${person.limit} min`}</small></div></div>
      <div className="track" style={{backgroundSize: `calc(100% / ${hours.length}) 100%`}}>
        {event.tasks.filter(task => schedule?.assignments[task.id] === person.id).map(task => <button key={task.id} className={'task-block tone-' + index % 4} style={{left: offset(task.start) + '%', width: offset(task.end) - offset(task.start) + '%'}} onClick={() => onTask(task)} title={task.title}><strong>{task.title}</strong><small>{clock(task.start)}–{clock(task.end)}</small></button>)}
      </div>
    </div>)}
  </div></div>
  <div className="agenda">
    {event.people.map((person, index) => {
      const slots = event.tasks.filter(task => schedule?.assignments[task.id] === person.id).sort((a, b) => a.start - b.start)
      return <section className="agenda-lane" key={person.id} aria-label={person.alias}>
        <div className="agenda-person"><span className={'avatar tone-' + index % 4}>{person.alias.slice(0, 2).toUpperCase()}</span>
          <div><strong>{person.alias}</strong><small>{schedule ? `${schedule.workload[person.id] ?? 0} / ${person.limit} min` : `Up to ${person.limit} min`}</small></div>
        </div>
        {slots.map(task => <button className={'agenda-slot tone-' + index % 4} key={task.id} onClick={() => onTask(task)}>
          <strong>{task.title}</strong><small>{clock(task.start)}–{clock(task.end)}</small>
        </button>)}
        {!slots.length && <small className="agenda-empty">No assigned tasks</small>}
      </section>
    })}
  </div></>
}

function Panel({title, close, children}: {title: string; close: () => void; children: ReactNode}) {
  return <div className="overlay" onClick={close}><section role="dialog" aria-modal="true" aria-label={title} className="drawer" onClick={event => event.stopPropagation()} onKeyDown={event => {if (event.key === 'Escape') close()}}><div className="drawer-head"><h2>{title}</h2><button aria-label="Close" autoFocus onClick={close}>×</button></div>{children}</section></div>
}

function PersonEditor({person, save, remove}: {person: Person; save: (person: Person) => void; remove?: () => void}) {
  const [alias, setAlias] = useState(person.alias)
  const [skills, setSkills] = useState(person.skills.join(', '))
  const [availability, setAvailability] = useState(person.availability.map(([a, b]) => [clock(a), clock(b)]))
  const [limit, setLimit] = useState(person.limit)
  const [preference, setPreference] = useState(person.preference)
  function submit(event: FormEvent) {
    event.preventDefault()
    save({...person, alias: alias.trim(), skills: splitSkills(skills), availability: availability.map(([a, b]) => [minute(a), minute(b)]), limit, preference})
  }
  return <form onSubmit={submit}>
    <label>Alias<input required maxLength={40} value={alias} onChange={e => setAlias(e.target.value)} placeholder="e.g. Cedar"/></label>
    <label>Skills<input value={skills} onChange={e => setSkills(e.target.value)} placeholder="welcome, setup"/></label>
    <label>Workload limit in minutes<input type="number" required min={1} max={1440} value={limit} onChange={e => setLimit(Number(e.target.value))}/></label>
    <fieldset><legend>Availability · HH:MM</legend>{availability.map(([a, b], index) => <div className="interval" key={index}>
      {[a, b].map((value, part) => <input aria-label={part === 0 ? 'Start' : 'End'} key={part} value={value} onChange={e => setAvailability(rows => rows.map((row, i) => i === index ? row.map((v, j) => j === part ? e.target.value : v) : row))} required/>)}
      <button type="button" aria-label="Remove availability interval" onClick={() => setAvailability(rows => rows.filter((_, i) => i !== index))}>×</button>
    </div>)}
    <button type="button" disabled={availability.length >= 8} onClick={() => setAvailability(rows => [...rows, ['09:00','12:00']])}>Add interval</button></fieldset>
    <label>Scheduling preference<textarea maxLength={240} value={preference} onChange={e => setPreference(e.target.value)} placeholder="I enjoy greeting visitors."/></label>
    <div className="actions"><button className="primary">Save participant</button>{remove && <button type="button" onClick={remove}>Remove participant</button>}</div>
  </form>
}
function TaskEditor({task, save, remove}: {task: Task; save: (task: Task) => void; remove?: () => void}) {
  const [title, setTitle] = useState(task.title)
  const [skills, setSkills] = useState(task.skills.join(', '))
  const [start, setStart] = useState(clock(task.start))
  const [end, setEnd] = useState(clock(task.end))
  return <form onSubmit={e => {e.preventDefault(); save({...task, title: title.trim(), skills: splitSkills(skills), start: minute(start), end: minute(end)})}}>
    <label>Task title<input required maxLength={80} value={title} onChange={e => setTitle(e.target.value)}/></label>
    <label>Required skills<input value={skills} onChange={e => setSkills(e.target.value)} placeholder="setup, welcome"/></label>
    <div className="interval"><label>Start · HH:MM<input required value={start} onChange={e => setStart(e.target.value)}/></label><label>End · HH:MM<input required value={end} onChange={e => setEnd(e.target.value)}/></label></div>
    <div className="actions"><button className="primary">Save task</button>{remove && <button type="button" onClick={remove}>Remove task</button>}</div>
  </form>
}

function App() {
  const [view, setView] = useState<View>('Schedule')
  const [account, setAccount] = useState<Hex | null>(null)
  const [activity, setActivity] = useState<Activity | null>(() => stored('sq.activity', null))
  const [target, setTarget] = useState<Target | null>(initialTarget)
  const [contract, setContract] = useState<Hex | null>(() => address || (mayDeploy ? stored('sq.local-contract', null) : null))
  const [events, setEvents] = useState<(Target & {title: string})[]>(() => stored('sq.events', []))
  const [meta, setMeta] = useState<EventMeta | null>(null)
  const [current, setCurrent] = useState<EventInput | null>(null)
  const [draft, setDraft] = useState<EventInput | null>(null)
  const [owner, setOwner] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [published, setPublished] = useState<{schedule: Schedule; event: EventInput} | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [resolution, setResolution] = useState('')
  const [state, setState] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, refresh] = useState(0)
  const [loading, setLoading] = useState(!!target)
  const [modal, setModal] = useState<'event' | 'open' | 'technical' | null>(null)
  const [person, setPerson] = useState<Person | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [details, setDetails] = useState<Task | null>(null)
  const [openId, setOpenId] = useState('')
  const [openEvent, setOpenEvent] = useState('')
  const canEdit = !!(account && ((owner && owner.toLowerCase() === account.toLowerCase()) || (target && draft && !meta && target.workspace === account.toLowerCase().slice(2))))
  const version = selected ?? meta?.version ?? 0
  const live = draft ?? current
  const stale = published && published.schedule.revision !== meta?.revision
  const active = activity !== null && !state.startsWith('EVM transaction reverted') && (!receipt || !['FINALIZED','CANCELED'].includes(receipt.statusName ?? ''))
  const conflicts = live?.tasks.filter(slot => !live.people.some(member => eligible(member, slot))) ?? []
  const close = () => {setModal(null); setPerson(null); setTask(null); setDetails(null); setError('')}

  useEffect(() => {
    const provider = wallet() as (ReturnType<typeof wallet> & {on?: (key: string, fn: (...args: unknown[]) => void) => void; removeListener?: (key: string, fn: (...args: unknown[]) => void) => void})
    if (!provider) return
    const changed = (value: unknown) => setAccount(Array.isArray(value) && validAddress(value[0] || '') ? value[0] : null)
    const chain = () => setState('Wallet network changed.')
    void provider.request({method:'eth_accounts'}).then(changed).catch(() => {})
    provider.on?.('accountsChanged', changed); provider.on?.('chainChanged', chain)
    return () => {provider.removeListener?.('accountsChanged', changed); provider.removeListener?.('chainChanged', chain)}
  }, [])

  useEffect(() => {
    if (!target || !contract) return
    let canceled = false
    setLoading(true)
    void (async () => {
      const params = [target.workspace, target.event]
      const [nextMeta, nextOwner] = await Promise.all([read<EventMeta>(contract, 'event', params), read<string>(contract, 'owner', [target.workspace], false)])
      if (canceled) return
      setMeta(nextMeta); setOwner(nextOwner)
      const [next, last] = nextMeta ? await Promise.all([
        read<EventInput>(contract, 'inputs_at', [...params, nextMeta.revision]),
        nextMeta.last ? read<Attempt>(contract, 'attempt', [...params, nextMeta.last]) : null,
      ]) : [null, null]
      if (canceled) return
      setCurrent(next); setAttempt(last)
      if (next) setEvents(previous => {
        const updated = [...previous.filter(item => item.workspace !== target.workspace || item.event !== target.event), {...target, title: next.title}]
        localStorage.setItem('sq.events', JSON.stringify(updated))
        return updated
      })
    })().catch(reason => {if (!canceled) setError(String(reason.message ?? reason))}).finally(() => {if (!canceled) setLoading(false)})
    return () => {canceled = true}
  }, [contract, reload, target])

  useEffect(() => {
    setPublished(null)
    if (!target || !contract || !version) return
    let canceled = false
    void (async () => {
      const params = [target.workspace, target.event]
      const schedule = await read<Schedule>(contract, 'schedule_at', [...params, version])
      const event = schedule && await read<EventInput>(contract, 'inputs_at', [...params, schedule.revision])
      if (!canceled && schedule && event) setPublished({schedule, event})
    })().catch(reason => {if (!canceled) setError(String(reason.message ?? reason))})
    return () => {canceled = true}
  }, [contract, target, version])

  useEffect(() => {
    if (!activity) return
    let canceled = false
    let timer: number
    async function inspect() {
      if (!activity || canceled) return
      try {
        const transaction = await client.getTransaction({hash: activity.hash})
        if (canceled) return
        setReceipt(transaction)
        if (transaction.statusName === 'FINALIZED') {
          setState(succeeded(transaction) ? 'Finalized on Bradbury.' : 'Finalized without successful contract execution.')
          if (succeeded(transaction)) {
            if (activity.label === 'Deploy contract' && mayDeploy && transaction.recipient && validAddress(transaction.recipient)) {
              setContract(transaction.recipient)
              localStorage.setItem('sq.local-contract', JSON.stringify(transaction.recipient))
            }
            if (activity.label === 'Save event' && activity.target?.event === querySafeEvent()) setDraft(null)
            setSelected(null)
            refresh(value => value + 1)
          }
          return
        }
        if (transaction.statusName === 'CANCELED') {setState('Transaction canceled. You can retry.'); return}
        const lifecycle = await client.advanced.getTransactionLifecycle({hash: activity.hash}).catch(() => null)
        if (canceled) return
        setResolution(lifecycle?.resolutionAction ?? '')
        setState(transaction.statusName === 'ACCEPTED' ? 'Provisionally accepted on GenLayer.' : `GenLayer consensus · ${(transaction.statusName ?? 'pending').replaceAll('_', ' ').toLowerCase()}`)
      } catch {
        const evm = await rpc<object | null>('eth_getTransactionReceipt', [activity.hash]).catch(() => null)
        if (canceled) return
        if ((evm as {status?: string})?.status === '0x0') {setState('EVM transaction reverted before GenLayer admission.'); return}
        setState(evm ? 'EVM inclusion confirmed. Waiting for GenLayer status.' : 'Submitted. Waiting for network receipt.')
      }
      timer = window.setTimeout(inspect, 5000)
    }
    void inspect()
    return () => {canceled = true; window.clearTimeout(timer)}
  }, [activity])

  async function run(action: () => Promise<void>) {
    setBusy(true); setError('')
    try {await action()} catch (reason) {
      setState(previous => previous.startsWith('Awaiting') || previous.startsWith('Checking Bradbury') ? '' : previous)
      const value = reason as {code?: number; message?: string}
      setError(value.code === 4001 ? 'Wallet request canceled.' : value.message ?? String(reason))
    } finally {setBusy(false)}
  }
  function track(hash: Hex, label: string) {
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw Error("Invalid transaction ID returned by Bradbury.")
    const next = {hash: hash as TxHash, label, target: target ?? undefined}
    localStorage.setItem('sq.activity', JSON.stringify(next))
    setReceipt(null); setResolution(''); setActivity(next); setState('Submitted to Bradbury.')
  }
  async function write(label: string, method: string, args: (string | number)[]) {
    if (!contract || !account) throw Error('Connect a wallet to the deployed workspace first.')
    setState('Checking Bradbury and live fees.')
    const signed = await signer(account, () => setState('Awaiting wallet confirmation.'))
    const quote = await fees()
    track(await signed.writeContract({address: contract, functionName: method, args, fees: quote}), label)
  }
  function load(next: Target) {
    setTarget(next); setCurrent(null); setDraft(null); setMeta(null); setOwner(null); setAttempt(null); setSelected(null); setView('Schedule')
    const url = new URL(location.href)
    url.searchParams.set('workspace', next.workspace); url.searchParams.set('event', next.event)
    history.replaceState(null, '', url)
  }
  function savePerson(value: Person) {
    if (!live) return
    const updated = {...live, people: live.people.some(item => item.id === value.id) ? live.people.map(item => item.id === value.id ? value : item) : [...live.people, value]}
    const issue = inputError(updated)
    if (issue) setError(issue)
    else {setDraft(updated); close()}
  }
  function saveTask(value: Task) {
    if (!live) return
    const updated = {...live, tasks: live.tasks.some(item => item.id === value.id) ? live.tasks.map(item => item.id === value.id ? value : item) : [...live.tasks, value]}
    const issue = inputError(updated)
    if (issue) setError(issue)
    else {setDraft(updated); close()}
  }
  const boardEvent = published?.event ?? live
  const isDemo = target?.workspace === demo.workspace && target.event === demo.event
  const demoTransactions = deployment.demoTransactions as Record<string, string>
  const scheduleTx = isDemo && published ? demoTransactions[String(version)] : undefined
  const conflictTx = isDemo && attempt?.status === 'infeasible' ? demoTransactions.conflict : undefined

  return <div className="layout">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="ShiftQuorum home"><img src="/brand/logo.svg" alt=""/><strong>ShiftQuorum</strong></a>
      <div className="side-label">Workspace</div>
      <nav aria-label="Workspace">{views.map(([name, icon]) => <button key={name} className={view === name ? 'nav-active' : ''} onClick={() => setView(name)} aria-current={view === name ? 'page' : undefined}><span aria-hidden="true">{icon}</span>{name}</button>)}</nav>
      <div className="sidebar-end"><span className="network-dot"/> Bradbury Phase 2</div>
    </aside>
    <main><header className="topbar"><span><strong>Workspace</strong><span className="crumb"> / {view}</span></span><div className="actions">
      {account && <button onClick={() => void run(switchNetwork)}>Network</button>}
      <button onClick={() => void run(async () => setAccount(await connect()))}>{account ? account.slice(0, 6) + '…' + account.slice(-4) : 'Connect wallet'}</button>
    </div></header>
    <div className="content">
      <section className="intro"><div><div className="eyebrow">COMMUNITY SCHEDULING</div><h1>{view === 'My events' ? 'My events' : live?.title || 'Make time work.'}</h1><p>{live ? `${live.date}  ·  ${live.zone}` : 'Build a schedule around your people, not the other way around.'}</p></div><div className="actions"><button onClick={() => setModal('open')}>Open event</button><button className="primary" disabled={!account || !contract || active} onClick={() => void run(async () => {
        const own = account!.toLowerCase().slice(2)
        if (!await read<string>(contract!, 'owner', [own], false)) {await write('Create workspace', 'create_workspace', [own]); return}
        load({workspace: own, event: newId()}); setDraft(emptyEvent()); setModal('event')
      })}>+ New event</button></div></section>

      {!contract && <div className="notice">The Bradbury contract address is awaiting configuration. Published events will be available here after deployment.</div>}
      {mayDeploy && !contract && <button disabled={!account || busy || active} onClick={() => void run(async () => {
        const {default: code} = await import('../contracts/shiftquorum.py?raw')
        const signed = await signer(account!, () => setState('Awaiting wallet confirmation.'))
        track(await signed.deployContract({code, args: [], fees: await fees()}), 'Deploy contract')
      })}>Deploy ShiftQuorum contract</button>}
      {mayDeploy && contract && <div className="notice activity"><span>Contract <a href={explorer + '/address/' + contract}>{contract}</a></span>
        {canEdit && target && !active && <button onClick={() => void run(async () => {
          const {default: fixture} = await import('../fixtures/community-repair.json')
          setDraft(fixture as EventInput)
        })}>Load scheduling fixture</button>}
      </div>}
      {error && !modal && !person && !task && <p className="notice error" role="alert">{error}</p>}
      {(state || activity) && <div className="notice activity" aria-live="polite"><span><strong>{activity?.label}</strong> {state} {activity && <a href={explorer + '/tx/' + activity.hash} target="_blank" rel="noreferrer">View transaction ↗</a>}</span><div className="actions">
        {activity && resolution === 'Finalize' && receipt?.statusName !== 'FINALIZED' && <button disabled={!account || busy} onClick={() => void run(async () => {
          const signed = await signer(account!, () => setState('Awaiting wallet confirmation for finalization.'))
          const hash = await signed.finalizeTransaction({txId: activity.hash})
          setState('Finalization submitted.'); setResolution(''); localStorage.setItem('sq.finalization', hash)
        })}>Finalize transaction</button>}
        {activity && (receipt?.statusName === 'FINALIZED' || receipt?.statusName === 'CANCELED' || state.startsWith('EVM transaction reverted')) && <button onClick={() => {setActivity(null); setState(''); localStorage.removeItem('sq.activity')}}>Dismiss</button>}
      </div></div>}
      {draft && target && <div className="notice activity"><span><strong>Unsaved changes</strong> · Save inputs on Bradbury before generating.</span><div className="actions"><button disabled={active || busy} onClick={() => {setDraft(null); setError('')}}>Discard</button><button className="primary" disabled={!canEdit || busy || active} onClick={() => void run(async () => {
        const problem = inputError(draft)
        if (problem) throw Error(problem)
        await write('Save event', 'save_event', [target.workspace, target.event, meta?.revision ?? 0, JSON.stringify(draft)])
      })}>Save event</button></div></div>}
      {attempt?.status === 'infeasible' && attempt.revision === meta?.revision && <div className="notice warning"><strong>Certified scheduling conflict.</strong> No eligible participant for {current?.tasks.find(item => item.id === attempt.task)?.title ?? attempt.task}. {meta?.version ? `Schedule V${meta.version} is preserved.` : 'No schedule was published.'}</div>}
      {draft && !!conflicts.length && <div className="notice warning"><strong>Draft conflict preview.</strong> No eligible participant for {conflicts.map(item => item.title).join(', ')}.</div>}

      {view === 'My events' && <section className="surface"><div className="section-head"><h2>Recent events</h2></div>{events.length ? events.map(item => <button className="event-row" key={item.workspace + item.event} onClick={() => load(item)}><strong>{item.title}</strong><span>Open →</span></button>) : <div className="empty"><h3>Your next event starts here</h3><p>Connect a wallet and create an event, or open a shared schedule.</p></div>}</section>}
      {view === 'Schedule' && <section className="surface">
        <div className="section-head"><div><h2>Schedule board</h2><p>{published ? `Finalized schedule V${version} · Input revision ${published.schedule.revision}${stale ? ' · Earlier inputs' : ''}` : version ? 'Loading the finalized assignment snapshot…' : 'Assignments appear after GenLayer finalizes a schedule.'}</p></div>
        <div className="actions">{contract && <button onClick={() => setModal('technical')}>Schedule details</button>}{meta && meta.version > 0 && <button onClick={() => navigator.clipboard.writeText(location.href).then(() => setState('Event link copied.')).catch(() => setError('Unable to copy the link.'))}>Copy link</button>}
        <button className="primary" disabled={!contract || !account || !target || !canEdit || !meta || !current?.tasks.length || !!draft || active || busy} onClick={() => void run(async () => {
          if (target && meta) await write('Generate schedule', 'generate', [target.workspace, target.event, meta.revision, meta.version, newId()])
        })}>Generate schedule</button></div></div>
        {boardEvent ? <Board event={boardEvent} schedule={published?.schedule ?? null} onTask={setDetails}/> : <div className="empty calendar-empty"><div className="motif" aria-hidden="true"><i/><i/><i/><i/><i/></div><h3>{target ? (loading && contract ? 'Loading event…' : 'Schedule unavailable') : 'Plan your first event'}</h3><p>{target ? (loading && contract ? 'Reading current event inputs from Bradbury.' : 'Open a finalized event or create one from your workspace.') : 'Bring tasks, availability, and preferences together in one place.'}</p></div>}
      </section>}
      {(view === 'People' || view === 'Tasks') && <section className="surface"><div className="section-head"><div><h2>{view === 'People' ? 'Participants' : 'Task slots'}</h2><p>{view === 'People' ? 'Aliases, availability, and scheduling preferences.' : 'Choose the times and skills each shift needs.'}</p></div><div className="actions">
      {canEdit && live && <button onClick={() => setModal('event')}>Event details</button>}
      <button className="primary" disabled={!live || !canEdit || active || (view === 'People' ? live.people.length >= 8 : live.tasks.length >= 8)} onClick={() => view === 'People' ? setPerson({id:newId(),alias:'',skills:[],availability:[[540,720]],limit:180,preference:''}) : setTask({id:newId(),title:'',skills:[],start:540,end:600})}>{view === 'People' ? '+ Add person' : '+ Add task'}</button></div></div>
      {view === 'People' && live?.people.map(item => <div className="event-row" key={item.id}><div><strong>{item.alias}</strong><small>{item.skills.join(', ') || 'Any task'} · {item.availability.length ? item.availability.map(([a,b]) => clock(a) + '–' + clock(b)).join(', ') : 'Unavailable'} · {item.limit} min max</small>{item.preference && <small>{item.preference}</small>}</div>{canEdit && <button disabled={active} onClick={() => setPerson(item)}>Edit</button>}</div>)}
      {view === 'Tasks' && live?.tasks.map(item => <div className="event-row" key={item.id}><div><strong>{item.title}</strong><small>{clock(item.start)}–{clock(item.end)} · {item.skills.join(', ') || 'No skills required'}</small></div>{canEdit && <button disabled={active} onClick={() => setTask(item)}>Edit</button>}</div>)}
      {!(view === 'People' ? live?.people.length : live?.tasks.length) && <div className="empty"><p>{live ? `No ${view === 'People' ? 'participants' : 'task slots'} yet.` : 'Create or open an event first.'}</p></div>}
      </section>}
      {view === 'History' && <section className="surface"><div className="section-head"><div><h2>Schedule history</h2><p>Browse immutable finalized assignments.</p></div></div>
        {meta?.version ? Array.from({length: meta.version}, (_, index) => meta.version - index).map(item => <button className="event-row" key={item} onClick={() => {setSelected(item); setView('Schedule')}}><strong>Schedule V{item}</strong><span>{item === meta.version ? 'Latest · Open →' : 'Open →'}</span></button>) : <div className="empty"><p>No finalized schedules yet.</p></div>}
      </section>}
      <footer>ShiftQuorum <span>·</span> Make time work.</footer>
    </div></main>
    {modal === 'technical' && contract && <Panel title="Schedule details" close={close}>
      <p>GenLayer Bradbury Phase 2 testnet</p>
      <div className="tech-links">
        <a href={explorer + '/address/' + contract} target="_blank" rel="noreferrer">View Intelligent Contract</a>
        {scheduleTx && <a href={explorer + '/tx/' + scheduleTx} target="_blank" rel="noreferrer">Schedule V{version} transaction</a>}
        {conflictTx && <a href={explorer + '/tx/' + conflictTx} target="_blank" rel="noreferrer">Certified conflict transaction</a>}
      </div>
    </Panel>}
    {modal === 'open' && <Panel title="Open a published event" close={close}><form onSubmit={e => {
      e.preventDefault()
      if (!idPattern.test(openId) || !idPattern.test(openEvent)) {setError('Enter a valid workspace and event ID.'); return}
      load({workspace:openId,event:openEvent}); close()
    }}><label>Workspace ID<input value={openId} onChange={e => setOpenId(e.target.value.trim())} required/></label><label>Event ID<input value={openEvent} onChange={e => setOpenEvent(e.target.value.trim())} required/></label>{error && <p role="alert" className="error">{error}</p>}<button className="primary">Open event</button>{demo.workspace && <button type="button" onClick={() => {load(demo); close()}}>Open public demonstration</button>}</form></Panel>}
    {modal === 'event' && live && <Panel title="Event details" close={close}><form onSubmit={e => {
      e.preventDefault()
      const data = new FormData(e.currentTarget)
      const next = {...live,title:String(data.get('title')).trim(),date:String(data.get('date')),zone:String(data.get('zone')).trim()}
      const issue = inputError(next)
      if (issue) setError(issue)
      else {setDraft(next); close(); setView('People')}
    }}><label>Event title<input name="title" defaultValue={live.title} maxLength={80} required/></label><label>Date<input name="date" type="date" defaultValue={live.date} required/></label><label>Time zone · fixed UTC offset<input name="zone" defaultValue={live.zone} required/></label><p className="privacy">Event data is public and permanent. Use aliases. Leave out real names, contact details, addresses, health information, and confidential details.</p>{error && <p role="alert" className="error">{error}</p>}<button className="primary">Apply details</button></form></Panel>}
    {person && <Panel title={person.alias ? 'Edit participant' : 'Add participant'} close={close}><p className="privacy">Use aliases and keep personal details and sensitive reasons offchain.</p>{error && <p role="alert" className="error">{error}</p>}<PersonEditor person={person} save={savePerson} remove={live?.people.some(item => item.id === person.id) ? () => {setDraft({...live!, people: live!.people.filter(item => item.id !== person.id)}); close()} : undefined}/></Panel>}
    {task && <Panel title={task.title ? 'Edit task' : 'Add task'} close={close}>{error && <p role="alert" className="error">{error}</p>}<TaskEditor task={task} save={saveTask} remove={live?.tasks.some(item => item.id === task.id) ? () => {setDraft({...live!, tasks: live!.tasks.filter(item => item.id !== task.id)}); close()} : undefined}/></Panel>}
    {details && <Panel title={details.title} close={close}><p>{clock(details.start)}–{clock(details.end)} · {details.end - details.start} minutes</p><p>Assigned to {published?.event.people.find(item => item.id === published.schedule.assignments[details.id])?.alias}</p><p>{details.skills.length ? 'Required skills · ' + details.skills.join(', ') : 'No required skills'}</p></Panel>}
  </div>
}

createRoot(document.getElementById('root')!).render(<App/>)
