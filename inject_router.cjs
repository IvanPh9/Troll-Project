const fs = require('fs');

let content = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

if (!content.includes('import { useRouter, useRoute } from \'vue-router\'')) {
  content = content.replace(
    'import { ref, computed, onMounted, onUnmounted, nextTick, watch } from \'vue\';',
    'import { ref, computed, onMounted, onUnmounted, nextTick, watch } from \'vue\';\nimport { useRouter, useRoute } from \'vue-router\';'
  );

  content = content.replace(
    'const props = defineProps({',
    'const router = useRouter();\nconst route = useRoute();\n\nconst props = defineProps({'
  );

  fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', content);
  console.log('Successfully injected router to RouteCanvas.vue!');
} else {
  console.log('Router already injected.');
}
