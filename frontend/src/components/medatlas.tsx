"use client";

import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Asterisk, ChartNoAxesCombined, Download, FileText, Heart, LogOut, Pause, Play, Plus, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
type Profile = { userId: string; name: string; dateOfBirth: string };
async function auth<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/auth/${path}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail || "Please try again.");
  return result as T;
}

type Panel = "documents" | "trends" | "insurance" | null;
type LocalDocument = { id: string; name: string; size: number; status: "processing" | "ready" | "rejected"; detail?: string };
type InsuranceSource = { id: string; filename: string; medical_category: string };
type LocalWritable = { write: (data: Blob) => Promise<void>; close: () => Promise<void> };
type LocalDirectory = { getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<LocalDirectory>; getFileHandle: (name: string, options?: { create?: boolean }) => Promise<{ createWritable: () => Promise<LocalWritable> }> };
const CLAIM_DOCUMENTS = [
  ["Claim Form", "Duly filled and signed by the patient or policyholder and the treating hospital; this is the formal reimbursement request."],
  ["Original Discharge Summary", "Complete hospitalization narrative with admission date, diagnosis, line of treatment, procedures, and discharge advice."],
  ["Itemized Hospital Bills and Receipts", "Final granular hospital bill with room rent, operating theater, doctor fees, and original stamped payment receipts."],
  ["Diagnostic Reports and Requisitions", "Pathology and imaging reports accompanied by the doctor's notes prescribing those tests."],
  ["Pharmacy Invoices and Prescriptions", "Original itemized chemist bills paired with the corresponding medically necessary prescriptions."],
  ["Initial Consultation Papers", "The first OPD prescription or referral note recommending hospitalization or surgery."],
  ["Patient KYC and Insurance ID", "Government identity proof such as Aadhaar, PAN, or Passport, plus the Health Insurance or TPA ID card."],
  ["Cancelled Cheque", "Voided cheque printed with the policyholder's name, account number, and routing code for NEFT/RTGS."],
] as const;
const emptyProfile = { name: "", dateOfBirth: "", password: "" };

function Brand({ small = false }: { small?: boolean }) {
  return <span className={`brand ${small ? "brand-small" : ""}`}>MedAtlas<span className="brand-dot">✳</span></span>;
}

function Login({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (profile: Profile) => void }) {
  const [mode, setMode] = useState<"login" | "create">("login");
  const [profile, setProfile] = useState(emptyProfile);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const localToday = new Date();
  const today = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, "0")}-${String(localToday.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    if (!open) { setMode("login"); setProfile(emptyProfile); setError(""); }
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const cleaned = { name: String(fields.get("name") ?? "").trim(), dateOfBirth: String(fields.get("dateOfBirth") ?? ""), password: String(fields.get("password") ?? "") };
    if (!cleaned.name || !cleaned.dateOfBirth || cleaned.dateOfBirth > today || cleaned.dateOfBirth < "1900-01-01" || cleaned.password.length < 8) { setError("Enter your name, valid date of birth, and an 8-character password."); return; }
    setBusy(true); setError("");
    try {
      const result = await auth<{ profile: Profile }>(mode === "create" ? "create" : "login", cleaned);
      onSuccess(result.profile);
    }
    catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="login-dialog">
      <div className="auth-art" aria-hidden="true"><span className="auth-script">Hello,<br/>you.</span><Asterisk className="auth-star" strokeWidth={1.4}/><span className="auth-caption">A LITTLE CLARITY.<br/>A LOT MORE YOU.</span></div>
      <div className="auth-main">
        <span className="eyebrow">YOUR PERSONAL HEALTH SPACE</span>
        <DialogTitle className="auth-title">{mode === "login" ? "Welcome back." : "Create your account."}</DialogTitle>
        <DialogDescription className="auth-description">{mode === "login" ? "Enter your account details to open your private health space." : "Your name, date of birth, and password create a separate local account."}</DialogDescription>
        <div className="auth-mode" role="tablist" aria-label="Authentication mode">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => { setMode("login"); setError(""); }}>Log in</button>
          <button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? "is-active" : ""} onClick={() => { setMode("create"); setError(""); }}>Create your account</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          <label htmlFor="full-name">Your name<input id="full-name" name="name" autoComplete="name" placeholder="What should we call you?" maxLength={80} defaultValue={profile.name} required /></label>
          <label htmlFor="birth-date">Date of birth<input id="birth-date" name="dateOfBirth" autoComplete="bday" type="date" min="1900-01-01" max={today} defaultValue={profile.dateOfBirth} required /></label>
          <label htmlFor="account-password">Password<input id="account-password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" minLength={8} maxLength={128} placeholder="At least 8 characters" required /></label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="button button-dark auth-submit" disabled={busy} type="submit">{busy ? "Opening…" : mode === "login" ? "Log in" : "Create account"}<ArrowRight size={19}/></button>
          <p className="demo-notice"><Sparkles size={15}/><span>Accounts and medical data stay on this device.</span></p>
        </form>
      </div>
    </DialogContent>
  </Dialog>;
}

