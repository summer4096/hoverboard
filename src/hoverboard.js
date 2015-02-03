var RenderingInterface = require('./renderingInterface');

function transformer(tilePoint, size){
  size = size || 256;

  var tilesLong = Math.pow(2, tilePoint.z);
  var sideLength = 40075016.68557849;
  var pixelsPerTile = sideLength / tilesLong;

  var x = tilePoint.x % tilesLong;
  var y = tilePoint.y % tilesLong;

  var tilePosition = {
    top: (sideLength/2) - (y / tilesLong * sideLength),
    left: -(sideLength/2) + (x / tilesLong * sideLength)
  };

  tilePosition.bottom = tilePosition.top-pixelsPerTile;
  tilePosition.right = tilePosition.left+pixelsPerTile;

  return d3.geo.transform({
    point: function(lng, lat) {
      var point = L.CRS.EPSG3857.project({lat: lat, lng: lng});
      point.x = (point.x - tilePosition.left)/sideLength;
      point.y = (point.y - tilePosition.top)/sideLength;
      point.x *= size;
      point.y *= size;
      this.stream.point(point.x, point.y);
    }
  });
}

module.exports = function(url, options){
  options = options || {};
  options.async = true;
  var layer = L.tileLayer.canvas(options);
  layer.setUrl(url);

  var projections = {};
  projections.WGS84 = function(tilePoint, size){
    size = size || 256;
    if (options.hidpiPolyfill) {
      size *= (1/window.devicePixelRatio);
    }
    return transformer(tilePoint, size);
  };

  var modes = {};
  modes.geojson = {
    extensions: ['geojson', 'json'],
    get: function(url, callback){
      var xhr = d3.json(url, callback);
      return xhr.abort.bind(xhr);
    },
    parse: function(data, tilePoint){
      return {
        data: {layer: data},
        projection: projections.WGS84(tilePoint)
      }
    }
  };
  modes.topojson = {
    extensions: ['topojson'],
    get: function(url, callback){
      var xhr = d3.json(url, callback);
      return xhr.abort.bind(xhr);
    },
    parse: function(data, tilePoint){
      var layers = {};
      for (var key in data.objects) {
        layers[key] = topojson.feature(data, data.objects[key]);
      }

      return {
        data: layers,
        projection: projections.WGS84(tilePoint)
      }
    }
  };
  modes.protobuf = {
    extensions: ['mvt', 'pbf'],
    get: function(url, callback){
      var xhr = d3.xhr(url).responseType('arraybuffer').get(callback);
      return xhr.abort.bind(xhr);
    },
    parse: function(data, tilePoint){
      var tile = new VectorTile( new pbf( new Uint8Array(data) ) );

      var layers = {};

      for (var key in tile.layers) {
        layers[key] = tile.layers[key].toGeoJSON();
      }

      var projection = d3.geo.transform({
        point: function(x, y) {
          x = x/tile.layers[layer.__currentLayer].extent*256;
          y = y/tile.layers[layer.__currentLayer].extent*256;

          this.stream.point(x, y);
        }
      });

      var clip = d3.geo.clipExtent()
        .extent([[-8, -8], [256+8, 256+8]]);

      return {
        data: layers,
        projection: {stream: function(s) { return projection.stream(clip.stream(s)); }}
      };
    }
  };

  var modeOption = 'auto';
  layer.mode = function(_mode, overrides){
    modeOption = _mode;
    return layer;
  };

  var renderers = [];
  layer.render = function(layerName, fn){
    if (typeof fn == 'function') {
      renderers.push({
        layer: layerName,
        run: fn
      });
      return layer;
    } else {
      var renderer = new RenderingInterface(layer, layerName);
      renderers.push({
        layer: layerName,
        run: renderer.run.bind(renderer)
      });
      return renderer;
    }
  };

  layer.drawTile = function(canvas, tilePoint, zoom) {
    var context = canvas.getContext('2d');
    tilePoint = {x: tilePoint.x, y: tilePoint.y, z: zoom};
    var tilesLong = Math.pow(2, tilePoint.z);
    tilePoint.x %= tilesLong;
    tilePoint.y %= tilesLong;
    if (tilePoint.x < 0) {
      tilePoint.x += tilesLong;
    }
    if (tilePoint.y < 0) {
      tilePoint.y += tilesLong;
    }

    var mode;
    if (modeOption == 'auto') {
      var extension = layer._url.split('?')[0].split('.').pop();
      for (var key in modes) {
        if (modes[key].extensions.indexOf(extension) != -1) {
          mode = modes[key];
          break;
        }
      }
      if (!mode) {
        throw new Error('I don\'t know what to do with URLs ending in .'+extension);
      }
    } else if (typeof modeOption == 'object') {
      mode = modeOption;
    } else {
      mode = modes[modeOption];
    }

    var url = layer.getTileUrl(tilePoint);
    mode.get(url, function(err, xhr){
      if (err) {
        throw err;
      }

      var result = mode.parse(xhr.response || xhr, tilePoint);

      var path = d3.geo.path()
        .projection(result.projection)
        .context(context);

      var width = canvas.width, height = canvas.height;

      if (options.hidpiPolyfill) {
        width *= (1/window.devicePixelRatio);
        height *= (1/window.devicePixelRatio);
      }

      context.clearRect(0, 0, width, height);

      if (renderers.length) {
        renderers.forEach(function(renderer){
          if (!result.data[renderer.layer]) return;

          layer.__currentLayer = renderer.layer;

          renderer.run(context, result.data[renderer.layer].features, tilePoint, function(features){
            if (typeof features == 'object' && !Array.isArray(features)) {
              features = [features];
            }

            context.beginPath();
            features.forEach(path);
          });
        });
      } else {
        throw new Error('No renderer specified!');
      }

      layer.tileDrawn(canvas);
    });
  };

  return layer;
};