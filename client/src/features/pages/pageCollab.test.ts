import { describe, expect, it } from 'vitest';

import type { PageRequest } from './pageApi';
import { isCollaborationEnabled, shouldRestoreAutoSaveDraft } from './pageCollab';

const serverPage: PageRequest = {
  id: 14,
  parentId: null,
  url: '/home/lesson',
  title: 'Lesson',
  shortDesc: 'Existing page',
  content: '<p>Existing content</p>',
  isProtected: false,
  isPinned: false,
  isCategoryPage: false,
  sortChildrenDesc: false,
};

describe('isCollaborationEnabled', () => {
  it('returns true only when the site setting explicitly enables collaboration', () => {
    expect(isCollaborationEnabled({ enable_collaboration: true } as any)).toBe(true);
    expect(isCollaborationEnabled({ enable_collaboration: false } as any)).toBe(false);
    expect(isCollaborationEnabled(undefined)).toBe(false);
  });
});

describe('shouldRestoreAutoSaveDraft', () => {
  it('rejects the blank placeholder draft created before page data loads', () => {
    expect(
      shouldRestoreAutoSaveDraft({
        id: 0,
        parentId: null,
        url: '',
        title: '',
        shortDesc: '',
        content: '',
        isProtected: false,
        isPinned: false,
        isCategoryPage: false,
        sortChildrenDesc: false,
      }, serverPage),
    ).toBe(false);
  });

  it('restores a meaningful draft for the same page', () => {
    expect(
      shouldRestoreAutoSaveDraft({
        ...serverPage,
        content: '<p>Unsaved local changes</p>',
      }, serverPage),
    ).toBe(true);
  });

  it('rejects a stale same-page draft with emptied HTML', () => {
    expect(
      shouldRestoreAutoSaveDraft({
        ...serverPage,
        content: '',
      }, serverPage),
    ).toBe(false);
  });

  it('rejects drafts from another page', () => {
    expect(
      shouldRestoreAutoSaveDraft({
        ...serverPage,
        id: 99,
      }, serverPage),
    ).toBe(false);
  });
});
