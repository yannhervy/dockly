"use client";

import React, { useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import type { InternalComment } from "@/lib/types";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import AddCommentIcon from "@mui/icons-material/AddComment";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

// ─── Helpers ──────────────────────────────────────────────
function formatDate(ts: Timestamp): string {
  const d = ts.toDate();
  if (d.getFullYear() < 2000) return "Okänt datum";
  return d.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface Props {
  /** Current list of internal comments */
  comments: InternalComment[];
  /** Called with updated comments array after add/delete/edit */
  onChange: (updated: InternalComment[]) => void;
  /** Map of userId → display name (for rendering author names) */
  userNames?: Record<string, string>;
  /** If true, show compact layout */
  compact?: boolean;
}

/**
 * Reusable panel for viewing, adding, editing, and deleting internal comments.
 * Used across admin tabs for Users, Resources, LandStorage, and AbandonedObjects.
 */
export default function InternalCommentsPanel({
  comments,
  onChange,
  userNames = {},
  compact = false,
}: Props) {
  const { firebaseUser } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const handleAdd = () => {
    if (!newComment.trim() || !firebaseUser) return;
    const entry: InternalComment = {
      byWho: firebaseUser.uid,
      date: Timestamp.now(),
      comment: newComment.trim(),
    };
    onChange([...comments, entry]);
    setNewComment("");
    setAdding(false);
  };

  const handleDelete = (index: number) => {
    onChange(comments.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditText(comments[index].comment);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editText.trim()) return;
    const updated = comments.map((c, i) =>
      i === editingIndex ? { ...c, comment: editText.trim() } : c
    );
    onChange(updated);
    setEditingIndex(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  const getAuthorName = (uid: string): string => {
    if (userNames[uid]) return userNames[uid];
    if (firebaseUser && uid === firebaseUser.uid) return "Du";
    return uid.slice(0, 8) + "…";
  };

  return (
    <Box sx={{ mt: compact ? 1 : 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary" }}>
          Interna kommentarer ({comments.length})
        </Typography>
        {!adding && (
          <Tooltip title="Lägg till kommentar">
            <IconButton size="small" onClick={() => setAdding(true)} color="primary">
              <AddCommentIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Existing comments */}
      {comments.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1 }}>
          {comments.map((c, i) => (
            <Box
              key={i}
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: "rgba(79, 195, 247, 0.04)",
                border: "1px solid rgba(79, 195, 247, 0.08)",
              }}
            >
              {editingIndex === i ? (
                /* ── Inline edit mode ── */
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <TextField
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={4}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveEdit();
                      }
                      if (e.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                  />
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    <Button size="small" variant="contained" onClick={handleSaveEdit} disabled={!editText.trim()}>
                      Spara
                    </Button>
                    <Button size="small" onClick={cancelEdit}>
                      Avbryt
                    </Button>
                  </Box>
                </Box>
              ) : (
                /* ── Read mode ── */
                <>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", flex: 1 }}>
                      {c.comment}
                    </Typography>
                    <Box sx={{ display: "flex", ml: 1 }}>
                      <Tooltip title="Redigera kommentar">
                        <IconButton size="small" onClick={() => startEdit(i)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Ta bort kommentar">
                        <IconButton size="small" onClick={() => handleDelete(i)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    {getAuthorName(c.byWho)} · {formatDate(c.date)}
                  </Typography>
                </>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Add form */}
      {adding && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            placeholder="Skriv en intern kommentar…"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAdd();
              }
            }}
            autoFocus
          />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Button size="small" variant="contained" onClick={handleAdd} disabled={!newComment.trim()}>
              Spara
            </Button>
            <Button size="small" onClick={() => { setAdding(false); setNewComment(""); }}>
              Avbryt
            </Button>
          </Box>
        </Box>
      )}

      {comments.length === 0 && !adding && (
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
          Inga kommentarer
        </Typography>
      )}
    </Box>
  );
}
