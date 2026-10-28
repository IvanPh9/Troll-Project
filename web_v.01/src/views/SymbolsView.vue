<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import SvgIcon, { type IconName } from '@/components/ui/SvgIcon.vue'

interface IconDoc {
  name: IconName | string
  title: string
  category: string
  description: string
  usageContext: string
  type: 'stroke' | 'fill' | 'both'
}

const iconsDocumentation: IconDoc[] = [
  {
    name: 'arrow-right',
    title: 'Стрілка вправо',
    category: 'Навігація',
    description: 'Вказівник переходу або прямого напрямку руху транспорту.',
    usageContext: 'Кнопки переходу, навігація списків, розклади руху',
    type: 'fill'
  },
  {
    name: 'arrow-left',
    title: 'Стрілка вліво (Назад)',
    category: 'Навігація',
    description: 'Головна кнопка повернення назад до попереднього розділу або списку.',
    usageContext: 'Верхня плаваюча скляна панель навігації, сторінки деталей',
    type: 'stroke'
  },
  {
    name: 'chevron-left',
    title: 'Шеврон вліво',
    category: 'Навігація',
    description: 'Компактний кутовий вказівник повернення або згортання елемента.',
    usageContext: 'Кнопки повернення, пагінація сторінок, модальні вікна',
    type: 'stroke'
  },
  {
    name: 'chevron-right',
    title: 'Шеврон вправо',
    category: 'Навігація',
    description: 'Компактний вказівник переходу або розкриття підменю.',
    usageContext: 'Списки карток, елементи вибору, перехід до профілю',
    type: 'stroke'
  },
  {
    name: 'chevron-down',
    title: 'Шеврон вниз',
    category: 'Навігація',
    description: 'Символ випадаючого списку (dropdown) або розгортання акордеона.',
    usageContext: 'Селекти, спадні списки типів транспорту, фільтри',
    type: 'stroke'
  },
  {
    name: 'route',
    title: 'Маршрут',
    category: 'Сутності системи',
    description: 'Символ транспортного маршруту депо (траєкторія зі стрілкою).',
    usageContext: 'Вкладка «Маршрути» в навігації, список маршрутів, конструктор',
    type: 'fill'
  },
  {
    name: 'drivers',
    title: 'Водії',
    category: 'Сутності системи',
    description: 'Символ персоналу / водіїв депо (портфель або бейдж водія).',
    usageContext: 'Вкладка «Водії», списки водіїв, статистика зміни',
    type: 'fill'
  },
  {
    name: 'vehicle',
    title: 'Транспортні засоби',
    category: 'Сутності системи',
    description: 'Фронтальне зображення тролейбуса / автобуса депо.',
    usageContext: 'Вкладка «Транспортні засоби», реєстр рухомого складу',
    type: 'fill'
  },
  {
    name: 'wmode',
    title: 'Режими роботи',
    category: 'Сутності системи',
    description: 'Графік змін, робочий розклад та моделі роботи водіїв.',
    usageContext: 'Вкладка «Режими роботи», таймлайни змін, планування',
    type: 'fill'
  },
  {
    name: 'stops',
    title: 'Зупинки',
    category: 'Сутності системи',
    description: 'Символ зупинкового пункту мережі громадського транспорту.',
    usageContext: 'Вкладка «Зупинки», список зупинок, деталі станції, карта',
    type: 'fill'
  },
  {
    name: 'depot',
    title: 'Депо / Парк',
    category: 'Сутності системи',
    description: 'Будівля автобусного чи тролейбусного парку (початок/кінець виходу).',
    usageContext: 'Рейси виїзду/заїзду в депо, нульові рейси в конструкторі',
    type: 'fill'
  },
  {
    name: 'plus',
    title: 'Додати (+)',
    category: 'Дії та кнопки',
    description: 'Створення або додавання нового об’єкта (зупинки, водія, напрямку, вузла).',
    usageContext: 'Кнопки швидких дій у навігації, створення записів, тулбар конструктора',
    type: 'stroke'
  },
  {
    name: 'trash',
    title: 'Видалити (Кошик)',
    category: 'Дії та кнопки',
    description: 'Символ видалення запису або активації режиму видалення.',
    usageContext: 'Кнопка «Видалити» в панелі дій, підтвердження видалення елементів',
    type: 'fill'
  },
  {
    name: 'pencil',
    title: 'Редагувати (Олівець)',
    category: 'Дії та кнопки',
    description: 'Символ зміни або редагування параметрів існуючого запису.',
    usageContext: 'Кнопка редагування водія, ТЗ, зупинки, сегмента графа',
    type: 'stroke'
  },
  {
    name: 'search',
    title: 'Пошук (Лупа)',
    category: 'Дії та кнопки',
    description: 'Поле глобального або локального текстового пошуку/фільтрації.',
    usageContext: 'Пошук по базі водіїв, транспорту, зупинок, номерів маршрутів',
    type: 'stroke'
  },
  {
    name: 'sort',
    title: 'Сортування',
    category: 'Дії та кнопки',
    description: 'Символ зміни порядку сортування колонок або списків.',
    usageContext: 'Заголовки таблиць, перемикачі сортування списків',
    type: 'stroke'
  },
  {
    name: 'assign-route',
    title: 'Призначити рейс',
    category: 'Дії та кнопки',
    description: 'Прив’язка обраного водія або машини до конкретного маршруту.',
    usageContext: 'Панель швидких дій «Призначити рейс» у розділах бази',
    type: 'fill'
  },
  {
    name: 'driver-add',
    title: 'Додати співробітника',
    category: 'Картки та форми',
    description: 'Контурний силует людини зі знаком плюс.',
    usageContext: 'Форма додавання нового водія / картка співробітника',
    type: 'stroke'
  },
  {
    name: 'driver-id',
    title: 'Посвідчення / ID',
    category: 'Картки та форми',
    description: 'Символ посвідчення водія або табельної карти співробітника.',
    usageContext: 'Поле посвідчення, профілі водіїв, табельні номери',
    type: 'stroke'
  },
  {
    name: 'phone',
    title: 'Телефон',
    category: 'Картки та форми',
    description: 'Контактний телефонний апарат для зв’язку з диспетчерською/водієм.',
    usageContext: 'Контактні картки, поля введення номера телефону',
    type: 'fill'
  },
  {
    name: 'email',
    title: 'Email (Пошта)',
    category: 'Картки та форми',
    description: 'Конверт для відображення або введення електронної адреси.',
    usageContext: 'Форми редагування профілю, контактна інформація',
    type: 'stroke'
  },
  {
    name: 'clock',
    title: 'Годинник / Час',
    category: 'Картки та форми',
    description: 'Циферблат для позначення часових інтервалів, рейсів чи тривалості.',
    usageContext: 'Час виїзду, час кола, час відстою, тривалість рейсу',
    type: 'stroke'
  },
  {
    name: 'mappin-and-ellipse',
    title: 'Маркер на карті',
    category: 'Карта та геодані',
    description: 'Географічний пін для позначення точного розташування точки.',
    usageContext: 'Координати зупинки, геопозиція на мапі Leaflet',
    type: 'fill'
  },
  {
    name: 'bed',
    title: 'Відпочинок / Нічліг',
    category: 'Графік та зміни',
    description: 'Символ ліжка для позначення міжзмінного або нічного відпочинку.',
    usageContext: 'Моделі режимів роботи, добові діаграми змін водіїв',
    type: 'fill'
  },
  {
    name: 'lunch',
    title: 'Обід / Перерва',
    category: 'Графік та зміни',
    description: 'Символ виделки та ложки для позначення обідньої перерви.',
    usageContext: 'Графіки розкладу, технологічні перерви на обід у зміні',
    type: 'fill'
  },
  {
    name: 'branch',
    title: 'Відгалуження маршруту',
    category: 'Конструктор маршрутів',
    description: 'Розгалуження колій або доріг на декілька напрямків у графі.',
    usageContext: 'Конструктор топології маршрутів, додавання бічної гілки',
    type: 'fill'
  },
  {
    name: 'finish-branch',
    title: 'Злиття / Кінець гілки',
    category: 'Конструктор маршрутів',
    description: 'Сходження відгалуження назад до основної гілки маршруту.',
    usageContext: 'Конструктор топології маршрутів, замикання кільця або гілки',
    type: 'fill'
  },
  {
    name: 'empty-chart',
    title: 'Порожні дані',
    category: 'Системні стани',
    description: 'Круглий перекреслений індикатор для блоків без даних.',
    usageContext: 'Віджети статистики, де немає активних рейсів або записів',
    type: 'fill'
  },
  {
    name: 'question-circle',
    title: 'Підказка / Довідка',
    category: 'Системні стани',
    description: 'Знак питання у колі для виклику контекстної довідки.',
    usageContext: 'Підказки до полів, довідкова інформація інтерфейсу',
    type: 'fill'
  },
  {
    name: 'chain-toggle',
    title: 'Перемикання ділянок',
    category: 'Конструктор маршрутів',
    description: 'Режим увімкнення та вимкнення ділянок (альтернатив чи основних рейок).',
    usageContext: 'Тулбар конструктора, тумблери ділянок на схемі та у списку',
    type: 'fill'
  },
  {
    name: 'split',
    title: 'Поділити проміжок',
    category: 'Конструктор маршрутів',
    description: 'Символ розділення активного часового проміжку доби на два окремих інтервали.',
    usageContext: 'Панель тайм-скрубера в конструкторі маршрутів',
    type: 'fill'
  },
  {
    name: 'pipette',
    title: 'Піпетка (Колір)',
    category: 'Дії та кнопки',
    description: 'Інструмент вибору довільного кольору лінії зі спектральної палітри.',
    usageContext: 'Майстер створення маршруту, панель параметрів маршруту',
    type: 'fill'
  },
  {
    name: 'rotate-180',
    title: 'Перевернути схему (180°)',
    category: 'Конструктор маршрутів',
    description: 'Поворот геометричної схеми кільця на 180 градусів для зворотного огляду.',
    usageContext: 'Верхній плаваючий тулбар швидких дій конструктора',
    type: 'stroke'
  },
  {
    name: 'table-view',
    title: 'Табличний вигляд',
    category: 'Навігація',
    description: 'Перемикання на табличне представлення розкладу, інтервалів та зупинок.',
    usageContext: 'Тулбар конструктора, кнопки дій картки маршруту',
    type: 'stroke'
  },
  {
    name: 'fit-to-screen',
    title: 'Центрувати схему',
    category: 'Навігація',
    description: 'Автоматичне центрування та скидання масштабу для огляду всього кільця.',
    usageContext: 'Верхня плаваюча панель картки перегляду маршруту',
    type: 'stroke'
  },
  {
    name: 'insert-before',
    title: 'Вставити перед кінцем',
    category: 'Конструктор маршрутів',
    description: 'Додавання нової контрольної точки перед поточною кінцевою точкою ділянки.',
    usageContext: 'Розгорнута капсула дії на рейці в конструкторі',
    type: 'fill'
  },
  {
    name: 'insert-after',
    title: 'Додати після кінця',
    category: 'Конструктор маршрутів',
    description: 'Додавання нової контрольної точки після завершення поточної ділянки.',
    usageContext: 'Розгорнута капсула дії на рейці в конструкторі',
    type: 'fill'
  },
  {
    name: 'eye',
    title: 'Показати елементи',
    category: 'Конструктор маршрутів',
    description: 'Відображення інженерних елементів редагування та маркерів додавання.',
    usageContext: 'Тулбар конструктора (кнопка чистого перегляду)',
    type: 'stroke'
  },
  {
    name: 'eye-slash',
    title: 'Приховати елементи',
    category: 'Конструктор маршрутів',
    description: 'Приховування кнопок редагування або підсвічування помилок для чистого перегляду.',
    usageContext: 'Тулбар конструктора, вікно зауважень та помилок валідації',
    type: 'stroke'
  },
  {
    name: 'sidebar-toggle',
    title: 'Сховати / показати меню',
    category: 'Навігація',
    description: 'Згортання правої бічної панелі налаштувань для повноекранного режиму.',
    usageContext: 'Кнопка у правому верхньому кутку конструктора топології',
    type: 'stroke'
  },
  {
    name: 'undo',
    title: 'Скасувати дію',
    category: 'Дії та кнопки',
    description: 'Скасування останньої виконаної операції на графічній схемі (Ctrl+Z).',
    usageContext: 'Верхній плаваючий тулбар конструктора, панель історії',
    type: 'stroke'
  },
  {
    name: 'redo',
    title: 'Повторити дію',
    category: 'Дії та кнопки',
    description: 'Повторення попередньо скасованої дії на схемі (Ctrl+Y / Ctrl+Shift+Z).',
    usageContext: 'Верхній плаваючий тулбар конструктора, панель історії',
    type: 'stroke'
  }
]

