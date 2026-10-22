const useCloudNavigatorStore = defineStore(
  'cloud-navigator',
  {
    state: () => ({
      target: null
    }),
    actions: {
      setTarget(payload) {
        // payload: { url, builtUrl?, token? }
        this.target = payload
      },
      clearTarget() {
        this.target = null
      }
    }
  })

export default useCloudNavigatorStore
