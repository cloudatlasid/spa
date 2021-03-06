import axios      from 'axios'
import { Notify } from 'quasar'

export default ({app, router, Vue}) => {
  // Inform Google Analytics - injected only in netlify
  router.beforeEach((to, from, next) => {
    if (typeof ga !== 'undefined') {
      ga('set', 'page', to.path)
      ga('send', 'pageview')
    }
    next()
  })

  router.beforeEach((to, from, next) => {
    app.$global.body   = {}
    app.$global.errors = {}
    if (to.meta.unguarded) {
      // Allowed without auth
      next()
    }
    else {
      let token     = null,
          tawk_hash = null,
          user      = {}
      if (typeof app.$global.token === 'string') {
        token = app.$global.token
      }
      else if (app.$storage.has('token')) {
        token     = app.$storage.getItem('token')
        user      = app.$storage.getItem('user')
        tawk_hash = app.$storage.getItem('tawk_hash')

        app.$global.token     = token
        app.$global.user      = user
        app.$global.tawk_hash = tawk_hash

        axios.defaults.headers.common[ 'Authorization' ] = 'Bearer ' + token

        // @TODO enable token refresh
      }

      if (!token) {
        if (!to.meta.unguarded && to.path != '/logout') {
          app.$storage.set('afterLogin', to.path) // Save to get back to the link tried
        }

        Notify.create({
                        message: 'Please, login to start',
                        icon:    'mdi-security',
                        timeout: 2000,
                        type:    'info',
                      })

        next({path: '/login'})
      }
      else {
        next()
      }
    }
  })
};
