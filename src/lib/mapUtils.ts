/**
 * Compute the 4 corners of a rotated rectangle given center, width, length, heading.
 * Used both in the public map page and the admin edit dialog.
 */
export function computeRectCorners(
  lat: number,
  lng: number,
  widthM: number,
  lengthM: number,
  headingDeg: number
): { lat: number; lng: number }[] {
  const headingRad = (headingDeg * Math.PI) / 180;
  const cosH = Math.cos(headingRad);
  const sinH = Math.sin(headingRad);

  // Approximate meters per degree at this latitude
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);

  const hw = widthM / 2; // half width
  const hl = lengthM / 2; // half length

  // Local offsets (x = east, y = north) for each corner
  const localCorners = [
    { x: -hw, y: hl }, // front-left
    { x: hw, y: hl }, // front-right
    { x: hw, y: -hl }, // back-right
    { x: -hw, y: -hl }, // back-left
  ];

  return localCorners.map(({ x, y }) => {
    // Rotate by heading
    const rx = x * cosH - y * sinH;
    const ry = x * sinH + y * cosH;
    return {
      lat: lat + ry / mPerDegLat,
      lng: lng + rx / mPerDegLng,
    };
  });
}

// Harbor center coordinates
export const HARBOR_CENTER = { lat: 57.6138617, lng: 11.8797606 };
