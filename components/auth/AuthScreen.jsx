"use client";

import React from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const allProviders = [
  { id: "google", label: "Continuer avec Google", image: "/images/g_logo.png" },
  { id: "apple", label: "Continuer avec Apple", image: "/images/Apple_logo.png" },
  { id: "github", label: "Continuer avec GitHub", image: "/images/github.png" },
];

export default function AuthScreen({ initialMode = "login", providerAvailability = {} }){
  const router = useRouter();
  const [mode, setMode] = React.useState(initialMode);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const isRegister = mode === "register";

  function switchMode(next){
    setMode(next);
    setError("");
  }

  async function handleCredentialsSubmit(event){
    event.preventDefault();
    setError("");

    if (!email || !password){
      setError("Email et mot de passe sont requis.");
      return;
    }

    try {
      setLoading(true);
      if (isRegister){
        if (!name){
          setError("Renseignez votre nom complet.");
          setLoading(false);
          return;
        }
        if (password.length < 8){
          setError("Le mot de passe doit contenir au moins 8 caractères.");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword){
          setError("Les mots de passe ne correspondent pas.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        if (!res.ok){
          const payload = await res.json().catch(() => ({}));
          setError(payload?.error || "Impossible de créer votre compte.");
          setLoading(false);
          return;
        }

        try {
          localStorage.setItem("admin:activateEditingOnce", "1");
        } catch (_err) {}
      }

      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error){
        setError("Identifiants invalides.");
        setLoading(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (submitError) {
      console.error(submitError);
      setError("Erreur inattendue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  const providers = React.useMemo(
    () => allProviders.map(provider => ({
      ...provider,
      enabled: providerAvailability?.[provider.id],
    })),
    [providerAvailability]
  );

  function oauthClick(provider){
    const info = providers.find(p => p.id === provider);
    if (!info?.enabled){
      setError("Connexion via ce fournisseur indisponible. Configurez les identifiants OAuth.");
      return;
    }
    setError("");
    signIn(provider, { callbackUrl: "/" });
  }

  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full overflow-hidden bg-slate-950 flex items-center justify-center p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-40 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-400/90 via-sky-500/70 to-transparent blur-2xl animate-auth-blob-fast"/>
        <div className="absolute top-[20%] right-[-140px] h-96 w-96 rounded-full bg-gradient-to-br from-sky-500/70 via-emerald-400/50 to-transparent blur-3xl animate-auth-blob animation-delay-1500"/>
        <div className="absolute bottom-[-180px] left-[10%] h-[420px] w-[420px] rounded-full bg-gradient-to-br from-emerald-500/55 via-sky-400/35 to-transparent blur-[150px] animate-auth-blob-slow animation-delay-6000"/>
        <div className="absolute top-[55%] right-[15%] h-56 w-56 rounded-full bg-gradient-to-br from-sky-400/50 via-emerald-300/40 to-transparent blur-2xl animate-auth-blob-fast animation-delay-3000"/>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(126,207,244,0.25),_transparent_65%)]"/>
      </div>

      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/10 bg-white shadow-2xl p-6 space-y-6">
        <div className="space-y-1 text-aligned">
          <h1 className="text-2xl font-semibold text-center">
            {isRegister ? "Créer un compte" : "CV Builder 1.0"}
          </h1>
          <p className="text-sm text-neutral-600">
            Bienvenue ! Avec CV Builder, créez des CV taillés pour chaque opportunité grâce à l’IA.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          {providers.map(provider => (
            <button
              key={provider.id}
              type="button"
              onClick={()=>oauthClick(provider.id)}
              disabled={!provider.enabled}
              className={`h-12 w-12 rounded-full border flex items-center justify-center transition ${provider.enabled ? "hover:shadow" : "opacity-40 cursor-not-allowed"}`}
              aria-label={provider.label}
            >
              <Image
                src={provider.image}
                alt={provider.label}
                width={provider.id === "apple" ? 22 : 28}
                height={provider.id === "apple" ? 22 : 28}
                className="object-contain"
                priority
              />
            </button>
          ))}
        </div>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-x-0 h-px bg-neutral-200"></div>
          <span className="relative px-3 text-xs uppercase tracking-wide text-neutral-500 bg-white">ou</span>
        </div>

        <form onSubmit={handleCredentialsSubmit} className="space-y-3">
          {isRegister ? (
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-neutral-600">Nom complet</label>
              <input
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Prénom Nom"
                autoComplete="name"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-neutral-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="prenom@exemple.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-neutral-600">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="••••••••"
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          {isRegister ? (
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-neutral-600">Confirmez le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          ) : null}

          {error ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded border border-emerald-500 bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {loading ? "Veuillez patienter…" : (isRegister ? "Créer mon compte" : "Me connecter")}
          </button>
        </form>

        <div className="text-center text-sm text-neutral-600">
          {isRegister ? (
            <span>
              Déjà inscrit ?
              {" "}
              <button type="button" onClick={()=>switchMode("login")} className="font-medium text-emerald-600 hover:underline">
                Se connecter
              </button>
            </span>
          ) : (
            <span>
              Nouveau ?
              {" "}
              <button type="button" onClick={()=>switchMode("register")} className="font-medium text-emerald-600 hover:underline">
                Créer un compte
              </button>
            </span>
          )}
        </div>

        <div className="text-center text-xs text-neutral-400">
          En vous connectant, vous acceptez nos conditions d'utilisation. Pas de spam.
        </div>
      </div>
    </div>
  );
}
