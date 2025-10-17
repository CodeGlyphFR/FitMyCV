"use client";

import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

/**
 * Provider global pour Google reCAPTCHA v3
 * Enveloppe l'application pour rendre reCAPTCHA disponible partout
 */
export default function RecaptchaProvider({ children }) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    console.warn('[RecaptchaProvider] NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not defined');
    return <>{children}</>;
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={siteKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: 'head',
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  );
}
