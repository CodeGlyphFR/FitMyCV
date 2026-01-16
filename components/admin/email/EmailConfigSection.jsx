'use client';

import { Settings, Wrench } from 'lucide-react';

/**
 * EmailConfigSection - Placeholder pour futurs paramètres email
 */
export function EmailConfigSection() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-orange-500/10 rounded-xl border border-orange-500/30 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-orange-500/20 rounded-xl">
            <Wrench className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">Configuration Email</h3>
            <p className="text-white/60 mt-1">
              Cette section permettra de configurer les paramètres d'envoi d'email.
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-8">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-xl mb-4">
            <Settings className="w-8 h-8 text-white/40" />
          </div>
          <h4 className="text-lg font-medium text-white mb-2">
            Configuration à venir
          </h4>
          <p className="text-white/50 max-w-md mx-auto">
            Les paramètres de configuration SMTP, providers de fallback,
            et autres options d'envoi seront disponibles ici prochainement.
          </p>
        </div>

        {/* Future features preview */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm font-medium text-white/80">Configuration SMTP</span>
            </div>
            <p className="text-xs text-white/40">
              Paramètres du serveur SMTP principal
            </p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm font-medium text-white/80">Provider de fallback</span>
            </div>
            <p className="text-xs text-white/40">
              Configuration Resend/SendGrid en backup
            </p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm font-medium text-white/80">Limites d'envoi</span>
            </div>
            <p className="text-xs text-white/40">
              Configuration des quotas horaires/journaliers
            </p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm font-medium text-white/80">Adresses email</span>
            </div>
            <p className="text-xs text-white/40">
              From, Reply-To, adresses de test
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailConfigSection;
