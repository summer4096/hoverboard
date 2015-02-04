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