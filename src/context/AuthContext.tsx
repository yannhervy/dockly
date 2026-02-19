"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { User, UserRole } from "@/lib/types";

// ─── Context shape ────────────────────────────────────────
interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
  needsSetup: boolean; // True when authenticated but no Firestore profile
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  // Role helpers
  isSuperadmin: boolean;
  isDockManager: boolean;
  isTenant: boolean;
  hasRole: (role: UserRole) => boolean;
  needsApproval: boolean; // true when user has profile but is not yet approved
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state and fetch Firestore profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          const profileData = snap.exists()
            ? ({ id: snap.id, ...snap.data() } as User)
            : null;
          // Set both user and profile together before clearing loading
           setFirebaseUser(user);
          setProfile(profileData);
          // Update lastLogin timestamp silently
          if (profileData) {
            updateDoc(doc(db, "users", user.uid), { lastLogin: Timestamp.now() }).catch(() => {});
          }
        } catch {
          setFirebaseUser(user);
          setProfile(null);
        }
      } else {
        setFirebaseUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Auth actions
  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  // Re-fetch the user's Firestore profile (call after editing profile)
  const refreshProfile = async () => {
    if (!firebaseUser) return;
    try {
      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : null);
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  // Role helpers
  const hasRole = (role: UserRole) => profile?.role === role;
  const isSuperadmin = profile?.role === "Superadmin";
  const isDockManager = profile?.role === "Dock Manager";
  const isTenant = profile?.role === "Tenant";

  // True when user is authenticated but has no Firestore profile yet,
  // or has an incomplete profile (missing phone — not yet through /setup)
  const needsSetup = !loading && !!firebaseUser && (!profile || !profile.phone);

  // True when user is authenticated and has a profile, but has not been approved
  // Missing approved field (legacy users) is treated as approved
  const needsApproval = !loading && !!firebaseUser && !!profile && profile.approved === false;

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      needsSetup,
      needsApproval,
      login,
      register,
      loginWithGoogle,
      logout,
      resetPassword,
      refreshProfile,
      isSuperadmin,
      isDockManager,
      isTenant,
      hasRole,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firebaseUser, profile, loading, needsSetup, needsApproval]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
