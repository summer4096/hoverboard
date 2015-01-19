var RenderingInterface = require('./renderingInterface');

module.exports = function(url, options){
  options = options || {};
  options.async = true;
  var layer = L.tileLayer.canvas(options);
  layer.setUrl(url);

  var projections = {};
  projections.WGS84 = function(offset){
    tileOffset = offset || {x: 0, y: 0};

    return d3.geo.transform({
      point: function(y, x) {
        var point = layer._map.latLngToLayerPoint(new L.LatLng(x, y));
        this.stream.point(point.x-tileOffset.x, point.y-tileOffset.y);
      }
    });
  };

  var modes = {};
  modes.geojson = {
    extensions: ['geojson', 'json'],
    get: function(url, callback){
      var xhr = d3.json(url, callback);
      return xhr.abort.bind(xhr);
    },
    parse: function(data, canvas){
      var tileOffset = {
        x: parseInt(d3.select(canvas).style('left').slice(0, -2)),
        y: parseInt(d3.select(canvas).style('top').slice(0, -2))
      };

      return {
        data: {layer: data},
        projection: projections.WGS84(tileOffset)
      }
    }
  };
  modes.topojson = {
    extensions: ['topojson'],
    get: function(url, callback){
      var xhr = d3.json(url, callback);
      return xhr.abort.bind(xhr);
    },
    parse: function(data, canvas){
      var tileOffset = {
        x: parseInt(d3.select(canvas).style('left').slice(0, -2)),
        y: parseInt(d3.select(canvas).style('top').slice(0, -2))
      };

      var layers = {};
      for (var key in data.objects) {
        layers[key] = topojson.feature(data, data.objects[key]);
      }

      return {
        data: layers,
        projection: projections.WGS84(tileOffset)
      }
    }
  };
  modes.protobuf = {
    extensions: ['mvt', 'pbf'],
    get: function(url, callback){
      var xhr = d3.xhr(url).responseType('arraybuffer').get(callback);
      return xhr.abort.bind(xhr);
    },
    parse: function(data, canvas){
      var tile = new VectorTile( new pbf( new Uint8Array(data) ) );

      var layers = {};

      for (var key in tile.layers) {
        layers[key] = tile.layers[key].toGeoJSON();
      }

      //console.log(layers);

      return {
        data: layers,
        projection: d3.geo.transform({
          point: function(x, y) {
            x = x/tile.layers[layer.__currentLayer].extent*canvas.width;
            y = y/tile.layers[layer.__currentLayer].extent*canvas.height;

            if (options.hidpiPolyfill) {
              x *= (1/window.devicePixelRatio);
              y *= (1/window.devicePixelRatio);
            }

            this.stream.point(x, y);
          }
        })
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

      var result = mode.parse(xhr.response||xhr, tilePoint);

      var path = d3.geo.path()
        .projection(result.projection)
        .context(context);

      var width = canvas.width, height=canvas.height;

      if (options.hidpiPolyfill) {
        width *= (1/window.devicePixelRatio);
        width *= (1/window.devicePixelRatio);
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
