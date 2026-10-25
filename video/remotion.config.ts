/**
 * remotion.config.ts — GPU-first render settings.
 *
 * `egl` makes the headless Chromium rasterise on the NVIDIA GPU (EGL/ANGLE
 * picks up libEGL_nvidia on this machine), and `if-possible` lets Remotion's
 * bundled FFmpeg encode H.264 with NVENC instead of the CPU encoder.
 *
 * NVENC and `--crf` are mutually exclusive in Remotion, so quality is set
 * with a target bitrate instead of a constant-rate factor.
 */
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(96);
Config.setCodec('h264');
// A moving camera needs more bits than a static one, but 8 Mbps keeps the
// upload size sane for a 1080×1920 reel.
Config.setVideoBitrate('8M');
Config.setPixelFormat('yuv420p');
Config.setChromiumOpenGlRenderer('egl');
Config.setHardwareAcceleration('if-possible');
Config.setDelayRenderTimeoutInMilliseconds(120000);
Config.setOverwriteOutput(true);
