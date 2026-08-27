const fs = require('fs');

let content = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

// Remove the rogue <template> right before <div class="canvas-container
content = content.replace(/<\/g>\s*<\/g>\s*<\/g>\s*<template>\s*<div class="canvas-container/g, '</g>\n          </g>\n        </g>\n\n<div class="canvas-container');
content = content.replace(/<template>\s*<div class="canvas-container/g, '<div class="canvas-container');

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', content);
console.log('Removed rogue template tag.');
