/**
 * Utilitaires de validation binaire d'images (Magic Bytes)
 *
 * Permet d'inspecter les signatures binaires réelles des fichiers pour
 * prévenir l'usurpation de type MIME et l'injection de fichiers malveillants.
 */

export type SupportedImageFormat = "jpeg" | "png" | "webp";

export interface ImageValidationResult {
  valid: boolean;
  format?: SupportedImageFormat;
  mimeType?: string;
  extension?: string;
  error?: string;
}

/**
 * Signatures binaires standard :
 * - JPEG : FF D8 FF
 * - PNG  : 89 50 4E 47 0D 0A 1A 0A
 * - WebP : 52 49 46 46 (RIFF aux octets 0-3) et 57 45 42 50 (WEBP aux octets 8-11)
 */
export function detectImageFormat(buffer: Buffer): SupportedImageFormat | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // Vérification JPEG : FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // Vérification PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // Vérification WebP : RIFF....WEBP
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return "webp";
  }

  return null;
}

export const MIME_TO_FORMAT: Record<string, SupportedImageFormat> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/pjpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

export const FORMAT_TO_MIME: Record<SupportedImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const FORMAT_TO_EXT: Record<SupportedImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

/**
 * Valide un buffer d'image en comparant sa signature binaire réelle avec le MIME déclaré.
 */
export function validateImageBuffer(
  buffer: Buffer,
  declaredMimeType?: string
): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Fichier d'image vide" };
  }

  const detectedFormat = detectImageFormat(buffer);

  if (!detectedFormat) {
    return {
      valid: false,
      error: "Signature binaire invalide : seuls les formats JPEG, PNG et WebP sont autorisés",
    };
  }

  // Si un MIME type a été déclaré par le client, vérifier la cohérence
  if (declaredMimeType) {
    const normalizedDeclared = declaredMimeType.toLowerCase().trim();
    const expectedFormat = MIME_TO_FORMAT[normalizedDeclared];

    if (!expectedFormat) {
      return {
        valid: false,
        error: `Type MIME déclaré non supporté : ${declaredMimeType}`,
      };
    }

    if (expectedFormat !== detectedFormat) {
      return {
        valid: false,
        error: `Incohérence détectée : le type MIME déclaré (${declaredMimeType}) ne correspond pas à la signature réelle (${detectedFormat})`,
      };
    }
  }

  return {
    valid: true,
    format: detectedFormat,
    mimeType: FORMAT_TO_MIME[detectedFormat],
    extension: FORMAT_TO_EXT[detectedFormat],
  };
}
