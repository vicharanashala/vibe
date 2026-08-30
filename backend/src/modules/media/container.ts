import {ContainerModule} from 'inversify';
import {MEDIA_TYPES} from './types.js';
import {VideoAssetRepository} from './repositories/providers/mongodb/VideoAssetRepository.js';
import {VideoStorageService} from './services/storage/VideoStorageService.js';
import {SignedUrlPlaybackProvider} from './services/storage/PlaybackUrlProvider.js';
import {CdnPlaybackProvider} from './services/storage/CdnPlaybackProvider.js';
import {storageConfig} from '#root/config/storage.js';
import {VideoAssetService} from './services/VideoAssetService.js';
import {VideoAssetController} from './controllers/VideoAssetController.js';

export const mediaContainerModule = new ContainerModule(options => {
  // Repository
  options.bind(VideoAssetRepository).toSelf().inSingletonScope();
  options.bind(MEDIA_TYPES.VideoAssetRepo).to(VideoAssetRepository);

  // Cloud storage boundary
  options.bind(VideoStorageService).toSelf().inSingletonScope();
  options.bind(MEDIA_TYPES.VideoStorageService).to(VideoStorageService);

  /**
   * Playback strategy, chosen by configuration.
   *
   * With a CDN host configured, playback goes through Cloud CDN — cached at the
   * edge, and signable across a whole path prefix so the .ts segments are covered
   * too. Without one, it falls back to per-object storage-API signing, which is
   * what worked before the CDN existed.
   */
  options.bind(SignedUrlPlaybackProvider).toSelf().inSingletonScope();
  options.bind(CdnPlaybackProvider).toSelf().inSingletonScope();
  options
    .bind(MEDIA_TYPES.PlaybackUrlProvider)
    .to(
      storageConfig.video.cdnHost
        ? CdnPlaybackProvider
        : SignedUrlPlaybackProvider,
    );

  // Service
  options.bind(VideoAssetService).toSelf().inSingletonScope();
  options.bind(MEDIA_TYPES.VideoAssetService).to(VideoAssetService);

  // Controller
  options.bind(VideoAssetController).toSelf().inSingletonScope();
});
