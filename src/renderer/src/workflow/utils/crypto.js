const decryptedData = (data) => {
  return window.electronAPI.workflow.decryptData(data)
}

export { decryptedData }
