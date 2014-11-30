var map = L.map('map', {
  center: [44.327,-72.888],
  zoom: 12,
  zoomControl: false
});

//L.tileLayer('http://{s}.tile.stamen.com/terrain-background/{z}/{x}/{y}.jpg').addTo(map);

//var url = 'http://{s}.tile.openstreetmap.us/vectiles-highroad/{z}/{x}/{y}.topojson';
var url = 'https://{s}.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6-dev,mapbox.mapbox-terrain-v1/{z}/{x}/{y}.vector.pbf?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6IlhHVkZmaW8ifQ.hAMX5hSW-QnTeRCMAy9A8Q';

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

  big_road: '#d28585',
  little_road: '#bbb'
};

L.tileLayer.hoverboard(url, {hidpiPolyfill: true})

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
    .fillBy('class', {
      medium_shadow:    'rgba(100, 50, 150,  0.2)',
      full_shadow:      'rgba(100, 50, 150,  0.3)',
      medium_highlight: 'rgba(255, 255, 150, 0.2)',
      full_highlight:   'rgba(255, 255, 150, 0.3)'
    })

  .render('contour')
    .stroke(0.5, 'rgba(0, 0, 0, 0.2)')

  .render('road')
    .where('type', ['motorway', 'trunk'])
    .stroke(3.5, 'rgba(0, 0, 0, 0.5)')
    .stroke(3, colors.big_road)

  .render('road')
    .whereNot('type', ['motorway', 'trunk'])
    .stroke(2, 'rgba(0, 0, 0, 0.5)')
    .stroke(1.5, colors.little_road)

  .render('building')
    .fill('#aaa')

  .render('water')
    .fill(colors.water)

  .render('waterway')
    .stroke(1, colors.water)

  .addTo(map);