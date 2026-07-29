"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Module = "dashboard" | "log" | "asset" | "mccb";
type RecordItem = {
  id: string;
  module: Exclude<Module, "dashboard">;
  title: string;
  subtitle: string;
  status: string;
  date: string;
  data: Record<string, string>;
};

const STORAGE_KEY = "qrnova-lab-records";
const DRIVE_TOKEN_KEY = "qrnova-drive-token";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw4zPOHM9jx4xoNYOAliZxCW-0FfCVeJalFpP9_UnCrIMFv03zaIcAbWNkjCk5hlBbiiQ/exec";
const tabs: { id: Module; label: string; short: string; icon: string }[] = [
  { id: "dashboard", label: "Ringkasan", short: "Utama", icon: "⌂" },
  { id: "log", label: "Buku Log", short: "Log", icon: "✓" },
  { id: "asset", label: "KEW.PA-9", short: "Aset", icon: "↗" },
  { id: "mccb", label: "MCCB Test", short: "MCCB", icon: "⚡" },
];

const seed: RecordItem[] = [
  { id: "demo-1", module: "log", title: "Makmal Kuasa", subtitle: "Amali perlindungan litar", status: "Hadir", date: "2026-07-29", data: {} },
  { id: "demo-2", module: "asset", title: "PA-9 • Multimeter Fluke", subtitle: "Muhammad Aiman", status: "Menunggu", date: "2026-07-29", data: {} },
  { id: "demo-3", module: "mccb", title: "MCCB • TR-026", subtitle: "Schneider NSX100", status: "Lulus", date: "2026-07-28", data: {} },
];

const field = (label: string, name: string, type = "text", required = false, placeholder = "") => (
  <label className="field">
    <span>{label}{required && <b> *</b>}</span>
    <input name={name} type={type} required={required} placeholder={placeholder} />
  </label>
);

export default function Home() {
  const [active, setActive] = useState<Module>("dashboard");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [driveState, setDriveState] = useState<"offline" | "ready" | "syncing">("offline");
  const [driveToken, setDriveToken] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setRecords(saved ? JSON.parse(saved) : seed);
    const token = localStorage.getItem(DRIVE_TOKEN_KEY) || "";
    setDriveToken(token);
    setDriveState(token ? "ready" : "offline");
  }, []);

  useEffect(() => {
    if (records.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const stats = useMemo(() => ({
    log: records.filter(r => r.module === "log").length,
    asset: records.filter(r => r.module === "asset" && r.status !== "Dipulangkan").length,
    mccb: records.filter(r => r.module === "mccb").length,
    pass: records.filter(r => r.module === "mccb" && r.status === "Lulus").length,
  }), [records]);

  const save = async (module: RecordItem["module"], form: HTMLFormElement) => {
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const today = new Date().toISOString().slice(0, 10);
    const item: RecordItem = {
      id: crypto.randomUUID(),
      module,
      title: module === "log" ? data.makmal : module === "asset" ? `PA-9 • ${data.aset}` : `MCCB • ${data.rujukan}`,
      subtitle: module === "log" ? data.aktiviti : module === "asset" ? data.nama : `${data.jenama} ${data.model}`,
      status: module === "log" ? data.kehadiran : module === "asset" ? "Menunggu" : data.keputusan,
      date: data.tarikh || today,
      data,
    };
    setRecords(prev => [item, ...prev]);
    form.reset();
    setActive("dashboard");

    if (!driveToken) {
      setToast("Disimpan pada peranti • Sambungkan Google untuk simpan ke Drive");
      setTimeout(() => setToast(""), 3200);
      return;
    }

    setDriveState("syncing");
    setToast("Menyimpan ke Google Sheets…");
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ token: driveToken, module, data: { ...data, id: item.id } }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Sambungan Google gagal.");
      if (result.documentUrl) {
        setRecords(prev => prev.map(record => record.id === item.id
          ? { ...record, data: { ...record.data, documentUrl: result.documentUrl } }
          : record));
      }
      setDriveState("ready");
      setToast(result.documentUrl
        ? "Disimpan ke Sheet • Google Doc berjaya dijana"
        : "Disimpan ke Google Sheet");
    } catch (error) {
      setDriveState("offline");
      setToast(`Salinan peranti selamat • ${error instanceof Error ? error.message : "Google tidak dapat dihubungi"}`);
    }
    setTimeout(() => setToast(""), 4200);
  };

  const submit = (module: RecordItem["module"]) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void save(module, e.currentTarget);
  };

  const syncDrive = () => {
    const token = window.prompt(
      "Tampal WEB_API_TOKEN daripada log setupProject(). Token disimpan pada peranti ini sahaja.",
      driveToken,
    );
    if (!token?.trim()) return;
    localStorage.setItem(DRIVE_TOKEN_KEY, token.trim());
    setDriveToken(token.trim());
    setDriveState("ready");
    setToast("Google Sheets & Docs telah disambungkan");
    setTimeout(() => setToast(""), 2800);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandmark">QN</div>
          <div><strong>QRNova Lab</strong><small>Sistem Pengurusan Makmal</small></div>
        </div>
        <button className={`sync ${driveState}`} onClick={syncDrive} title="Tetapan Google Sheets & Docs"><i />{driveState === "ready" ? "Google disambung" : driveState === "syncing" ? "Menyimpan…" : "Sambung Google"}</button>
      </header>

      <nav className="desktop-nav" aria-label="Navigasi utama">
        {tabs.map(t => <button key={t.id} className={active === t.id ? "active" : ""} onClick={() => setActive(t.id)}><span>{t.icon}</span>{t.label}</button>)}
      </nav>

      <section className="content">
        {active === "dashboard" && <Dashboard stats={stats} records={records} search={search} setSearch={setSearch} go={setActive} syncDrive={syncDrive} driveState={driveState} />}
        {active === "log" && <LogForm onSubmit={submit("log")} />}
        {active === "asset" && <AssetForm onSubmit={submit("asset")} />}
        {active === "mccb" && <MccbForm onSubmit={submit("mccb")} />}
      </section>

      <nav className="mobile-nav" aria-label="Navigasi mudah alih">
        {tabs.map(t => <button key={t.id} className={active === t.id ? "active" : ""} onClick={() => setActive(t.id)}><span>{t.icon}</span>{t.short}</button>)}
      </nav>
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}

