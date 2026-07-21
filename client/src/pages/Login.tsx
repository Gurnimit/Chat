import React, { useState, useEffect, useRef } from 'react';
import {
  Mail, User as UserIcon, Lock, MessageSquare, ArrowLeft,
  CheckCircle2, Eye, EyeOff, ChevronRight, Camera,
  Settings, Shield, Zap, Globe, Sparkles, Check
} from 'lucide-react';
import { useAuth, api, getApiBaseURL } from '../context/AuthContext';

/* ─── view types ─── */
type AuthView = 'login' | 'register' | 'forgot' | 'reset' | 'verify';
type RegisterStep = 1 | 2 | 3;

/* ─── friendly error mapper ─── */
function friendlyError(err: any): string {
  if (!err) return 'Something went wrong. Please try again.';
  if (err.message === 'Network Error' || err.code === 'ERR_NETWORK')
    return 'Unable to reach the server. Check your connection or server URL.';
  const msg: string = err?.response?.data?.error || err?.message || '';
  if (msg.includes('Invalid credentials') || msg.includes('Incorrect password'))
    return 'Incorrect username or password.';
  if (msg.includes('already')) return 'That username or email is already taken.';
  if (msg.includes('not found') || msg.includes('no account'))
    return 'No account found with that email.';
  if (msg.includes('token') || msg.includes('expired'))
    return 'This link has expired. Please request a new one.';
  if (msg.length > 0 && msg.length < 120) return msg;
  return 'Something went wrong. Please try again.';
}

/* ─────────────── Shared sub-components ─────────────── */

const FloatingInput: React.FC<{
  label: string; type?: string; placeholder?: string;
  value: string; onChange: (v: string) => void;
  icon?: React.ReactNode; required?: boolean; autoFocus?: boolean;
  rightSlot?: React.ReactNode;
}> = ({ label, type = 'text', placeholder, value, onChange, icon, required, autoFocus, rightSlot }) => {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;
  return (
    <div style={{ position: 'relative', marginBottom: 20 }}>
      <label style={{
        position: 'absolute', left: icon ? 44 : 16, top: active ? 8 : 19,
        fontSize: active ? 10 : 14, fontWeight: active ? 700 : 400,
        color: focused ? '#818cf8' : active ? '#6b7280' : '#9ca3af',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: 'none', letterSpacing: active ? '0.06em' : 0,
        textTransform: active ? 'uppercase' : 'none', zIndex: 1,
      }}>
        {label}
      </label>
      {icon && (
        <span style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          color: focused ? '#818cf8' : '#6b7280', transition: 'color 0.2s', display: 'flex',
        }}>
          {icon}
        </span>
      )}
      <input
        type={type} value={value} required={required} autoFocus={autoFocus}
        placeholder={active ? (placeholder || '') : ''}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', paddingTop: 26, paddingBottom: 10,
          paddingLeft: icon ? 44 : 16, paddingRight: rightSlot ? 44 : 16,
          borderRadius: 14, fontSize: 15, color: '#f1f5f9',
          background: 'rgba(15,18,30,0.7)',
          border: `1.5px solid ${focused ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.08)'}`,
          outline: 'none', boxSizing: 'border-box',
          boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      />
      {rightSlot && (
        <span style={{
          position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', cursor: 'pointer', color: '#6b7280',
        }}>
          {rightSlot}
        </span>
      )}
    </div>
  );
};

