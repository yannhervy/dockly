"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
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
  effectiveUid: string | null;
  realProfile: User | null; // Always the actual admin profile (even during view-as)
  loading: boolean;
  needsSetup: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  // Role helpers (reflect viewed user during view-as)
  isSuperadmin: boolean;
  isDockManager: boolean;
  isTenant: boolean;
  hasRole: (role: UserRole) => boolean;
  needsApproval: boolean;
  // View-as (impersonation without logout)
  isViewingAs: boolean;
  viewingAsProfile: User | null;
  startViewingAs: (user: User) => void;
  stopViewingAs: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [realProfile, setRealProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // View-as (impersonation) state
  const [viewingAsProfile, setViewingAsProfile] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = sessionStorage.getItem("viewingAs");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

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
          setRealProfile(profileData);
          // Update lastLogin timestamp silently
          if (profileData) {
            updateDoc(doc(db, "users", user.uid), { lastLogin: Timestamp.now() }).catch(() => {});
          }
        } catch {
          setFirebaseUser(user);
          setRealProfile(null);
        }
      } else {
        setFirebaseUser(null);
        setRealProfile(null);
        // Clear view-as on logout
        setViewingAsProfile(null);
        sessionStorage.removeItem("viewingAs");
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
      setRealProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : null);
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  // View-as methods
  const startViewingAs = useCallback((user: User) => {
    setViewingAsProfile(user);
    sessionStorage.setItem("viewingAs", JSON.stringify(user));
  }, []);

  const stopViewingAs = useCallback(() => {
    setViewingAsProfile(null);
    sessionStorage.removeItem("viewingAs");
  }, []);

  // Active profile: viewed user during view-as, otherwise real profile
  const profile = viewingAsProfile || realProfile;
  const isViewingAs = !!viewingAsProfile;

  // Effective UID: impersonated user's ID during view-as, otherwise the real Firebase UID
  const effectiveUid = viewingAsProfile?.id || firebaseUser?.uid || null;

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
      effectiveUid,
      realProfile,
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
      isViewingAs,
      viewingAsProfile,
      startViewingAs,
      stopViewingAs,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firebaseUser, profile, realProfile, loading, needsSetup, needsApproval, isViewingAs, viewingAsProfile, effectiveUid]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
