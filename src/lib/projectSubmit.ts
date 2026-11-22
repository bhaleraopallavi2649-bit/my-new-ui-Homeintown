// P7-06: resumable create-project plan for add-project.tsx.
//
// The create flow is several requests: POST /projects, then one upload per
// media item, then (optionally) publish. Previously a failure part-way (say
// photo 3 of 5) left a project on the server, and tapping Save/Publish again
// started from scratch — a SECOND project, with the first one orphaned as a
// draft. This plan lets a retry reuse the created id and send only what is
// still missing. Pure, so jest (node env) can test it.

export type UploadKey = 'cover' | `gallery:${number}` | `video:${number}` | 'brochure';

export interface MediaState {
  cover: boolean;
  gallery: number;
  videos: number;
  brochure: boolean;
}

/** Upload keys still to send, in the same order the form always used. */
export function pendingUploads(state: MediaState, done: Set<string>): UploadKey[] {
  const all: UploadKey[] = [];
  if (state.cover) all.push('cover');
  for (let i = 0; i < state.gallery; i++) all.push(`gallery:${i}`);
  for (let i = 0; i < state.videos; i++) all.push(`video:${i}`);
  if (state.brochure) all.push('brochure');
  return all.filter((k) => !done.has(k));
}

export interface SubmitPlan {
  create: boolean;
  uploads: UploadKey[];
  publish: boolean;
}

export function planSubmit(args: {
  createdId: string | null;
  done: Set<string>;
  publish: boolean;
  state: MediaState;
}): SubmitPlan {
  return {
    create: !args.createdId,
    uploads: pendingUploads(args.state, args.done),
    publish: args.publish === true,
  };
}
