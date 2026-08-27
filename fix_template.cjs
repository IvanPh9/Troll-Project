const fs = require('fs');
let constructor = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const templateSearch = `        @add-branch-stop="(brId, si) => addBranchStop(brId, si)"
        @edit-branch-stop="editBranchStop"`;

const templateReplace = `        @add-branch-stop="(brId, si) => addBranchStop(brId, si)"
        @extend-branch-with-stop="extendBranchWithStop"
        @edit-branch-stop="editBranchStop"`;

if (constructor.includes(templateSearch)) {
  constructor = constructor.replace(templateSearch, templateReplace);
  console.log("Updated RouteConstructor template");
} else {
  console.log("ERROR: templateSearch not found!");
}

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', constructor);
