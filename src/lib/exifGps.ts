/**
 * Pure-JS EXIF GPS extractor.
 * Parses JPEG EXIF data to extract GPS latitude and longitude.
 * No external dependencies — uses DataView on the file's ArrayBuffer.
 */

export interface ExifGpsCoords {
  lat: number;
  lng: number;
}

/**
 * Extract GPS coordinates from a JPEG file's EXIF data.
 * Returns null if the file has no EXIF GPS data or is not a JPEG.
 */
export async function extractExifGps(file: File): Promise<ExifGpsCoords | null> {
  try {
    // Read the first 128KB — EXIF data is always near the start
    const slice = file.slice(0, 131072);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);

    // Check JPEG SOI marker
    if (view.getUint16(0) !== 0xffd8) return null;

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      offset += 2;

      // APP1 marker — contains EXIF
      if (marker === 0xffe1) {
        const length = view.getUint16(offset);
        // Check "Exif\0\0" header
        if (
          view.getUint32(offset + 2) === 0x45786966 && // "Exif"
          view.getUint16(offset + 6) === 0x0000
        ) {
          return parseExifGps(view, offset + 8, length - 8);
        }
        offset += length;
      } else if ((marker & 0xff00) === 0xff00) {
        // Skip other markers
        const len = view.getUint16(offset);
        offset += len;
      } else {
        break;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Parse the TIFF header and find GPS IFD */
function parseExifGps(
  view: DataView,
  tiffStart: number,
  maxLen: number
): ExifGpsCoords | null {
  if (tiffStart + maxLen > view.byteLength) return null;

  // Determine byte order
  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949; // "II" = Intel = little-endian
  if (!littleEndian && byteOrder !== 0x4d4d) return null; // "MM" = Motorola = big-endian

  // Verify TIFF magic number
  if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) return null;

  // Offset to first IFD
  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);

  // Find GPS IFD pointer in IFD0
  const gpsIfdOffset = findTagValue(
    view,
    tiffStart,
    tiffStart + ifd0Offset,
    0x8825, // GPSInfoIFDPointer tag
    littleEndian
  );
  if (gpsIfdOffset === null) return null;

  // Parse GPS IFD entries
  return parseGpsIfd(view, tiffStart, tiffStart + gpsIfdOffset, littleEndian);
}

/** Find a specific tag value in an IFD (returns the 4-byte value/offset field as uint32) */
function findTagValue(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  targetTag: number,
  littleEndian: boolean
): number | null {
  if (ifdOffset + 2 > view.byteLength) return null;
  const count = view.getUint16(ifdOffset, littleEndian);

  for (let i = 0; i < count; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) return null;

    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === targetTag) {
      return view.getUint32(entryOffset + 8, littleEndian);
    }
  }
  return null;
}

/** Parse the GPS IFD and extract lat/lng */
function parseGpsIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean
): ExifGpsCoords | null {
  if (ifdOffset + 2 > view.byteLength) return null;
  const count = view.getUint16(ifdOffset, littleEndian);

  let latRef = "";
  let lngRef = "";
  let latValues: number[] | null = null;
  let lngValues: number[] | null = null;

  for (let i = 0; i < count; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);
    const valueOffset = view.getUint32(entryOffset + 8, littleEndian);

    switch (tag) {
      case 0x0001: // GPSLatitudeRef — "N" or "S"
        latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
        break;
      case 0x0002: // GPSLatitude — 3 rationals
        latValues = readRationals(view, tiffStart + valueOffset, 3, littleEndian);
        break;
      case 0x0003: // GPSLongitudeRef — "E" or "W"
        lngRef = String.fromCharCode(view.getUint8(entryOffset + 8));
        break;
      case 0x0004: // GPSLongitude — 3 rationals
        lngValues = readRationals(view, tiffStart + valueOffset, 3, littleEndian);
        break;
    }
  }

  if (!latValues || !lngValues || !latRef || !lngRef) return null;

  const lat = dmsToDecimal(latValues[0], latValues[1], latValues[2]);
  const lng = dmsToDecimal(lngValues[0], lngValues[1], lngValues[2]);

  return {
    lat: latRef === "S" ? -lat : lat,
    lng: lngRef === "W" ? -lng : lng,
  };
}

/** Read N EXIF rational values (each is 2 × uint32: numerator/denominator) */
function readRationals(
  view: DataView,
  offset: number,
  count: number,
  littleEndian: boolean
): number[] | null {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const pos = offset + i * 8;
    if (pos + 8 > view.byteLength) return null;
    const num = view.getUint32(pos, littleEndian);
    const den = view.getUint32(pos + 4, littleEndian);
    values.push(den === 0 ? 0 : num / den);
  }
  return values;
}

/** Convert degrees/minutes/seconds to decimal degrees */
function dmsToDecimal(degrees: number, minutes: number, seconds: number): number {
  return degrees + minutes / 60 + seconds / 3600;
}
