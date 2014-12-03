!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self);var f=o;f=f.L||(f.L={}),f=f.tileLayer||(f.tileLayer={}),f.hoverboard=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var RenderingInterface = require('./renderingInterface');

module.exports = function(url, options){
  options = options || {};
  options.async = true;
  var layer = L.tileLayer.canvas(options);
  layer.setUrl(url);

  var projections = {};
  projections.WGS84 = function(offset){
    offset = offset || {x: 0, y: 0};

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

      var result = mode.parse(xhr.response, canvas);

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