const searchQuery = ref('')
const selectedCategory = ref('Всі')
const copiedName = ref<string | null>(null)
const selectedIcons = ref<string[]>(iconsDocumentation.map(i => i.name as string))

const isGeneratingPdf = ref(false)
const pdfProgress = ref('')

const categories = computed(() => {
  const cats = new Set(iconsDocumentation.map(i => i.category))
  return ['Всі', ...Array.from(cats)]
})

const filteredIcons = computed(() => {
  return iconsDocumentation.filter(icon => {
    const matchesSearch = 
      icon.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      icon.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      icon.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      icon.usageContext.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesCat = selectedCategory.value === 'Всі' || icon.category === selectedCategory.value

    return matchesSearch && matchesCat
  })
})

const selectedIconsObjects = computed(() => {
  return iconsDocumentation.filter(i => selectedIcons.value.includes(i.name as string))
})

// Розбиття на окремі А4 сторінки для ідеального PDF
const pdfPages = computed(() => {
  const items = selectedIconsObjects.value
  const pages: IconDoc[][] = []
  const itemsPerPage = 7
  for (let i = 0; i < items.length; i += itemsPerPage) {
    pages.push(items.slice(i, i + itemsPerPage))
  }
  return pages
})

const isAllFilteredSelected = computed(() => {
  if (filteredIcons.value.length === 0) return false
  return filteredIcons.value.every(icon => selectedIcons.value.includes(icon.name as string))
})

