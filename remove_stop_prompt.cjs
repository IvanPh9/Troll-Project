const fs = require('fs');

let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const oldEditBranchStop = `function editBranchStop(brId, sectionIdx, stopIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.sections && br.sections[sectionIdx] && br.sections[sectionIdx].stops[stopIdx]) {
    const currentStop = br.sections[sectionIdx].stops[stopIdx];
    const newName = prompt('Назва зупинки на розгалудженні (залиште порожнім для видалення):', currentStop.name);
    if (newName !== null) {
      if (newName.trim() === '') {
        br.sections[sectionIdx].stops.splice(stopIdx, 1);
      } else {
        currentStop.name = newName.trim();
      }
    }
  }
}`;

const newEditBranchStop = `function editBranchStop(brId, sectionIdx, stopIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.sections) {
    if (!br.sections[sectionIdx]) {
      br.sections[sectionIdx] = { stops: [] };
    }
    const sec = br.sections[sectionIdx];
    if (!sec.id) {
      sec.id = 'br_sec_' + br.id + '_' + sectionIdx + '_' + Date.now();
    }
    router.push({ query: { ...route.query, segmentId: String(sec.id) } });
  }
}`;

content = content.replace(oldEditBranchStop, newEditBranchStop);

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
console.log('Successfully removed prompt alert from editBranchStop!');
