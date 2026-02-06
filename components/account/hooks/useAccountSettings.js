'use client';

import React from 'react';
import { signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Hook for managing account settings state
 */
export function useAccountSettings({ user, isOAuthUser = false }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetOnboarding } = useOnboarding();
  const { t, language } = useLanguage();

  // Profile state
  const [name, setName] = React.useState(user?.name || '');
  const [email, setEmail] = React.useState(user?.email || '');
  const [profileMessage, setProfileMessage] = React.useState('');
  const [profileError, setProfileError] = React.useState('');
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [emailCooldown, setEmailCooldown] = React.useState(0);

  // Onboarding state
  const [onboardingMessage, setOnboardingMessage] = React.useState('');
  const [onboardingError, setOnboardingError] = React.useState('');
  const [onboardingLoading, setOnboardingLoading] = React.useState(false);
  const [onboardingCompletedAt, setOnboardingCompletedAt] = React.useState(null);

  // Credits-only mode
  const [creditsOnlyMode, setCreditsOnlyMode] = React.useState(false);

  // Check if email was changed successfully
  React.useEffect(() => {
    if (searchParams.get('email-changed') === 'true') {
      setProfileMessage(t('account.profile.emailSuccess'));
      setEmail(user?.email || '');
    }
  }, [searchParams, user?.email, t]);

  // Fetch onboarding completion date
  React.useEffect(() => {
    async function fetchOnboardingState() {
      try {
        const res = await fetch('/api/user/onboarding');
        if (res.ok) {
          const data = await res.json();
          if (data.completedAt) {
            setOnboardingCompletedAt(new Date(data.completedAt));
          }
        }
      } catch (error) {
        console.error('[AccountSettings] Error fetching onboarding state:', error);
      }
    }
    fetchOnboardingState();
  }, []);

  // Fetch credits-only mode
  React.useEffect(() => {
    fetch('/api/subscription/current')
      .then(res => res.json())
      .then(data => setCreditsOnlyMode(data.creditsOnlyMode || false))
      .catch(() => {});
  }, []);

  // Timer for email cooldown
  React.useEffect(() => {
    if (emailCooldown <= 0) return;

    const timer = setInterval(() => {
      setEmailCooldown(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [emailCooldown]);

  // Update profile
  async function updateProfile(event) {
    event.preventDefault();
    setProfileMessage('');
    setProfileError('');

    if (!name && !email) {
      setProfileError(t('account.profile.noChanges'));
      return;
    }

    try {
      setProfileLoading(true);
      const res = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isOAuthUser ? { name } : { name, email }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429 && payload?.cooldownRemaining) {
          setEmailCooldown(payload.cooldownRemaining);
        }
        setProfileError(payload?.error || t('account.profile.errors.updateFailed'));
        return;
      }

      if (payload?.emailChangeRequested) {
        setProfileMessage(payload?.message || t('account.profile.success'));
        setEmailCooldown(60);
      } else {
        setProfileMessage(payload?.message || t('account.profile.success'));
      }
    } catch (error) {
      console.error(error);
      setProfileError(t('account.profile.errors.unexpected'));
    } finally {
      setProfileLoading(false);
    }
  }

  // Reset onboarding
  async function handleResetOnboarding() {
    setOnboardingMessage('');
    setOnboardingError('');

    try {
      setOnboardingLoading(true);
      await resetOnboarding();
      setOnboardingMessage(t('account.tutorial.success'));

      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } catch (error) {
      console.error('[AccountSettings] Reset onboarding error:', error);
      const errorMessage = error?.message || t('account.tutorial.errors.resetFailed');
      setOnboardingError(errorMessage);
      setOnboardingLoading(false);
    }
  }

  return {
    // Profile
    name,
    setName,
    email,
    setEmail,
    profileMessage,
    profileError,
    profileLoading,
    emailCooldown,
    updateProfile,
    // Onboarding
    onboardingMessage,
    onboardingError,
    onboardingLoading,
    onboardingCompletedAt,
    handleResetOnboarding,
    // Mode
    creditsOnlyMode,
    // Utils
    t,
    language,
  };
}