const isSomeFilteredSelected = computed(() => {
  return filteredIcons.value.some(icon => selectedIcons.value.includes(icon.name as string)) && !isAllFilteredSelected.value
})

const toggleSelectAllFiltered = () => {
  if (isAllFilteredSelected.value) {
    const filteredNames = new Set(filteredIcons.value.map(i => i.name as string))
    selectedIcons.value = selectedIcons.value.filter(name => !filteredNames.has(name))
  } else {
    const newSelected = new Set(selectedIcons.value)
    filteredIcons.value.forEach(i => newSelected.add(i.name as string))
    selectedIcons.value = Array.from(newSelected)
  }
}

const selectAll = () => {
  selectedIcons.value = iconsDocumentation.map(i => i.name as string)
}

const deselectAll = () => {
  selectedIcons.value = []
}

const toggleIconSelection = (name: string) => {
  const idx = selectedIcons.value.indexOf(name)
  if (idx > -1) {
    selectedIcons.value.splice(idx, 1)
  } else {
    selectedIcons.value.push(name)
  }
}

const copySnippet = (name: string) => {
  const code = `<SvgIcon name="${name}" class="w-5 h-5" />`
  navigator.clipboard.writeText(code)
  copiedName.value = name
  setTimeout(() => {
    if (copiedName.value === name) {
      copiedName.value = null
    }
  }, 2000)
}

