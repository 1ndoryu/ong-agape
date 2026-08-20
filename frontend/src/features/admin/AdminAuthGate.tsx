import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { getAdminProfile, login, type AdminProfile } from '../../api/admin';

const tokenKey = 'agape_admin_token';

function AdminAuthGate({ children }: { children: (profile: AdminProfile, token: string) => ReactNode }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey));
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    getAdminProfile(token)
      .then(setProfile)
      .catch(() => {
        sessionStorage.removeItem(tokenKey);
        setToken(null);
        setError('Tu sesión expiró o ya no tiene acceso al panel.');
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await login(email.trim(), password);
      sessionStorage.setItem(tokenKey, response.token);
      setToken(response.token);
      setPassword('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión.');
      setIsLoading(false);
    }
  };

  if (isLoading) return <AuthShell><p className="text-sm text-slate-500">Verificando acceso seguro…</p></AuthShell>;
  if (profile && token) return <>{children(profile, token)}</>;

  return <AuthShell><form className="space-y-5" onSubmit={submit}><div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#e33139]">Acceso privado</p><h1 className="font-serif text-4xl tracking-[-.06em]">Administra con claridad.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Usa una cuenta autorizada por el equipo de Ágape. Los roles limitan cada operación.</p></div><label className="block text-xs font-semibold text-slate-700">Correo<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-[#1d5689]" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label className="block text-xs font-semibold text-slate-700">Contraseña<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-[#1d5689]" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-800">{error}</p>}<button className="w-full rounded-full bg-[#0d2f54] px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isLoading}>Entrar al panel</button></form></AuthShell>;
}

function AuthShell({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f5ee] px-5 py-10"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_20px_70px_rgba(13,47,84,0.08)] sm:p-10"><a className="mb-10 inline-flex items-center gap-3" href="/"><img className="h-11 w-11 object-contain" src="/logo-agape.png" alt="" /><span className="flex flex-col leading-[.9]"><strong className="text-[10px] tracking-[.08em]">EL PROYECTO</strong><em className="text-lg font-black not-italic tracking-[.13em] text-[#e33139]">ÁGAPE</em></span></a>{children}</section></main>;
}

export default AdminAuthGate;
