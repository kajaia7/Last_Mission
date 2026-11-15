// ROUTE DATA: fill this in from NASA Mars Trek (https://trek.nasa.gov/mars/).
// Step-by-step guide: https://www.jpl.nasa.gov/edu/resources/project/map-a-mars-rover-driving-route/
//
// 1. In Mars Trek, go to Jezero Crater and pick ONE start point and ONE finish point.
// 2. Draw two paths between them:
//      Route A goes straight OVER a steep hill (shorter).
//      Route B goes AROUND the hill (longer, gentler).
// 3. For each path, use the distance tool for "distanceKm" and the elevation
//    profile for "maxSlopeDeg" (steepest part) and "climbM" (total uphill).
// 4. Save a screenshot of each path into tasks/rover-route/assets/
//    as route-a.png and route-b.png, and write the map layer name you used.
//
// Leave a value as null until you have measured it. The game shows "—" and a
// "measurements missing" banner, so made-up numbers never reach the pitch.
const ROUTE_TASK = {
  place: 'Jezero Crater',
  start: null,  // e.g. 'Landing site'
  finish: null, // e.g. 'Delta front'
  routes: [
    {
      id: 'a',
      label: 'Route A',
      name: 'Over the hill',
      summary: 'Straight over the top. Shorter, but steep.',
      image: 'assets/route-a.png',
      mapLayer: null,  // the Mars Trek layer shown in the screenshot
      distanceKm: null,
      maxSlopeDeg: null,
      climbM: null
    },
    {
      id: 'b',
      label: 'Route B',
      name: 'Around the hill',
      summary: 'Curves around the side. Longer, but gentler.',
      image: 'assets/route-b.png',
      mapLayer: null,
      distanceKm: null,
      maxSlopeDeg: null,
      climbM: null
    }
  ]
};