const currentDateFormatted = computed(() => {
  return new Date().toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
})

const exportToPdf = async () => {
  if (selectedIcons.value.length === 0) {
    alert('Будь ласка, оберіть хоча б один символ для завантаження PDF.')
    return
  }

  isGeneratingPdf.value = true
  pdfProgress.value = 'Ініціалізація...'

  try {
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 350))

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    })

    const pageElements = document.querySelectorAll<HTMLElement>('.pdf-export-page')
    if (!pageElements || pageElements.length === 0) {
      throw new Error('Не знайдено сторінок для експорту')
    }

    for (let i = 0; i < pageElements.length; i++) {
      pdfProgress.value = `Рендеринг сторінки ${i + 1} з ${pageElements.length}...`
      const pageEl = pageElements[i]
      
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1000
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      
      if (i > 0) {
        pdf.addPage('a4', 'portrait')
      }
      
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
    }

    pdfProgress.value = 'Збереження файлу...'
    const today = new Date().toISOString().slice(0, 10)
    pdf.save(`Dovidnyk_Symvoliv_Depo_${today}.pdf`)
  } catch (err: any) {
    console.error('Помилка генерації PDF:', err)
    alert(`Помилка генерації PDF: ${err?.message || 'Не вдалося створити файл'}. Відкриваємо вікно друку для збереження в PDF.`)
    window.print()
  } finally {
    isGeneratingPdf.value = false
    pdfProgress.value = ''
  }
}
</script>