const PasswordInput: React.FC<{
  label?: string; value: string; onChange: (v: string) => void;
  autoFocus?: boolean;
}> = ({ label = 'Password', value, onChange, autoFocus }) => {
  const [show, setShow] = useState(false);
  return (
    <FloatingInput
      label={label} type={show ? 'text' : 'password'} value={value}
      onChange={onChange} required autoFocus={autoFocus}
      icon={<Lock size={16} />}
      rightSlot={
        <button type="button" onClick={() => setShow(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#6b7280' }}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  );
};

const PrimaryBtn: React.FC<{ children: React.ReactNode; loading?: boolean; disabled?: boolean; type?: 'button' | 'submit'; onClick?: () => void }> = ({
  children, loading, disabled, type = 'submit', onClick,
}) => (
  <button
    type={type} disabled={disabled || loading} onClick={onClick}
    style={{
      width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
      background: loading || disabled ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
      color: '#fff', fontWeight: 700, fontSize: 15, cursor: disabled || loading ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: disabled || loading ? 'none' : '0 4px 24px rgba(99,102,241,0.45)',
      transition: 'all 0.2s', letterSpacing: '0.02em',
    }}
  >
    {loading
      ? <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)', borderTop: '2.5px solid #fff', animation: 'spin 0.8s linear infinite' }} />
      : children}
  </button>
);

const ErrorBanner: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{
    display: 'flex', gap: 10, alignItems: 'flex-start',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 12, padding: '12px 14px', marginBottom: 18,
    color: '#fca5a5', fontSize: 13, lineHeight: 1.5,
    animation: 'fadeSlideUp 0.3s ease both',
  }}>
    <span style={{ marginTop: 1, flexShrink: 0 }}>⚠</span>
    <span>{msg}</span>
  </div>
);

const SuccessBanner: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{
    display: 'flex', gap: 10, alignItems: 'flex-start',
    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 12, padding: '12px 14px', marginBottom: 18,
    color: '#6ee7b7', fontSize: 13, lineHeight: 1.5,
    animation: 'fadeSlideUp 0.3s ease both',
  }}>
    <CheckCircle2 size={16} style={{ marginTop: 1, flexShrink: 0 }} />
    <span>{msg}</span>
  </div>
);

/* ─── progress dots ─── */
const StepDots: React.FC<{ step: RegisterStep }> = ({ step }) => (
  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
    {([1, 2, 3] as RegisterStep[]).map(s => (
      <div key={s} style={{
        height: 4, borderRadius: 2, transition: 'all 0.3s',
        width: s === step ? 24 : 8,
        background: s === step ? '#6366f1' : s < step ? '#a5b4fc' : 'rgba(255,255,255,0.1)',
      }} />
    ))}
  </div>
);