function Dashboard({ stats, records, search, setSearch, go, syncDrive, driveState }: {
  stats: { log: number; asset: number; mccb: number; pass: number }; records: RecordItem[];
  search: string; setSearch: (v: string) => void; go: (m: Module) => void; syncDrive: () => void; driveState: string;
}) {
  const shown = records.filter(r => `${r.title} ${r.subtitle}`.toLowerCase().includes(search.toLowerCase())).slice(0, 6);
  return <div className="stack">
    <section className="hero">
      <div><p className="eyebrow">Rabu, 29 Julai 2026</p><h1>Selamat pagi, <em>Pengurus Makmal.</em></h1><p>Pantau aktiviti, pinjaman aset dan laporan ujian daripada satu tempat.</p></div>
      <div className="hero-actions">
        <button className="primary" onClick={() => go("log")}>＋ Rekod aktiviti</button>
        <button className="secondary" onClick={syncDrive}>{driveState === "syncing" ? "Menyegerak…" : "↻ Segerak Drive"}</button>
      </div>
    </section>

    <section className="stats">
      <article className="stat mint"><div className="stat-icon">✓</div><span>Kehadiran hari ini</span><strong>{stats.log}</strong><small>rekod buku log</small></article>
      <article className="stat amber"><div className="stat-icon">↗</div><span>Aset dipinjam</span><strong>{stats.asset}</strong><small>masih aktif</small></article>
      <article className="stat blue"><div className="stat-icon">⚡</div><span>Ujian MCCB</span><strong>{stats.mccb}</strong><small>{stats.pass} lulus</small></article>
      <article className="stat violet"><div className="stat-icon">◫</div><span>Jumlah rekod</span><strong>{records.length}</strong><small>semua modul</small></article>
    </section>

    <section className="quick-grid">
      <button onClick={() => go("log")}><b>01</b><span><strong>Buku Log Makmal</strong><small>Rekod kehadiran & aktiviti harian</small></span><i>→</i></button>
      <button onClick={() => go("asset")}><b>02</b><span><strong>Pinjaman KEW.PA-9</strong><small>Mohon dan jejak aset alih</small></span><i>→</i></button>
      <button onClick={() => go("mccb")}><b>03</b><span><strong>MCCB Test Report</strong><small>Rekod data ujian & keputusan</small></span><i>→</i></button>
    </section>

    <section className="recent panel">
      <div className="section-head"><div><p className="eyebrow">Aktiviti terkini</p><h2>Rekod terbaru</h2></div><label className="search">⌕<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari rekod…" /></label></div>
      <div className="record-list">
        {shown.map(r => <article key={r.id}><div className={`record-icon ${r.module}`}>{r.module === "log" ? "✓" : r.module === "asset" ? "↗" : "⚡"}</div><div><strong>{r.title}</strong><small>{r.subtitle}</small>{r.data.documentUrl && <a className="doc-link" href={r.data.documentUrl} target="_blank" rel="noreferrer">Buka Google Doc ↗</a>}</div><time>{new Date(`${r.date}T00:00`).toLocaleDateString("ms-MY", { day: "numeric", month: "short" })}</time><span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span></article>)}
        {!shown.length && <div className="empty">Tiada rekod sepadan.</div>}
      </div>
    </section>
  </div>;
}

function FormHeader({ code, title, description }: { code: string; title: string; description: string }) {
  return <div className="form-heading"><span>{code}</span><div><p className="eyebrow">Borang digital</p><h1>{title}</h1><p>{description}</p></div></div>;
}

