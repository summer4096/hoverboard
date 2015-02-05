var map = L.map('map', {
  center: [44.327,-72.888],
  zoom: 12,
  zoomControl: false
});

//L.tileLayer('http://{s}.tile.stamen.com/terrain-background/{z}/{x}/{y}.jpg').addTo(map);

//var url = 'http://{s}.tile.openstreetmap.us/vectiles-highroad/{z}/{x}/{y}.topojson';
var url = 'https://{s}.tiles.mapbox.com/v4/mapbox.mapbox-streets-v5,mapbox.mapbox-terrain-v2/{z}/{x}/{y}.vector.pbf?access_token=pk.eyJ1IjoiZmFyYWRheTIiLCJhIjoiTUVHbDl5OCJ9.buFaqIdaIM3iXr1BOYKpsQ';

var colors = {
  land: '#FCFBE7',
  water: '#368ed9',
  grass: '#E6F2C1',
  beach: '#FFEEC7',
  park: '#DAF2C1',
  cemetery: '#D6DED2',
  wooded: '#C3D9AD',
  agriculture: '#F2E8B6',
  building: '#E4E0E0',
  hospital: 'rgb(229,198,195)',
  school: '#FFF5CC',
  sports: '#B8E6B8',
  residential: '#FCFBE7',
  commercial: '#FCFBE7',
  industrial: '#FCFBE7',
  parking: '#EEE',
  big_road: '#853A6C',
  little_road: '#853A6C'
};

(new Hoverboard.mvt(url, {hidpiPolyfill: true}))

  .render('landuse')
    .minZoom(12)
    .fillBy('class', {
      cemetery: colors.cemetery,
      college: colors.school,
      commercial: colors.industrial,
      common: colors.park,
      forest: colors.wooded,
      golf_course: colors.sports,
      grass: colors.grass,
      hospital: colors.hospital,
      industrial: colors.industrial,
      park: colors.park,
      parking: colors.parking,
      pedestrian: colors.pedestrian_fill,
      pitch: colors.sports,
      residential: colors.residential,
      school: colors.school,
      sports_center: colors.sports,
      stadium: colors.sports,
      university: colors.school,
      wood: colors.wooded
    })

  .render('hillshade')
    .fillBy('level', {
      // Hillshade is now defined by numeric shade level in v2
      94: '#f2f3f3',
      90: '#cdcdd1',
      89: '#a8a8b1',
      78: '#868592',
      67: '#646373',
      56: '#444456'
    })

  .render('contour')
    .stroke(0.6, 'rgba(20,20,35,0.3')
    // Try out hypsometric nonsense here:
    /*.fillBy('ele', {
      10: '#000',
      20: '#111'
      etc . . .
    })*/

  .render('road')
    .where('type', ['motorway', 'trunk'])
    .stroke(1.75, 'rgba(2555, 255, 255, 0.5)')
    .stroke(0.75, colors.big_road)

  .render('road')
    .whereNot('type', ['motorway', 'trunk'])
    .stroke(1, 'rgba(255, 255, 255, 0.5)')
    .stroke(0.5, colors.little_road)

  .render('building')
    .fill('#888896')
    .stroke(0.5, 'rgba(0,0,0,0.4)')

  .render('water')
    .fill(colors.water)

  .render('waterway')
    .stroke(1, colors.water)

  .addTo(map);

var hash = L.hash(map);
