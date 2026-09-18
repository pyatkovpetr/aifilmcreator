"use client";

export function useAuth() {
  return {
    user: { song_credits: 5, referral_bonus: 0 },
    isAuthenticated: true,
    refreshUser: async () => undefined,
  };
}

export function useAuthModal() {
  return { openAuthModal: () => undefined };
}
