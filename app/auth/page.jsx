import { redirect } from "next/navigation";
import AuthScreen from "@/components/auth/AuthScreen";
import { auth } from "@/lib/auth/session";

export const runtime = "nodejs";

export default async function AuthPage({ searchParams }){
  const session = await auth();
  if (session?.user?.id){
    redirect("/");
  }

  const initialMode = searchParams?.mode === "register" ? "register" : "login";
  const availability = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: Boolean(
      process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_CLIENT_SECRET &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY
    ),
    github: Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET),
  };

  return <AuthScreen initialMode={initialMode} providerAvailability={availability} />;
}