<template>
  <div class="symbols-page min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 md:p-10 font-sans text-slate-800">
    
    <!-- Шапка сторінки -->
    <header class="max-w-7xl mx-auto mb-8">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <router-link
              to="/"
              class="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-700 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="На головну"
            >
              <SvgIcon name="arrow-left" class="w-4 h-4" />
            </router-link>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Довідник символів та іконок</h1>
          </div>
          <p class="text-slate-500 text-sm">
            Оберіть необхідні символи за допомогою чекбоксів та натисніть <strong>«Завантажити PDF»</strong> для збереження файлу на пристрій.
          </p>
        </div>

        <!-- Кнопка прямого завантаження PDF та лічильник -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="px-3.5 py-2 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl">
            Обрано: <span class="text-blue-600 font-bold">{{ selectedIcons.length }}</span> з {{ iconsDocumentation.length }}
          </div>

          <button
            @click="exportToPdf"
            :disabled="isGeneratingPdf || selectedIcons.length === 0"
            class="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 active:scale-95 text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
            title="Завантажити вибрані символи як файл PDF"
          >
            <svg v-if="!isGeneratingPdf" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <svg v-else class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>{{ isGeneratingPdf ? (pdfProgress || 'Генерація...') : 'Завантажити PDF' }}</span>
          </button>
        </div>
      </div>

      <!-- Панель керування вибором, пошуку та категорій -->
      <div class="mt-6 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        
        <!-- Ліва частина: Пошук та масовий вибір -->
        <div class="flex flex-wrap items-center gap-3 flex-1">
          <!-- Пошук -->
          <div class="relative flex-1 min-w-[240px] max-w-md">
            <SvgIcon name="search" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Пошук за назвою чи описом..."
              class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 shadow-sm transition"
            />
          </div>

          <!-- Швидкі кнопки вибору -->
          <div class="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              @click="selectAll"
              class="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Обрати всі ({{ iconsDocumentation.length }})
            </button>
            <div class="h-4 w-px bg-slate-200"></div>
            <button
              @click="deselectAll"
              class="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
            >
              Зняти вибір
            </button>
          </div>
        </div>

        <!-- Права частина: Категорії (пігулки) -->
        <div class="flex flex-wrap gap-1.5 items-center">
          <button
            v-for="cat in categories"
            :key="cat"
            @click="selectedCategory = cat"
            :class="[
              selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-xs font-medium'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            ]"
            class="px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
          >
            {{ cat }}
          </button>
        </div>

      </div>
    </header>

    <!-- Головна таблиця символів (Інтерактивна на екрані) -->
    <main class="max-w-7xl mx-auto">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                
                <!-- Чекбокс у шапці -->
                <th class="py-4 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    :checked="isAllFilteredSelected"
                    :indeterminate.prop="isSomeFilteredSelected"
                    @change="toggleSelectAllFiltered"
                    class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    title="Обрати всі відфільтровані"
                  />
                </th>

                <th class="py-4 px-3 w-10 text-center">№</th>
                <th class="py-4 px-4 w-32 sm:w-40">Символ</th>
                <th class="py-4 px-4 w-40 sm:w-48">Код (Key)</th>
                <th class="py-4 px-4 w-32">Категорія</th>
                <th class="py-4 px-4">Опис та призначення</th>
                <th class="py-4 px-4">Місця використання</th>
                <th class="py-4 px-4 w-36 text-right">Дія</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-sm">
              
              <tr 
                v-for="(item, idx) in filteredIcons" 
                :key="item.name"
                :class="selectedIcons.includes(item.name as string) ? 'bg-blue-50/20' : 'opacity-60 bg-slate-50/30'"
                class="hover:bg-slate-50/80 transition-colors group"
              >
                <!-- Чекбокс вибору -->
                <td class="py-4 px-3 text-center">
                  <input
                    type="checkbox"
                    :checked="selectedIcons.includes(item.name as string)"
                    @change="toggleIconSelection(item.name as string)"
                    class="w-4.5 h-4.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                  />
                </td>

                <!-- Номер -->
                <td class="py-4 px-3 text-center font-mono text-xs text-slate-400">
                  {{ idx + 1 }}
                </td>

                <!-- Превʼю -->
                <td class="py-4 px-4">
                  <div class="flex items-center gap-2">
                    <div class="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 shadow-2xs group-hover:scale-105 transition-transform">
                      <SvgIcon :name="item.name" class="w-5 h-5" />
                    </div>
                    <div class="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 hidden sm:flex items-center justify-center text-blue-600">
                      <SvgIcon :name="item.name" class="w-4 h-4" />
                    </div>
                  </div>
                </td>

                <!-- Назва та тип -->
                <td class="py-4 px-4">
                  <div class="font-bold text-slate-900 font-mono text-sm mb-0.5">
                    {{ item.name }}
                  </div>
                  <div class="text-xs text-slate-500 flex items-center gap-1.5">
                    <span 
                      :class="item.type === 'stroke' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'"
                      class="px-1.5 py-0.5 rounded text-[10px] font-semibold border"
                    >
                      {{ item.type === 'stroke' ? 'Stroke' : 'Fill' }}
                    </span>
                  </div>
                </td>

                <!-- Категорія -->
                <td class="py-4 px-4">
                  <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                    {{ item.category }}
                  </span>
                </td>

                <!-- Опис -->
                <td class="py-4 px-4 text-slate-700 font-medium">
                  <div class="text-slate-900 font-semibold text-xs mb-0.5">{{ item.title }}</div>
                  <div class="text-xs leading-relaxed text-slate-600">{{ item.description }}</div>
                </td>

                <!-- Де використовується -->
                <td class="py-4 px-4 text-xs text-slate-500">
                  {{ item.usageContext }}
                </td>

                <!-- Кнопка копіювання -->
                <td class="py-4 px-4 text-right">
                  <button
                    @click.stop="copySnippet(item.name as string)"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer shadow-2xs"
                    :class="copiedName === item.name 
                      ? 'bg-emerald-500 text-white border-emerald-600' 
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'"
                    title="Скопіювати Vue компонент"
                  >
                    <span>{{ copiedName === item.name ? 'Скопійовано!' : 'Код' }}</span>
                  </button>
                </td>
              </tr>

              <tr v-if="filteredIcons.length === 0">
                <td colspan="8" class="py-12 text-center text-slate-400">
                  Символів за запитом «{{ searchQuery }}» не знайдено
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- МОДАЛЬНЕ ВІКНО / КОНТЕЙНЕР ДЛЯ РЕНДЕРИНГУ ЧИСТОГО A4 PDF ДОКУМЕНТА -->
    <div 
      v-if="isGeneratingPdf"
      class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center p-4"
    >
      <div class="bg-white p-6 rounded-2xl shadow-2xl text-center max-w-sm w-full">
        <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-3"></div>
        <h3 class="text-lg font-bold text-slate-900 mb-1">Генерація PDF файлу</h3>
        <p class="text-sm text-slate-500">{{ pdfProgress || 'Будь ласка, зачекайте...' }}</p>
      </div>

      <!-- Внутрішній рендер сторінок для захоплення html2canvas (видимий під час генерації у фіксованому контейнері) -->
      <div class="pdf-render-wrapper opacity-0 pointer-events-none fixed top-0 left-0">
        <div 
          v-for="(pageItems, pageIdx) in pdfPages" 
          :key="pageIdx" 
          class="pdf-export-page"
          style="width: 794px; min-height: 1123px; padding: 40px; box-sizing: border-box; background-color: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; justify-content: space-between;"
        >
          <!-- Шапка сторінки -->
          <div>
            <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <div style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase;">
                  КП СМР «Електроавтотранс» (м. Суми)
                </div>
                <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 2px 0 0 0;">
                  Довідник символів та іконографіки системи
                </h2>
              </div>
              <div style="text-align: right; font-size: 10px; color: #64748b;">
                <div><strong>Дата:</strong> {{ currentDateFormatted }}</div>
                <div><strong>Сторінка:</strong> {{ pageIdx + 1 }} з {{ pdfPages.length }} (Елементи: {{ selectedIcons.length }})</div>
              </div>
            </div>

            <!-- Таблиця на сторінці -->
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
              <thead>
                <tr style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; font-weight: 700; color: #334155; font-size: 10px; text-transform: uppercase;">
                  <th style="padding: 8px 6px; width: 30px; text-align: center; border: 1px solid #cbd5e1;">№</th>
                  <th style="padding: 8px 8px; width: 64px; text-align: center; border: 1px solid #cbd5e1;">Символ</th>
                  <th style="padding: 8px 10px; width: 120px; border: 1px solid #cbd5e1;">Код (Key)</th>
                  <th style="padding: 8px 10px; width: 90px; border: 1px solid #cbd5e1;">Категорія</th>
                  <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">Опис та призначення</th>
                  <th style="padding: 8px 10px; width: 160px; border: 1px solid #cbd5e1;">Місця використання</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="(item, itemIdx) in pageItems" 
                  :key="item.name"
                  style="border-bottom: 1px solid #e2e8f0; vertical-align: middle; background-color: #ffffff;"
                >
                  <!-- Номер загальний -->
                  <td style="padding: 8px 6px; text-align: center; font-family: monospace; font-size: 10px; color: #64748b; border: 1px solid #cbd5e1;">
                    {{ (pageIdx * 7) + itemIdx + 1 }}
                  </td>

                  <!-- SVG іконка -->
                  <td style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">
                    <div style="width: 32px; height: 32px; margin: 0 auto; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #0f172a;">
                      <SvgIcon :name="item.name" class="w-5 h-5" />
                    </div>
                  </td>

                  <!-- Назва та тип -->
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">
                    <div style="font-family: monospace; font-weight: 700; font-size: 11px; color: #0f172a;">
                      {{ item.name }}
                    </div>
                    <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
                      Тип: <strong>{{ item.type === 'stroke' ? 'Stroke' : 'Fill' }}</strong>
                    </div>
                  </td>

                  <!-- Категорія -->
                  <td style="padding: 8px 10px; font-size: 10px; color: #334155; border: 1px solid #cbd5e1;">
                    {{ item.category }}
                  </td>

                  <!-- Опис -->
                  <td style="padding: 8px 10px; color: #1e293b; border: 1px solid #cbd5e1;">
                    <div style="font-weight: 700; font-size: 11px; color: #0f172a; margin-bottom: 2px;">
                      {{ item.title }}
                    </div>
                    <div style="font-size: 10px; line-height: 1.35; color: #475569;">
                      {{ item.description }}
                    </div>
                  </td>

                  <!-- Місця використання -->
                  <td style="padding: 8px 10px; font-size: 10px; color: #475569; border: 1px solid #cbd5e1; line-height: 1.3;">
                    {{ item.usageContext }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Підвал сторінки -->
          <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 16px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
            <div>КП СМР «Електроавтотранс» — Система диспетчеризації та візуалізації топології маршрутів</div>
            <div>Сторінка {{ pageIdx + 1 }} з {{ pdfPages.length }}</div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
@media print {
  @page {
    size: A4 portrait;
    margin: 10mm 10mm 12mm 10mm;
  }
}
</style>
