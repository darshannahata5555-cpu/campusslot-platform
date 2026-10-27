import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Camera,
  Mic,
  Projector,
  Cpu,
  Triangle,
  Search,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
  LayoutGrid,
  History,
  ClipboardList,
  ShieldCheck,
  PackageCheck,
  AlertCircle,
  SlidersHorizontal,
  Menu,
  LoaderCircle,
  CheckCircle2,
  BookOpen,
  Plus,
} from "lucide-react";
import { api, post } from "./api";
import "./styles.css";

const icons = {
  Cameras: Camera,
  Audio: Mic,
  Presentation: Projector,
  Electronics: Cpu,
  Accessories: Triangle,
};
const labels = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  checked_out: "Checked out",
  returned: "Returned",
  overdue: "Overdue",
};
const actionLabels = {
  created: "Reservation requested",
  approved: "Request approved",
  rejected: "Request rejected",
  cancelled: "Reservation cancelled",
  checked_out: "Equipment checked out",
  returned: "Equipment returned",
};
const date = (d) =>
  new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const time = (d) =>
  new Date(d).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
const full = (d) => `${date(d)}, ${time(d)}`;
function Icon({ category, ...props }) {
  const C = icons[category] || PackageCheck;
  return <C {...props} />;
}
function Spinner() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading CampusSlot…
    </div>
  );
}
function Empty({ title, children }) {
  return (
    <div className="empty">
      <CalendarDays size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function ErrorBox({ error, retry }) {
  return (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      <span>{error}</span>
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  );
}
function Badge({ status, overdue }) {
  return (
    <span className={`badge ${overdue ? "overdue" : status}`}>
      <i />
      {overdue ? "Overdue" : labels[status] || status}
    </span>
  );
}
function Modal({ title, subtitle, onClose, children, wide = false }) {
  const panel = useRef();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const els = [
          ...panel.current.querySelectorAll(
            "button,input,select,textarea,a[href]",
          ),
        ].filter((x) => !x.disabled);
        if (!els.length) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === els[0] ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          els.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={panel}
        tabIndex={-1}
      >
        <button
          className="icon-btn close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={21} />
        </button>
        <h2 id="modal-title">{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </section>
    </div>
  );
}
function AuthDialog({ onClose, onAuth, initial = "login" }) {
  const [mode, setMode] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await post(`/auth/${mode}`, data);
      onAuth(result.user);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        mode === "login" ? "Welcome back." : "Make room for your next idea."
      }
      subtitle={
        mode === "login"
          ? "Sign in to your CampusSlot account."
          : "Create a student account to reserve campus equipment."
      }
      onClose={onClose}
    >
      <div className="auth-tabs">
        <button
          className={mode === "login" ? "selected" : ""}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          Sign in
        </button>
        <button
          className={mode === "register" ? "selected" : ""}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          Create account
        </button>
      </div>
      <form onSubmit={submit} key={mode}>
        {mode === "register" && (
          <label>
            Full name
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              placeholder="Your full name"
            />
          </label>
        )}
        <label>
          Email address
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="you@campus.edu"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            required
            minLength={mode === "register" ? 12 : 1}
            maxLength={72}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            placeholder={
              mode === "register"
                ? "At least 12 characters"
                : "Enter your password"
            }
          />
        </label>
        {error && <ErrorBox error={error} />}
        <button className="btn primary full" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create student account"}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="form-foot">
        <ShieldCheck size={15} /> Staff accounts are created by your campus
        administrator.
      </p>
    </Modal>
  );
}
function EquipmentArt({ item, large = false }) {
  return (
    <div
      className={`equipment-art art-${item.category.toLowerCase()} ${large ? "large" : ""}`}
    >
      <div className="art-circle" />
      <Icon category={item.category} strokeWidth={1.1} />
      <span className="asset-label">{item.assetTag}</span>
      <span className="art-cross">+</span>
    </div>
  );
}
function BookDialog({ item, user, onClose, onAuthNeeded, onBooked }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      await post("/reservations", {
        equipment: item._id,
        purpose: data.purpose,
        start: new Date(data.start).toISOString(),
        end: new Date(data.end).toISOString(),
      });
      onBooked();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const localInput = (d) => {
    const x = new Date(d);
    return new Date(+x - x.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  return (
    <Modal
      title={item.name}
      subtitle={item.category + " · " + item.assetTag}
      onClose={onClose}
      wide
    >
      <div className="booking-layout">
        <div>
          <EquipmentArt item={item} large />
          <p className="description">{item.description}</p>
          <p className="location">
            <MapPin size={16} />
            {item.location}
          </p>
          <div className="specs">
            {item.specs.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <h3 className="small-heading">Reserved time windows</h3>
          {item.windows.length ? (
            <div className="windows">
              {item.windows.map((w, i) => (
                <div key={i}>
                  <Badge status={w.status} />
                  <span>
                    {full(w.start)}
                    <br />
                    to {full(w.end)}
                  </span>
                  {w.status === "checked_out" &&
                    new Date(w.end) < new Date() && (
                      <small className="danger-text">
                        Return overdue; pickup may be delayed.
                      </small>
                    )}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">
              No upcoming reservations. Pick a time that works for you.
            </p>
          )}
        </div>
        <div className="booking-form">
          <h3>Plan your pickup</h3>
          <p className="muted small">
            Reserve up to 90 days ahead, for a maximum of 7 days. All times use
            your local timezone (
            {Intl.DateTimeFormat().resolvedOptions().timeZone}).
          </p>
          {user?.role === "staff" ? (
            <div className="info">
              Use a student account to place reservations. Manage requests from
              the staff desk.
            </div>
          ) : !user ? (
            <div className="signin-prompt">
              <CalendarDays size={28} />
              <h3>Your next project starts here.</h3>
              <p>Sign in to request this equipment.</p>
              <button className="btn primary" onClick={onAuthNeeded}>
                Sign in to reserve <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label>
                Pickup date & time
                <input
                  name="start"
                  type="datetime-local"
                  required
                  min={localInput(Date.now() + 60000)}
                  max={localInput(Date.now() + 90 * 86400000)}
                />
              </label>
              <label>
                Return date & time
                <input
                  name="end"
                  type="datetime-local"
                  required
                  min={localInput(Date.now() + 60000)}
                  max={localInput(Date.now() + 90 * 86400000)}
                />
              </label>
              <label>
                Project purpose
                <textarea
                  name="purpose"
                  rows={4}
                  required
                  minLength={10}
                  maxLength={1000}
                  placeholder="Tell us about your project and how you’ll use this equipment."
                />
              </label>
              <div className="info">
                <ShieldCheck size={17} />
                <span>
                  Your request holds the time slot while staff review it. You
                  can have up to 3 active reservations.
                </span>
              </div>
              {error && <ErrorBox error={error} />}
              <button disabled={busy} className="btn primary full">
                {busy ? "Submitting…" : "Request reservation"}
                <ArrowUpRight size={17} />
              </button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  );
}
function Discover({ user, onChoose, version }) {
  const [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      setLoading(true);
      api(
        "/equipment?" +
          new URLSearchParams({ q, ...(category ? { category } : {}) }),
      )
        .then((d) => {
          if (live) {
            setData(d);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, category, version, retry]);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> LESS COORDINATION. MORE CREATION.
          </div>
          <h1>
            Big ideas.
            <br />
            The right <em>equipment.</em>
          </h1>
          <p>
            From your first prototype to your next short film.
            <br className="desktop-break" /> Find it, reserve it, and make it
            happen.
          </p>
          <a href="#equipment" className="btn primary">
            Explore equipment <ArrowDownIcon />
          </a>
          <div className="hero-note">
            <div className="mini-avatars">
              <span>CS</span>
              <span>AV</span>
              <span>ML</span>
            </div>
            <span>Built for the things you’re building.</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="visual-grid" />
          <div className="floating-label">
            <span className="live-dot" /> YOUR CAMPUS. CONNECTED.
          </div>
          <div className="hero-camera">
            <Camera strokeWidth={0.85} />
          </div>
          <span className="visual-plus plus-one">+</span>
          <span className="visual-plus plus-two">+</span>
          <div className="visual-caption">
            <span>THE CAMPUS TOOLKIT</span>
            <strong>Possibility, on loan.</strong>
          </div>
          <div className="reservation-float">
            <div className="success-icon">
              <Check size={18} />
            </div>
            <div>
              <strong>A little less admin.</strong>
              <span>A lot more making.</span>
            </div>
            <ArrowUpRight size={18} />
          </div>
        </div>
      </section>
      <div className="benefit-strip">
        <span>
          <CalendarDays size={18} /> Clear availability
        </span>
        <span>
          <ShieldCheck size={18} /> Simple staff approvals
        </span>
        <span>
          <PackageCheck size={18} /> Easy pickups & returns
        </span>
        <span className="benefit-last">
          All your campus gear. One place. <ArrowUpRight size={16} />
        </span>
      </div>
      <section id="equipment" className="catalog">
        <div className="section-title">
          <div className="eyebrow dark">THE EQUIPMENT ROOM</div>
          <div className="section-title-row">
            <h2>What will you make next?</h2>
            <span className="muted small">Borrow the tools. Own the idea.</span>
          </div>
        </div>
        <div className="catalog-tools">
          <div className="search-box">
            <Search size={19} />
            <input
              aria-label="Search equipment"
              placeholder="Search equipment, descriptions, or locations…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                className="icon-btn"
                aria-label="Clear search"
                onClick={() => setQ("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="catalog-count">
            {data
              ? `${data.equipment.length} item${data.equipment.length === 1 ? "" : "s"}`
              : "Equipment"}
            <SlidersHorizontal size={17} />
          </div>
        </div>
        <div className="category-tabs" aria-label="Equipment categories">
          {[
            "",
            ...(data?.categories || [
              "Accessories",
              "Audio",
              "Cameras",
              "Electronics",
              "Presentation",
            ]),
          ].map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c ? <Icon category={c} size={16} /> : <LayoutGrid size={16} />}{" "}
              {c || "All equipment"}
            </button>
          ))}
        </div>
        {error ? (
          <ErrorBox error={error} retry={() => setRetry((x) => x + 1)} />
        ) : loading ? (
          <Spinner />
        ) : data?.equipment.length ? (
          <div className="equipment-grid">
            {data.equipment.map((item) => (
              <article className="equipment-card" key={item._id}>
                <button
                  className="art-button"
                  tabIndex={-1}
                  aria-label={`View ${item.name}`}
                  onClick={() => onChoose(item)}
                >
                  <EquipmentArt item={item} />
                  <span
                    className={`availability ${item.windows.some((w) => w.status === "checked_out" || (new Date(w.start) <= new Date() && new Date(w.end) > new Date())) ? "held" : ""}`}
                  >
                    <i />
                    {item.windows.some(
                      (w) =>
                        w.status === "checked_out" ||
                        (new Date(w.start) <= new Date() &&
                          new Date(w.end) > new Date()),
                    )
                      ? "Currently reserved"
                      : "Available to request"}
                  </span>
                </button>
                <div className="equipment-content">
                  <div className="card-category">
                    {item.category}
                    <span>{item.assetTag}</span>
                  </div>
                  <h3>{item.name}</h3>
                  <p className="card-description">{item.description}</p>
                  <p className="location">
                    <MapPin size={14} />
                    {item.location}
                  </p>
                  <div className="card-bottom">
                    <span>
                      <Clock size={14} />
                      {item.windows.length
                        ? `${item.windows.length} reserved window${item.windows.length === 1 ? "" : "s"}`
                        : "View available times"}
                    </span>
                    <button
                      aria-label={`View and reserve ${item.name}`}
                      onClick={() => onChoose(item)}
                    >
                      View & reserve <ArrowUpRight size={17} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No equipment found">
            Try another search or category.
          </Empty>
        )}
      </section>
      <section className="how-it-works">
        <div>
          <div className="eyebrow dark">FROM IDEA TO IN YOUR HANDS</div>
          <h2>
            Three steps.
            <br /> Endless possibilities.
          </h2>
        </div>
        <div className="steps">
          {[
            [
              "01",
              "Find your fit",
              "Explore campus equipment and choose your pickup and return times.",
            ],
            [
              "02",
              "Get the green light",
              "Tell us about your project. A staff coordinator reviews your request.",
            ],
            [
              "03",
              "Pick up. Create. Return.",
              "Collect your gear, bring your idea to life, and return it on time.",
            ],
          ].map(([n, t, p]) => (
            <div className="step" key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
function ArrowDownIcon() {
  return <ArrowRight size={17} className="arrow-down" />;
}
function Pager({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button
        className="btn secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={16} />
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button
        className="btn secondary"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
function Reservations({ user, onChange, version, notify }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(true),
    [action, setAction] = useState(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const isStaff = user.role === "staff";
  function load() {
    setLoading(true);
    return api(
      "/reservations?" +
        new URLSearchParams({ q, ...(status ? { status } : {}), page }),
    )
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      setLoading(true);
      api(
        "/reservations?" +
          new URLSearchParams({ q, ...(status ? { status } : {}), page }),
      )
        .then((d) => {
          if (live) {
            setData(d);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, status, page, version]);
  async function perform(e) {
    e.preventDefault();
    setBusy(true);
    setActionError("");
    try {
      const note = new FormData(e.currentTarget).get("note") || "";
      await post(`/reservations/${action.r._id}/${action.type}`, { note });
      notify("Reservation updated successfully.");
      setAction(null);
      onChange();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function ask(r, type) {
    setAction({ r, type });
    setActionError("");
  }
  const summaries = isStaff
    ? [
        ["pending", "Awaiting review", ClipboardList],
        ["approved", "Ready for pickup", CalendarDays],
        ["checked_out", "On loan", PackageCheck],
        ["overdue", "Overdue returns", AlertCircle],
      ]
    : [
        ["active", "Active reservations", CalendarDays],
        ["pending", "Awaiting approval", Clock],
        ["checked_out", "Currently borrowing", PackageCheck],
        ["returned", "Projects completed", CheckCircle2],
      ];
  return (
    <section className="workspace">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow dark">
            {isStaff ? "CAMPUS OPERATIONS" : "YOUR CAMPUS TOOLKIT"}
          </div>
          <h1>{isStaff ? "The staff desk." : "My reservations."}</h1>
          <p>
            {isStaff
              ? "Keep equipment moving and good ideas going."
              : "Every project, from request to return."}
          </p>
        </div>
        <div className="workspace-icon">
          {isStaff ? <ShieldCheck size={34} /> : <CalendarDays size={34} />}
        </div>
      </div>
      <div className="stats-grid">
        {summaries.map(([key, label, C]) => (
          <button
            className={`stat ${key === "overdue" && data?.summary.overdue ? "attention" : ""}`}
            key={key}
            onClick={() => {
              if (STATUSES_UI.includes(key) || key === "overdue") {
                setStatus(key);
                setPage(1);
              }
            }}
          >
            <span>
              {label}
              <C size={18} />
            </span>
            <strong>{data?.summary[key] ?? "—"}</strong>
            <small>
              {key === "active"
                ? "Maximum 3 at a time"
                : key === "overdue"
                  ? "Checked out beyond return time"
                  : "Across your reservations"}
            </small>
          </button>
        ))}
      </div>
      <div className="table-panel">
        <div className="panel-heading">
          <h2>{isStaff ? "All reservations" : "Reservation overview"}</h2>
          <span className="muted small">
            {data?.total ?? "—"} matching requests
          </span>
        </div>
        <div className="reservation-tools">
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="Search reservations"
              placeholder={
                isStaff
                  ? "Search student, equipment, or purpose…"
                  : "Search equipment or project purpose…"
              }
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <label className="filter-select">
            <span className="sr-only">Filter reservation status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {[...STATUSES_UI, "overdue"].map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </label>
        </div>
        {error ? (
          <ErrorBox error={error} retry={load} />
        ) : loading ? (
          <Spinner />
        ) : !data?.reservations.length ? (
          <Empty title="No reservations here yet">
            {q || status
              ? "Try a different search or status filter."
              : "Explore the equipment room to start your next project."}
          </Empty>
        ) : (
          <div className="reservation-list">
            {data.reservations.map((r) => (
              <div className="reservation-row" key={r._id}>
                <div
                  className={`row-art art-${r.equipment?.category.toLowerCase()}`}
                >
                  <Icon category={r.equipment?.category} size={26} />
                </div>
                <div className="reservation-detail">
                  <div className="reservation-top">
                    <h3>{r.equipment?.name || "Equipment"}</h3>
                    <Badge
                      status={r.status}
                      overdue={
                        r.status === "checked_out" &&
                        new Date(r.end) < new Date()
                      }
                    />
                  </div>
                  <p className="purpose">{r.purpose}</p>
                  {isStaff && (
                    <p className="borrower">
                      {r.student?.name} <span>· {r.student?.email}</span>
                    </p>
                  )}
                  <div className="reservation-meta">
                    <span>
                      <CalendarDays size={14} />
                      {full(r.start)} <ArrowRight size={12} /> {full(r.end)}
                    </span>
                    <span>
                      <MapPin size={14} />
                      {r.equipment?.location}
                    </span>
                  </div>
                  {r.staffNote && (
                    <div className="staff-note">Staff note: {r.staffNote}</div>
                  )}
                  <small className="reservation-id">
                    Request #{r._id.slice(-8).toUpperCase()}
                    {r.checkedOutAt
                      ? ` · Picked up ${full(r.checkedOutAt)}`
                      : ""}
                    {r.returnedAt ? ` · Returned ${full(r.returnedAt)}` : ""}
                  </small>
                </div>
                <div className="row-actions">
                  {isStaff && r.status === "pending" && (
                    <>
                      <button
                        className="btn primary small-btn"
                        onClick={() => ask(r, "approve")}
                      >
                        <Check size={14} />
                        Approve
                      </button>
                      <button
                        className="btn secondary small-btn"
                        onClick={() => ask(r, "reject")}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {isStaff && r.status === "approved" && (
                    <button
                      className="btn primary small-btn"
                      onClick={() => ask(r, "checkout")}
                    >
                      Check out
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                  {isStaff && r.status === "checked_out" && (
                    <button
                      className="btn primary small-btn"
                      onClick={() => ask(r, "return")}
                    >
                      Record return
                      <Check size={14} />
                    </button>
                  )}
                  {!isStaff && ["pending", "approved"].includes(r.status) && (
                    <button
                      className="btn secondary small-btn"
                      onClick={() => ask(r, "cancel")}
                    >
                      Cancel request
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <Pager page={page} pages={data?.pages || 1} onChange={setPage} />
      </div>
      {action && (
        <Modal
          title={
            {
              approve: "Approve this request?",
              reject: "Reject this request?",
              checkout: "Hand over this equipment?",
              return: "Record this return?",
              cancel: "Cancel your reservation?",
            }[action.type]
          }
          subtitle={action.r.equipment?.name}
          onClose={() => {
            if (!busy) setAction(null);
          }}
        >
          <p className="description">
            {
              {
                approve:
                  "The student will be able to collect the equipment during their reservation window.",
                reject:
                  "The reserved time slot will be released for other students.",
                checkout:
                  "Confirm that you are handing the physical item to this borrower. Checkout is only available during the reserved window.",
                return:
                  "Confirm that the equipment has been physically returned to the pickup desk.",
                cancel:
                  "Your held time slot will be released. You can submit a new request later.",
              }[action.type]
            }
          </p>
          <div className="info">
            <CalendarDays size={18} />
            {full(action.r.start)} → {full(action.r.end)}
          </div>
          <form onSubmit={perform}>
            {isStaff && (
              <label>
                Staff note (optional)
                <textarea
                  name="note"
                  maxLength={500}
                  rows={3}
                  placeholder="Add context for the student and activity record…"
                />
              </label>
            )}
            {actionError && <ErrorBox error={actionError} />}
            <button
              className={`btn full ${["reject", "cancel"].includes(action.type) ? "destructive" : "primary"}`}
              disabled={busy}
            >
              {busy
                ? "Saving…"
                : "Confirm " +
                  {
                    checkout: "checkout",
                    return: "return",
                    approve: "approval",
                    reject: "rejection",
                    cancel: "cancellation",
                  }[action.type]}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
const STATUSES_UI = [
  "pending",
  "approved",
  "checked_out",
  "returned",
  "rejected",
  "cancelled",
];
function ActivityHistory({ user, version }) {
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api("/activity?" + new URLSearchParams({ page }))
      .then((d) => {
        if (live) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [page, version, retry]);
  return (
    <section className="workspace history-workspace">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow dark">EVERY STEP, ACCOUNTED FOR</div>
          <h1>Activity history.</h1>
          <p>
            {user.role === "staff"
              ? "A shared record of every reservation and handover."
              : "The complete story of your reservations."}
          </p>
        </div>
        <div className="workspace-icon">
          <History size={34} />
        </div>
      </div>
      <div className="table-panel">
        <div className="panel-heading">
          <h2>{user.role === "staff" ? "Campus activity" : "My activity"}</h2>
          <span className="muted small">{data?.total ?? "—"} events</span>
        </div>
        {error ? (
          <ErrorBox error={error} retry={() => setRetry((x) => x + 1)} />
        ) : loading ? (
          <Spinner />
        ) : !data?.activities.length ? (
          <Empty title="Your story starts here">
            Reservation updates will appear here as they happen.
          </Empty>
        ) : (
          <div className="timeline">
            {data.activities.map((a) => (
              <article key={a._id} className="timeline-item">
                <div className={`timeline-icon ${a.action}`}>
                  <Icon
                    category={
                      a.action === "created" ? "Presentation" : "Accessories"
                    }
                    size={18}
                  />
                </div>
                <div>
                  <div className="timeline-title">
                    <h3>{actionLabels[a.action]}</h3>
                    <time dateTime={a.createdAt}>{full(a.createdAt)}</time>
                  </div>
                  <p>
                    <strong>{a.equipment?.name}</strong>{" "}
                    <span>
                      · #{String(a.reservation).slice(-8).toUpperCase()}
                    </span>
                  </p>
                  <p className="muted small">
                    By {a.actor?.name || "Campus staff"}
                    {user.role === "staff"
                      ? ` · Borrower: ${a.student?.name || "Student"}`
                      : ""}
                  </p>
                  {a.note && <div className="staff-note">{a.note}</div>}
                </div>
              </article>
            ))}
          </div>
        )}
        <Pager page={page} pages={data?.pages || 1} onChange={setPage} />
      </div>
    </section>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [authLoading, setAuthLoading] = useState(true),
    [view, setView] = useState("discover"),
    [authMode, setAuthMode] = useState(null),
    [chosen, setChosen] = useState(null),
    [version, setVersion] = useState(0),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch((e) => {
        if (e.status !== 401)
          setToast("Account service unavailable. You can retry signing in.");
      })
      .finally(() => setAuthLoading(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  function navigate(v) {
    setView(v);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function logout() {
    try {
      await post("/auth/logout");
      setUser(null);
      navigate("discover");
      setToast("You have signed out.");
    } catch (e) {
      setToast(e.message);
    }
  }
  const changed = () => setVersion((v) => v + 1);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header>
        <div className="nav-shell">
          <button
            className="brand"
            aria-label="CampusSlot home"
            onClick={() => navigate("discover")}
          >
            <span className="brand-icon">
              <CalendarDays size={22} />
            </span>
            Campus<span>Slot</span>
            <span className="brand-dot">.</span>
          </button>
          <button
            className="icon-btn mobile-toggle"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <nav aria-label="Main navigation" className={menu ? "open" : ""}>
            <button
              className={view === "discover" ? "nav-active" : ""}
              onClick={() => navigate("discover")}
            >
              Equipment
            </button>
            {user && (
              <>
                <button
                  className={view === "reservations" ? "nav-active" : ""}
                  onClick={() => navigate("reservations")}
                >
                  {user.role === "staff" ? "Staff desk" : "My reservations"}
                </button>
                <button
                  className={view === "activity" ? "nav-active" : ""}
                  onClick={() => navigate("activity")}
                >
                  Activity
                </button>
              </>
            )}
            <a
              href="#how"
              onClick={() => {
                navigate("discover");
                setTimeout(
                  () =>
                    document
                      .querySelector(".how-it-works")
                      ?.scrollIntoView({ behavior: "smooth" }),
                  50,
                );
              }}
            >
              How it works <ArrowUpRight size={13} />
            </a>
          </nav>
          <div className="nav-account">
            {authLoading ? (
              <LoaderCircle className="spin" size={18} />
            ) : user ? (
              <>
                <div className="account-name">
                  <span className="avatar">
                    {user.name
                      .split(" ")
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span>
                    {user.name.split(" ")[0]}
                    <small>
                      {user.role === "staff"
                        ? "Staff coordinator"
                        : "Student account"}
                    </small>
                  </span>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Sign out"
                  title="Sign out"
                  onClick={logout}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <>
                <button
                  className="text-button"
                  onClick={() => setAuthMode("login")}
                >
                  Sign in
                </button>
                <button
                  className="btn primary nav-join"
                  onClick={() => setAuthMode("register")}
                >
                  Get started <ArrowUpRight size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main">
        {view === "discover" ? (
          <Discover user={user} onChoose={setChosen} version={version} />
        ) : user ? (
          view === "reservations" ? (
            <Reservations
              user={user}
              version={version}
              onChange={changed}
              notify={setToast}
            />
          ) : (
            <ActivityHistory user={user} version={version} />
          )
        ) : (
          <Spinner />
        )}
      </main>
      <footer>
        <div className="footer-top">
          <button className="brand" onClick={() => navigate("discover")}>
            <span className="brand-icon">
              <CalendarDays size={20} />
            </span>
            Campus<span>Slot</span>
            <span className="brand-dot">.</span>
          </button>
          <p>Good equipment. Great ideas. Your campus.</p>
          <span className="footer-tag">
            <span className="live-dot" /> MADE FOR CAMPUS LIFE
          </span>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} CampusSlot</span>
          <span>
            Reserve responsibly. Create something good.{" "}
            <ArrowUpRight size={13} />
          </span>
        </div>
      </footer>
      {chosen && !authMode && (
        <BookDialog
          item={chosen}
          user={user}
          onClose={() => setChosen(null)}
          onAuthNeeded={() => setAuthMode("login")}
          onBooked={() => {
            setChosen(null);
            changed();
            navigate("reservations");
            setToast(
              "Request submitted. Your time slot is held while staff review it.",
            );
          }}
        />
      )}
      {authMode && (
        <AuthDialog
          initial={authMode}
          onClose={() => setAuthMode(null)}
          onAuth={(u) => {
            setUser(u);
            changed();
            setToast(`Welcome, ${u.name.split(" ")[0]}.`);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
