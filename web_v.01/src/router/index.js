import { createRouter, createWebHistory } from 'vue-router'
import WelcomeView from '../views/WelcomeView.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/login',
            name: 'login',
            component: () => import('../views/LoginView.vue'),
            meta: { public: true }
        },
        {
            path: '/',
            name: 'welcome',
            component: WelcomeView
        },
        {
            path: '/symbols',
            name: 'symbols',
            component: () => import('../views/SymbolsView.vue')
        },
        {
            path: '/base',
            name: 'base',
            component: () => import('../views/InfoView.vue'),
            children: [
                {
                    path: 'drivers',
                    component: () => import('@/components/drivers/DriversList.vue')
                },
                {
                    path: 'drivers/add',
                    name: 'driver-add',
                    component: () => import('@/components/drivers/AddDriver.vue')
                },
                {
                    path: 'drivers/:id',
                    name: 'driver-profile',
                    component: () => import('@/components/drivers/DriverProfile.vue'),
                    props: true
                },
                {
                    path: 'stops',
                    component: () => import('@/components/stops/StopsList.vue')
                },
                {
                    path: 'stops/:name',
                    name: 'stop-detail',
                    component: () => import('@/components/stops/StopDetail.vue'),
                    props: true
                },
                {
                    path: 'route',
                    component: () => import('@/components/routes/RouteList.vue')
                },
                {
                    path: 'route/:id',
                    name: 'route-detail',
                    component: () => import('@/modules/route-constructor/RouteConstructor.vue'),
                    props: true
                },
                {
                    path: 'route/create',
                    name: 'route-create',
                    component: () => import('@/modules/route-constructor/RouteConstructor.vue')
                },
                {
                    path: 'vehicle',
                    component: () => import('@/components/vehicles/VehicleList.vue')
                },
                {
                    path: 'wmode',
                    component: () => import('@/components/routes/WorkingModelList.vue')
                }
            ]
        }
    ]
})

// Навігаційний захист маршрутів (Auth Guard)
router.beforeEach((to, from, next) => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null
    const isAuthenticated = Boolean(token)

    // Якщо це публічна сторінка (наприклад, логін)
    if (to.meta.public || to.name === 'login') {
        if (isAuthenticated) {
            // Вже авторизований - повертаємо на головну
            return next('/')
        }
        return next()
    }

    // Для всіх інших сторінок потрібна авторизація
    if (!isAuthenticated) {
        return next({
            name: 'login',
            query: { redirect: to.fullPath }
        })
    }

    next()
})

export default router