function Landing({ onLogin }: { onLogin: () => void }) {
  const [paused, setPaused] = useState(false);
  return <main className={`landing ${paused ? "motion-paused" : ""}`} id="main-content">
    <header className="landing-header"><a className="home-link" href="#" aria-label="MedAtlas home"><Brand small/></a><span className="nav-note">HEALTH IS PERSONAL. <span>MAKE IT YOURS.</span></span><button className="button button-dark nav-login" onClick={onLogin}>Log in<ArrowUpRight size={18}/></button></header>
    <section className="hero" aria-labelledby="medatlas-title">
      <div className="hero-copy"><div className="brain-backdrop" aria-hidden="true"/><div className="spark-field" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
        <div className="hero-eyebrow"><span className="tiny-cross"><Plus size={14}/></span>MEET YOUR HEALTH'S NEW HAPPY PLACE</div>
        <h1 id="medatlas-title" tabIndex={-1} className="hero-wordmark">MedAtlas<span className="title-spark" aria-hidden="true">✳</span></h1>
        <h2 className="hero-description">Your <span>second brain</span><br/>for all your<br className="desktop-break"/> medical problems</h2>
        <div className="hero-bottom"><button className="button hero-cta" onClick={onLogin}>Make space for you<span className="button-circle"><ArrowUpRight size={24}/></span></button><p>Less scattered.<br/>More connected. <Heart size={14}/></p></div>
        <span className="hero-index" aria-hidden="true">YOUR STORY, ALL TOGETHER. / 01</span>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <div className="visual-heading">A HEALTHIER<br/><span>headspace.</span></div>
        <div className="orbit-ring orbit-one"/><div className="orbit-ring orbit-two"/>
        <div className="hero-image-wrap"><img src="/images/medatlas-sculpture.png" alt="" className="hero-sculpture" width="1024" height="1024" fetchPriority="high"/></div>
        <span className="floating-sticker sticker-you">100%<br/><strong>YOU.</strong></span>
        <span className="floating-sticker sticker-connected"><Asterisk size={22}/>IT'S ALL CONNECTED</span>
        <span className="visual-footer">BIG PICTURE ENERGY.</span><span className="visual-plus">+</span>
      </div>
    </section>
    <div className="marquee" aria-hidden="true"><div className="marquee-track">{[0,1,2,3].map(i => <span key={i}>YOUR BODY <Asterisk/> YOUR STORY <Asterisk/> YOUR ATLAS <Asterisk/></span>)}</div></div>
    <footer className="landing-footer"><span>A little more clarity. A little more you.</span><button className="motion-toggle" aria-label={paused ? "Play animations" : "Pause animations"} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={14}/> : <Pause size={14}/>} {paused ? "Play motion" : "Pause motion"}</button><span>MADE FOR YOUR EVERYDAY.</span></footer>
  </main>;
}

