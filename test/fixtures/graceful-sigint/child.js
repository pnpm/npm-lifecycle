process.once('SIGINT', () => {
  console.log('cleanup started')
  setTimeout(() => {
    console.log('cleanup finished')
    process.exit(0)
  }, 200)
})
console.log('ready')
setInterval(() => {}, 1000)
