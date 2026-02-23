"use client";

import { useState } from "react";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { REACTION_EMOJIS, REACTION_LABELS } from "@/lib/types";
import type { ReactionMap } from "@/lib/types";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";

// ─── Shared user-name cache (singleton across all instances) ───
let cachedNames: Record<string, string> | null = null;
let fetchPromise: Promise<Record<string, string>> | null = null;

async function getUserNames(): Promise<Record<string, string>> {
  if (cachedNames) return cachedNames;
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    const snap = await getDocs(collection(db, "users"));
    const map: Record<string, string> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.name) map[d.id] = data.name;
    });
    cachedNames = map;
    return map;
  })();
  return fetchPromise;
}

// ─── Props ──────────────────────────────────────────────
interface ReactionsBarProps {
  /** Firestore document ID of the news post */
  postId: string;
  /** Current reactions map */
  reactions: ReactionMap;
  /** Called after a reaction changes (to update parent state) */
  onReactionsChange?: (updated: ReactionMap) => void;
  /** Compact mode (smaller chips) */
  compact?: boolean;
}

/**
 * Shared reaction bar component used on news listing, detail, and homepage.
 * Shows emoji chips with counts. Hover tooltip shows reactor names.
 * Clicking toggles the current user's reaction.
 */
export default function ReactionsBar({
  postId,
  reactions,
  onReactionsChange,
  compact = false,
}: ReactionsBarProps) {
  const { firebaseUser } = useAuth();
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // Lazy-load user names only when hovering over a reaction
  const loadNames = () => {
    if (Object.keys(userNames).length > 0) return; // already loaded
    getUserNames().then(setUserNames);
  };

  const handleToggle = async (emoji: string) => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const current = reactions[emoji] || [];
    const hasReacted = current.includes(uid);

    try {
      await updateDoc(doc(db, "news", postId), {
        [`reactions.${emoji}`]: hasReacted
          ? arrayRemove(uid)
          : arrayUnion(uid),
      });

      // Build updated reactions map
      const updated = { ...reactions };
      const list = [...(updated[emoji] || [])];
      if (hasReacted) {
        updated[emoji] = list.filter((id) => id !== uid);
        if (updated[emoji].length === 0) delete updated[emoji];
      } else {
        updated[emoji] = [...list, uid];
      }
      onReactionsChange?.(updated);
    } catch (err) {
      console.error("Error toggling reaction:", err);
    }
  };

  // Build tooltip text for an emoji
  const getTooltip = (emoji: string, reactorIds: string[]): string => {
    if (reactorIds.length === 0) {
      return firebaseUser
        ? REACTION_LABELS[emoji] || "Reagera"
        : "Logga in för att reagera";
    }

    const names = reactorIds.map(
      (uid) => userNames[uid] || (uid === firebaseUser?.uid ? "Du" : "Okänd")
    );

    // Put "Du" first if the user has reacted
    const sorted = [...names].sort((a, b) =>
      a === "Du" ? -1 : b === "Du" ? 1 : 0
    );

    const label = REACTION_LABELS[emoji] || "";
    const nameStr =
      sorted.length <= 3
        ? sorted.join(", ")
        : `${sorted.slice(0, 3).join(", ")} +${sorted.length - 3}`;

    return label ? `${label}\n${nameStr}` : nameStr;
  };

  return (
    <Box
      sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={loadNames}
    >
      {REACTION_EMOJIS.map((emoji) => {
        const reactors = reactions[emoji] || [];
        const hasReacted = firebaseUser
          ? reactors.includes(firebaseUser.uid)
          : false;
        const count = reactors.length;

        return (
          <Tooltip
            key={emoji}
            title={
              <span style={{ whiteSpace: "pre-line" }}>
                {getTooltip(emoji, reactors)}
              </span>
            }
            arrow
          >
            <span>
              <Chip
                label={`${emoji}${count > 0 ? ` ${count}` : ""}`}
                size={compact ? "small" : "small"}
                clickable={!!firebaseUser}
                onClick={() => handleToggle(emoji)}
                disabled={!firebaseUser}
                variant={hasReacted ? "filled" : "outlined"}
                sx={{
                  fontSize: compact ? "0.85rem" : "1rem",
                  borderColor: hasReacted
                    ? "primary.main"
                    : "rgba(79,195,247,0.15)",
                  bgcolor: hasReacted
                    ? "rgba(79,195,247,0.15)"
                    : "transparent",
                  "&:hover": { bgcolor: "rgba(79,195,247,0.1)" },
                  ...(count === 0 && !firebaseUser
                    ? { display: "none" }
                    : {}),
                }}
              />
            </span>
          </Tooltip>
        );
      })}
    </Box>
  );
}
