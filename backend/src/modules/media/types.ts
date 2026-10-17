const MEDIA_TYPES = {
  VideoAssetService: Symbol.for('VideoAssetService'),
  VideoAssetRepo: Symbol.for('VideoAssetRepo'),
  VideoStorageService: Symbol.for('VideoStorageService'),
  /**
   * Bound to whichever playback-authorization strategy the deployment uses —
   * per-object signed URLs today, Cloud CDN signed cookies once confirmed.
   * Call sites depend on the interface, never the implementation.
   */
  PlaybackUrlProvider: Symbol.for('PlaybackUrlProvider'),
};

export {MEDIA_TYPES};
