!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self);var f=o;f=f.L||(f.L={}),f=f.tileLayer||(f.tileLayer={}),f.hoverboard=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"./renderingInterface":2}],2:[function(require,module,exports){
var RenderingInterface = function(layer, name){
  this.layer = layer;
  this.layerName = name;

  this.instructions = [];
  this.whereConditions = [];

  var self = this;
  Object.keys(layer.__proto__).forEach(function(key){
    self[key] = function(){
      return layer[key].apply(layer, arguments);
    };
  });
  ['render', 'data', 'mode', 'addTo'].forEach(function(key){
    self[key] = function(){
      return layer[key].apply(layer, arguments);
    };
  });
};

RenderingInterface.prototype.minZoom = function(minZoom){
  this.minZoom = minZoom;
  return this;
};
RenderingInterface.prototype.maxZoom = function(maxZoom){
  this.maxZoom = maxZoom;
  return this;
};

RenderingInterface.prototype.fill = function(color){
  this.instructions.push({
    type: 'fill',
    color: color
  });
  return this;
};
RenderingInterface.prototype.stroke = function(width, color){
  this.instructions.push({
    type: 'stroke',
    width: width,
    color: color
  });
  return this;
};

RenderingInterface.prototype.fillBy = function(property, colors, fallback){
  this.fill(function(d){
    return colors[d.properties[property]] || fallback;
  });
  return this;
};
RenderingInterface.prototype.strokeBy = function(property, strokes, fallback){
  this.stroke(function(d){
    return strokes[d.properties[property]] || fallback;
  });
  return this;
};

RenderingInterface.prototype._where = function(options){
  console.log('where', options);
  var field = options.field;
  var value = options.value;

  if (typeof value == 'undefined') {
    if (typeof field == 'string') {
      this.where(function(d){
        return d.properties[field] ? true : false;
      }, undefined, options.invert);
    } else if (typeof field == 'object') {
      for (var key in field) {
        this.where(key, field[key], options.invert);
      }
    } else if (typeof field == 'function') {
      if (options.invert) {
        var oldField = field;
        console.log('inverting');
        field = function(){
          return !oldField.apply(null, arguments);
        };
      }
      this.whereConditions.push(field);
    } else {
      throw new Error('with RenderingInterface.where(field, value) if value is undefined then field must be a string, object, or function!');
    }
  } else if (typeof value == 'string' || typeof value == 'number'){
    this.where(function(d){
      return d.properties[field] == value;
    }, undefined, options.invert);
  } else if (typeof value == 'object' && Array.isArray(value)) {
    this.where(function(d){
      return value.indexOf(d.properties[field]) != -1;
    }, undefined, options.invert);
  } else {
    throw new Error('RenderingInterface.where(field, value) cannot be called with field as type '+(typeof field)+' and value as type '+(typeof value));
  }
  return this;
};

RenderingInterface.prototype.where = function(field, value, invert){
  return this._where({field: field, value: value, invert: invert});
}
RenderingInterface.prototype.whereNot = function(field, value){
  console.log('whereNot', field, value);
  return this._where({field: field, value: value, invert: true});
}

RenderingInterface.prototype.run = function(context, features, tile, draw){
  if (typeof this.minZoom == 'number' && tile.z < this.minZoom) return;
  if (typeof this.maxZoom == 'number' && tile.z > this.maxZoom) return;

  this.whereConditions.forEach(function(fn){
    features = features.filter(fn);
  });

  this.instructions.forEach(function(instruction){
    if (instruction.type == 'fill') {
      if (typeof instruction.color == 'string') {
        //fill all at once
        context.fillStyle = instruction.color;
        draw(features);
        context.fill();
      } else if (typeof instruction.color == 'function') {
        //fill individually
        features.forEach(function(feature){
          context.fillStyle = instruction.color(feature);
          draw(feature);
          context.fill();
        });
      } else {
        throw new Error('fill color must be string or function, is type '+(typeof instruction.color));
      }
    } else if (instruction.type == 'stroke') {
      if (typeof instruction.width == 'number' && typeof instruction.color == 'string') {
        //draw all at once
        context.lineWidth = instruction.width;
        context.strokeStyle = instruction.color;
        draw(features);
        context.stroke();
      } else if (typeof instruction.width == 'function' || typeof instruction.color == 'function') {
        //draw individually
        features.forEach(function(feature){
          var lineWidth = (typeof instruction.width == 'function') ? instruction.width(feature) : instruction.width;
          var strokeStyle = (typeof instruction.color == 'function') ? instruction.color(feature) : instruction.color;

          if (typeof instruction.color == 'undefined' && Array.isArray(lineWidth)) {
            strokeStyle = lineWidth[1];
            lineWidth = lineWidth[0];
          }

          draw(feature);
          context.stroke();
        });
      } else {
        throw new Error('Expected stroke(number or function, string or function) or stroke(function), got stroke('+(typeof instruction.width)+', '+(typeof instruction.color)+')');
      }
    }
  });
};

module.exports = RenderingInterface;
},{}]},{},[1])(1)
});