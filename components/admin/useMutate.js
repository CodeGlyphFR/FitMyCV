"use client";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/components/notifications/NotificationProvider";

export default function useMutate(){
  const router = useRouter();
  const { addNotification } = useNotifications();

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
