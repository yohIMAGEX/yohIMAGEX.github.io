'use strict';

function colorGradient(colorFrom, colorTo, steps) {
  if(steps > 2) {
    var fromRGB = hexToRgb(colorFrom);
    var toRGB = hexToRgb(colorTo);
    var colors = [];
    var r = null, g = null, b = null;
    var percentage = 0;

    for(var i =0; i< steps; i++) {
      percentage = i / steps;
      r = calculateColorGradient(fromRGB.r, toRGB.r, percentage);
      g = calculateColorGradient(fromRGB.g, toRGB.g, percentage);
      b = calculateColorGradient(fromRGB.b, toRGB.b, percentage);
      colors.push(rgbToHex(r,g,b));
    }
    console.log('colors', colors)
    return colors;
  }
}


function calculateColorGradient(firstColor, secondColor, percentage) {
  return parseInt(firstColor * percentage + secondColor * (1 - percentage));
}


// reference http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

