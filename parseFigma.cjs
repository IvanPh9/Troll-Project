const fs = require('fs');

const data = JSON.parse(fs.readFileSync('figma.json', 'utf8'));

function extractTextAndColors(node, indent = '') {
    let result = '';
    
    if (node.name) {
        result += `${indent}Node: ${node.name} (Type: ${node.type})\n`;
    }
    
    if (node.characters) {
        result += `${indent}  Text: "${node.characters}"\n`;
    }
    
    if (node.fills && Array.isArray(node.fills)) {
        node.fills.forEach(fill => {
            if (fill.type === 'SOLID' && fill.color) {
                const r = Math.round(fill.color.r * 255);
                const g = Math.round(fill.color.g * 255);
                const b = Math.round(fill.color.b * 255);
                result += `${indent}  Fill Color: rgb(${r}, ${g}, ${b})\n`;
            }
        });
    }

    if (node.children) {
        node.children.forEach(child => {
            result += extractTextAndColors(child, indent + '  ');
        });
    }
    
    return result;
}

const documentNode = data.document;
const summary = extractTextAndColors(documentNode);
fs.writeFileSync('figma_summary.txt', summary);
console.log('Summary written to figma_summary.txt');
