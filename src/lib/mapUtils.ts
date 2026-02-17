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
/**
 * Compute a boat-shaped hull outline given center, width, length, heading.
 * The bow (front) is pointed with smooth bezier curves; the stern (back) is flat.
 * Heading 0 = bow pointing north, 90 = bow pointing east, etc.
 *
 * Returns ~30-40 {lat,lng} points suitable for a Google Maps Polygon.
 */
export function computeBoatHull(
  lat: number,
  lng: number,
  widthM: number,
  lengthM: number,
  headingDeg: number
): { lat: number; lng: number }[] {
  const headingRad = (headingDeg * Math.PI) / 180;
  const cosH = Math.cos(headingRad);
  const sinH = Math.sin(headingRad);

  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);

  const hw = widthM / 2; // half width
  const hl = lengthM / 2; // half length

  // Build the hull outline in local coords (x = east, y = north, bow = +y)
  // Stern is flat, sides taper, bow is a bezier point
  const localPoints: { x: number; y: number }[] = [];

  // --- Stern (flat back) ---
  localPoints.push({ x: -hw, y: -hl }); // stern-left
  localPoints.push({ x: hw, y: -hl });  // stern-right

  // --- Right side: straight section then bezier curve toward bow ---
  // Straight side goes to ~60% of the length
  const sideEnd = hl * 0.3; // y where the taper begins
  localPoints.push({ x: hw, y: sideEnd });

  // Bezier from (hw, sideEnd) to bow tip (0, hl)
  // Control points create a smooth taper
  const bezierSteps = 12;
  const p0 = { x: hw, y: sideEnd };
  const p1 = { x: hw, y: hl * 0.7 };     // control: keeps width, pushes forward
  const p2 = { x: hw * 0.15, y: hl * 0.95 }; // control: narrows toward tip
  const p3 = { x: 0, y: hl };             // bow tip

  for (let i = 1; i <= bezierSteps; i++) {
    const t = i / bezierSteps;
    const mt = 1 - t;
    localPoints.push({
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
    });
  }

  // --- Left side: mirror bezier from bow tip back to (-hw, sideEnd) ---
  const q0 = { x: 0, y: hl };             // bow tip
  const q1 = { x: -hw * 0.15, y: hl * 0.95 };
  const q2 = { x: -hw, y: hl * 0.7 };
  const q3 = { x: -hw, y: sideEnd };

  for (let i = 1; i <= bezierSteps; i++) {
    const t = i / bezierSteps;
    const mt = 1 - t;
    localPoints.push({
      x: mt * mt * mt * q0.x + 3 * mt * mt * t * q1.x + 3 * mt * t * t * q2.x + t * t * t * q3.x,
      y: mt * mt * mt * q0.y + 3 * mt * mt * t * q1.y + 3 * mt * t * t * q2.y + t * t * t * q3.y,
    });
  }

  // Close back to stern-left
  localPoints.push({ x: -hw, y: -hl });

  // Rotate and project to lat/lng
  return localPoints.map(({ x, y }) => {
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