/* ─── illustrations (SVG inline) ─── */
const HeroIllustration: React.FC = () => (
  <svg viewBox="0 0 400 340" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 380 }}>
    {/* Background circles */}
    <circle cx="200" cy="170" r="130" fill="rgba(99,102,241,0.07)" />
    <circle cx="200" cy="170" r="95" fill="rgba(99,102,241,0.06)" />
    {/* Phone frame */}
    <rect x="130" y="60" width="140" height="220" rx="24" fill="rgba(18,22,40,0.9)" stroke="rgba(129,140,248,0.3)" strokeWidth="1.5" />
    <rect x="142" y="80" width="116" height="188" rx="12" fill="rgba(10,13,25,0.95)" />
    {/* Chat bubbles */}
    <rect x="152" y="94" width="60" height="22" rx="10" fill="rgba(99,102,241,0.6)" />
    <rect x="174" y="124" width="70" height="22" rx="10" fill="rgba(255,255,255,0.08)" />
    <rect x="152" y="154" width="55" height="22" rx="10" fill="rgba(99,102,241,0.6)" />
    <rect x="184" y="184" width="44" height="22" rx="10" fill="rgba(255,255,255,0.08)" />
    {/* Typing indicator */}
    <rect x="152" y="220" width="40" height="18" rx="9" fill="rgba(255,255,255,0.05)" />
    <circle cx="162" cy="229" r="3" fill="rgba(255,255,255,0.35)" />
    <circle cx="172" cy="229" r="3" fill="rgba(255,255,255,0.35)" />
    <circle cx="182" cy="229" r="3" fill="rgba(255,255,255,0.35)" />
    {/* Signal / Lock badges */}
    <circle cx="305" cy="110" r="28" fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.3)" strokeWidth="1" />
    <Shield x="292" y="97" width="26" height="26" stroke="#10b981" strokeWidth="1.5" fill="none" />
    <circle cx="95" cy="240" r="24" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" strokeWidth="1" />
    <Zap x="83" y="228" width="24" height="24" stroke="#818cf8" strokeWidth="1.5" fill="none" />
    {/* Floating dots */}
    <circle cx="320" cy="200" r="5" fill="rgba(129,140,248,0.4)" />
    <circle cx="80" cy="140" r="4" fill="rgba(129,140,248,0.3)" />
    <circle cx="340" cy="260" r="3" fill="rgba(16,185,129,0.4)" />
    <circle cx="60" cy="180" r="3" fill="rgba(16,185,129,0.3)" />
  </svg>
);

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export const Login: React.FC = () => {
  const { login, register } = useAuth();

  /* view routing */
  const [view, setView] = useState<AuthView>('login');
  const [registerStep, setRegisterStep] = useState<RegisterStep>(1);

  /* shared fields */
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  /* reset / forgot */
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [token, setToken] = useState('');

  /* UI state */
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* server config (hidden) */
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(
    () => localStorage.getItem('velvet_backend_url') || ''
  );
  const gearClickCount = useRef(0);
  const gearTimer = useRef<any>(null);

  const handleGearClick = () => {
    gearClickCount.current += 1;
    clearTimeout(gearTimer.current);
    if (gearClickCount.current >= 7) {
      gearClickCount.current = 0;
      setShowServerConfig(v => !v);
    } else {
      gearTimer.current = setTimeout(() => { gearClickCount.current = 0; }, 2000);
    }
  };

  /* ── deep link handling ── */
  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (path === '/verify-email' && t) {
      setView('verify'); setToken(t);
      triggerVerify(t);
    } else if (path === '/reset-password' && t) {
      setView('reset'); setToken(t);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const triggerVerify = async (t: string) => {
    setLoading(true); setError(null);
    try {
      const res = await api.post('/auth/verify-email', { token: t });
      setStatusMsg(res.data.message || 'Email verified! You can now sign in.');
      window.history.replaceState({}, '', '/');
    } catch (e: any) {
      setError(friendlyError(e));
    } finally { setLoading(false); }
  };

  const clearState = () => { setError(null); setStatusMsg(null); };
  const goView = (v: AuthView) => { clearState(); setView(v); setRegisterStep(1); };

  /* ── login ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clearState();
    const id = username.trim();
    if (!id) { setError('Please enter your username or email.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true);
    try {
      await login(id, password);
    } catch (e: any) {
      setError(friendlyError(e));
    } finally { setLoading(false); }
  };

  /* ── register step 1 ── */
  const handleRegisterStep1 = (e: React.FormEvent) => {
    e.preventDefault(); clearState();
    if (!username.trim()) { setError('Username is required.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    clearState(); setRegisterStep(2);
  };

  /* ── register step 2 → 3 ── */
  const handleRegisterStep2 = async (e: React.FormEvent) => {
    e.preventDefault(); clearState(); setLoading(true);
    try {
      const res = await register(email.trim(), username.trim(), password, displayName.trim() || undefined);
      setRegisterStep(3);
      if (res.message) setStatusMsg(res.message);
    } catch (e: any) {
      setError(friendlyError(e));
    } finally { setLoading(false); }
  };

  /* ── forgot password ── */
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); clearState();
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim() });
      setStatusMsg(res.data.message || 'Reset link sent — check your inbox.');
      setEmail('');
    } catch (e: any) {
      setError(friendlyError(e));
    } finally { setLoading(false); }
  };

  /* ── reset password ── */
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); clearState();
    if (!newPassword) { setError('New password is required.'); return; }
    if (newPassword !== confirmNewPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword });
      setStatusMsg(res.data.message || 'Password updated! You can now sign in.');
      goView('login');
    } catch (e: any) {
      setError(friendlyError(e));
    } finally { setLoading(false); }
  };

  /* ── avatar preview ── */
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  /* ── save server URL ── */
  const handleSaveServerUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const url = serverUrlInput.trim();
    if (url) localStorage.setItem('velvet_backend_url', url);
    else localStorage.removeItem('velvet_backend_url');
    api.defaults.baseURL = getApiBaseURL();
    setShowServerConfig(false);
  };

  /* ════════════════ RENDER ════════════════ */
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: '#07090e', overflow: 'hidden', position: 'relative' }}>

      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulseRing { 0%,100%{ opacity:.4; transform:scale(1); } 50%{ opacity:.15; transform:scale(1.12); } }
        @keyframes bgFloat1 { 0%,100%{ transform:translate(0,0)scale(1); } 50%{ transform:translate(30px,-20px)scale(1.08); } }
        @keyframes bgFloat2 { 0%,100%{ transform:translate(0,0)scale(1); } 50%{ transform:translate(-20px,25px)scale(0.95); } }
        @keyframes stepIn { from{ opacity:0; transform:translateX(20px); } to{ opacity:1; transform:translateX(0); } }
        .auth-step-enter { animation: stepIn 0.3s cubic-bezier(0.22,1,0.36,1) both; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px #0f121e inset !important; -webkit-text-fill-color:#f1f5f9 !important; }
      `}</style>

      {/* ── Ambient background ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-15%', width: '60vw', height: '60vw', maxWidth: 700, maxHeight: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', animation: 'bgFloat1 14s ease-in-out infinite', filter: 'blur(1px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-15%', width: '55vw', height: '55vw', maxWidth: 650, maxHeight: 650, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.14) 0%, transparent 70%)', animation: 'bgFloat2 18s ease-in-out infinite', filter: 'blur(1px)' }} />
        {/* Grid dots */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.04) 1px, transparent 0)', backgroundSize: '44px 44px', opacity: 0.6 }} />
      </div>

      {/* ── Hidden gear / server config ── */}
      <button
        type="button" onClick={handleGearClick}
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 100, background: 'none', border: 'none', color: 'rgba(255,255,255,0.1)', cursor: 'pointer', padding: 6 }}
        title="Config"
      >
        <Settings size={16} />
      </button>

      {showServerConfig && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <form onSubmit={handleSaveServerUrl} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 380 }}>
            <p style={{ fontWeight: 700, color: '#a5b4fc', marginBottom: 16, fontSize: 14, letterSpacing: '0.05em' }}>SERVER CONFIGURATION</p>
            <FloatingInput label="Backend API URL" type="url" placeholder="http://192.168.1.x:5000" value={serverUrlInput} onChange={setServerUrlInput} />
            <p style={{ fontSize: 10, color: '#4b5563', marginTop: -12, marginBottom: 16 }}>Leave blank to use defaults.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowServerConfig(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'none', color: '#9ca3af', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Save</button>
            </div>
          </form>
        </div>
      )}

      {/* ════ DESKTOP: split layout ════ */}
      <div style={{ display: 'none' }} className="desktop-hero" />

      <div style={{
        display: 'flex', width: '100%', minHeight: '100dvh',
        alignItems: 'stretch', position: 'relative', zIndex: 10,
      }}>

        {/* ── Left panel: illustration (desktop only) ── */}
        <div style={{
          flex: '0 0 50%', maxWidth: '50%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '60px 48px', gap: 32,
        }} className="hidden md:flex">
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
              <MessageSquare size={24} color="#fff" />
            </div>
            <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.18em', background: 'linear-gradient(to right,#c7d2fe,#e0e7ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              VELVET
            </span>
          </div>

          {/* Illustration */}
          <HeroIllustration />

          {/* Tagline */}
          <div style={{ textAlign: 'center', maxWidth: 340 }}>
            <h1 style={{ fontSize: 38, fontWeight: 900, color: '#fff', lineHeight: 1.15, margin: '0 0 12px', letterSpacing: '-0.025em' }}>
              Private messaging,<br />
              <span style={{ background: 'linear-gradient(135deg,#818cf8,#6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                reimagined.
              </span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16, lineHeight: 1.7 }}>
              Real-time conversations with end-to-end privacy, built for modern devices.
            </p>
          </div>

          {/* Feature row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { icon: <Shield size={14} />, label: 'Private by design' },
              { icon: <Zap size={14} />, label: 'Real-time WebSockets' },
              { icon: <Globe size={14} />, label: 'Web & Android' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: 12, fontWeight: 600 }}>
                {f.icon} {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel: auth card ── */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px 16px',
          overflowY: 'auto',
        }}>
          <div style={{
            width: '100%', maxWidth: 420,
            background: 'rgba(14,18,34,0.75)',
            backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 28, padding: '36px 32px',
            boxShadow: '0 32px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
            position: 'relative',
          }}>
            {/* Top glow accent */}
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(to right,transparent,rgba(129,140,248,0.5),transparent)', borderRadius: '50%' }} />

            {/* Mobile logo */}
            <div className="flex md:hidden" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={18} color="#fff" />
              </div>
              <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '0.18em', color: '#e0e7ff' }}>VELVET</span>
            </div>

            {/* ════ VIEW: LOGIN ════ */}
            {view === 'login' && (
              <form onSubmit={handleLogin} className="auth-step-enter">
                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Welcome back</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 28px' }}>Sign in to your Velvet account.</p>

                {error && <ErrorBanner msg={error} />}
                {statusMsg && <SuccessBanner msg={statusMsg} />}

                <FloatingInput label="Username or Email" value={username} onChange={setUsername} required autoFocus icon={<UserIcon size={16} />} />
                <div style={{ marginBottom: 8 }}>
                  <PasswordInput label="Password" value={password} onChange={setPassword} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 22, marginTop: -6 }}>
                  <button type="button" onClick={() => goView('forgot')} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Forgot password?
                  </button>
                </div>

                <PrimaryBtn loading={loading}>
                  Sign In <ChevronRight size={16} />
                </PrimaryBtn>

                <div style={{ position: 'relative', margin: '20px 0', textAlign: 'center' }}>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', position: 'absolute', inset: '50% 0 auto' }} />
                  <span style={{ position: 'relative', background: '#0e1222', padding: '0 12px', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em' }}>OR</span>
                </div>

                <button type="button" disabled style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: 14, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.7 2.4 30.2 0 24 0 14.7 0 6.7 5.4 2.7 13.3l7.9 6.1C12.5 13.2 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.3z"/><path fill="#FBBC05" d="M10.6 28.6c-.6-1.8-.9-3.6-.9-5.6s.3-3.8.9-5.6L2.7 11.3C1 14.7 0 18.3 0 22.5s1 7.8 2.7 11.2l7.9-5.1z"/><path fill="#34A853" d="M24 44c5.9 0 10.9-2 14.5-5.4l-7.5-5.8c-2 1.3-4.5 2.1-7 2.1-6.2 0-11.5-4.2-13.4-9.9L2.7 31c4 7.9 12 13 21.3 13z"/></svg>
                  Continue with Google <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }}>(coming soon)</span>
                </button>

                <p style={{ textAlign: 'center', marginTop: 24, color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
                  New to Velvet?{' '}
                  <button type="button" onClick={() => goView('register')} style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Create an account
                  </button>
                </p>
              </form>
            )}

            {/* ════ VIEW: REGISTER STEP 1 ════ */}
            {view === 'register' && registerStep === 1 && (
              <form onSubmit={handleRegisterStep1} className="auth-step-enter">
                <button type="button" onClick={() => goView('login')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>
                  <ArrowLeft size={14} /> Back to sign in
                </button>

                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>Create account</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 6px' }}>Step 1 of 2 — Account details</p>
                <StepDots step={1} />

                {error && <ErrorBanner msg={error} />}

                <FloatingInput label="Username" value={username} onChange={setUsername} required autoFocus icon={<UserIcon size={16} />} placeholder="e.g. john_doe" />
                <FloatingInput label="Email Address" type="email" value={email} onChange={setEmail} required icon={<Mail size={16} />} placeholder="you@example.com" />
                <PasswordInput label="Password" value={password} onChange={setPassword} />
                <PasswordInput label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} />

                <PrimaryBtn>
                  Continue <ChevronRight size={16} />
                </PrimaryBtn>
              </form>
            )}

            {/* ════ VIEW: REGISTER STEP 2 ════ */}
            {view === 'register' && registerStep === 2 && (
              <form onSubmit={handleRegisterStep2} className="auth-step-enter">
                <button type="button" onClick={() => { clearState(); setRegisterStep(1); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>
                  <ArrowLeft size={14} /> Back
                </button>

                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>Profile setup</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 6px' }}>Step 2 of 2 — Almost there!</p>
                <StepDots step={2} />

                {error && <ErrorBanner msg={error} />}

                {/* Avatar picker */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    style={{ width: 90, height: 90, borderRadius: '50%', border: '2px dashed rgba(129,140,248,0.4)', background: avatarPreview ? 'none' : 'rgba(99,102,241,0.08)', cursor: 'pointer', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {avatarPreview
                      ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#6366f1' }}>
                          <Camera size={22} />
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#818cf8' }}>PHOTO</span>
                        </div>
                      )}
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 10 }}>Preview only — upload after creating your account</p>
                </div>

                <FloatingInput label="Display Name (optional)" value={displayName} onChange={setDisplayName} icon={<Sparkles size={16} />} placeholder="How you appear to others" />

                <PrimaryBtn loading={loading}>
                  Create Account
                </PrimaryBtn>
              </form>
            )}

            {/* ════ VIEW: REGISTER STEP 3 (SUCCESS) ════ */}
            {view === 'register' && registerStep === 3 && (
              <div className="auth-step-enter" style={{ textAlign: 'center', padding: '16px 0' }}>
                {/* Success circle */}
                <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 28px' }}>
                  <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', animation: 'pulseRing 2s ease-in-out infinite' }} />
                  <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: '0 12px 40px rgba(16,185,129,0.35)' }}>
                    <Check size={44} color="#fff" strokeWidth={3} />
                  </div>
                </div>

                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>Account created!</h2>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.7, margin: '0 0 8px' }}>
                  Welcome to Velvet, <span style={{ color: '#a5b4fc', fontWeight: 600 }}>@{username}</span>.
                </p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, lineHeight: 1.7, marginBottom: 32 }}>
                  Please check your inbox and verify your email address before signing in.
                </p>

                {/* Inbox visual hint */}
                <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, padding: '14px 18px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Mail size={20} style={{ color: '#818cf8', flexShrink: 0 }} />
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', margin: '0 0 2px', letterSpacing: '0.04em' }}>VERIFICATION EMAIL SENT</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Check your inbox at <span style={{ color: '#c7d2fe' }}>{email}</span></p>
                  </div>
                </div>

                <PrimaryBtn type="button" onClick={() => goView('login')}>
                  Go to Sign In <ChevronRight size={16} />
                </PrimaryBtn>
              </div>
            )}

            {/* ════ VIEW: FORGOT PASSWORD ════ */}
            {view === 'forgot' && (
              <form onSubmit={handleForgot} className="auth-step-enter">
                <button type="button" onClick={() => goView('login')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>
                  <ArrowLeft size={14} /> Back to sign in
                </button>

                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Reset password</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 28px', lineHeight: 1.6 }}>Enter your email and we'll send a secure reset link.</p>

                {error && <ErrorBanner msg={error} />}
                {statusMsg && <SuccessBanner msg={statusMsg} />}

                <FloatingInput label="Email Address" type="email" value={email} onChange={setEmail} required autoFocus icon={<Mail size={16} />} />

                <PrimaryBtn loading={loading}>
                  Send Reset Link
                </PrimaryBtn>
              </form>
            )}

            {/* ════ VIEW: RESET PASSWORD ════ */}
            {view === 'reset' && (
              <form onSubmit={handleReset} className="auth-step-enter">
                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Set new password</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 28px' }}>Choose a strong, unique password.</p>

                {error && <ErrorBanner msg={error} />}
                {statusMsg && <SuccessBanner msg={statusMsg} />}

                <PasswordInput label="New Password" value={newPassword} onChange={setNewPassword} autoFocus />
                <PasswordInput label="Confirm New Password" value={confirmNewPassword} onChange={setConfirmNewPassword} />

                <PrimaryBtn loading={loading}>
                  Reset Password
                </PrimaryBtn>
              </form>
            )}

            {/* ════ VIEW: EMAIL VERIFY ════ */}
            {view === 'verify' && (
              <div className="auth-step-enter" style={{ textAlign: 'center', padding: '24px 0' }}>
                {loading ? (
                  <>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3.5px solid rgba(99,102,241,0.2)', borderTop: '3.5px solid #6366f1', animation: 'spin 0.9s linear infinite', margin: '0 auto 24px' }} />
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>Verifying your email…</p>
                  </>
                ) : error ? (
                  <>
                    <ErrorBanner msg={error} />
                    <PrimaryBtn type="button" onClick={() => goView('login')}>Go to Sign In</PrimaryBtn>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={56} style={{ color: '#10b981', margin: '0 auto 20px', display: 'block' }} />
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Email verified!</h2>
                    {statusMsg && <p style={{ color: '#6ee7b7', fontSize: 14, marginBottom: 24 }}>{statusMsg}</p>}
                    <PrimaryBtn type="button" onClick={() => goView('login')}>Sign In <ChevronRight size={16} /></PrimaryBtn>
                  </>
                )}
              </div>
            )}

            {/* Footer */}
            <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.15)', marginTop: 28, letterSpacing: '0.03em' }}>
              Velvet Chat v0.1 · Privacy by design
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
