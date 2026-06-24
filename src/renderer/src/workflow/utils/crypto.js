const encryptedData = (data) => {
  return window.electronAPI.workflow.encryptData(data)
}

const decryptedData = (data) => {
  return window.electronAPI.workflow.decryptData(data)
}

const verifyData = (data) => {
  return window.electronAPI.workflow.verifyData(data)
}

export { encryptedData, decryptedData, verifyData }
