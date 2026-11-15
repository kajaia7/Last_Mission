"""Measure the two rover routes with NASA Mars Trek's elevation profile service.

Uses only the Python standard library:

    python tasks/rover-route/tools/measure_routes.py

It asks Mars Trek for the ground height along each route in route-paths.json
(the same service behind Mars Trek's "Elevation Profile" tool) and prints the
distance, steepest slope and total climb to copy into ../routes.js.

Elevation layer: "MGS MOLA and Mars Express HRSC, DEM" (about 200 m per pixel).
Because each height pixel is about 200 m wide, the steepest slope is measured
over 400 m stretches (two pixels) so single-pixel steps don't exaggerate it.
"""
import json
import math
import pathlib
import urllib.parse
import urllib.request

SERVICE = 'https://trek.nasa.gov/mars/TrekServices/ws/elevationProfile/calculate'
DEM = ('https://trek.nasa.gov/mars/trekarcgis/rest/services/'
       'Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw/ImageServer')
MARS_RADIUS_M = 3390000
SAMPLES = 200
SLOPE_BASELINE_M = 400


def profile(path):
    query = urllib.parse.urlencode({
        'endpoint': DEM,
        'path': json.dumps(path, separators=(',', ':')),
        'numberOfPoints': SAMPLES,
        'radiusInMeters': MARS_RADIUS_M,
    })
    request = urllib.request.Request(f'{SERVICE}?{query}', headers={'User-Agent': 'rover-route-measure/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = json.load(response)
    total = float(data['totalDistance'])
    heights = [point['elevation'] for point in data['line']]
    return total, heights, data['line']


def measure(path):
    total, heights, line = profile(path)
    step = total / (len(heights) - 1)
    k = max(1, round(SLOPE_BASELINE_M / step))
    steepest = max(
        math.degrees(math.atan(abs(heights[i + k] - heights[i]) / (k * step)))
        for i in range(len(heights) - k)
    )
    climb = sum(max(0, b - a) for a, b in zip(heights, heights[1:]))
    top = max(range(len(heights)), key=heights.__getitem__)
    return {
        'distanceKm': round(total / 1000, 2),
        'maxSlopeDeg': round(steepest, 1),
        'climbM': round(climb),
        'startHeightM': heights[0],
        'finishHeightM': heights[-1],
        'highestM': heights[top],
        'highestAt': [round(line[top]['x'], 4), round(line[top]['y'], 4)],
    }


def main():
    paths = json.loads((pathlib.Path(__file__).with_name('route-paths.json')).read_text(encoding='utf-8'))
    for route_id, path in paths['routes'].items():
        print(f'Route {route_id.upper()}:', json.dumps(measure(path)))


if __name__ == '__main__':
    main()
