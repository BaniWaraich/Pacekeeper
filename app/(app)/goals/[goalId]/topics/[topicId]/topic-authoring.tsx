"use client";

import { useState } from "react";
import { MaterialEditor } from "./material-editor";
import { DraftPanel } from "./draft-panel";

/**
 * Composes the material editor and the AI draft panel, lifting the
 * unsaved-changes signal between them: POST /api/ai/questions reads
 * `topic.material` server-side, so drafting is blocked while the textarea
 * holds unsaved edits (stale-material guard).
 */
export function TopicAuthoring({
  goalId,
  topicId,
  initialMaterial,
}: {
  goalId: string;
  topicId: string;
  initialMaterial: string;
}) {
  const [materialDirty, setMaterialDirty] = useState(false);

  return (
    <>
      <MaterialEditor
        topicId={topicId}
        initialMaterial={initialMaterial}
        onDirtyChange={setMaterialDirty}
      />
      <DraftPanel
        goalId={goalId}
        topicId={topicId}
        materialDirty={materialDirty}
      />
    </>
  );
}