function LogForm({ onSubmit }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return <div className="form-page"><FormHeader code="LOG" title="Buku Log Makmal" description="Daftar kehadiran dan aktiviti penggunaan makmal." />
    <form onSubmit={onSubmit} className="panel form-card">
      <h2>Butiran kehadiran</h2><div className="form-grid">
        {field("Nama penuh", "nama", "text", true, "Nama pelajar / staf")}
        {field("No. matrik / staf", "no_id", "text", true, "Contoh: 23DET001")}
        {field("Tarikh", "tarikh", "date", true)}
        {field("Masa masuk", "masa_masuk", "time", true)}
        {field("Makmal", "makmal", "text", true, "Contoh: Makmal Kuasa")}
        <label className="field"><span>Status kehadiran *</span><select name="kehadiran" required><option>Hadir</option><option>Lewat</option><option>Keluar awal</option></select></label>
        <label className="field full"><span>Aktiviti / eksperimen *</span><textarea name="aktiviti" required placeholder="Terangkan aktiviti yang dijalankan…" /></label>
        <label className="field full"><span>Catatan keselamatan</span><textarea name="catatan" placeholder="Insiden, kerosakan atau pemerhatian…" /></label>
      </div><FormActions />
    </form>
  </div>;
}

function AssetForm({ onSubmit }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return <div className="form-page"><FormHeader code="PA9" title="Permohonan KEW.PA-9" description="Borang pergerakan atau pinjaman aset alih." />
    <form onSubmit={onSubmit} className="panel form-card">
      <h2>Maklumat pemohon</h2><div className="form-grid">
        {field("Nama pemohon", "nama", "text", true)}
        {field("Jawatan", "jawatan", "text", true)}
        {field("Bahagian", "bahagian", "text", true)}
        {field("Tujuan", "tujuan", "text", true)}
        {field("Tempat digunakan", "tempat", "text", true)}
        {field("Nama pengeluar", "pengeluar")}
      </div>
      <h2>Butiran aset</h2><div className="form-grid">
        {field("No. siri pendaftaran", "no_siri", "text", true)}
        {field("Keterangan aset", "aset", "text", true)}
        {field("Tarikh dipinjam", "tarikh", "date", true)}
        {field("Tarikh dijangka pulang", "tarikh_pulang", "date", true)}
        <label className="field full"><span>Catatan</span><textarea name="catatan" placeholder="Aksesori disertakan atau syarat penggunaan…" /></label>
      </div><FormActions label="Hantar permohonan" />
    </form>
  </div>;
}

function MccbForm({ onSubmit }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return <div className="form-page"><FormHeader code="MCCB" title="MCCB Test Report" description="Test data for opening under overload conditions • MS IEC 60947-2." />
    <form onSubmit={onSubmit} className="panel form-card">
      <h2>Detail of MCCB</h2><div className="form-grid">
        {field("Test Ref. No.", "rujukan", "text", true, "Contoh: TR-027")}
        {field("Job No.", "job")}
        {field("Company", "syarikat", "text", true)}
        {field("Brand", "jenama", "text", true)}
        {field("Model", "model", "text", true)}
        <label className="field"><span>Type *</span><select name="jenis" required><option>Fixed</option><option>Adjustable</option></select></label>
        {field("No. of pole(s)", "pole", "number", true)}
        {field("Rated current (A)", "arus_kadar", "number", true)}
        {field("Short circuit capacity (kA)", "kapasiti", "number", true)}
      </div>
      <h2>Working condition</h2><div className="form-grid">
        {field("Ambient temp. mula (°C)", "suhu_mula", "number", true)}
        {field("Ambient temp. akhir (°C)", "suhu_akhir", "number", true)}
        {field("Humidity mula (%)", "lembapan_mula", "number", true)}
        {field("Humidity akhir (%)", "lembapan_akhir", "number", true)}
        {field("TCD factor", "tcd", "number", true)}
        {field("Cable size (mm²)", "kabel", "number")}
        {field("Tightening torque (Nm)", "tork", "number")}
      </div>
      <h2>Opening under overload conditions</h2><div className="form-grid">
        {field("Test current 1.05 × Ir (A)", "arus_105", "number", true)}
        {field("Tripping time 1.05 × Ir", "masa_105", "text", true, "Contoh: > 120 min")}
        {field("Test current 1.30 × Ir (A)", "arus_130", "number", true)}
        {field("Tripping time 1.30 × Ir", "masa_130", "text", true, "Contoh: 48 min")}
        <label className="field"><span>Keputusan *</span><select name="keputusan" required><option>Lulus</option><option>Gagal</option></select></label>
        {field("Tarikh ujian", "tarikh", "date", true)}
        <label className="field full"><span>Remarks</span><textarea name="catatan" placeholder="Pemerhatian juruteknik…" /></label>
      </div><FormActions label="Simpan laporan" />
    </form>
  </div>;
}

function FormActions({ label = "Simpan rekod" }: { label?: string }) {
  return <div className="form-actions"><button type="reset" className="secondary">Kosongkan</button><button className="primary" type="submit">{label} →</button></div>;
}
