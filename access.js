/* Local distance model. No routing services or population data are used. */
'use strict';
const ProviderAccess = (() => {
  const radians = degrees => degrees * Math.PI / 180;
  function distanceMiles(a, b) {
    const dLat = radians(b[1] - a[1]);
    const dLon = radians(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[1])) *
      Math.cos(radians(b[1])) * Math.sin(dLon / 2) ** 2;
    return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  }
  function nearest(point, providers) {
    let result = null;
    for (const provider of providers) {
      const miles = distanceMiles(point, provider.geometry.coordinates);
      if (!result || miles < result.miles) result = {provider, miles};
    }
    return result;
  }
  function inRing(point, ring) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > y) !== (b[1] > y) &&
        x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function contains(geometry, point) {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    return polygons.some(polygon => inRing(point, polygon[0]) &&
      !polygon.slice(1).some(hole => inRing(point, hole)));
  }
  function samples(geometry, fallback) {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
    for (const polygon of polygons) for (const [x, y] of polygon[0]) {
      west = Math.min(west, x); east = Math.max(east, x);
      south = Math.min(south, y); north = Math.max(north, y);
    }
    const points = [];
    for (let x = 0; x < 24; x++) for (let y = 0; y < 24; y++) {
      const point = [west + (x + 0.5) / 24 * (east - west), south + (y + 0.5) / 24 * (north - south)];
      if (contains(geometry, point)) points.push(point);
    }
    if (!points.length && fallback && contains(geometry, fallback)) points.push(fallback);
    return points;
  }
  function average(points, providers) {
    if (!points.length || !providers.length) return null;
    let total = 0, weights = 0;
    for (const point of points) {
      const weight = Math.cos(radians(point[1]));
      total += nearest(point, providers).miles * weight;
      weights += weight;
    }
    return total / weights;
  }
  // An explicit illustrative assumption, not a road-network travel time.
  const minutes = miles => miles / 30 * 60;
  return {distanceMiles, nearest, contains, samples, average, minutes};
})();
