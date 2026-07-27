export const MAX_LOGO_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_LOGO_FILE_SIZE_LABEL = "10 MB";

export const ACCEPTED_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

export const ACCEPTED_LOGO_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "svg",
] as const;

export const LOGO_FILE_INPUT_ACCEPT = [
  ...ACCEPTED_LOGO_MIME_TYPES,
  ...ACCEPTED_LOGO_EXTENSIONS.map((extension) => `.${extension}`),
].join(",");

