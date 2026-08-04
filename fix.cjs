const fs = require('fs');
let file = fs.readFileSync('c:/Users/2025/Desktop/Depo/web_v.01/src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

file = file.replace(/L \$\{l\.rightX \+ absDx\} \$\{turnY - r\}\s+A \$\{r\} \$\{r\} 0 0 1 \$\{l\.rightX \+ absDx - r\} \$\{turnY\}\s+L \$\{l\.rightX \+ 38\.62\} \$\{turnY\}\s+A \$\{r\} \$\{r\} 0 0 0 \$\{l\.rightX \+ 27\.32\} \$\{turnY \+ 4\.68\}/g,
`L \${l.rightX + absDx} \${turnY}
          A \${r} \${r} 0 0 1 \${l.rightX + absDx - r} \${turnY + r}
          L \${l.rightX + r} \${mergeY - r}
          A \${r} \${r} 0 0 0 \${l.rightX} \${mergeY}`);

file = file.replace(/L \$\{l\.leftX - absDx\} \$\{turnY \+ r\}\s+A \$\{r\} \$\{r\} 0 0 1 \$\{l\.leftX - absDx \+ r\} \$\{turnY\}\s+L \$\{l\.leftX - 38\.62\} \$\{turnY\}\s+A \$\{r\} \$\{r\} 0 0 0 \$\{l\.leftX - 27\.32\} \$\{turnY - 4\.68\}/g,
`L \${l.leftX - absDx} \${turnY}
          A \${r} \${r} 0 0 1 \${l.leftX - absDx + r} \${turnY - r}
          L \${l.leftX - r} \${mergeY + r}
          A \${r} \${r} 0 0 0 \${l.leftX} \${mergeY}`);

fs.writeFileSync('c:/Users/2025/Desktop/Depo/web_v.01/src/modules/route-constructor/components/RouteCanvas.vue', file);
console.log('done');
