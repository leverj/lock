function Lock () {

  var next = typeof setImmediate === 'undefined' ? setTimeout : setImmediate

  var locked = {}

  function _releaser (key, exec) {
    return function (done) {
      return function () {
      _release(key, exec)
      if (done) done.apply(null, arguments)
      }
    }
  }

  function _release (key, exec) {
    var i = locked[key].indexOf(exec) //should usually be 0

    if(!~i) return

    locked[key].splice(i, 1)

    //note, that the next locker isn't triggered until next tick,
    //so it's always after the released callback
    if(isLocked(key))
      next(function () {
        locked[key][0](_releaser(key, locked[key][0]))
      })
    else
      delete locked[key]
  }

  function _lock(key, exec) {
    if(isLocked(key))
      return locked[key].push(exec), false
    return locked[key] = [exec], true
  }

  function lock(key, exec) {
    if(Array.isArray(key)) {
      var keys = key.length, locks = []
      var l = {}

      function releaser (done) {
        return function () {
          var args = [].slice.call(arguments)
          for(var key in l)
            _release(key, l[key])
          done.apply(this, args)
        }
      }

      key.forEach(function (key) {
        var n = 0

        function ready () {
          if(n++) return
          if(!--keys)
            //all the keys are ready!
            exec(releaser)
        }

        l[key] = ready
        if(_lock(key, ready)) ready()
      })

      return
    }

    if(_lock(key, exec))
      exec(_releaser(key, exec))
  }

  function isLocked (key) {
    return Array.isArray(locked[key]) ? !! locked[key].length : false
  }

  lock.isLocked = isLocked

  return lock
}

function AsyncLock() {
  const _lock = Lock()
  const fn    = async function (locks, exec) {
    let result
    const promise = new Promise((resolve, reject) => result = {resolve, reject})
    const unique  = [...new Set(locks)].sort()
    _lock(unique, function (release) {
      exec().then(result.resolve)
        .catch(result.reject)
        .finally(() => release(function (err) { if (err) result.reject(err) })())
    })
    return promise
  }
  fn.isLocked = _lock.isLocked
  return fn
}

module.exports = {Lock: Lock, AsyncLock: AsyncLock}