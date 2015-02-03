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

L.tileLayer.hoverboard(url, {hidpiPolyfill: true})

  .render('water')
    .fill(colors.water)

  .addTo(map);

var hash = L.hash(map);
