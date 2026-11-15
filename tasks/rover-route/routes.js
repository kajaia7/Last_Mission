// ROUTE DATA: real measurements from NASA Mars Trek (https://trek.nasa.gov/mars/).
// Method follows NASA JPL's guide:
// https://www.jpl.nasa.gov/edu/resources/project/map-a-mars-rover-driving-route/
//
// Place: an isolated hill on the southern floor of Jezero Crater (hill top
// near 18.150°N, 77.581°E). Both routes share the same start and finish.
// Coordinates are in tools/route-paths.json.
//
// How the numbers were made (re-run any time):
//   python tasks/rover-route/tools/measure_routes.py
// It uses Mars Trek's elevation profile service with the
// "MGS MOLA and Mars Express HRSC, DEM" height map (about 200 m per pixel).
// "Steepest part" is the steepest 400 m stretch of the route.
//
// Pictures: tasks/rover-route/assets/route-a.png and route-b.png, drawn on the
// Mars Trek layer "MRO CTX, Jezero Mosaic, Preliminary" by
// tools/make-pictures.html (served by tools/save_server.py).
const ROUTE_TASK = {
  place: 'Jezero Crater',
  start: 'the west side of the hill',
  finish: 'the east side of the hill',
  // NASA JPL: Perseverance's top speed is about 152 meters per hour on flat, hard ground.
  roverTopSpeedMetersPerHour: 152,
  elevationLayer: 'MGS MOLA and Mars Express HRSC, DEM',
  routes: [
    {
      id: 'a',
      label: 'Route A',
      name: 'Over the hill',
      summary: 'Straight over the top. Shorter, but steep.',
      image: 'assets/route-a.png',
      mapLayer: 'MRO CTX, Jezero Mosaic, Preliminary',
      distanceKm: 4.26,
      maxSlopeDeg: 17.5,
      climbM: 239
    },
    {
      id: 'b',
      label: 'Route B',
      name: 'Around the hill',
      summary: 'Curves around the north side. Longer, but gentler.',
      image: 'assets/route-b.png',
      mapLayer: 'MRO CTX, Jezero Mosaic, Preliminary',
      distanceKm: 6.17,
      maxSlopeDeg: 5.1,
      climbM: 95
    }
  ]
};
