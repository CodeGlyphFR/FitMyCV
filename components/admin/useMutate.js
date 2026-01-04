"use client";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useAdmin } from "@/components/admin/AdminProvider";

export default function useMutate(){
  const router = useRouter();
  const { addNotification } = useNotifications();
  const { hasDebitedEditSession, markEditAsDebited } = useAdmin();

  async function mutate(args){
    try {
      const res = await fetch("/api/admin/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();

      if (!res.ok) {
        // Gestion spéciale des erreurs 403 (limite atteinte)
        if (res.status === 403) {
          addNotification({
            type: 'error',
            message: data.error || 'Limite atteinte',
            duration: 6000,
          });

          // Si une action est requise (redirection vers abonnements)
          if (data.actionRequired && data.redirectUrl) {
            setTimeout(() => {
              router.push(data.redirectUrl);
            }, 1500);
          }
        } else {
          addNotification({
            type: 'error',
            message: data.error || 'Erreur lors de la modification',
            duration: 4000,
          });
        }

        // Ne pas throw pour permettre aux modaux de se fermer
        return null;
      }

      // Mutation réussie → Débiter UNE SEULE FOIS par session d'édition
      if (!hasDebitedEditSession) {
        try {
          const debitRes = await fetch('/api/cv/debit-edit', { method: 'POST' });
          const debitData = await debitRes.json();

          if (debitRes.ok && debitData.success) {
            console.log('[useMutate] ✅ Débit de la session d\'édition réussi');
            markEditAsDebited();
            // Rafraîchir le compteur de crédits
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('credits-updated'));
            }
          } else {
            // Afficher erreur mais ne pas bloquer (mutation déjà effectuée)
            console.error('[useMutate] ⚠️ Erreur débit edit session:', debitData.error);
            // On ne bloque pas ici car la modification est déjà faite
            // L'utilisateur sera bloqué à la prochaine activation du mode édition
          }
        } catch (debitError) {
          console.error('[useMutate] ⚠️ Erreur lors du débit:', debitError);
          // Idem, on ne bloque pas
        }
      }

      router.refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cv:list:changed"));
      }
      return data;
    } catch (error) {
      // Erreur réseau ou autre erreur inattendue
      addNotification({
        type: 'error',
        message: error.message || 'Erreur lors de la modification',
        duration: 4000,
      });
      return null;
    }
  }

  return { mutate };
}
