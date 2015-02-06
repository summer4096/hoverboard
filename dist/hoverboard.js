!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.Hoverboard=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var RenderingInterface = require('./renderingInterface');

module.exports = L.TileLayer.Canvas.extend({
  options: {
    async: true
  },
  initialize: function(url, options){
    L.TileLayer.Canvas.prototype.initialize.call(this, options);

    this._tileCache = {};
    this._renderers = [];

    this.setUrl(url);

    this.on("tileunload", function(d){
      if (d.tile.abort) d.tile.abort();
      d.tile.abort = null;
    });
  },
  projector: function(tilePoint, layer, canvasSize){
    var tilesLong = Math.pow(2, tilePoint.z);
    var sideLength = 40075016.68557849;
    var pixelsPerTile = sideLength / tilesLong;

    var x = tilePoint.x % tilesLong;
    var y = tilePoint.y % tilesLong;

    var tilePosition = {
      top: (sideLength/2) - ((y+1) / tilesLong * sideLength),
      left: -(sideLength/2) + (x / tilesLong * sideLength)
    };

    tilePosition.bottom = tilePosition.top+pixelsPerTile;
    tilePosition.right = tilePosition.left+pixelsPerTile;

    return d3.geo.transform({
      point: function(lng, lat) {
        var point = L.CRS.EPSG3857.project({lat: lat, lng: lng});
        point.x = (point.x - tilePosition.left)/pixelsPerTile;
        point.y = 1-((point.y - tilePosition.top)/pixelsPerTile);
        point.x *= canvasSize;
        point.y *= canvasSize;
        this.stream.point(point.x, point.y);
      }
    });
  },
  clippedProjector: function(tilePoint, layer, canvasSize){
    var projector = this.projector(tilePoint, layer, canvasSize);

    var clip = d3.geo.clipExtent()
      .extent([[-8, -8], [canvasSize+8, canvasSize+8]]);

    return {stream: function(s) { return projector.stream(clip.stream(s)); }};
  },
  _fetchTile: function(tilePoint, callback){
    var cacheKey = this._url+'@@'+JSON.stringify(tilePoint);

    if (typeof this._tileCache[cacheKey] != 'undefined') {
      callback(null, this._tileCache[cacheKey]);
      return function(){};
    } else {
      var self = this;
      var url = this.getTileUrl(tilePoint);
      return this.fetch(url, function(err, result){
        if (!err) {
          self._tileCache[cacheKey] = self.parse(result);
        }
        callback(err, self._tileCache[cacheKey]);
      });
    }
  },
  render: function(layerName, fn){
    if (typeof fn == 'function') {
      this._renderers.push({
        layer: layerName,
        run: fn
      });
      return this;
    } else {
      var renderer = new RenderingInterface(this, layerName);
      this._renderers.push({
        layer: layerName,
        run: renderer.run.bind(renderer)
      });
      return renderer;
    }
  },
  drawData: function(canvas, tilePoint, data, callback){
    var context = canvas.getContext('2d');

    var canvasSize = canvas.width;
    context.clearRect(0, 0, canvasSize, canvasSize);

    var paths = {};

    if (this._renderers.length) {
      var self = this;
      this._renderers.forEach(function(renderer){
        if (!data[renderer.layer]) return;

        if (typeof paths[renderer.layer] == 'undefined') {
          paths[renderer.layer] = d3.geo.path()
            .projection(self.clippedProjector(tilePoint, renderer.layer, canvasSize))
            .context(context);
        }

        renderer.run(context, data[renderer.layer].features, tilePoint, function(features){
          if (typeof features == 'object' && !Array.isArray(features)) {
            features = [features];
          }

          context.beginPath();
          features.forEach(paths[renderer.layer]);
        });
      });
      callback();
    } else {
      callback(new Error('No renderer specified!'));
    }
  },
  drawTile: function(canvas, tilePoint, zoom){
    if (typeof this._url == 'undefined') {
      this.tileDrawn(canvas);
      return;
    }

    this._adjustTilePoint(tilePoint);

    var self = this;
    canvas.abort = this._fetchTile(tilePoint, function(err, result){
      if (err) {
        self.tileDrawn(canvas);
        throw err;
      }

      self.drawData(canvas, tilePoint, result, function(err){
        self.tileDrawn(canvas);
        if (err) {
          throw err;
        }
      });
    });
  }
});

module.exports.json = module.exports.extend({
  fetch: function(url, callback){
    var xhr = d3.json(url, function(err, xhrResponse){
      callback(err, xhrResponse.response || xhrResponse);
    });

    return xhr.abort.bind(xhr);
  }
});

module.exports.geojson = module.exports.json.extend({
  parse: function(data){
    return {geojson: data};
  }
});

module.exports.topojson = module.exports.json.extend({
  parse: function(data){
    var layers = {};

    for (var key in data.objects) {
      layers[key] = topojson.feature(data, data.objects[key]);
    }

    return layers;
  }
});

module.exports.mvt = module.exports.extend({
  fetch: function(url, callback){
    var xhr = d3.xhr(url)
      .responseType('arraybuffer')
      .get(function(err, xhrResponse){
        callback(err, xhrResponse.response || xhrResponse);
      });

    return xhr.abort.bind(xhr);
  },
  parse: function(data){
    var tile = new VectorTile( new pbf( new Uint8Array(data) ) );

    var layers = {};

    if (typeof this.layerExtents == 'undefined') {
      this.layerExtents = {};

      for (var key in tile.layers) {
        this.layerExtents[key] = tile.layers[key].extent;
      }
    }

    for (var key in tile.layers) {
      layers[key] = tile.layers[key].toGeoJSON();
    }

    return layers;
  },
  projector: function(tilePoint, layer, canvasSize){
    var self = this;

    return d3.geo.transform({
      point: function(x, y) {
        x = x/self.layerExtents[layer]*canvasSize;
        y = y/self.layerExtents[layer]*canvasSize;

        this.stream.point(x, y);
      }
    });
  }
});
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