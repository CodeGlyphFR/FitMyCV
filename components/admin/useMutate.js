"use client";
import { useRouter } from "next/navigation";

export default function useMutate(){
  const router = useRouter();

  async function mutate(args){
    const res = await fetch("/api/admin/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data && data.error) || "Erreur");
    router.refresh();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cv:list:changed"));
    }
    return data;
  }

  return { mutate };
}
