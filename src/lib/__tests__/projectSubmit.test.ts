// P7-06: resumable create-project plan. Previously a retry after a failed
// upload re-POSTed /projects and created a duplicate project.
import { pendingUploads, planSubmit } from '../projectSubmit';

const state = { cover: true, gallery: 2, videos: 1, brochure: true };

describe('pendingUploads', () => {
  it('orders cover → gallery → video → brochure', () => {
    expect(pendingUploads(state, new Set())).toEqual(['cover', 'gallery:0', 'gallery:1', 'video:0', 'brochure']);
  });
  it('omits absent media', () => {
    expect(pendingUploads({ cover: true, gallery: 0, videos: 0, brochure: false }, new Set())).toEqual(['cover']);
  });
});

describe('planSubmit', () => {
  it('fresh submit, publish=false → create, every upload, no publish', () => {
    expect(planSubmit({ createdId: null, done: new Set(), publish: false, state })).toEqual({
      create: true,
      uploads: ['cover', 'gallery:0', 'gallery:1', 'video:0', 'brochure'],
      publish: false,
    });
  });

  it('retry with an id and some uploads done, publish=true → no create, only the rest, publish', () => {
    expect(planSubmit({ createdId: 'p1', done: new Set(['cover', 'gallery:0']), publish: true, state })).toEqual({
      create: false,
      uploads: ['gallery:1', 'video:0', 'brochure'],
      publish: true,
    });
  });

  it('retry with publish=false → publish stays false', () => {
    expect(planSubmit({ createdId: 'p1', done: new Set(['cover']), publish: false, state }).publish).toBe(false);
  });

  it('everything uploaded + publish=true → no uploads, publish only', () => {
    const done = new Set(['cover', 'gallery:0', 'gallery:1', 'video:0', 'brochure']);
    expect(planSubmit({ createdId: 'p1', done, publish: true, state })).toEqual({ create: false, uploads: [], publish: true });
  });
});