function FeaturePanel({ panel, onClose, documents, setDocuments }: { panel: Panel; onClose: () => void; documents: LocalDocument[]; setDocuments: Dispatch<SetStateAction<LocalDocument[]>> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; citations: { filename: string; page_number: number }[]; abstained: boolean } | null>(null);
  const [questionError, setQuestionError] = useState("");
  const [asking, setAsking] = useState(false);
  const [policyId, setPolicyId] = useState("");
  const [policySubmitted, setPolicySubmitted] = useState(false);
  const [claimChecklist, setClaimChecklist] = useState<Record<number, boolean>>({});
  const [insuranceSources, setInsuranceSources] = useState<InsuranceSource[]>([]);
  const [insuranceError, setInsuranceError] = useState("");
  const [savingInsurance, setSavingInsurance] = useState(false);
  const [insuranceSaved, setInsuranceSaved] = useState("");
  const titles = { documents: "Your documents", trends: "Your health trends", insurance: "Your insurance claim" };
  const allClaimDocumentsReady = CLAIM_DOCUMENTS.every((_, index) => claimChecklist[index]);

  useEffect(() => {
    if (panel !== "insurance" || !policySubmitted) return;
    let active = true;
    setInsuranceError(""); setInsuranceSaved("");
    fetch("/api/sources", { credentials: "same-origin" })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Could not load insurance documents.");
        if (active) setInsuranceSources((result.sources || []).filter((source: InsuranceSource) => source.medical_category === "Insurance & Consent"));
      })
      .catch(error => { if (active) setInsuranceError(error instanceof Error ? error.message : "Could not load insurance documents."); });
    return () => { active = false; };
  }, [panel, policySubmitted]);
  async function addFiles(files: FileList | null) {
    if (!files) return;
    const accepted: LocalDocument[] = [];
    const validFiles: File[] = [];
    let invalid = false;
    Array.from(files).forEach(file => {
      if (!/\.pdf$/i.test(file.name) || file.size > 10 * 1024 * 1024) { invalid = true; return; }
      accepted.push({ id: crypto.randomUUID(), name: file.name, size: file.size, status: "processing" });
      validFiles.push(file);
    });
    setFileError(invalid ? "Choose PDF files under 10 MB each." : "");
    if (!accepted.length) return;
    setDocuments(previous => [...previous, ...accepted]);
    setUploading(true);
    for (const [index, file] of validFiles.entries()) {
      const item = accepted[index];
      if (!item) continue;
      const body = new FormData();
      body.append("file", file);
      try {
        const response = await fetch("/api/ingest/pdf", { method: "POST", body, credentials: "same-origin" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Document rejected.");
        const ingested = result.ingested;
        setDocuments(previous => previous.map(document => document.id === item.id ? { ...document, status: "ready", detail: `${ingested.medical_category} · ${ingested.chunk_count} chunks` } : document));
      } catch (error) {
        setDocuments(previous => previous.map(document => document.id === item.id ? { ...document, status: "rejected", detail: error instanceof Error ? error.message : "Document rejected." } : document));
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }
  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = question.trim();
    if (!query || asking) return;
    setAsking(true); setQuestionError(""); setAnswer(null);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ query }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "The local health pipeline could not answer.");
      setAnswer(result);
    } catch (error) { setQuestionError(error instanceof Error ? error.message : "The local health pipeline could not answer."); }
    finally { setAsking(false); }
  }
  function submitPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (policyId.trim()) { setInsuranceError(""); setInsuranceSaved(""); setPolicySubmitted(true); }
  }
  async function saveInsuranceBundle() {
    const picker = (window as unknown as { showDirectoryPicker?: (options?: { mode: "readwrite" }) => Promise<LocalDirectory> }).showDirectoryPicker;
    if (!picker) { setInsuranceError("Folder saving is unavailable in this browser. Use Brave, Chrome, or Edge."); return; }
    setSavingInsurance(true); setInsuranceError(""); setInsuranceSaved("");
    try {
      const parent = await picker({ mode: "readwrite" });
      const folder = await parent.getDirectoryHandle("Insurance documents", { create: true });
      const usedNames = new Set<string>();
      for (const source of insuranceSources) {
        const response = await fetch(`/api/documents/${encodeURIComponent(source.id)}/file`, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`Could not read ${source.filename}.`);
        const original = source.filename || `document-${source.id}`;
        const extension = original.includes(".") ? original.slice(original.lastIndexOf(".")) : ".pdf";
        const base = original.slice(0, original.length - extension.length) || "document";
        let filename = original; let copy = 2;
        while (usedNames.has(filename)) filename = `${base} (${copy++})${extension}`;
        usedNames.add(filename);
        const writable = await (await folder.getFileHandle(filename, { create: true })).createWritable();
        await writable.write(await response.blob());
        await writable.close();
      }
      setInsuranceSaved(`Saved ${insuranceSources.length} document${insuranceSources.length === 1 ? "" : "s"} in the Insurance documents folder.`);
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setInsuranceError(error instanceof Error ? error.message : "Could not save the insurance documents.");
    } finally { setSavingInsurance(false); }
  }
  return <Sheet open={panel !== null} onOpenChange={value => { if (!value) { setFileError(""); onClose(); } }}>
    <SheetContent className="feature-sheet">
      <SheetHeader><span className="eyebrow">YOUR MEDATLAS</span><SheetTitle className="panel-title">{panel ? titles[panel] : "Your health space"}</SheetTitle><SheetDescription className="panel-description">{panel === "documents" ? "One place for the pieces of your health story." : panel === "trends" ? "A clearer picture of your health over time." : "A little less paperwork. A little more peace of mind."}</SheetDescription></SheetHeader>
      {panel === "documents" ? <div className="panel-body">
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="sr-only" tabIndex={-1} aria-label="Upload medical documents" onChange={e => void addFiles(e.target.files)}/>
        <button disabled={uploading} className={`upload-zone ${dragging ? "is-dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}><span className="upload-icon"><Upload size={27}/></span><strong>{uploading ? "Processing offline…" : "Upload your documents"}</strong><span>Click or drop PDF files here</span><small>Medical checks, processing, and storage stay on this device</small></button>
        {fileError && <p className="form-error" role="alert">{fileError}</p>}
        <p className="panel-note">Each upload starts the complete offline medical-document pipeline. Non-medical files are rejected before indexing.</p>
        {documents.length > 0 && <><div className="file-list-heading">PROCESSING STATUS <span>{documents.length}</span></div><ul className="file-list">{documents.map(doc => <li key={doc.id}><FileText size={23}/><span><strong>{doc.name}</strong><small className={doc.status === "rejected" ? "file-status-rejected" : ""}>{doc.status === "processing" ? "Processing offline…" : doc.status === "ready" ? doc.detail : doc.detail}</small></span></li>)}</ul></>}
      </div> : <div className="panel-body">{panel === "trends" ? <>
        <div className="empty-panel empty-trends"><ChartNoAxesCombined size={57} strokeWidth={1.3}/><h3>Ask about your health.</h3><p>Answers are grounded in your accepted medical documents and checked by the local safety pipeline.</p></div>
        <form className="question-form" onSubmit={askQuestion}><label htmlFor="health-question">Your question</label><div className="question-row"><input id="health-question" className="question-input" value={question} onChange={event => setQuestion(event.target.value)} maxLength={1000} placeholder="What does my latest report say?"/><button className="button button-dark" type="submit" disabled={asking || !question.trim()}>{asking ? "Checking…" : "Ask"}</button></div></form>
        {questionError && <p className="form-error" role="alert">{questionError}</p>}
        {answer && <div className={`question-answer ${answer.abstained ? "is-abstained" : ""}`}><strong>{answer.abstained ? "I could not verify that from your sources." : "Verified from your sources"}</strong><p>{answer.answer}</p>{answer.citations?.length > 0 && <ul className="citation-list">{answer.citations.map((citation, index) => <li key={`${citation.filename}-${citation.page_number}-${index}`}>[{index + 1}] {citation.filename} · page {citation.page_number}</li>)}</ul>}</div>}
        <p className="panel-note">Questions are sent only to the local MedAtlas backend. Diagnosis, treatment, and unsupported answers are blocked or declined.</p>
      </> : <>{panel === "insurance" ? <>
        <form className="policy-form" onSubmit={submitPolicy}><label htmlFor="policy-reference">Insurance policy reference ID</label><div className="question-row"><input id="policy-reference" className="question-input" value={policyId} onChange={event => { setPolicyId(event.target.value); setPolicySubmitted(false); setClaimChecklist({}); setInsuranceSources([]); setInsuranceSaved(""); }} placeholder="Enter your policy reference" maxLength={120} required/><button className="button button-dark" type="submit">Continue</button></div></form>
        {policySubmitted && <div className="claim-checklist"><div className="claim-heading"><strong>CLAIM CHECKLIST</strong><span>{CLAIM_DOCUMENTS.filter((_, index) => claimChecklist[index]).length}/{CLAIM_DOCUMENTS.length}</span></div><p className="policy-label">Policy reference: <strong>{policyId.trim()}</strong></p>{CLAIM_DOCUMENTS.map(([title, description], index) => <label className={`claim-item ${claimChecklist[index] ? "is-done" : ""}`} key={title}><input type="checkbox" checked={Boolean(claimChecklist[index])} onChange={event => setClaimChecklist(previous => ({ ...previous, [index]: event.target.checked }))}/><span><strong>{index + 1}. {title}</strong><small>{description}</small></span></label>)}{CLAIM_DOCUMENTS.some((_, index) => !claimChecklist[index]) ? <p className="claim-reminder">Reminder: upload the unchecked documents so your claim process remains hassle-free.</p> : <p className="claim-complete">All required documents are marked ready.</p>}
          <div className="insurance-sources"><div className="claim-heading"><strong>TAGGED INSURANCE DOCUMENTS</strong><span>{insuranceSources.length}</span></div>{insuranceSources.length ? <ul className="insurance-source-list">{insuranceSources.map(source => <li key={source.id}><FileText size={16}/><span>{source.filename}</span></li>)}</ul> : <p className="policy-label">No uploaded documents tagged “Insurance & Consent” were found yet.</p>}</div>
          <button className="button button-dark insurance-save" type="button" disabled={!allClaimDocumentsReady || !insuranceSources.length || savingInsurance} onClick={() => void saveInsuranceBundle()}><Download size={17}/>{savingInsurance ? "Saving offline…" : "Bundle and save offline"}</button>
          {insuranceError && <p className="form-error" role="alert">{insuranceError}</p>}{insuranceSaved && <p className="claim-complete" role="status">{insuranceSaved}</p>}
        </div>}
        {!policySubmitted && <div className="empty-panel empty-insurance"><ShieldCheck size={57} strokeWidth={1.3}/><h3>A clearer path to your claim.</h3><p>Enter your policy reference to see the required documents.</p></div>}
      </> : <><div className="empty-panel empty-insurance"><ShieldCheck size={57} strokeWidth={1.3}/><h3>A clearer path to your claim.</h3><p>Your policy documents, claim details, and progress will come together here.</p><span className="preview-label">FRONTEND PREVIEW</span></div><p className="panel-note">Claim management will be connected in the next build. No claim has been submitted.</p></>}</>}</div>}
    </SheetContent>
  </Sheet>;
}

function Dashboard({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const firstName = profile.name.split(/\s+/)[0];
  const cards = [
    { id: "documents" as const, number: "01", className: "card-documents", Icon: FileText, title: <>UPLOAD YOUR<br/>DOCUMENTS</>, description: "Every report. Every prescription. One home.", action: documents.length ? `${documents.length} document${documents.length !== 1 ? "s" : ""} selected` : "Bring it all together", motif: "All your pieces." },
    { id: "trends" as const, number: "02", className: "card-trends", Icon: ChartNoAxesCombined, title: <>YOUR HEALTH<br/>TRENDS</>, description: "Small changes. A much bigger picture.", action: "See the bigger picture", motif: "Find your rhythm." },
    { id: "insurance" as const, number: "03", className: "card-insurance", Icon: ShieldCheck, title: <>YOUR INSURANCE<br/>CLAIM</>, description: "Make room for care. Less for paperwork.", action: "Take the next step", motif: "A little peace of mind." },
  ];
  return <main className="dashboard" id="main-content"><div className="heart-backdrop" aria-hidden="true"/><div className="heartbeat-line" aria-hidden="true"/>
    <header className="dashboard-header"><Brand small/><span className="workspace-label">YOUR HEALTH SPACE</span><div className="profile-controls"><span className="profile-name"><span className="avatar">{firstName.slice(0, 1).toUpperCase()}</span>{firstName}</span><button className="signout" onClick={onSignOut}><LogOut size={17}/><span>Log out</span></button></div></header>
    <section className="dashboard-content" aria-labelledby="dashboard-title">
      <div className="dashboard-intro"><div><span className="eyebrow">A FRESH PERSPECTIVE, JUST FOR YOU</span><h1 id="dashboard-title" tabIndex={-1}>Hey {firstName},<br/>let's connect <span>the dots.</span></h1></div><div className="intro-note"><Asterisk size={55} strokeWidth={1.4}/><p>Your health story.<br/>A little more together.</p></div></div>
      <div className="dashboard-section-label"><span>YOUR NEXT CHAPTER STARTS HERE</span><ArrowDown size={18}/></div>
      <div className="feature-grid">{cards.map(({ id, number, className, Icon, title, description, action, motif }) => <button key={id} className={`feature-card ${className}`} onClick={() => setPanel(id)}><div className="card-top"><span>{number} / YOUR ATLAS</span><span className="card-open"><ArrowUpRight size={23}/></span></div><div className="card-art"><span className="card-icon"><Icon size={62} strokeWidth={1.3}/></span><span className="card-motif">{motif}</span></div><h2>{title}</h2><p>{description}</p><span className="card-action">{action}<ArrowRight size={19}/></span></button>)}</div>
      <div className="dashboard-footer"><p><Heart size={16}/>Made for you. At your pace.</p><span>DOCUMENT AND CLAIM PREVIEW</span></div>
    </section>
    <FeaturePanel panel={panel} onClose={() => setPanel(null)} documents={documents} setDocuments={setDocuments}/>
  </main>;
}

export default function MedAtlas() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const transitionRef = useRef(false);
  useEffect(() => { auth<{ profile: Profile | null }>("status").then(state => setProfile(state.profile)).catch(() => {}); }, []);
  useEffect(() => {
    if (transitionRef.current) {
      window.scrollTo({ top: 0 });
      document.querySelector<HTMLElement>(profile ? "#dashboard-title" : "#medatlas-title")?.focus();
    }
    transitionRef.current = true;
  }, [profile]);
  async function signOut() { await auth("logout", {}); setProfile(null); }
  return <><a className="skip-link" href="#main-content">Skip to content</a>{profile ? <Dashboard profile={profile} onSignOut={() => void signOut()}/> : <Landing onLogin={() => setLoginOpen(true)}/>}<Login open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={user => { setProfile(user); setLoginOpen(false); }}/></>;
}
