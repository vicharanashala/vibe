import 'reflect-metadata';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {VideoAssetService} from '../services/VideoAssetService.js';
import {IVideoAsset} from '../classes/transformers/VideoAsset.js';
import {storageConfig} from '#root/config/storage.js';

/**
 * Behavioural tests for the service layer, where the authorization rules and the
 * asset state machine live. The other suites cover pure helpers; this covers the
 * decisions — who may upload, who may watch, and what is allowed to make a video
 * playable.
 *
 * Storage, the repository, the playback provider and enrollments are all faked, so
 * these run without a database, a bucket, or credentials.
 */

const COURSE = new ObjectId().toString();
const VERSION = new ObjectId().toString();
const OWNER = new ObjectId().toString();
const STRANGER = new ObjectId().toString();

const user = (id: string, roles: 'admin' | 'user' = 'user') =>
  ({_id: id, roles} as never);

function makeAsset(overrides: Partial<IVideoAsset> = {}): IVideoAsset {
  return {
    _id: new ObjectId(),
    courseId: new ObjectId(COURSE),
    courseVersionId: new ObjectId(VERSION),
    createdBy: new ObjectId(OWNER),
    title: 'Lecture 1',
    contentType: 'video/mp4',
    originalFileName: 'lecture.mp4',
    uploadObjectKey: 'uploads/abc/source.mp4',
    status: 'PROCESSING',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as IVideoAsset;
}

/** Fakes with just enough behaviour to observe what the service decides. */
function harness(options: {
  asset?: IVideoAsset;
  enrollments?: Array<{courseId: string; courseVersionId: string; role: string}>;
  statUpload?: {exists: boolean | 'unknown'; sizeBytes?: number};
  probe?: {playlistObjectKey?: string; inProgress: boolean; problem?: string};
  probeThrows?: boolean;
  referenced?: boolean;
} = {}) {
  const stored: IVideoAsset[] = [];
  let current = options.asset ?? makeAsset();

  const repository = {
    create: vi.fn(async (a: IVideoAsset) => {
      stored.push(a);
      return a;
    }),
    findById: vi.fn(async () => current),
    update: vi.fn(async (_id: string, changes: Partial<IVideoAsset>) => {
      current = {...current, ...changes};
      return current;
    }),
    listByCourseVersion: vi.fn(async () => [current]),
    isReferencedByItem: vi.fn(async () => options.referenced ?? false),
    softDelete: vi.fn(async () => true),
  };

  const storage = {
    createUploadUrl: vi.fn(async () => ({
      url: 'https://signed.example/upload',
      expiresAt: new Date(Date.now() + 3600e3),
    })),
    statUpload: vi.fn(async () => options.statUpload ?? {exists: true as const}),
    probeForPlaylist: vi.fn(async () => {
      if (options.probeThrows) throw new Error('bucket unavailable');
      return options.probe ?? {inProgress: true};
    }),
  };

  const playbackUrls = {
    createGrant: vi.fn(async () => ({
      url: 'https://cdn.example/manifest.m3u8',
      expiresAt: new Date(Date.now() + 3600e3),
    })),
  };

  const enrollments = {
    getAllEnrollments: vi.fn(async () => options.enrollments ?? []),
  };

  const service = new VideoAssetService(
    repository as never,
    storage as never,
    playbackUrls as never,
    enrollments as never,
  );

  return {service, repository, storage, playbackUrls, enrollments, stored,
    get current() { return current; }};
}

const asInstructor = [{courseId: COURSE, courseVersionId: VERSION, role: 'INSTRUCTOR'}];
const asStudent = [{courseId: COURSE, courseVersionId: VERSION, role: 'STUDENT'}];

describe('createUploadUrl — who may upload', () => {
  it('allows an instructor on that course version', async () => {
    const h = harness({enrollments: asInstructor});
    const result = await h.service.createUploadUrl({
      user: user(OWNER),
      courseId: COURSE,
      courseVersionId: VERSION,
      fileName: 'lecture.mp4',
      contentType: 'video/mp4',
      sizeBytes: 1024,
    });
    expect(result.uploadUrl).toContain('https://');
    expect(result.uploadObjectKey).toMatch(/^uploads\/[a-f0-9]{24}\/source\.mp4$/);
  });

  it('refuses a student', async () => {
    const h = harness({enrollments: asStudent});
    await expect(
      h.service.createUploadUrl({
        user: user(OWNER),
        courseId: COURSE,
        courseVersionId: VERSION,
        fileName: 'lecture.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1024,
      }),
    ).rejects.toThrow(/do not have permission/i);
  });

  it('refuses an instructor from a different course version', async () => {
    // Being staff on one course must not grant upload rights on another.
    const h = harness({
      enrollments: [
        {courseId: COURSE, courseVersionId: new ObjectId().toString(), role: 'INSTRUCTOR'},
      ],
    });
    await expect(
      h.service.createUploadUrl({
        user: user(OWNER),
        courseId: COURSE,
        courseVersionId: VERSION,
        fileName: 'lecture.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1024,
      }),
    ).rejects.toThrow(/do not have permission/i);
  });

  it('allows a platform admin with no enrollment at all', async () => {
    const h = harness({enrollments: []});
    await expect(
      h.service.createUploadUrl({
        user: user(OWNER, 'admin'),
        courseId: COURSE,
        courseVersionId: VERSION,
        fileName: 'lecture.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1024,
      }),
    ).resolves.toBeTruthy();
  });
});

describe('createUploadUrl — what may be uploaded', () => {
  const base = {
    user: user(OWNER),
    courseId: COURSE,
    courseVersionId: VERSION,
    contentType: 'video/mp4',
    sizeBytes: 1024,
  };

  it('rejects a non-video extension', async () => {
    const h = harness({enrollments: asInstructor});
    await expect(
      h.service.createUploadUrl({...base, fileName: 'notes.pdf'}),
    ).rejects.toThrow(/Unsupported video file type/);
  });

  it('rejects a non-video content type', async () => {
    const h = harness({enrollments: asInstructor});
    await expect(
      h.service.createUploadUrl({
        ...base,
        fileName: 'lecture.mp4',
        contentType: 'application/octet-stream',
      }),
    ).rejects.toThrow(/must be video\/mp4/i);
  });

  it('rejects a file over the configured maximum', async () => {
    const h = harness({enrollments: asInstructor});
    await expect(
      h.service.createUploadUrl({
        ...base,
        fileName: 'lecture.mp4',
        sizeBytes: storageConfig.video.maxUploadBytes + 1,
      }),
    ).rejects.toThrow(/maximum upload size/i);
  });

  it('states both sizes in GB, so the message is actionable', async () => {
    const h = harness({enrollments: asInstructor});
    await expect(
      h.service.createUploadUrl({
        ...base,
        fileName: 'lecture.mp4',
        sizeBytes: 3 * 1024 ** 3,
      }),
    ).rejects.toThrow(/3\.00 GB.*2\.00 GB/);
  });

  it('pins the content type into the grant it returns', async () => {
    const h = harness({enrollments: asInstructor});
    const result = await h.service.createUploadUrl({
      ...base,
      fileName: 'lecture.mp4',
      contentType: 'video/mp4',
    });
    // The PUT must send exactly this, since it is inside the signature.
    expect(result.requiredContentType).toBe('video/mp4');
  });

  it('rejects a non-MP4 container, even a valid video one', async () => {
    // Narrow on purpose: the pipeline has only been verified with MP4, so a MOV
    // would upload successfully and then never become playable.
    const h = harness({enrollments: asInstructor});
    await expect(
      h.service.createUploadUrl({
        ...base,
        fileName: 'lecture.mov',
        contentType: 'video/quicktime',
      }),
    ).rejects.toThrow(/Unsupported video file type/);
  });

  it('rejects an MP4 filename carrying a different content type', async () => {
    // e.g. a renamed MKV — the extension passes but the browser reports the real
    // type, and that value is what would be pinned into the signature.
    const h = harness({enrollments: asInstructor});
    await expect(
      h.service.createUploadUrl({
        ...base,
        fileName: 'lecture.mp4',
        contentType: 'video/x-matroska',
      }),
    ).rejects.toThrow(/must be video\/mp4/i);
  });
});

describe('markUploaded — a client cannot fake an upload', () => {
  it('refuses when storage says the object is definitely absent', async () => {
    const h = harness({
      enrollments: asInstructor,
      statUpload: {exists: false},
    });
    await expect(
      h.service.markUploaded('any', user(OWNER)),
    ).rejects.toThrow(/Upload not found in storage/);
  });

  it('proceeds when storage cannot be read, since the credential is write-only', async () => {
    // The correct least-privilege grant cannot look; refusing here would break
    // every upload.
    const h = harness({
      enrollments: asInstructor,
      statUpload: {exists: 'unknown'},
    });
    const result = await h.service.markUploaded('any', user(OWNER));
    expect(result.status).toBe('PROCESSING');
  });

  it('never sets READY — only an observed playlist can do that', async () => {
    const h = harness({enrollments: asInstructor, statUpload: {exists: true}});
    const result = await h.service.markUploaded('any', user(OWNER));
    expect(result.status).not.toBe('READY');
  });
});

describe('refreshReadiness — the state machine', () => {
  it('becomes READY only when a master playlist is observed', async () => {
    const h = harness({
      probe: {playlistObjectKey: 'uploads/abc/source.mp4/manifest.m3u8', inProgress: false},
    });
    const result = await h.service.refreshReadiness(makeAsset());
    expect(result.status).toBe('READY');
    expect(result.playlistObjectKey).toContain('manifest.m3u8');
  });

  it('becomes FAILED when the output exists but is not a master playlist', async () => {
    const h = harness({
      probe: {inProgress: false, problem: 'not a multivariant master'},
    });
    const result = await h.service.refreshReadiness(makeAsset());
    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toMatch(/multivariant/);
  });

  it('does NOT flip a good asset to FAILED when the bucket errors', async () => {
    // A transient storage failure must not condemn a video that is fine.
    const h = harness({probeThrows: true});
    const result = await h.service.refreshReadiness(makeAsset({status: 'PROCESSING'}));
    expect(result.status).toBe('PROCESSING');
  });

  it('retires an upload abandoned long ago', async () => {
    const old = makeAsset({
      status: 'UPLOADING',
      createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    });
    // Seeded into the harness as well, so the fake repository mutates this asset
    // rather than a different default one.
    const h = harness({asset: old});
    const result = await h.service.refreshReadiness(old);
    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toMatch(/never finished/i);
  });

  it('leaves a recent UPLOADING asset alone', async () => {
    const recent = makeAsset({status: 'UPLOADING', createdAt: new Date()});
    const h = harness({asset: recent});
    const result = await h.service.refreshReadiness(recent);
    expect(result.status).toBe('UPLOADING');
  });

  it('does not retire a PROCESSING asset by age — the bytes did land', async () => {
    const oldProcessing = makeAsset({
      status: 'PROCESSING',
      createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    });
    const h = harness({asset: oldProcessing});
    const result = await h.service.refreshReadiness(oldProcessing);
    expect(result.status).not.toBe('FAILED');
  });
});

describe('createPlaybackGrant — who may watch', () => {
  const ready = () =>
    makeAsset({
      status: 'READY',
      playlistObjectKey: 'uploads/abc/source.mp4/manifest.m3u8',
    });

  it('grants an enrolled student', async () => {
    const h = harness({asset: ready(), enrollments: asStudent});
    const grant = await h.service.createPlaybackGrant('any', user(STRANGER));
    expect(grant.url).toContain('https://');
  });

  it('grants the uploader even with no enrollment', async () => {
    const h = harness({asset: ready(), enrollments: []});
    await expect(
      h.service.createPlaybackGrant('any', user(OWNER)),
    ).resolves.toBeTruthy();
  });

  it('grants a platform admin', async () => {
    const h = harness({asset: ready(), enrollments: []});
    await expect(
      h.service.createPlaybackGrant('any', user(STRANGER, 'admin')),
    ).resolves.toBeTruthy();
  });

  it('refuses someone with no enrollment on that course version', async () => {
    const h = harness({asset: ready(), enrollments: []});
    await expect(
      h.service.createPlaybackGrant('any', user(STRANGER)),
    ).rejects.toThrow(/do not have access/i);
  });

  it('refuses while the video is not playable, rather than signing nothing', async () => {
    const h = harness({
      asset: makeAsset({status: 'PROCESSING'}),
      enrollments: asStudent,
      probe: {inProgress: true},
    });
    await expect(
      h.service.createPlaybackGrant('any', user(STRANGER)),
    ).rejects.toThrow(/not ready to play/i);
  });
});

describe('deleteAsset', () => {
  it('refuses while a lesson still plays the video', async () => {
    const h = harness({enrollments: asInstructor, referenced: true});
    await expect(h.service.deleteAsset('any', user(OWNER))).rejects.toThrow(
      /used by one or more lessons/i,
    );
    expect(h.repository.softDelete).not.toHaveBeenCalled();
  });

  it('removes an unreferenced video', async () => {
    const h = harness({enrollments: asInstructor, referenced: false});
    await h.service.deleteAsset('any', user(OWNER));
    expect(h.repository.softDelete).toHaveBeenCalledOnce();
  });

  it('refuses a student', async () => {
    const h = harness({enrollments: asStudent});
    await expect(h.service.deleteAsset('any', user(OWNER))).rejects.toThrow(
      /do not have permission/i,
    );
  });
});

describe('updateAsset', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renames', async () => {
    const h = harness({enrollments: asInstructor});
    const result = await h.service.updateAsset({
      assetId: 'any',
      user: user(OWNER),
      title: '  Week 3 — Recursion  ',
    });
    expect(result.title).toBe('Week 3 — Recursion');
  });

  it('refuses a blank title rather than leaving an unnamed row', async () => {
    const h = harness({enrollments: asInstructor});
    await expect(
      h.service.updateAsset({assetId: 'any', user: user(OWNER), title: '   '}),
    ).rejects.toThrow(/cannot be empty/i);
  });

  it('clears a description with undefined so the field is unset, not null', async () => {
    const h = harness({enrollments: asInstructor});
    await h.service.updateAsset({
      assetId: 'any',
      user: user(OWNER),
      description: '  ',
    });
    expect(h.repository.update).toHaveBeenCalledWith('any', {
      description: undefined,
    });
  });

  it('ignores a nonsensical duration instead of storing it', async () => {
    const h = harness({enrollments: asInstructor});
    await h.service.updateAsset({
      assetId: 'any',
      user: user(OWNER),
      durationSeconds: -5,
    });
    expect(h.repository.update).not.toHaveBeenCalled();
  });

  it('refuses a student', async () => {
    const h = harness({enrollments: asStudent});
    await expect(
      h.service.updateAsset({assetId: 'any', user: user(OWNER), title: 'x'}),
    ).rejects.toThrow(/do not have permission/i);
  });
});
