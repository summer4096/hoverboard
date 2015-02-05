#!/bin/bash
while true; do
  browserify -s Hoverboard src/hoverboard.js > dist/hoverboard.js
  uglify -s ~/code/2014/hoverboard/dist/hoverboard.js -o ~/code/2014/hoverboard/dist/hoverboard.min.js
  inotifywait src/
done