"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Asterisk, ChartNoAxesCombined, FileText, Heart, LogOut, Pause, Play, Plus, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
type Profile = { name: string; dateOfBirth: string; mobile: string };
async function auth<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/auth/${path}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail || "Please try again.");
  return result as T;
}

type Panel = "documents" | "trends" | "insurance" | null;
type LocalDocument = { id: string; name: string; size: number };
const emptyProfile: Profile = { name: "", dateOfBirth: "", mobile: "" };

function Brand({ small = false }: { small?: boolean }) {
  return <span className={`brand ${small ? "brand-small" : ""}`}>MedAtlas<span className="brand-dot">✳</span></span>;
}

function Login({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (profile: Profile) => void }) {
  const [step, setStep] = useState<"profile" | "code">("profile");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [enrolled, setEnrolled] = useState(true);
  const [qr, setQr] = useState("");
  const [manualKey, setManualKey] = useState("");
  const localToday = new Date();
  const today = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, "0")}-${String(localToday.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    if (!open) { setStep("profile"); setProfile(emptyProfile); setCode(""); setError(""); setQr(""); setManualKey(""); }
    else auth<{ enrolled: boolean }>("status").then(state => setEnrolled(state.enrolled)).catch(() => setError("Cannot reach the authentication service."));
  }, [open]);

  async function continueLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const cleaned = { name: String(fields.get("name") ?? "").trim(), dateOfBirth: String(fields.get("dateOfBirth") ?? ""), mobile: String(fields.get("mobile") ?? "").trim() };
    if (!cleaned.name || !cleaned.mobile || !cleaned.dateOfBirth || cleaned.dateOfBirth > today || cleaned.dateOfBirth < "1900-01-01") {
      setError("Please enter your name, mobile number, and a valid date of birth."); return;
    }
    setBusy(true); setError("");
    try {
      if (!enrolled) {
        const setup = await auth<{ qr: string; manualKey: string }>("enroll", cleaned);
        setQr(setup.qr); setManualKey(setup.manualKey);
      }
      setProfile(cleaned); setCode(""); setStep("code");
    }
    catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await auth<{ profile: Profile }>(enrolled ? "login" : "activate", enrolled ? { ...profile, code } : { code });
      setQr(""); setManualKey(""); onSuccess(result.profile);
    }
    catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="login-dialog">
      <div className="auth-art" aria-hidden="true"><span className="auth-script">Hello,<br/>you.</span><Asterisk className="auth-star" strokeWidth={1.4}/><span className="auth-caption">A LITTLE CLARITY.<br/>A LOT MORE YOU.</span></div>
      <div className="auth-main">
        <span className="eyebrow">YOUR PERSONAL HEALTH SPACE</span>
        <DialogTitle className="auth-title">{step === "profile" ? "Let's make it personal." : "One code. You're in."}</DialogTitle>
        <DialogDescription className="auth-description">{step === "profile" ? "Your health story starts with you." : enrolled ? <>Enter the code from your authenticator app for <strong>{profile.name}</strong>.</> : "Scan this QR code once with your authenticator app, then enter its current code."}</DialogDescription>
        {step === "profile" ? <form onSubmit={continueLogin} className="auth-form">
          <label htmlFor="full-name">Your name<input id="full-name" name="name" autoComplete="name" placeholder="What should we call you?" maxLength={80} defaultValue={profile.name} required /></label>
          <label htmlFor="birth-date">Date of birth<input id="birth-date" name="dateOfBirth" autoComplete="bday" type="date" min="1900-01-01" max={today} defaultValue={profile.dateOfBirth} required /></label>
          <label htmlFor="mobile">Mobile number<input id="mobile" name="mobile" type="tel" autoComplete="tel" placeholder="Your mobile number" maxLength={20} defaultValue={profile.mobile} required /></label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="button button-dark auth-submit" disabled={busy} type="submit">{busy ? "Preparing…" : enrolled ? "Continue" : "Set up authenticator"}<ArrowRight size={19}/></button>
          <p className="demo-notice"><Sparkles size={15}/><span>Your authenticator generates codes offline. Your mobile number is an account detail; no SMS is sent.</span></p>
        </form> : <form className="auth-form code-form" onSubmit={verify}>
          {!enrolled && qr && <div className="enrollment-qr"><img src={qr} alt="Scan with an authenticator app" width={170} height={170}/><small>Can't scan? Enter this key manually: <strong>{manualKey}</strong></small></div>}
          <label htmlFor="verification-code">Your 6-digit code</label>
          <InputOTP id="verification-code" aria-label="Your 6-digit code" inputMode="numeric" autoComplete="one-time-code" pattern="^[0-9]*$" maxLength={6} value={code} onChange={value => { setCode(value); setError(""); }}>
            <InputOTPGroup className="otp-group">{[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="otp-slot"/>)}</InputOTPGroup>
          </InputOTP>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button type="submit" className="button button-dark auth-submit" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Open my MedAtlas"}<ArrowRight size={19}/></button>
          <div className="code-actions"><button type="button" onClick={() => { setStep("profile"); setError(""); setCode(""); }}><ArrowLeft size={15}/>Edit details</button></div>
        </form>}
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

function FeaturePanel({ panel, onClose, documents, setDocuments }: { panel: Panel; onClose: () => void; documents: LocalDocument[]; setDocuments: (docs: LocalDocument[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const titles = { documents: "Your documents", trends: "Your health trends", insurance: "Your insurance claim" };
  function addFiles(files: FileList | null) {
    if (!files) return;
    const accepted: LocalDocument[] = [];
    let invalid = false;
    Array.from(files).forEach(file => {
      if (!/\.(pdf|png|jpe?g)$/i.test(file.name) || file.size > 20 * 1024 * 1024) { invalid = true; return; }
      // Keep metadata only. No upload, document reading, or cloud storage occurs.
      accepted.push({ id: crypto.randomUUID(), name: file.name, size: file.size });
    });
    setDocuments([...documents, ...accepted]);
    setFileError(invalid ? "Choose PDF, JPG, or PNG files under 20 MB each." : "");
    if (inputRef.current) inputRef.current.value = "";
  }
  return <Sheet open={panel !== null} onOpenChange={value => { if (!value) { setFileError(""); onClose(); } }}>
    <SheetContent className="feature-sheet">
      <SheetHeader><span className="eyebrow">YOUR MEDATLAS</span><SheetTitle className="panel-title">{panel ? titles[panel] : "Your health space"}</SheetTitle><SheetDescription className="panel-description">{panel === "documents" ? "One place for the pieces of your health story." : panel === "trends" ? "A clearer picture of your health over time." : "A little less paperwork. A little more peace of mind."}</SheetDescription></SheetHeader>
      {panel === "documents" ? <div className="panel-body">
        <a href="/workspace" className="button button-dark workspace-link">Open local medical workspace <ArrowUpRight size={18}/></a>
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="sr-only" tabIndex={-1} aria-label="Select medical documents" onChange={e => addFiles(e.target.files)}/>
        <button className={`upload-zone ${dragging ? "is-dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}><span className="upload-icon"><Upload size={27}/></span><strong>Drop your documents here</strong><span>or click to browse your files</span><small>PDF, JPG, PNG · Up to 20 MB each</small></button>
        {fileError && <p className="form-error" role="alert">{fileError}</p>}
        <p className="panel-note">This preview keeps selected filenames on this page. Use the local medical workspace to ingest and search medical documents.</p>
        {documents.length > 0 && <><div className="file-list-heading">SELECTED DOCUMENTS <span>{documents.length}</span></div><ul className="file-list">{documents.map(doc => <li key={doc.id}><FileText size={23}/><span><strong>{doc.name}</strong><small>{doc.size < 1024 * 1024 ? `${Math.max(1, Math.round(doc.size / 1024))} KB` : `${(doc.size / (1024 * 1024)).toFixed(1)} MB`} · Selected locally</small></span><button aria-label={`Remove ${doc.name}`} onClick={() => setDocuments(documents.filter(d => d.id !== doc.id))}><X size={18}/></button></li>)}</ul></>}
      </div> : <div className="panel-body"><div className={`empty-panel ${panel === "trends" ? "empty-trends" : "empty-insurance"}`}>
        {panel === "trends" ? <ChartNoAxesCombined size={57} strokeWidth={1.3}/> : <ShieldCheck size={57} strokeWidth={1.3}/>}
        <h3>{panel === "trends" ? "Your bigger picture starts here." : "A clearer path to your claim."}</h3><p>{panel === "trends" ? "Your health measurements and their changes over time will appear here." : "Your policy documents, claim details, and progress will come together here."}</p><span className="preview-label">FRONTEND PREVIEW</span>
      </div><p className="panel-note">{panel === "trends" ? "Health analysis will be connected in the next build. No medical results have been generated." : "Claim management will be connected in the next build. No claim has been submitted."}</p></div>}
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
